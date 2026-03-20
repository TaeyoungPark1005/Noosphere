import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px', borderBottom: '1px solid #e2e8f0',
      background: '#fff',
    }}>
      <Link to="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
        <img src="/favicon.svg" alt="Noosphere" style={{ width: 24, height: 23 }} />
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.03em' }}>
          noosphere
        </span>
      </Link>
      <nav style={{ display: 'flex', gap: 16 }}>
        <Link to="/history" style={{ color: '#64748b', fontSize: 14, textDecoration: 'none' }}>
          History
        </Link>
      </nav>
    </header>
  )
}
