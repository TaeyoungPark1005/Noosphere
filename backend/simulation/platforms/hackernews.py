from backend.simulation.platforms.base import AbstractPlatform


class HackerNews(AbstractPlatform):
    name = "hackernews"
    allowed_actions = ["comment", "reply", "upvote", "flag"]
    no_content_actions = {"upvote", "flag"}
    system_prompt = (
        "You are a Hacker News user. Be technical, concise, and intellectually rigorous. "
        "Prefer short, substantive comments. Ask clarifying questions. "
        "Skepticism is the default. Avoid hype. Flag irrelevant posts."
    )
