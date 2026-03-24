import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HistorySidebar } from './HistorySidebar'

export function Header() {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <>
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
            boxShadow: '0 2px 8px rgba(99,85,224,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,0.85)',
            }} />
          </div>
          <span style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 13, fontWeight: 500,
            color: '#1e293b', letterSpacing: '0.01em',
          }}>
            Noosphere
          </span>
        </Link>

        <nav style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setHistoryOpen(true)}
            style={{
              color: '#94a3b8',
              fontSize: 13,
              fontFamily: 'DM Sans, sans-serif',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: 6,
              fontWeight: 400,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f8fafc'
              e.currentTarget.style.color = '#1e293b'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            History
          </button>
        </nav>
      </header>

      <HistorySidebar open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  )
}
