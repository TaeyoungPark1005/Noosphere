import { useState, useEffect, useRef } from 'react'
import { authenticatedFetch } from '../cloud/auth'
import { useCredits } from '../cloud/credits'
import { t } from '../tokens'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const PACKS = [
  {
    priceId: import.meta.env.VITE_STRIPE_PRICE_65CR as string,
    name: 'Starter',
    price: '$10',
    credits: 70,
    perSim: '~$0.14/sim',
    highlight: false,
  },
  {
    priceId: import.meta.env.VITE_STRIPE_PRICE_260CR as string,
    name: 'Growth',
    price: '$40',
    credits: 300,
    perSim: '~$0.13/sim',
    highlight: true,
  },
  {
    priceId: import.meta.env.VITE_STRIPE_PRICE_650CR as string,
    name: 'Pro',
    price: '$100',
    credits: 900,
    perSim: '~$0.11/sim',
    highlight: false,
  },
] as const

interface Props {
  open: boolean
  onClose: () => void
  /** 'insufficient' = 크레딧 부족으로 시뮬레이션 막힘, 'topup' = 직접 충전 클릭 */
  reason?: 'insufficient' | 'topup'
}

export function CreditModal({ open, onClose, reason = 'topup' }: Props) {
  const { credits } = useCredits()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // ESC 닫기
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // 열릴 때마다 에러 초기화
  useEffect(() => { if (open) setError(null) }, [open])

  if (!open) return null

  const handleBuy = async (priceId: string) => {
    if (!priceId) return
    setError(null)
    setLoading(priceId)
    try {
      const res = await authenticatedFetch(`${API_BASE}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_id: priceId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(err.detail ?? 'Checkout failed')
      }
      const data = await res.json() as { url: string }
      setLoading(null)
      window.location.assign(data.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(null)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: t.space[4],
      }}
    >
      <div style={{
        background: t.color.bgPage, borderRadius: t.radius.xl,
        padding: '28px 28px 24px',
        width: '100%', maxWidth: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: t.font.size.xl, fontWeight: t.font.weight.bold, color: t.color.textPrimary, marginBottom: 6 }}>
            {reason === 'insufficient' ? 'Not enough credits' : 'Top up credits'}
          </div>
          <div style={{ fontSize: t.font.size.md, color: t.color.textSecondary }}>
            {reason === 'insufficient'
              ? `1 credit per simulation. Current balance: ${credits ?? 0} cr`
              : `Current balance: ${credits ?? 0} cr · 1 credit = 1 simulation. Never expires.`}
          </div>
        </div>

        {/* 플랜 카드 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: t.space[2] }}>
          {PACKS.map(pack => (
            <button
              key={pack.name}
              onClick={() => void handleBuy(pack.priceId)}
              disabled={!!loading || !pack.priceId}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: t.radius.lg,
                border: pack.highlight ? `2px solid ${t.color.primaryVivid}` : `1.5px solid ${t.color.border}`,
                background: pack.highlight ? t.color.accentSurface : t.color.bgPage,
                cursor: loading || !pack.priceId ? 'not-allowed' : 'pointer',
                opacity: loading && loading !== pack.priceId ? 0.5 : 1,
                transition: 'all 0.15s',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: t.font.size.md, fontWeight: t.font.weight.bold, color: pack.highlight ? t.color.primaryVivid : t.color.textPrimary }}>
                    {pack.name}
                  </span>
                  {pack.highlight && (
                    <span style={{
                      fontSize: t.font.size.xs, fontWeight: t.font.weight.bold, color: t.color.textInverse,
                      background: t.color.primaryVivid, padding: '1px 7px', borderRadius: t.radius.lg,
                    }}>
                      Best value
                    </span>
                  )}
                </div>
                <div style={{ fontSize: t.font.size.xs, color: t.color.textMuted, marginTop: 2 }}>
                  {pack.credits} credits
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: t.color.textPrimary }}>
                  {loading === pack.priceId ? '…' : pack.price}
                </div>
                <div style={{ fontSize: t.font.size.xs, color: t.color.textMuted }}>one-time</div>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <p style={{ fontSize: t.font.size.sm, color: t.color.danger, textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
            {error}
          </p>
        )}

        <button
          onClick={onClose}
          style={{
            display: 'block', width: '100%', marginTop: 14,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: t.font.size.sm, color: t.color.textMuted, textAlign: 'center',
            padding: t.space[1],
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
