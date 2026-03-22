import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { LandingDemoWindow } from '../components/LandingDemoWindow'

const SIMULATION_PLATFORMS = [
  'Hacker News', 'Product Hunt', 'Indie Hackers', 'Reddit r/startups', 'LinkedIn',
]

const DATA_SOURCES = [
  'GitHub', 'arXiv', 'Semantic Scholar', 'Hacker News',
  'Reddit', 'Product Hunt', 'iTunes', 'Google Play', 'GDELT', 'Serper',
]

const STEPS = [
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  return (
    <div style={{
      background: '#f8fafc',
      color: '#1e293b',
      minHeight: '100vh',
      fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <div ref={menuRef} style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <nav className="landing-nav" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 48px',
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'linear-gradient(135deg, #6355e0, #8070ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99,85,224,0.28)',
            }}>
              <div style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.85)' }} />
            </div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 14, fontWeight: 500, color: '#1e293b',
            }}>
              Noosphere
            </span>
          </div>

          <div className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <a href="#how-it-works" style={{
              fontSize: 13, color: '#64748b', textDecoration: 'none',
              transition: 'color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = '#1e293b')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
            >
              How it works
            </a>
            <a href="#platforms" style={{
              fontSize: 13, color: '#64748b', textDecoration: 'none',
              transition: 'color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = '#1e293b')}
              onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
            >
              Platforms
            </a>
          </div>

          <Link to="/app" className="landing-nav-signin" style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12, fontWeight: 500, color: '#fff',
            padding: '8px 18px', borderRadius: 7,
            background: '#1e293b', textDecoration: 'none',
            boxShadow: '0 1px 4px rgba(0,0,0,0.14)',
            transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.82')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Sign in →
          </Link>

          {/* 햄버거 버튼 */}
          <button
            className="landing-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={menuOpen}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 12, margin: -12,
              display: 'none',
              flexDirection: 'column', gap: 4,
            }}
          >
            <span style={{
              display: 'block', width: 20, height: 2, background: '#1e293b', borderRadius: 2,
              transition: 'transform 0.25s ease, opacity 0.25s ease',
              transform: menuOpen ? 'translateY(6px) rotate(45deg)' : 'none',
            }} />
            <span style={{
              display: 'block', width: 20, height: 2, background: '#1e293b', borderRadius: 2,
              transition: 'opacity 0.25s ease',
              opacity: menuOpen ? 0 : 1,
            }} />
            <span style={{
              display: 'block', width: 20, height: 2, background: '#1e293b', borderRadius: 2,
              transition: 'transform 0.25s ease, opacity 0.25s ease',
              transform: menuOpen ? 'translateY(-6px) rotate(-45deg)' : 'none',
            }} />
          </button>
        </nav>

        {/* 모바일 드롭다운 메뉴 */}
        <div className={`landing-mobile-menu${menuOpen ? ' open' : ''}`}>
          <div style={{ padding: '8px 0 12px' }}>
            <a
              href="#how-it-works"
              onClick={() => setMenuOpen(false)}
              style={{ display: 'block', padding: '10px 20px', fontSize: 14, color: '#475569', textDecoration: 'none' }}
            >
              How it works
            </a>
            <a
              href="#platforms"
              onClick={() => setMenuOpen(false)}
              style={{ display: 'block', padding: '10px 20px', fontSize: 14, color: '#475569', textDecoration: 'none' }}
            >
              Platforms
            </a>
            <Link
              to="/app"
              onClick={() => setMenuOpen(false)}
              style={{
                display: 'block', margin: '6px 16px 0', padding: '10px 18px',
                background: '#1e293b', color: '#fff', borderRadius: 8,
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 500,
                textDecoration: 'none', textAlign: 'center',
              }}
            >
              Sign in →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center',
        padding: '72px 24px 0',
        background: '#fff',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '4px 14px', borderRadius: 100,
          background: '#f1f5f9', border: '1px solid #e2e8f0',
          marginBottom: 22,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6355e0' }} />
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10, letterSpacing: '0.1em',
            color: '#64748b', textTransform: 'uppercase' as const,
          }}>
            Pre-launch Intelligence
          </span>
        </div>

        <h1 className="landing-hero-h1" style={{
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
          maxWidth: 500, margin: '0 0 36px',
        }}>
          Simulate real-world reactions across 5 tech communities — grounded in signals
          from GitHub, arXiv, and Hacker News.
        </p>

        <div className="landing-hero-cta" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 52 }}>
          <Link to="/app" style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13, fontWeight: 500, color: '#fff',
            padding: '12px 26px', borderRadius: 9,
            background: '#1e293b', textDecoration: 'none',
            boxShadow: '0 2px 12px rgba(30,41,59,0.18)',
            transition: 'opacity 0.15s, transform 0.15s',
            display: 'inline-block',
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.86'; e.currentTarget.style.transform = 'translateY(-1px)' }}
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
            display: 'inline-block',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#1e293b' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b' }}
          >
            See how it works ↓
          </a>
        </div>

        {/* Auto-playing walkthrough window */}
        <div style={{ width: '100%', maxWidth: 900, marginBottom: 48, textAlign: 'left' }}>
          <LandingDemoWindow />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" style={{
        maxWidth: 860, margin: '0 auto', padding: '80px 24px',
      }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10, letterSpacing: '0.18em',
          color: '#94a3b8', textTransform: 'uppercase' as const,
          marginBottom: 32, textAlign: 'center',
        }}>
          How it works
        </div>

        <div style={{
          border: '1px solid #e2e8f0', borderRadius: 12,
          overflow: 'hidden', background: '#fff',
        }}>
          {STEPS.map((step, i) => (
            <div key={step.num} className="landing-how-row" style={{
              display: 'flex', alignItems: 'flex-start', gap: 28,
              padding: '28px 36px',
              borderBottom: i < STEPS.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                color: '#94a3b8', letterSpacing: '0.06em',
                flexShrink: 0, paddingTop: 2, minWidth: 26,
              }}>
                {step.num}
              </span>
              <div className="landing-how-divider" style={{ width: 1, alignSelf: 'stretch', background: '#f1f5f9', flexShrink: 0 }} />
              <div className="landing-how-title" style={{ flexShrink: 0, minWidth: 160 }}>
                <span style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 18, fontWeight: 600,
                  color: '#1e293b', lineHeight: 1.3,
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

      {/* ── Platforms & Sources ───────────────────────────────────────── */}
      <section id="platforms" style={{
        maxWidth: 860, margin: '0 auto', padding: '0 24px 80px',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10, letterSpacing: '0.18em',
          color: '#94a3b8', textTransform: 'uppercase' as const,
          marginBottom: 14,
        }}>
          Simulation platforms
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {SIMULATION_PLATFORMS.map(name => (
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
          fontSize: 10, letterSpacing: '0.18em',
          color: '#94a3b8', textTransform: 'uppercase' as const,
          marginBottom: 14,
        }}>
          Data sources
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {DATA_SOURCES.map(name => (
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

      {/* ── CTA ──────────────────────────────────────────────────────── */}
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
          boxShadow: '0 2px 12px rgba(30,41,59,0.18)',
          display: 'inline-block',
          transition: 'opacity 0.15s, transform 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.86'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          Get Started →
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="landing-footer" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 48px', borderTop: '1px solid #e2e8f0',
        background: '#f8fafc',
      }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12, color: '#94a3b8',
        }}>
          Noosphere
        </span>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11, color: '#cbd5e1',
        }}>
          © 2026 · Pre-launch Intelligence
        </span>
      </footer>
    </div>
  )
}
