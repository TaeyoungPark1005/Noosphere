import { useEffect, useState } from 'react'
import type { Platform, SocialPost } from '../types'

const PLATFORM_ORDER: Platform[] = ['hackernews', 'producthunt', 'indiehackers', 'reddit_startups', 'linkedin']
const PLATFORM_LABELS: Record<Platform, string> = {
  hackernews: 'Hacker News',
  producthunt: 'Product Hunt',
  indiehackers: 'Indie Hackers',
  reddit_startups: 'Reddit',
  linkedin: 'LinkedIn',
}

function PostCard({ post, depth = 0 }: { post: SocialPost; depth?: number }) {
  return (
    <div style={{
      marginLeft: depth * 20,
      borderLeft: depth > 0 ? '2px solid #e2e8f0' : 'none',
      paddingLeft: depth > 0 ? 12 : 0,
      paddingBottom: 8,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{post.author_name}</span>
        <span style={{
          fontSize: 10, padding: '1px 6px', borderRadius: 8,
          background: '#f1f5f9', color: '#94a3b8', textTransform: 'uppercase',
        }}>{post.action_type}</span>
        {post.upvotes > 0 && (
          <span style={{ fontSize: 11, color: '#64748b' }}>▲ {post.upvotes}</span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 14, color: '#1e293b', lineHeight: 1.5 }}>
        {post.content}
      </p>
    </div>
  )
}

export function SocialFeedView({ posts }: { posts: Partial<Record<Platform, SocialPost[]>> }) {
  const platforms = PLATFORM_ORDER.filter(p => posts[p]?.length)
  const [active, setActive] = useState<Platform | ''>(platforms[0] || '')
  const activePosts = active ? posts[active] || [] : []

  useEffect(() => {
    if (platforms.length === 0) {
      setActive('')
      return
    }
    if (!active || !platforms.includes(active)) {
      setActive(platforms[0])
    }
  }, [active, platforms])

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
        {platforms.map(p => {
          const count = posts[p]?.length ?? 0

          return (
            <button key={p} onClick={() => setActive(p)}
              style={{
                padding: '8px 16px', fontSize: 13, cursor: 'pointer', border: 'none',
                background: 'none', fontWeight: active === p ? 600 : 400,
                borderBottom: active === p ? '2px solid #1e293b' : '2px solid transparent',
                color: active === p ? '#1e293b' : '#64748b',
              }}>
              {PLATFORM_LABELS[p]} ({count})
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activePosts.map(post => (
          <PostCard key={post.id} post={post}
            depth={post.parent_id ? 1 : 0} />
        ))}
      </div>
    </div>
  )
}
