// frontend/src/components/OntologyGraph.tsx
import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { OntologyEntity, OntologyRelationship, OntologyData, ContextGraphData } from '../types'

const NODE_COLORS: Record<string, string> = {
  framework:      '#3b82f6',
  product:        '#22c55e',
  company:        '#f97316',
  technology:     '#a855f7',
  market_segment: '#eab308',
  pain_point:     '#ef4444',
  research:       '#14b8a6',
  standard:       '#94a3b8',
  concept:        '#c084fc',
  regulation:     '#92400e',
}

const EDGE_COLORS: Record<string, string> = {
  competes_with:   '#ef4444',
  integrates_with: '#22c55e',
  built_on:        '#3b82f6',
  targets:         '#f97316',
  addresses:       '#14b8a6',
  enables:         '#a855f7',
  regulated_by:    '#92400e',
  part_of:         '#94a3b8',
}

const EDGE_DASHED: Record<string, boolean> = {
  competes_with: true,
  regulated_by:  true,
}

const REL_LABEL: Record<string, string> = {
  competes_with:   'competes with',
  integrates_with: 'integrates with',
  built_on:        'built on',
  targets:         'targets',
  addresses:       'addresses',
  enables:         'enables',
  regulated_by:    'regulated by',
  part_of:         'part of',
}

interface GraphNode {
  id: string
  name: string
  type: string
  source_node_ids: string[]
  color: string
}

interface GraphLink {
  source: string
  target: string
  type: string
  color: string
}

// ── Side panel ────────────────────────────────────────────────────────────────

interface SidePanelProps {
  entity: OntologyEntity | null
  entities: OntologyEntity[]
  relationships: OntologyRelationship[]
  contextNodes: Array<{ id: string; title: string; source: string; url?: string }>
  onClose: () => void
}

function SidePanel({ entity, entities, relationships, contextNodes, onClose }: SidePanelProps) {
  const entityMap = useMemo(
    () => Object.fromEntries(entities.map(e => [e.id, e])),
    [entities]
  )

  if (!entity) return null

  const outgoing = relationships.filter(r => r.from === entity.id)
  const incoming = relationships.filter(r => r.to === entity.id)
  const sources = contextNodes.filter(n => entity.source_node_ids.includes(n.id))
  const totalConnections = outgoing.length + incoming.length

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 220,
      height: '100%', background: 'rgba(15,23,42,0.96)',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      padding: '14px 14px', overflowY: 'auto', zIndex: 10,
      backdropFilter: 'blur(8px)',
    }}>
      {/* Close */}
      <button onClick={onClose} style={{
        float: 'right', background: 'none', border: 'none',
        cursor: 'pointer', fontSize: 16, color: '#64748b',
        lineHeight: 1, padding: 0,
      }}>×</button>

      {/* Type badge */}
      <div style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
        background: (NODE_COLORS[entity.type] ?? '#94a3b8') + '28',
        border: '1px solid ' + (NODE_COLORS[entity.type] ?? '#94a3b8') + '60',
        color: NODE_COLORS[entity.type] ?? '#94a3b8',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
        textTransform: 'uppercase', marginBottom: 8,
      }}>
        {entity.type}
      </div>

      {/* Name */}
      <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3 }}>
        {entity.name}
      </h3>

      {/* Connection count */}
      {totalConnections > 0 && (
        <p style={{ margin: '0 0 14px', fontSize: 11, color: '#64748b' }}>
          {totalConnections} connection{totalConnections !== 1 ? 's' : ''}
        </p>
      )}

      {/* Outgoing relationships */}
      {outgoing.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {outgoing.map((r, i) => {
            const target = entityMap[r.to]
            if (!target) return null
            return (
              <div key={i} style={{
                padding: '6px 8px', borderRadius: 6, marginBottom: 4,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 10, color: EDGE_COLORS[r.type] ?? '#94a3b8', fontWeight: 600, marginBottom: 2 }}>
                  → {REL_LABEL[r.type] ?? r.type}
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>
                  {target.name}
                </div>
                <div style={{ fontSize: 10, color: '#475569' }}>
                  {target.type}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Incoming relationships */}
      {incoming.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {incoming.map((r, i) => {
            const src = entityMap[r.from]
            if (!src) return null
            return (
              <div key={i} style={{
                padding: '6px 8px', borderRadius: 6, marginBottom: 4,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, marginBottom: 2 }}>
                  ← {REL_LABEL[r.type] ?? r.type}
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 500 }}>
                  {src.name}
                </div>
                <div style={{ fontSize: 10, color: '#475569' }}>
                  {src.type}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* No connections */}
      {totalConnections === 0 && (
        <p style={{ fontSize: 11, color: '#475569', margin: '0 0 14px' }}>No mapped relationships</p>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
            Sources
          </div>
          {sources.map(s => (
            <div key={s.id} style={{ fontSize: 11, marginBottom: 4 }}>
              {s.url
                ? <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'none' }}>{s.title}</a>
                : <span style={{ color: '#94a3b8' }}>{s.title}</span>
              }
              <span style={{ color: '#475569', marginLeft: 4 }}>({s.source})</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface OntologyGraphProps {
  data: OntologyData
  contextNodes?: Array<{ id: string; title: string; source: string; url?: string }>
  width?: number
  autoSelectId?: string
}

export const OntologyGraph = memo(function OntologyGraph({ data, contextNodes = [], width, autoSelectId }: OntologyGraphProps) {
  const [selectedEntity, setSelectedEntity] = useState<OntologyEntity | null>(() =>
    autoSelectId ? (data.entities.find(e => e.id === autoSelectId) ?? null) : null
  )
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)

  useEffect(() => {
    if (autoSelectId) {
      setSelectedEntity(data.entities.find(e => e.id === autoSelectId) ?? null)
    }
  }, [autoSelectId, data.entities])

  const handleEngineStop = useCallback(() => {
    graphRef.current?.zoomToFit(400, 24)
  }, [])

  const graphNodes = useMemo<GraphNode[]>(() =>
    data.entities
      .filter(e => !hiddenTypes.has(e.type))
      .map(e => ({ ...e, color: NODE_COLORS[e.type] ?? '#94a3b8' })),
    [data.entities, hiddenTypes]
  )

  const graphData = useMemo(() => {
    const visibleIds = new Set(graphNodes.map(n => n.id))
    const links: GraphLink[] = data.relationships
      .filter(r => visibleIds.has(r.from) && visibleIds.has(r.to))
      .map(r => ({
        source: r.from,
        target: r.to,
        type: r.type,
        color: EDGE_COLORS[r.type] ?? '#cbd5e1',
      }))
    return { nodes: graphNodes, links }
  }, [graphNodes, data.relationships])

  // Nodes/edges connected to the selected entity
  const highlightSet = useMemo(() => {
    if (!selectedEntity) return null
    const nodes = new Set<string>([selectedEntity.id])
    const links = new Set<string>()
    data.relationships.forEach(r => {
      if (r.from === selectedEntity.id) { nodes.add(r.to); links.add(`${r.from}→${r.to}`) }
      if (r.to === selectedEntity.id)   { nodes.add(r.from); links.add(`${r.from}→${r.to}`) }
    })
    return { nodes, links }
  }, [selectedEntity, data.relationships])

  const usedTypes = useMemo(() => [...new Set(data.entities.map(e => e.type))], [data.entities])

  const toggleType = useCallback((type: string) => {
    setHiddenTypes(prev => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }, [])

  const getNodeColor = useCallback((node: GraphNode) => {
    if (!highlightSet) return node.color
    return highlightSet.nodes.has(node.id) ? node.color : node.color + '30'
  }, [highlightSet])

  const getLinkColor = useCallback((link: GraphLink) => {
    if (!highlightSet) return link.color
    const srcId = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source
    const tgtId = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target
    return highlightSet.links.has(`${srcId}→${tgtId}`) ? link.color : link.color + '25'
  }, [highlightSet])

  return (
    <div style={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{data.domain_summary}</p>
      </div>


      {/* Legend */}
      <div style={{ padding: '7px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        {usedTypes.map(type => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 4, fontSize: 11,
              border: '1.5px solid ' + (NODE_COLORS[type] ?? '#94a3b8'),
              background: hiddenTypes.has(type) ? '#fff' : (NODE_COLORS[type] ?? '#94a3b8'),
              color: hiddenTypes.has(type) ? (NODE_COLORS[type] ?? '#94a3b8') : '#fff',
              cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Graph */}
      <div style={{ position: 'relative', height: 300 }}>
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={width}
          height={300}
          warmupTicks={120}
          cooldownTicks={0}
          onEngineStop={handleEngineStop}
          nodeId="id"
          // @ts-expect-error ForceGraph2D generic node type mismatch
          nodeLabel={(node: GraphNode) => `${node.name} · ${node.type}`}
          // @ts-expect-error ForceGraph2D generic node type mismatch
          nodeColor={getNodeColor}
          nodeRelSize={6}
          linkColor={getLinkColor}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          // @ts-expect-error linkLineDash not in typings but supported at runtime
          linkLineDash={(link: GraphLink) => EDGE_DASHED[link.type] ? [4, 2] : undefined}
          onNodeClick={(node: unknown) => {
            const n = node as GraphNode
            const entity = data.entities.find(e => e.id === n.id)
            setSelectedEntity(prev => prev?.id === n.id ? null : (entity ?? null))
          }}
          backgroundColor="#f8fafc"
        />
        {selectedEntity && (
          <SidePanel
            entity={selectedEntity}
            entities={data.entities}
            relationships={data.relationships}
            contextNodes={contextNodes}
            onClose={() => setSelectedEntity(null)}
          />
        )}
      </div>
    </div>
  )
})

// ── ContextGraph ───────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  arxiv:        '#a855f7',
  s2:           '#6366f1',
  hackernews:   '#f97316',
  reddit:       '#ef4444',
  github:       '#22c55e',
  product_hunt: '#ec4899',
  gdelt:        '#eab308',
  input_text:   '#64748b',
}

function getSourceColor(source: string): string {
  for (const [key, color] of Object.entries(SOURCE_COLORS)) {
    if (source.startsWith(key) || source === key) return color
  }
  return '#94a3b8'
}

interface ContextGraphProps {
  data: ContextGraphData
  width?: number
}

export const ContextGraph = memo(function ContextGraph({ data, width }: ContextGraphProps) {
  // 1. 소스 목록 (legend용)
  const usedSources = useMemo(
    () => [...new Set(data.nodes.map(n => n.source.split(':')[0]))],
    [data.nodes]
  )

  // 2. 숨겨진 소스 (legend 토글용)
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set())
  const toggleSource = useCallback((src: string) => {
    setHiddenSources(prev => {
      const next = new Set(prev)
      next.has(src) ? next.delete(src) : next.add(src)
      return next
    })
  }, [])

  // 3. hover된 엣지 (강조용)
  const [hoveredLink, setHoveredLink] = useState<string | null>(null) // "sourceId→targetId"

  // 4. graphData (filtered)
  const graphNodes = useMemo(() =>
    data.nodes
      .filter(n => !hiddenSources.has(n.source.split(':')[0]))
      .map(n => ({
        ...n,
        color: getSourceColor(n.source.split(':')[0]),
      })),
    [data.nodes, hiddenSources]
  )

  const graphData = useMemo(() => {
    const visibleIds = new Set(graphNodes.map(n => n.id))
    const links = data.edges
      .filter(e => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map(e => ({
        source: e.source,
        target: e.target,
        weight: e.weight,
        label: e.label,
      }))
    return { nodes: graphNodes, links }
  }, [graphNodes, data.edges])

  const graphRef = useRef<any>(null)
  const handleEngineStop = useCallback(() => {
    graphRef.current?.zoomToFit(400, 24)
  }, [])

  // 5. 노드 클릭 → URL 이동
  const handleNodeClick = useCallback((node: any) => {
    if (node.url) window.open(node.url, '_blank', 'noreferrer')
  }, [])

  // 6. 링크 색깔 (hover 시 강조)
  const getLinkColor = useCallback((link: any) => {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target
    const key = `${srcId}→${tgtId}`
    return hoveredLink === key ? '#f1f5f9' : 'rgba(148,163,184,0.3)'
  }, [hoveredLink])

  const getLinkWidth = useCallback((link: any) => {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target
    const key = `${srcId}→${tgtId}`
    return hoveredLink === key ? 2.5 : 1
  }, [hoveredLink])

  // 7. hover된 엣지 label 표시용 상태
  const [hoveredLinkLabel, setHoveredLinkLabel] = useState<string | null>(null)

  const handleLinkHover = useCallback((link: any) => {
    if (!link) {
      setHoveredLink(null)
      setHoveredLinkLabel(null)
      return
    }
    const srcId = typeof link.source === 'object' ? link.source.id : link.source
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target
    setHoveredLink(`${srcId}→${tgtId}`)
    setHoveredLinkLabel(link.label || null)
  }, [])

  return (
    <div style={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#f8fafc' }}>
      {/* Legend */}
      <div style={{ padding: '7px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        {usedSources.map(src => {
          const color = getSourceColor(src)
          const hidden = hiddenSources.has(src)
          return (
            <button
              key={src}
              onClick={() => toggleSource(src)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 4, fontSize: 11,
                border: `1.5px solid ${color}`,
                background: hidden ? '#fff' : color,
                color: hidden ? color : '#fff',
                cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
              }}
            >
              {src}
            </button>
          )
        })}
      </div>

      {/* Hover label tooltip */}
      {hoveredLinkLabel && (
        <div style={{
          position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.9)', color: '#e2e8f0',
          padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
          pointerEvents: 'none', zIndex: 20,
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(4px)',
        }}>
          {hoveredLinkLabel}
        </div>
      )}

      {/* Graph */}
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={320}
        warmupTicks={120}
        cooldownTicks={0}
        onEngineStop={handleEngineStop}
        nodeId="id"
        nodeLabel={(node: any) => `${node.title}\n${node.source}`}
        nodeColor={(node: any) => node.color}
        nodeRelSize={5}
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        onLinkHover={handleLinkHover}
        onNodeClick={handleNodeClick}
        backgroundColor="#f8fafc"
      />
    </div>
  )
})
