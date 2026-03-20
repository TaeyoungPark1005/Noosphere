import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { SocialFeedView } from '../components/SocialFeedView'
import { PersonaCardView } from '../components/PersonaCardView'
import { ReportView } from '../components/ReportView'
import { getResults } from '../api'
import type { SimResults } from '../types'

type Tab = 'analysis' | 'report' | 'feed' | 'personas'

export function ResultPage() {
  const { simId } = useParams<{ simId: string }>()
  const navigate = useNavigate()
  const [results, setResults] = useState<SimResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('analysis')

  useEffect(() => {
    if (!simId) return
    getResults(simId)
      .then(setResults)
      .catch(e => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false))
  }, [simId])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'report', label: 'Simulation Report' },
    { id: 'feed', label: 'Social Feed' },
    { id: 'personas', label: 'Personas' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <Header />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <button onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14 }}>
            ← New simulation
          </button>
        </div>

        {loading && <p style={{ color: '#64748b' }}>Loading results...</p>}
        {error && <p style={{ color: '#ef4444' }}>{error}</p>}

        {results && (
          <>
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e2e8f0' }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{
                    padding: '10px 20px', fontSize: 14, cursor: 'pointer', border: 'none',
                    background: 'none', fontWeight: tab === t.id ? 600 : 400,
                    borderBottom: tab === t.id ? '2px solid #1e293b' : '2px solid transparent',
                    color: tab === t.id ? '#1e293b' : '#64748b',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'analysis' && (
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.7, color: '#1e293b' }}>
                {results.analysis_md || '_분석 보고서 없음_'}
              </div>
            )}
            {tab === 'report' && (
              <ReportView report={results.report_json} simId={simId!} />
            )}
            {tab === 'feed' && (
              <SocialFeedView posts={results.posts_json} />
            )}
            {tab === 'personas' && (
              <PersonaCardView personas={results.personas_json} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
