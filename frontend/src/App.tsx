import { lazy, Suspense } from 'react'
import type { ComponentType } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

function lazyPage<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  importer: () => Promise<TModule>,
  exportName: TKey
) {
  return lazy(async () => {
    const module = await importer()
    return { default: module[exportName] as ComponentType }
  })
}

const LandingPage = lazyPage(() => import('./pages/LandingPage'), 'LandingPage')
const HomePage = lazyPage(() => import('./pages/HomePage'), 'HomePage')
const SimulatePage = lazyPage(() => import('./pages/SimulatePage'), 'SimulatePage')
const ResultPage = lazyPage(() => import('./pages/ResultPage'), 'ResultPage')
const HistoryPage = lazyPage(() => import('./pages/HistoryPage'), 'HistoryPage')

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/"                    element={<LandingPage />} />
          <Route path="/app"                 element={<HomePage />} />
          <Route path="/demo"                element={<Navigate to="/" replace />} />
          <Route path="/simulate/:simId"     element={<SimulatePage />} />
          <Route path="/result/:simId"       element={<ResultPage />} />
          <Route path="/history"             element={<HistoryPage />} />
          <Route path="*"                    element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
