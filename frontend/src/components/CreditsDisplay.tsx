import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticatedFetch } from '../cloud/auth'
import { t } from '../tokens'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function fetchCredits(): Promise<number> {
  const res = await authenticatedFetch(`${API_BASE}/credits`)
  if (!res.ok) throw new Error('Failed to fetch credits')
  const data = await res.json()
  return data.credits as number
}

interface Props {
  /** Clerk getToken function from useAuth() — kept for API compatibility but unused internally */
  getToken?: () => Promise<string | null>
  /** Increment this to force a refetch (e.g. after sim_done) */
  refetchKey?: number
}

export function CreditsDisplay({ refetchKey }: Props) {
  const [credits, setCredits] = useState<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    async function loadCredits() {
      try {
        const nextCredits = await fetchCredits()
        if (active) setCredits(nextCredits)
      } catch {
        if (active) setCredits(null)
      }
    }

    void loadCredits()

    return () => {
      active = false
    }
  }, [refetchKey])

  if (credits === null) return null

  const low = credits <= 3
  return (
    <button
      onClick={() => navigate('/pricing')}
      title={low ? 'Low credits — top up' : `${credits} credits remaining`}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 20,
        border: `1.5px solid ${low ? t.color.dangerBorder : t.color.border}`,
        background: low ? '#fff1f2' : t.color.bgCard,
        color: low ? t.color.danger : t.color.textStrong,
        fontSize: t.font.size.md, fontWeight: t.font.weight.medium, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = low ? t.color.danger : t.color.textStrong
        e.currentTarget.style.color = low ? t.color.danger : t.color.textPrimary
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = low ? t.color.dangerBorder : t.color.border
        e.currentTarget.style.color = low ? t.color.danger : t.color.textStrong
      }}
    >
      <span style={{ fontSize: t.font.size.xs }}>⚡</span>
      {credits} cr
      {low && <span style={{ fontSize: t.font.size.xs }}>· Top up</span>}
    </button>
  )
}
