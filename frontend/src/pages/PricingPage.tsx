import { useEffect, useState } from 'react'
import type { ComponentType, PropsWithChildren } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { trackEvent } from '../cloud/analytics'
import { t } from '../tokens'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const PACKS = [
  {
    priceId: import.meta.env.VITE_STRIPE_PRICE_65CR as string,
    name: 'Starter',
    price: '$5',
    credits: 65,
    perSim: '~$0.08 / sim',
    highlight: false,
    desc: 'Try it out',
  },
  {
    priceId: import.meta.env.VITE_STRIPE_PRICE_260CR as string,
    name: 'Growth',
    price: '$20',
    credits: 260,
    perSim: '~$0.077 / sim',
    highlight: true,
    desc: 'Most popular',
  },
  {
    priceId: import.meta.env.VITE_STRIPE_PRICE_650CR as string,
    name: 'Pro',
    price: '$50',
    credits: 650,
    perSim: '~$0.077 / sim',
    highlight: false,
    desc: 'Best value',
  },
] as const

async function createCheckout(priceId: string, token: string): Promise<string> {
  const res = await fetch(`${API_BASE}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ price_id: priceId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? 'Checkout failed')
  }
  const data = await res.json()
  return (data as { url: string }).url
}

function PricingContent({ getToken }: { getToken: () => Promise<string | null> }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleBuy = async (priceId: string) => {
    if (!priceId) return
    setError(null)
    setLoading(priceId)
    try {
      const token = await getToken()
      if (!token) { navigate('/'); return }
      trackEvent('checkout_opened', { price_id: priceId })
      const url = await createCheckout(priceId, token)
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(null)
    }
  }

  return (
    <div style={{
      display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap',
      marginTop: 48,
    }}>
      {PACKS.map(pack => (
        <div key={pack.name} style={{
          width: 220, padding: '28px 24px', borderRadius: 14,
          border: pack.highlight ? `2px solid ${t.color.primaryVivid}` : `1.5px solid ${t.color.border}`,
          background: pack.highlight ? '#faf9ff' : t.color.bgPage,
          boxShadow: pack.highlight ? '0 4px 24px rgba(99,85,224,0.12)' : 'none',
          display: 'flex', flexDirection: 'column', gap: 12,
          position: 'relative',
        }}>
          {pack.highlight && (
            <div style={{
              position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
              background: t.color.primaryVivid, color: t.color.textInverse, fontSize: t.font.size.xs, fontWeight: t.font.weight.bold,
              padding: '3px 12px', borderRadius: 20, letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}>
              MOST POPULAR
            </div>
          )}
          <div>
            <div style={{ fontSize: t.font.size.md, fontWeight: t.font.weight.semibold, color: t.color.primaryVivid, marginBottom: 2 }}>
              {pack.name}
            </div>
            <div style={{ fontSize: t.font.size.xs, color: t.color.textMuted }}>{pack.desc}</div>
          </div>
          <div>
            <span style={{ fontSize: 32, fontWeight: 800, color: t.color.textPrimary, letterSpacing: '-0.03em' }}>
              {pack.price}
            </span>
            <span style={{ fontSize: t.font.size.md, color: t.color.textMuted, marginLeft: 4 }}>one-time</span>
          </div>
          <div style={{ fontSize: t.font.size.lg, color: t.color.textPrimary, fontWeight: t.font.weight.semibold }}>
            {pack.credits} credits
          </div>
          <div style={{ fontSize: t.font.size.sm, color: t.color.textMuted }}>{pack.perSim}</div>
          <button
            onClick={() => handleBuy(pack.priceId)}
            disabled={!!loading || !pack.priceId}
            style={{
              marginTop: 8, padding: '10px 0', borderRadius: t.radius.md, border: 'none',
              background: pack.highlight ? t.color.primaryVivid : t.color.textPrimary,
              color: t.color.textInverse, fontWeight: t.font.weight.semibold, fontSize: t.font.size.lg, cursor: loading || !pack.priceId ? 'not-allowed' : 'pointer',
              opacity: loading || !pack.priceId ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {!pack.priceId ? 'Unavailable' : loading === pack.priceId ? 'Redirecting…' : 'Buy now'}
          </button>
        </div>
      ))}
      {error && (
        <div style={{
          width: '100%', textAlign: 'center', fontSize: t.font.size.md, color: t.color.danger,
          marginTop: 8,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

function PricingPageInner() {
  const [searchParams] = useSearchParams()
  const status = searchParams.get('status')
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

  const [useAuth, setUseAuth] = useState<null | (() => { getToken: () => Promise<string | null>; isSignedIn?: boolean })>(null)
  const [SignInButton, setSignInButton] = useState<null | ComponentType<PropsWithChildren<{ mode?: 'modal' | 'redirect' }>>>(null)
  const [clerkError, setClerkError] = useState<string | null>(null)

  useEffect(() => {
    if (!clerkKey) return
    let active = true

    void import('@clerk/react')
      .then(mod => {
        if (!active) return
        setUseAuth(() => mod.useAuth as () => { getToken: () => Promise<string | null>; isSignedIn?: boolean })
        setSignInButton(() => mod.SignInButton as ComponentType<PropsWithChildren<{ mode?: 'modal' | 'redirect' }>>)
      })
      .catch(error => {
        console.error('Failed to load Clerk pricing components', error)
        if (active) setClerkError('Authentication is temporarily unavailable.')
      })

    return () => {
      active = false
    }
  }, [clerkKey])

  return (
    <div style={{ minHeight: '100vh', background: t.color.bgBody, fontFamily: 'DM Sans, sans-serif' }}>
      {/* Simple header */}
      <div style={{
        padding: `${t.space[4]} 28px`, borderBottom: `1px solid ${t.color.border}`, background: t.color.bgPage,
        display: 'flex', alignItems: 'center',
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #6355e0, #8070ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.85)' }} />
          </div>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: t.font.size.md, fontWeight: t.font.weight.medium, color: t.color.textPrimary }}>
            Noosphere
          </span>
        </Link>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '60px 24px' }}>
        {status === 'cancel' && (
          <div style={{
            padding: '14px 20px', borderRadius: 10, background: t.color.dangerLight,
            border: `1px solid ${t.color.dangerBorder}`, color: t.color.dangerDark, fontSize: t.font.size.lg,
            fontWeight: t.font.weight.medium, marginBottom: 32, textAlign: 'center',
          }}>
            Payment cancelled. No charge was made.
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: t.color.textPrimary, letterSpacing: '-0.03em', margin: 0 }}>
            Credits
          </h1>
          <p style={{ fontSize: 15, color: t.color.textSecondary, marginTop: 10 }}>
            One credit = one simulation run. No subscription, no expiry.
          </p>
        </div>

        {!clerkKey && (
          <div style={{ textAlign: 'center', marginTop: 48, color: t.color.textSecondary, fontSize: t.font.size.lg }}>
            Pricing is available only in cloud deployments with Clerk enabled.
          </div>
        )}
        {clerkError && (
          <div style={{ textAlign: 'center', marginTop: 48, color: t.color.danger, fontSize: t.font.size.lg }}>
            {clerkError}
          </div>
        )}
        {clerkKey && !clerkError && useAuth && SignInButton ? (
          <AuthGatedPricing useAuthHook={useAuth} SignInButton={SignInButton} />
        ) : clerkKey && !clerkError ? (
          <div style={{ textAlign: 'center', marginTop: 48, color: t.color.textMuted, fontSize: t.font.size.lg }}>
            Loading…
          </div>
        ) : null}
      </div>
    </div>
  )
}

function AuthGatedPricing({
  useAuthHook,
  SignInButton,
}: {
  useAuthHook: () => { getToken: () => Promise<string | null>; isSignedIn?: boolean }
  SignInButton: ComponentType<PropsWithChildren<{ mode?: 'modal' | 'redirect' }>>
}) {
  const { getToken, isSignedIn } = useAuthHook()

  if (!isSignedIn) {
    return (
      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <p style={{ color: t.color.textSecondary, fontSize: t.font.size.lg, marginBottom: 20 }}>
          Sign in to purchase credits.
        </p>
        <SignInButton mode="modal">
          <button style={{
            padding: '10px 28px', borderRadius: t.radius.md, border: 'none',
            background: t.color.textPrimary, color: t.color.textInverse, fontSize: t.font.size.lg,
            fontWeight: t.font.weight.semibold, cursor: 'pointer',
          }}>
            Sign in
          </button>
        </SignInButton>
      </div>
    )
  }

  return <PricingContent getToken={getToken} />
}

export function PricingPage() {
  return <PricingPageInner />
}
