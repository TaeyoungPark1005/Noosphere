export type Platform =
  | 'hackernews'
  | 'producthunt'
  | 'indiehackers'
  | 'reddit_startups'
  | 'linkedin'

export type Provider = 'openai' | 'anthropic' | 'gemini'

export interface SimConfig {
  input_text: string
  language: string
  num_rounds: number
  max_agents: number
  platforms: Platform[]
  activation_rate: number
  source_limits: Record<string, number>
  provider: Provider
}

export interface SocialPost {
  id: string
  platform: Platform
  author_node_id: string
  author_name: string
  content: string
  action_type: string
  round_num: number
  upvotes: number
  downvotes: number
  parent_id: string | null
}

export interface Persona {
  node_id: string
  name: string
  role: string
  mbti: string
  bias: string
  interests: string[]
}

export interface ReportSegment {
  name: string
  sentiment: 'positive' | 'neutral' | 'negative'
  summary: string
  key_quotes: string[]
}

export interface CriticismCluster {
  theme: string
  count: number
  examples: string[]
}

export interface Improvement {
  suggestion: string
  frequency: number
}

export interface ReportJSON {
  verdict: 'positive' | 'mixed' | 'skeptical' | 'negative'
  evidence_count: number
  segments: ReportSegment[]
  criticism_clusters: CriticismCluster[]
  improvements: Improvement[]
}

export interface SimResults {
  sim_id: string
  posts_json: Partial<Record<Platform, SocialPost[]>>
  personas_json: Partial<Record<Platform, Persona[]>>
  report_json: ReportJSON
  report_md: string
  analysis_md: string
}

export interface HistoryItem {
  id: string
  created_at: string
  input_text_snippet: string
  language: string
  config: SimConfig & { provider?: Provider }
  status: 'running' | 'completed' | 'failed'
  domain: string
}
