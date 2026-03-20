from __future__ import annotations
import dataclasses


@dataclasses.dataclass
class Persona:
    node_id: str
    name: str
    role: str
    mbti: str
    interests: list[str]
    bias: str        # "academic" | "commercial" | "skeptic" | "evangelist"
    source_title: str


@dataclasses.dataclass
class SocialPost:
    id: str                        # uuid4 또는 "__seed__{platform}"
    platform: str                  # "hackernews" | "producthunt" | "indiehackers" | "reddit_startups" | "linkedin"
    author_node_id: str            # 에이전트 node_id 또는 "__seed__"
    author_name: str
    content: str
    action_type: str               # 플랫폼별 허용 action_type
    round_num: int                 # 0 = 씨드, 1~N = 시뮬레이션 라운드
    upvotes: int = 0
    downvotes: int = 0
    parent_id: str | None = None   # None = 최상위; 댓글/답글은 부모 post id


@dataclasses.dataclass
class PlatformState:
    platform_name: str
    posts: list[SocialPost] = dataclasses.field(default_factory=list)
    round_num: int = 0
