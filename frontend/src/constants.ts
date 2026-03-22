import type { Platform, ReportJSON } from './types'

export const SOURCE_COLORS: Record<string, string> = {
  arxiv:        '#a855f7',
  semantic_scholar: '#6366f1',
  hackernews:   '#f97316',
  reddit:       '#ef4444',
  github:       '#22c55e',
  product_hunt: '#ec4899',
  itunes:       '#fc3158',
  google_play:  '#01875f',
  gdelt:        '#eab308',
  serper:       '#0891b2',
  input_text:   '#64748b',
}

export const PLATFORM_COLORS: Record<Platform, string> = {
  hackernews:      '#f97316',
  producthunt:     '#ef4444',
  indiehackers:    '#8b5cf6',
  reddit_startups: '#b45309',
  linkedin:        '#2563eb',
}

export const PLATFORM_OPTIONS: Array<{ id: Platform; label: string; icon: string }> = [
  { id: 'hackernews',      label: 'Hacker News',       icon: '🟠' },
  { id: 'producthunt',     label: 'Product Hunt',      icon: '🔴' },
  { id: 'indiehackers',    label: 'Indie Hackers',     icon: '🟣' },
  { id: 'reddit_startups', label: 'Reddit r/startups',  icon: '🟤' },
  { id: 'linkedin',        label: 'LinkedIn',           icon: '🔵' },
]

type VerdictConfig = { color: string; label: string; emoji: string }

export const VERDICT_CONFIG: Record<ReportJSON['verdict'], VerdictConfig> = {
  positive:  { color: '#22c55e', label: 'Positive',  emoji: '✅' },
  mixed:     { color: '#f59e0b', label: 'Mixed',     emoji: '⚖️' },
  skeptical: { color: '#f97316', label: 'Skeptical', emoji: '🤔' },
  negative:  { color: '#ef4444', label: 'Negative',  emoji: '❌' },
}
