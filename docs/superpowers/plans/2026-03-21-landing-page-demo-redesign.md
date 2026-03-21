# Landing Page Redesign + Demo Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the landing page with a white theme and an auto-playing product walkthrough window (home → simulation → results loop), then delete DemoPage.

**Architecture:** A new `LandingDemoWindow` component drives its own `useEffect` timer loop through 3 phases (home input, simulation progress, results tabs), fully self-contained with display-only elements. `LandingPage` is fully rewritten in white theme. `DemoPage` is deleted after its mock data is extracted.

**Tech Stack:** React 18, TypeScript, React Router 6, inline styles (React.CSSProperties), Vite. No test framework — verification is done by running the dev server and visually inspecting.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/hooks/useMockSimulation.ts` | Modify | Export MOCK_SOURCES, MOCK_PERSONAS, MOCK_POSTS |
| `frontend/src/components/LandingDemoWindow.tsx` | Create | Self-contained auto-playing walkthrough component |
| `frontend/src/pages/LandingPage.tsx` | Full rewrite | White-theme landing page using LandingDemoWindow |
| `frontend/src/App.tsx` | Modify | Remove DemoPage route, add /demo redirect |
| `frontend/src/pages/DemoPage.tsx` | Delete | Removed after data extraction |
| `frontend/src/components/Header.tsx` | Minor polish | Hover states, spacing |
| `frontend/src/index.css` | Modify | Add @keyframes runClick |

---

## Task 1: Export mock data from useMockSimulation.ts

**Files:**
- Modify: `frontend/src/hooks/useMockSimulation.ts`

- [ ] **Step 1: Add `export` to MOCK_SOURCES, MOCK_PERSONAS, MOCK_POSTS**

  Open `frontend/src/hooks/useMockSimulation.ts`. Change lines 5, 20, 33:
  ```ts
  // Before
  const MOCK_SOURCES = [...]
  const MOCK_PERSONAS = [...]
  const MOCK_POSTS: Array<...> = [...]

  // After
  export const MOCK_SOURCES = [...]
  export const MOCK_PERSONAS = [...]
  export const MOCK_POSTS: Array<...> = [...]
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd /Users/taeyoungpark/Desktop/noosphere/frontend
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/hooks/useMockSimulation.ts
  git commit -m "refactor: export mock data arrays from useMockSimulation"
  ```

---

## Task 2: Add @keyframes runClick to index.css

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Append the keyframe after the existing `.cursor-blink` block**

  ```css
  /* ── 데모 Run 버튼 클릭 애니메이션 ──────────────────── */
  @keyframes runClick {
    0%   { transform: scale(1);    background: #1e293b; }
    40%  { transform: scale(0.96); background: #8070ff; }
    100% { transform: scale(1);    background: #1e293b; }
  }

  .run-btn-click {
    animation: runClick 200ms ease forwards;
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/src/index.css
  git commit -m "feat: add runClick keyframe animation for demo button"
  ```

---

## Task 3: Create LandingDemoWindow component

**Files:**
- Create: `frontend/src/components/LandingDemoWindow.tsx`

This component drives a 3-phase loop entirely via `useEffect` timers. All interior elements are display-only (`pointerEvents: 'none'` on the container). It imports mock data from `useMockSimulation.ts` and `MOCK_RESULTS` inline.

- [ ] **Step 1: Create the file with types and mock data**

  Create `frontend/src/components/LandingDemoWindow.tsx`:

  ```tsx
  import { useEffect, useState } from 'react'
  import { MOCK_SOURCES, MOCK_PERSONAS, MOCK_POSTS } from '../hooks/useMockSimulation'
  import { SOURCE_COLORS } from '../constants'
  import type { Platform, SocialPost } from '../types'

  // ── Mock results data (extracted from DemoPage before deletion) ──────────
  const MOCK_REPORT = {
    verdict: 'mixed' as const,
    segments: [
      { name: 'Hacker News',    sentiment: 'neutral'  as const, summary: 'Technical community engaged but skeptical. Strong interest in methodology and simulation fidelity.' },
      { name: 'Product Hunt',   sentiment: 'positive' as const, summary: 'Practitioners immediately connected with the pain point. Strong upvote potential.' },
      { name: 'Indie Hackers',  sentiment: 'positive' as const, summary: 'Highly favorable reception. IH users acutely aware of positioning risk.' },
      { name: 'Reddit r/startups', sentiment: 'neutral' as const, summary: 'Mixed reception with constructive skepticism.' },
      { name: 'LinkedIn',       sentiment: 'positive' as const, summary: 'Professional audience responded well to structured output and GTM framing.' },
    ],
  }

  const MOCK_ANALYSIS_EXCERPT = `## Market Analysis — Noosphere

  **Domain:** AI / Developer Tools · SaaS

  ### Executive Summary

  Noosphere enters a nascent but rapidly growing category of AI-driven market intelligence tools. The concept of simulating social reactions before launch resonates strongly with founders and product managers who have experienced costly positioning mistakes post-launch.

  ### Community Reception Overview

  Across all five simulated platforms, the overall reception was **cautiously optimistic**. Technical communities (Hacker News, r/startups) exhibited healthy skepticism around simulation fidelity, while practitioner communities (Product Hunt, Indie Hackers, LinkedIn) responded with enthusiasm.`

  const DEMO_INPUT = `Noosphere is an AI-powered market simulator that predicts real-world reactions to your product before you launch.

  Paste your landing page, pitch deck, or product description and Noosphere will:
  - Collect context from GitHub, arXiv, Hacker News, Reddit, and more
  - Generate 50+ AI personas representing your target audience
  - Run multi-round social simulations across 5 tech platforms
  - Deliver a structured analysis: verdict, sentiment by segment, key criticisms`

  const PLATFORM_LABELS: Record<Platform, string> = {
    hackernews: 'Hacker News',
    producthunt: 'Product Hunt',
    indiehackers: 'Indie Hackers',
    reddit_startups: 'Reddit r/startups',
    linkedin: 'LinkedIn',
  }

  type Phase = 'home' | 'simulate' | 'results'
  type ResultTab = 'report' | 'feed' | 'analysis'

  const SENTIMENT_COLOR: Record<string, string> = {
    positive: '#22c55e',
    neutral:  '#f59e0b',
    negative: '#ef4444',
  }
  ```

- [ ] **Step 2: Add the component body**

  Continue in the same file:

  ```tsx
  export function LandingDemoWindow() {
    const [phase, setPhase] = useState<Phase>('home')
    const [typedChars, setTypedChars] = useState(0)
    const [runClicked, setRunClicked] = useState(false)
    const [sources, setSources] = useState<typeof MOCK_SOURCES>([])
    const [personaCount, setPersonaCount] = useState(0)
    const [posts, setPosts] = useState<SocialPost[]>([])
    const [simRound, setSimRound] = useState(0)
    const [resultTab, setResultTab] = useState<ResultTab>('report')
    const [visible, setVisible] = useState(true)

    useEffect(() => {
      const timers: ReturnType<typeof setTimeout>[] = []
      let t = 0
      const at = (delay: number, fn: () => void) => {
        t += delay
        timers.push(setTimeout(fn, t))
      }

      // ── PHASE 1: Home ────────────────────────────────────────
      setPhase('home')
      setTypedChars(0)
      setRunClicked(false)
      setSources([])
      setPersonaCount(0)
      setPosts([])
      setSimRound(0)
      setResultTab('report')
      setVisible(true)

      // Typewriter: type first 80 chars one by one, then jump to full
      for (let i = 1; i <= 80; i++) {
        at(60, () => setTypedChars(i))
      }
      at(200, () => setTypedChars(DEMO_INPUT.length))

      // Run button click
      at(1200, () => setRunClicked(true))
      at(300, () => {
        setVisible(false) // fade out before phase transition
      })
      at(300, () => {
        setPhase('simulate')
        setVisible(true)
      })

      // ── PHASE 2: Simulation ──────────────────────────────────
      // Sources appear one by one (prepend, newest on top)
      MOCK_SOURCES.forEach((src, i) => {
        at(i === 0 ? 400 : 350, () => {
          setSources(prev => [src, ...prev])
        })
      })

      // Clear sources, start personas
      at(600, () => setSources([]))
      MOCK_PERSONAS.forEach((_, i) => {
        at(i === 0 ? 400 : 280, () => {
          setPersonaCount(prev => prev + 1)
        })
      })

      // Round 1 posts
      at(600, () => setSimRound(1))
      for (let i = 0; i < 6; i++) {
        const p = MOCK_POSTS[i]
        at(i === 0 ? 300 : 450, () => {
          setPosts(prev => [...prev, {
            id: `demo-1-${i}`,
            platform: p.platform,
            author_node_id: `n${i}`,
            author_name: p.author_name,
            content: p.content,
            action_type: p.action_type,
            round_num: 1,
            upvotes: 30 + Math.floor(i * 13),
            downvotes: i % 3 === 0 ? 1 : 0,
            parent_id: null,
          }])
        })
      }

      // Round 2 posts
      at(600, () => setSimRound(2))
      for (let i = 6; i < 10; i++) {
        const p = MOCK_POSTS[i % MOCK_POSTS.length]
        at(i === 6 ? 300 : 400, () => {
          setPosts(prev => [...prev, {
            id: `demo-2-${i}`,
            platform: p.platform,
            author_node_id: `n${i}`,
            author_name: p.author_name,
            content: p.content,
            action_type: p.action_type,
            round_num: 2,
            upvotes: 20 + Math.floor(i * 9),
            downvotes: 0,
            parent_id: null,
          }])
        })
      }

      // Transition to results
      at(800, () => setVisible(false))
      at(300, () => {
        setPhase('results')
        setResultTab('report')
        setVisible(true)
      })

      // ── PHASE 3: Results ─────────────────────────────────────
      at(3000, () => setResultTab('feed'))
      at(3000, () => setResultTab('analysis'))
      at(2500, () => setVisible(false))

      // Restart loop
      at(400, () => {
        setPhase('home')
        setTypedChars(0)
        setRunClicked(false)
        setSources([])
        setPersonaCount(0)
        setPosts([])
        setSimRound(0)
        setResultTab('report')
        setVisible(true)
        // Re-trigger by bumping a key — handled by parent via key prop or re-mount
      })

      return () => timers.forEach(clearTimeout)
    }, [])

    const displayText = DEMO_INPUT.slice(0, typedChars)
    const personaPct = Math.min(100, (personaCount / MOCK_PERSONAS.length) * 100)

    const containerStyle: React.CSSProperties = {
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
    }

    return (
      <div style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 4px 32px rgba(0,0,0,0.07)',
        background: '#fff',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {/* Top bar — no label, just dots */}
        <div style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '9px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fca5a5' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fcd34d' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#86efac' }} />
          {phase === 'simulate' && simRound > 0 && (
            <span style={{
              marginLeft: 'auto',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 10,
              color: '#94a3b8',
            }}>
              Round {simRound} · {posts.length} posts
            </span>
          )}
        </div>

        {/* Content area — fixed height, overflow hidden */}
        <div style={{ height: 420, overflow: 'hidden', ...containerStyle }}>
          {phase === 'home' && <HomePhase displayText={displayText} runClicked={runClicked} />}
          {phase === 'simulate' && (
            <SimulatePhase
              sources={sources}
              personaCount={personaCount}
              personaPct={personaPct}
              posts={posts}
              simRound={simRound}
            />
          )}
          {phase === 'results' && <ResultsPhase tab={resultTab} onTabChange={setResultTab} />}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 3: Add HomePhase sub-component**

  ```tsx
  function HomePhase({ displayText, runClicked }: { displayText: string; runClicked: boolean }) {
    return (
      <div style={{ padding: '32px 28px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 8px', color: '#0f172a' }}>
          How will the market react?
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 16px' }}>
          Describe your product and simulate real-world reactions across tech communities.
        </p>
        <div style={{
          width: '100%', padding: '12px 14px',
          fontSize: 12, border: '1.5px solid #8b5cf6',
          borderRadius: 10, resize: 'none',
          fontFamily: 'inherit', background: '#fff',
          lineHeight: 1.6, color: '#1e293b',
          boxShadow: '0 0 0 3px rgba(139,92,246,0.1)',
          minHeight: 120, whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {displayText}
          {displayText.length < 200 && (
            <span className="cursor-blink" style={{ display: 'inline' }} />
          )}
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['hackernews', 'producthunt', 'indiehackers', 'reddit_startups', 'linkedin'] as Platform[]).map(p => (
            <span key={p} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', fontSize: 11, borderRadius: 7,
              border: '1.5px solid #1e293b',
              background: '#1e293b', color: '#fff', fontWeight: 600,
            }}>
              {PLATFORM_LABELS[p]}
            </span>
          ))}
        </div>
        <button
          className={runClicked ? 'run-btn run-btn-click' : 'run-btn'}
          style={{
            marginTop: 16, padding: '11px 28px', fontSize: 13, fontWeight: 700,
            background: '#1e293b', color: '#fff',
            border: 'none', borderRadius: 9, cursor: 'default',
            letterSpacing: '-0.01em',
          }}
        >
          Run Simulation →
        </button>
      </div>
    )
  }
  ```

- [ ] **Step 4: Add SimulatePhase sub-component**

  ```tsx
  function SimulatePhase({
    sources, personaCount, personaPct, posts, simRound,
  }: {
    sources: typeof MOCK_SOURCES
    personaCount: number
    personaPct: number
    posts: SocialPost[]
    simRound: number
  }) {
    const showSources = sources.length > 0
    const showPersonas = sources.length === 0 && personaCount > 0 && simRound === 0
    const showPosts = simRound > 0

    return (
      <div style={{ padding: '20px 24px', height: '100%', overflowY: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#22c55e', flexShrink: 0,
            animation: 'pulse 1.5s infinite',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.02em' }}
            className={showPosts ? '' : 'cursor-blink'}
          >
            {showSources
              ? 'Searching sources...'
              : showPersonas
              ? `Generating personas — ${personaCount} / ${MOCK_PERSONAS.length}`
              : showPosts
              ? `Round ${simRound} · ${posts.length} posts`
              : 'Initializing...'}
          </span>
        </div>

        {showPersonas && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>
              <span>Building agent personas</span>
              <span>{personaCount} / {MOCK_PERSONAS.length}</span>
            </div>
            <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: 'linear-gradient(90deg, #6355e0, #8070ff)',
                width: `${personaPct}%`,
                transition: 'width 0.3s ease',
                boxShadow: '0 0 6px rgba(99,85,224,0.4)',
              }} />
            </div>
          </div>
        )}

        {showSources && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {sources.slice(0, 5).map((src, i) => (
              <div key={i} className="source-item" style={{
                padding: '7px 10px', borderRadius: 7,
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderLeft: `3px solid ${SOURCE_COLORS[src.source as keyof typeof SOURCE_COLORS] || '#94a3b8'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                    background: `${SOURCE_COLORS[src.source as keyof typeof SOURCE_COLORS] || '#94a3b8'}18`,
                    color: SOURCE_COLORS[src.source as keyof typeof SOURCE_COLORS] || '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    fontFamily: 'IBM Plex Mono, monospace',
                  }}>
                    {src.source}
                  </span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>
                  {src.title}
                </div>
              </div>
            ))}
          </div>
        )}

        {showPosts && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {posts.slice(-4).map(post => (
              <div key={post.id} className="post-item" style={{
                padding: '9px 12px', borderRadius: 8,
                border: '1px solid #e2e8f0', background: '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                    background: '#f1f5f9', color: '#475569',
                    textTransform: 'uppercase', fontFamily: 'IBM Plex Mono, monospace',
                  }}>
                    {post.platform.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b' }}>{post.author_name}</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#374151', lineHeight: 1.5 }}>
                  {post.content.slice(0, 100)}{post.content.length > 100 ? '...' : ''}
                </p>
                <div style={{ marginTop: 4, fontSize: 10, color: '#94a3b8' }}>▲ {post.upvotes}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 5: Add ResultsPhase sub-component**

  ```tsx
  function ResultsPhase({ tab, onTabChange }: { tab: ResultTab; onTabChange: (t: ResultTab) => void }) {
    const tabs: { id: ResultTab; label: string }[] = [
      { id: 'report',   label: 'Simulation' },
      { id: 'feed',     label: 'Social Feed' },
      { id: 'analysis', label: 'Analysis' },
    ]
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 16px' }}>
          {tabs.map(t => (
            <div key={t.id} style={{
              padding: '10px 14px', fontSize: 12, cursor: 'default',
              fontWeight: tab === t.id ? 600 : 400,
              borderBottom: tab === t.id ? '2px solid #1e293b' : '2px solid transparent',
              color: tab === t.id ? '#1e293b' : '#64748b',
              transition: 'color 0.15s, border-color 0.15s',
            }}>
              {t.label}
            </div>
          ))}
        </div>

        <div key={tab} className="tab-content" style={{ flex: 1, overflowY: 'hidden', padding: '16px 20px' }}>
          {tab === 'report' && (
            <div>
              {/* Verdict badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                  background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a',
                  fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase',
                }}>
                  Mixed
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>127 signals across 5 platforms</span>
              </div>
              {/* Sentiment by segment */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {MOCK_REPORT.segments.map(seg => (
                  <div key={seg.name} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 7,
                    border: '1px solid #e2e8f0', background: '#f8fafc',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: SENTIMENT_COLOR[seg.sentiment],
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', width: 130, flexShrink: 0 }}>
                      {seg.name}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
                      {seg.summary.slice(0, 60)}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'feed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { platform: 'producthunt', author: 'priya_builds', content: '🚀 This is exactly what I needed before my last launch. Would have saved me weeks of misaligned positioning. Upvoted!', upvotes: 54 },
                { platform: 'hackernews', author: 'rachel_cto', content: 'The technical implementation here is more interesting than the product surface suggests. LLM-based agent simulation with network effects modeled in?', upvotes: 89 },
                { platform: 'linkedin', author: 'Sarah K.', content: 'As a PM, the ability to stress-test messaging across different communities before launch is massive. The persona diversity feels real.', upvotes: 76 },
              ].map((post, i) => (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 8,
                  border: '1px solid #e2e8f0', background: '#fff',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                      background: '#f1f5f9', color: '#475569', textTransform: 'capitalize',
                      fontFamily: 'IBM Plex Mono, monospace',
                    }}>
                      {post.platform.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1e293b' }}>{post.author}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>▲ {post.upvotes}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{post.content}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'analysis' && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                Market Analysis — Noosphere
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                <strong style={{ color: '#475569' }}>Domain:</strong> AI / Developer Tools · SaaS
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Executive Summary</div>
              <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.65, margin: 0 }}>
                Noosphere enters a nascent but rapidly growing category of AI-driven market intelligence tools.
                The concept of simulating social reactions before launch resonates strongly with founders and product
                managers who have experienced costly positioning mistakes post-launch.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 6: Verify the component compiles**

  ```bash
  cd /Users/taeyoungpark/Desktop/noosphere/frontend
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/components/LandingDemoWindow.tsx
  git commit -m "feat: add LandingDemoWindow auto-playing walkthrough component"
  ```

---

## Task 4: Rewrite LandingPage.tsx

**Files:**
- Full rewrite: `frontend/src/pages/LandingPage.tsx`

The existing file is 745 lines of dark-theme code. Replace it entirely.

- [ ] **Step 1: Write the new LandingPage**

  Replace all contents of `frontend/src/pages/LandingPage.tsx`:

  ```tsx
  import { Link } from 'react-router-dom'
  import { LandingDemoWindow } from '../components/LandingDemoWindow'

  const platforms = [
    'Hacker News', 'Product Hunt', 'Indie Hackers',
    'Reddit r/startups', 'LinkedIn',
  ]

  const sources = [
    'GitHub', 'arXiv', 'Semantic Scholar',
    'Hacker News', 'Reddit', 'Product Hunt',
    'iTunes', 'Google Play', 'GDELT', 'Serper',
  ]

  const steps = [
    {
      num: '01',
      title: 'Gather signals',
      desc: 'Real-world context sourced from GitHub, arXiv, Hacker News, Semantic Scholar, and more — to ground the simulation in truth.',
    },
    {
      num: '02',
      title: 'Generate personas',
      desc: 'AI personas constructed with distinct biases, expertise levels, and platform-native behavior. Researchers, skeptics, early adopters.',
    },
    {
      num: '03',
      title: 'Read the verdict',
      desc: 'Multi-round simulation produces a structured report — sentiment by segment, criticism clusters, and concrete improvement suggestions.',
    },
  ]

  export function LandingPage() {
    return (
      <div style={{ background: '#f8fafc', color: '#1e293b', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>

        {/* ── Nav ── */}
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 48px', background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'linear-gradient(135deg, #6355e0, #8070ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99,85,224,0.3)',
            }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.85)' }} />
            </div>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 14, fontWeight: 500, color: '#1e293b' }}>
              Noosphere
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <a href="#how-it-works" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>How it works</a>
            <a href="#platforms"    style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>Platforms</a>
          </div>
          <Link to="/app" style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12, fontWeight: 500, color: '#fff',
            padding: '8px 18px', borderRadius: 7,
            background: '#1e293b', textDecoration: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Sign in →
          </Link>
        </nav>

        {/* ── Hero ── */}
        <section style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center', padding: '72px 24px 0',
          background: '#fff', borderBottom: '1px solid #f1f5f9',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '4px 14px', borderRadius: 100,
            background: '#f1f5f9', border: '1px solid #e2e8f0',
            marginBottom: 24,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6355e0' }} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10, letterSpacing: '0.1em', color: '#64748b',
              textTransform: 'uppercase' as const,
            }}>
              Pre-launch Intelligence
            </span>
          </div>

          <h1 style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 56, fontWeight: 600, lineHeight: 1.12,
            color: '#0f172a', margin: '0 0 18px',
            maxWidth: 680, letterSpacing: '-0.02em',
          }}>
            How will the market react{' '}
            <em style={{ fontStyle: 'italic', fontWeight: 300, color: '#94a3b8' }}>before</em>
            {' '}you launch?
          </h1>

          <p style={{
            fontSize: 17, lineHeight: 1.65, color: '#64748b',
            maxWidth: 520, margin: '0 0 36px',
          }}>
            Simulate real-world reactions across 5 tech communities — grounded in signals
            from GitHub, arXiv, and Hacker News.
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 48 }}>
            <Link to="/app" style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13, fontWeight: 500, color: '#fff',
              padding: '12px 26px', borderRadius: 9,
              background: '#1e293b', textDecoration: 'none',
              boxShadow: '0 2px 12px rgba(30,41,59,0.2)',
              transition: 'opacity 0.15s, transform 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              Get Started →
            </Link>
            <a href="#how-it-works" style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 13, color: '#64748b',
              padding: '11px 26px', borderRadius: 9,
              border: '1.5px solid #e2e8f0', textDecoration: 'none',
              transition: 'border-color 0.15s, color 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#1e293b' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b' }}
            >
              See how it works ↓
            </a>
          </div>

          {/* Auto-playing demo window */}
          <div style={{ width: '100%', maxWidth: 760, marginBottom: -1 }}>
            <LandingDemoWindow />
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" style={{ maxWidth: 860, margin: '0 auto', padding: '80px 24px' }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10, letterSpacing: '0.18em', color: '#94a3b8',
            textTransform: 'uppercase' as const, marginBottom: 32, textAlign: 'center',
          }}>
            How it works
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            {steps.map((step, i) => (
              <div key={step.num} style={{
                display: 'flex', alignItems: 'flex-start', gap: 28,
                padding: '28px 36px',
                borderBottom: i < steps.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                  color: '#94a3b8', letterSpacing: '0.06em',
                  flexShrink: 0, paddingTop: 2, minWidth: 26,
                }}>
                  {step.num}
                </span>
                <div style={{ width: 1, alignSelf: 'stretch', background: '#f1f5f9', flexShrink: 0 }} />
                <div style={{ flexShrink: 0, minWidth: 160 }}>
                  <span style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 18, fontWeight: 600, color: '#1e293b', lineHeight: 1.3,
                  }}>
                    {step.title}
                  </span>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: '#64748b', margin: 0, paddingTop: 2 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Platforms ── */}
        <section id="platforms" style={{
          maxWidth: 860, margin: '0 auto', padding: '0 24px 80px', textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10, letterSpacing: '0.18em', color: '#94a3b8',
            textTransform: 'uppercase' as const, marginBottom: 12,
          }}>
            Simulation platforms
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            {platforms.map(name => (
              <span key={name} style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
                color: '#475569', padding: '6px 14px',
                border: '1px solid #e2e8f0', borderRadius: 100,
                background: '#fff',
              }}>
                {name}
              </span>
            ))}
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10, letterSpacing: '0.18em', color: '#94a3b8',
            textTransform: 'uppercase' as const, marginBottom: 12, marginTop: 28,
          }}>
            Data sources
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {sources.map(name => (
              <span key={name} style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
                color: '#94a3b8', padding: '5px 12px',
                border: '1px solid #f1f5f9', borderRadius: 100,
                background: '#f8fafc',
              }}>
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{
          textAlign: 'center', padding: '72px 24px',
          background: '#fff', borderTop: '1px solid #e2e8f0',
        }}>
          <h2 style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 42, fontWeight: 600, lineHeight: 1.15,
            color: '#0f172a', margin: '0 0 14px',
            letterSpacing: '-0.02em',
          }}>
            Launch with{' '}
            <em style={{ fontStyle: 'italic', fontWeight: 300, color: '#94a3b8' }}>informed</em>
            {' '}conviction.
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: '#64748b', margin: '0 0 32px' }}>
            Run your first simulation in under 2 minutes. No credit card required.
          </p>
          <Link to="/app" style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13, fontWeight: 500, color: '#fff',
            padding: '13px 32px', borderRadius: 9,
            background: '#1e293b', textDecoration: 'none',
            boxShadow: '0 2px 12px rgba(30,41,59,0.2)',
            display: 'inline-block',
            transition: 'opacity 0.15s, transform 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Get Started →
          </Link>
        </section>

        {/* ── Footer ── */}
        <footer style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 48px', borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: '#94a3b8' }}>
            Noosphere
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#cbd5e1' }}>
            © 2026 · Pre-launch Intelligence
          </span>
        </footer>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd /Users/taeyoungpark/Desktop/noosphere/frontend
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 3: Start dev server and verify landing page renders**

  ```bash
  cd /Users/taeyoungpark/Desktop/noosphere/frontend
  npm run dev
  ```
  Open http://localhost:5173 — should show white-theme landing page with the auto-playing demo window in the hero. Check that:
  - Phase 1 (home): textarea types in, Run button clicks
  - Phase 2 (simulate): sources appear, persona bar fills, posts appear
  - Phase 3 (results): tabs switch automatically

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/pages/LandingPage.tsx
  git commit -m "feat: rewrite landing page with white theme and auto-playing demo window"
  ```

---

## Task 5: Update App.tsx — remove DemoPage, add redirect

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Edit App.tsx**

  ```tsx
  // Remove:
  import { DemoPage } from './pages/DemoPage'
  // Remove:
  <Route path="/demo" element={<DemoPage />} />

  // Add (keep Navigate already imported from react-router-dom):
  <Route path="/demo" element={<Navigate to="/" replace />} />
  ```

  Full updated file:
  ```tsx
  import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
  import { LandingPage }  from './pages/LandingPage'
  import { HomePage }     from './pages/HomePage'
  import { SimulatePage } from './pages/SimulatePage'
  import { ResultPage }   from './pages/ResultPage'
  import { HistoryPage }  from './pages/HistoryPage'

  export function App() {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/"          element={<LandingPage />} />
          <Route path="/app"       element={<HomePage />} />
          <Route path="/demo"      element={<Navigate to="/" replace />} />
          <Route path="/simulate/:simId" element={<SimulatePage />} />
          <Route path="/result/:simId"   element={<ResultPage />} />
          <Route path="/history"   element={<HistoryPage />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    )
  }
  ```

- [ ] **Step 2: Delete DemoPage.tsx**

  ```bash
  rm /Users/taeyoungpark/Desktop/noosphere/frontend/src/pages/DemoPage.tsx
  ```

- [ ] **Step 3: Verify TypeScript compiles and dev server starts**

  ```bash
  cd /Users/taeyoungpark/Desktop/noosphere/frontend
  npx tsc --noEmit && npm run dev
  ```
  Expected: no errors. Navigate to http://localhost:5173/demo — should redirect to `/`.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/App.tsx
  git add frontend/src/pages/DemoPage.tsx  # staged for deletion
  git commit -m "feat: remove DemoPage, redirect /demo to /"
  ```

---

## Task 6: Minor UI polish on Header and HomePage

**Files:**
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/pages/HomePage.tsx`

- [ ] **Step 1: Polish Header.tsx**

  Update `frontend/src/components/Header.tsx` — add hover state to History link and improve spacing:

  ```tsx
  import { Link, useLocation } from 'react-router-dom'

  export function Header() {
    const location = useLocation()
    return (
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 28px',
        borderBottom: '1px solid #e2e8f0',
        background: '#fff',
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #6355e0, #8070ff)',
            boxShadow: '0 2px 8px rgba(99,85,224,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.85)' }} />
          </div>
          <span style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 13, fontWeight: 500, color: '#1e293b',
          }}>
            Noosphere
          </span>
        </Link>
        <nav style={{ display: 'flex', gap: 4 }}>
          <Link to="/history" style={{
            color: location.pathname === '/history' ? '#1e293b' : '#94a3b8',
            fontSize: 13, fontFamily: 'DM Sans, sans-serif',
            textDecoration: 'none', padding: '6px 12px', borderRadius: 6,
            fontWeight: location.pathname === '/history' ? 600 : 400,
            transition: 'color 0.15s, background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#1e293b' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = location.pathname === '/history' ? '#1e293b' : '#94a3b8' }}
          >
            History
          </Link>
        </nav>
      </header>
    )
  }
  ```

- [ ] **Step 2: Polish HomePage.tsx run button label and error state**

  In `frontend/src/pages/HomePage.tsx`, find the run button and improve the disabled/loading visual slightly. Find the textarea and verify placeholder text is present. No structural changes — only minor style tweaks if needed. If the page looks clean already, skip this step.

- [ ] **Step 3: Verify dev server — navigate to /app and check Header and HomePage look correct**

  Open http://localhost:5173/app — Header should have the new logo shadow, History link with hover state.

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/src/components/Header.tsx frontend/src/pages/HomePage.tsx
  git commit -m "polish: improve Header hover states and active link styling"
  ```

---

## Task 7: Fix LandingDemoWindow loop (re-mount on loop end)

The current `useEffect` in `LandingDemoWindow` resets state at the end of the timer sequence, but a single `useEffect` can't re-trigger itself without a key change. Use a `loopCount` state to re-run the effect.

**Files:**
- Modify: `frontend/src/components/LandingDemoWindow.tsx`

- [ ] **Step 1: Add loopCount state and use it as useEffect dependency**

  ```tsx
  // Add to state declarations at top of LandingDemoWindow:
  const [loopCount, setLoopCount] = useState(0)

  // Change useEffect signature:
  useEffect(() => {
    // ... all existing timer logic ...
    // At the very end of the timer sequence, replace the manual reset with:
    at(400, () => setLoopCount(c => c + 1))

    return () => timers.forEach(clearTimeout)
  }, [loopCount])  // <-- add loopCount as dependency
  ```

  Remove the manual state reset lines that were at the end of the old `useEffect` (the ones setting `setPhase('home')`, `setTypedChars(0)`, etc. at the bottom). Instead, add them at the very top of the `useEffect` body (before the timer declarations) so they run on every loop restart:

  ```tsx
  useEffect(() => {
    // Reset all state for this loop iteration
    setPhase('home')
    setTypedChars(0)
    setRunClicked(false)
    setSources([])
    setPersonaCount(0)
    setPosts([])
    setSimRound(0)
    setResultTab('report')
    setVisible(true)

    const timers: ReturnType<typeof setTimeout>[] = []
    // ... rest of timer sequence ...
    at(400, () => setLoopCount(c => c + 1))
    return () => timers.forEach(clearTimeout)
  }, [loopCount])
  ```

- [ ] **Step 2: Verify loop works — watch 2 full cycles in browser**

  Open http://localhost:5173 and watch the demo window. It should loop smoothly from results back to the home typing phase without freezing.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/components/LandingDemoWindow.tsx
  git commit -m "fix: implement proper loop restart using loopCount effect dependency"
  ```

---

## Done

Final check:
- [ ] `http://localhost:5173` — landing page with white theme, demo window auto-playing
- [ ] `http://localhost:5173/demo` — redirects to `/`
- [ ] `http://localhost:5173/app` — HomePage unchanged, Header polished
- [ ] `npx tsc --noEmit` — zero errors
