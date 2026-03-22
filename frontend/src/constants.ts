import type { Platform, ReportJSON } from './types'

export const SOURCE_COLORS: Record<string, string> = {
  arxiv:            '#7B2D8E', // 짙은 보라
  semantic_scholar: '#1D4ED8', // 로열 블루
  hackernews:       '#FF6B35', // 주황
  reddit:           '#C5283D', // 크림슨
  github:           '#15803D', // 포레스트 그린
  product_hunt:     '#EC4899', // 핫핑크
  itunes:           '#F59E0B', // 앰버
  google_play:      '#14B8A6', // 틸
  gdelt:            '#84CC16', // 라임
  serper:           '#0891B2', // 시안
  input_text:       '#64748B', // 슬레이트 그레이
  idea:             '#A855F7', // 바이올렛
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
