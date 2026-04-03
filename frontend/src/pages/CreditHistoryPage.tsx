// overrides/frontend/src/pages/CreditHistoryPage.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '../components/Header'
import { CreditModal } from '../components/CreditModal'
import { authenticatedFetch } from '../cloud/auth'
import { useCredits } from '../cloud/credits'
import { t } from '../tokens'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface LedgerItem {
  delta: number
  reason: string
  sim_id: string | null
  stripe_id: string | null
  created_at: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return iso
  }
}

function reasonLabel(item: LedgerItem): string {
  if (item.reason === 'stripe_refund') return 'Refund (payment reversed)'
  if (item.reason === 'refund') return 'Simulation refund'
  if (item.delta > 0) {
    const credits = item.delta
    if (credits >= 900) return `Pro plan top-up (+${credits})`
    if (credits >= 300) return `Growth plan top-up (+${credits})`
    if (credits >= 70) return `Starter plan top-up (+${credits})`
    return `Credits added (+${credits})`
  }
  return 'Simulation run'
}

export function CreditHistoryPage() {
  const { credits } = useCredits()
  const [items, setItems] = useState<LedgerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creditModalOpen, setCreditModalOpen] = useState(false)

  useEffect(() => {
    let active = true
    authenticatedFetch(`${API_BASE}/credits/history`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: { items: LedgerItem[] }) => { if (active) setItems(data.items) })
      .catch(() => { if (active) setItems([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: t.color.bgBody }}>
      <Header />
      <main style={{ maxWidth: 700, margin: '0 auto', padding: `${t.space[8]} ${t.space[6]} 80px` }}>
        {/* 페이지 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: t.font.weight.bold, margin: '0 0 4px', color: t.color.textPrimary }}>
              Credit History
            </h1>
            <p style={{ margin: 0, fontSize: t.font.size.md, color: t.color.textMuted }}>
              Balance: <strong style={{ color: t.color.textPrimary }}>{credits ?? '—'} ⚡</strong>
            </p>
          </div>
          <button
            onClick={() => setCreditModalOpen(true)}
            style={{
              padding: `${t.space[2]} 18px`, borderRadius: t.radius.md, border: 'none',
              background: t.color.primaryVivid, color: t.color.textInverse,
              fontSize: t.font.size.md, fontWeight: t.font.weight.semibold, cursor: 'pointer',
            }}
          >
            Add credits
          </button>
        </div>

        {/* 목록 */}
        {loading ? (
          <p style={{ color: t.color.textMuted, fontSize: t.font.size.lg }}>Loading...</p>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: t.color.textMuted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
            <p style={{ fontSize: t.font.size.lg, margin: 0 }}>No transactions yet.</p>
            <Link to="/app" style={{ fontSize: t.font.size.md, color: t.color.primaryVivid, marginTop: 8, display: 'inline-block' }}>
              Run your first simulation →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((item, i) => (
              <div
                key={i}
                style={{
                  background: t.color.bgPage, border: `1px solid ${t.color.border}`,
                  borderRadius: 10, padding: `14px ${t.space[4]}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: t.font.size.lg, fontWeight: t.font.weight.medium, color: t.color.textPrimary }}>
                    {reasonLabel(item)}
                  </div>
                  <div style={{ fontSize: t.font.size.sm, color: t.color.textMuted, marginTop: 3 }}>
                    {formatDate(item.created_at)}
                    {item.sim_id && (
                      <Link
                        to={`/result/${item.sim_id}`}
                        style={{ marginLeft: 8, color: t.color.primaryVivid, textDecoration: 'none' }}
                      >
                        View result →
                      </Link>
                    )}
                  </div>
                </div>
                <span style={{
                  fontSize: t.font.size.xl, fontWeight: t.font.weight.bold,
                  color: item.delta > 0 ? t.color.success : t.color.danger,
                }}>
                  {item.delta > 0 ? '+' : ''}{item.delta} ⚡
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      <CreditModal
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        reason="topup"
      />
    </div>
  )
}
