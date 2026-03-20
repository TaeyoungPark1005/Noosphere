import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { useSimulation } from '../hooks/useSimulation'
import type { Platform, SocialPost } from '../types'

const PLATFORM_LABELS: Record<Platform, string> = {
  hackernews: 'Hacker News',
  producthunt: 'Product Hunt',
  indiehackers: 'Indie Hackers',
  reddit_startups: 'Reddit r/startups',
  linkedin: 'LinkedIn',
}

export function SimulatePage() {
  const { simId } = useParams<{ simId: string }>()
  const navigate = useNavigate()
  const sim = useSimulation(simId!)

  useEffect(() => {
    if (sim.status === 'done' && simId) {
      navigate(`/result/${simId}`)
    }
  }, [sim.status, simId, navigate])

  const progressMessages = sim.events
    .filter(e => e.type === 'sim_progress')
    .map(e => (e as { type: 'sim_progress'; message: string }).message)

  const recentPosts: SocialPost[] = Object.values(sim.postsByPlatform)
    .flatMap(posts => posts ?? [])
    .slice(-10)
    .reverse()

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <Header />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          {sim.status !== 'error' && (
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: '#22c55e',
              animation: 'pulse 1.5s infinite',
            }} />
          )}
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
            {sim.status === 'connecting' ? 'Connecting...' :
             sim.status === 'error' ? 'Simulation failed' :
             `Round ${sim.roundNum} — ${sim.agentCount} agents`}
          </h2>
        </div>

        {sim.status === 'error' && (
          <p style={{ color: '#ef4444' }}>{sim.errorMsg}</p>
        )}

        {progressMessages.length > 0 && (
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
            {progressMessages[progressMessages.length - 1]}
          </p>
        )}

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          {recentPosts.map(post => (
            <div key={post.id} style={{
              padding: '10px 0', borderBottom: '1px solid #f1f5f9',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: '#f1f5f9', color: '#64748b',
                }}>
                  {PLATFORM_LABELS[post.platform] || post.platform}
                </span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{post.author_name}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{post.action_type}</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: '#1e293b' }}>{post.content}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
