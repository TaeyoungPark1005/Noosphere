import type { Persona, Platform } from '../types'

const PLATFORM_LABELS: Record<Platform, string> = {
  hackernews: 'HN',
  producthunt: 'PH',
  indiehackers: 'IH',
  reddit_startups: 'Reddit',
  linkedin: 'LinkedIn',
}

const PLATFORM_COLORS: Record<Platform, string> = {
  hackernews:      '#ff6600',
  producthunt:     '#da552f',
  indiehackers:    '#4f46e5',
  reddit_startups: '#ff4500',
  linkedin:        '#0077b5',
}

const BIAS_COLORS: Record<string, string> = {
  academic:   '#6366f1',
  commercial: '#22c55e',
  skeptic:    '#f59e0b',
  evangelist: '#ec4899',
}

type PersonaWithPlatform = Persona & { platform: Platform }

export function PersonaCardView({ personas }: { personas: Partial<Record<Platform, Persona[]>> | null | undefined }) {
  const allPersonas: PersonaWithPlatform[] = Object.entries(personas ?? {}).flatMap(([platform, list]) =>
    (list ?? []).map(p => ({ ...p, platform: platform as Platform }))
  )

  if (allPersonas.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>👤</div>
        No personas generated yet.
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 12,
    }}>
      {allPersonas.map((p, i) => {
        const platformColor = PLATFORM_COLORS[p.platform] || '#64748b'
        const biasColor = BIAS_COLORS[p.bias] || '#64748b'
        const biasBg = biasColor + '15'
        const biasBorder = '1px solid ' + biasColor + '30'
        return (
          <div key={i} style={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            background: '#fff',
            overflow: 'hidden',
          }}>
            {/* Platform accent bar */}
            <div style={{ height: 3, background: platformColor }} />

            <div style={{ padding: 14 }}>
              {/* Avatar + Name/MBTI */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: platformColor + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: platformColor, flexShrink: 0,
                }}>
                  {p.name[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{p.name}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, flexShrink: 0, marginLeft: 4,
                      color: platformColor,
                    }}>
                      {PLATFORM_LABELS[p.platform] || p.platform}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.mbti}</div>
                </div>
              </div>

              {/* Role */}
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#475569' }}>{p.role}</p>

              {/* Bias tag */}
              <span style={{
                display: 'inline-block',
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                background: biasBg, color: biasColor, border: biasBorder,
                textTransform: 'capitalize',
              }}>{p.bias}</span>

              {/* Interests */}
              {p.interests.slice(0, 3).map((interest, j) => (
                <span key={j} style={{
                  display: 'inline-block', fontSize: 10, color: '#64748b',
                  background: '#f1f5f9', borderRadius: 4, padding: '1px 5px',
                  margin: '4px 2px 0',
                }}>{interest}</span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
