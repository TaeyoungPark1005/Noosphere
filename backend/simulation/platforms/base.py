from __future__ import annotations
import dataclasses
from backend.simulation.models import SocialPost, PlatformState


@dataclasses.dataclass
class AgentAction:
    action_type: str
    target_post_id: str | None   # None for new top-level posts


class AbstractPlatform:
    name: str
    allowed_actions: list[str]
    no_content_actions: set[str]
    system_prompt: str           # Platform persona for LLM

    def requires_content(self, action_type: str) -> bool:
        return action_type not in self.no_content_actions

    def get_allowed_actions(self, persona_bias: str) -> list[str]:
        """Restrict action types based on persona bias (e.g. maker_response)."""
        return list(self.allowed_actions)

    def build_feed(
        self,
        state: PlatformState,
        top_posts: int = 3,
        top_comments_per_post: int = 3,
    ) -> str:
        """Render platform feed as text for LLM context."""
        top_level = [p for p in state.posts if p.parent_id is None]
        top_level_sorted = sorted(top_level, key=lambda p: -p.upvotes)[:top_posts]

        lines: list[str] = [f"=== {self.name.upper()} FEED (Round {state.round_num}) ==="]
        for post in top_level_sorted:
            lines.append(
                f"\n[POST id={post.id}] {post.author_name} (+{post.upvotes}/-{post.downvotes})\n"
                f"{post.content[:400]}"
            )
            comments = [p for p in state.posts if p.parent_id == post.id]
            comments_sorted = sorted(comments, key=lambda p: -p.upvotes)[:top_comments_per_post]
            for c in comments_sorted:
                lines.append(
                    f"  [COMMENT id={c.id}] {c.author_name} (+{c.upvotes})\n"
                    f"  {c.content[:200]}"
                )
        lines.append("\n[Available post IDs for targeting]: " +
                     ", ".join(p.id for p in state.posts if p.parent_id is None))
        return "\n".join(lines)

    def update_vote_counts(
        self,
        state: PlatformState,
        target_post_id: str,
        action_type: str,
    ) -> SocialPost | None:
        """Mutate upvote/downvote count on target post. Returns updated post or None."""
        for post in state.posts:
            if post.id == target_post_id:
                if action_type in ("upvote", "react"):
                    post.upvotes += 1
                elif action_type in ("downvote", "flag"):
                    post.downvotes += 1
                return post
        return None
