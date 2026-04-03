import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AppLogo } from './AppLogo'
import { HistorySidebar } from './HistorySidebar'
import { t } from '../tokens'

export function Header() {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${t.space[3]}px 28px`,
        borderBottom: `1px solid ${t.color.border}`,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky' as const,
        top: 0,
        zIndex: 50,
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
          <AppLogo size={24} />
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: t.font.size.md, fontWeight: t.font.weight.medium, color: t.color.textPrimary, letterSpacing: '0.01em' }}>
            Noosphere
          </span>
        </Link>

        <nav style={{ display: 'flex', gap: t.space[1] }}>
          <button
            onClick={() => setHistoryOpen(true)}
            className="header-nav-btn"
            style={{
              color: t.color.textMuted,
              fontSize: t.font.size.md,
              fontFamily: 'DM Sans, sans-serif',
              textDecoration: 'none',
              padding: '6px 12px',
              borderRadius: t.radius.sm,
              fontWeight: t.font.weight.normal,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
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
