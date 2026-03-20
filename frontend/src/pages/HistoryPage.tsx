import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { getHistory } from '../api'
import type { HistoryItem } from '../types'

const STATUS_CONFIG = {
  completed: { color: '#22c55e', label: 'Done' },
  running: { color: '#f59e0b', label: 'Running' },
  failed: { color: '#ef4444', label: 'Failed' },
}

export function HistoryPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHistory()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <Header />
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Simulation History</h1>

        {loading && <p style={{ color: '#64748b' }}>Loading...</p>}
        {!loading && items.length === 0 && (
          <p style={{ color: '#64748b' }}>No simulations yet. <a href="/">Run one →</a></p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => {
            const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.failed
            const date = new Date(item.created_at).toLocaleDateString()

            return (
              <div
                key={item.id}
                onClick={() => item.status === 'completed' && navigate(`/result/${item.id}`)}
                style={{
                  padding: 16, borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#fff', cursor: item.status === 'completed' ? 'pointer' : 'default',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => {
                  if (item.status === 'completed')
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#1e293b'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#1e293b', flex: 1 }}>
                    {item.input_text_snippet}…
                  </p>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: `${status.color}20`, color: status.color,
                    marginLeft: 12, whiteSpace: 'nowrap',
                  }}>{status.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                  <span>{date}</span>
                  <span>{item.language}</span>
                  {item.domain && <span>{item.domain}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
