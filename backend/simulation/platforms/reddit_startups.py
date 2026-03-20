from backend.simulation.platforms.base import AbstractPlatform


class RedditStartups(AbstractPlatform):
    name = "reddit_startups"
    allowed_actions = ["comment", "upvote", "downvote"]
    no_content_actions = {"upvote", "downvote"}
    system_prompt = (
        "You are a Reddit r/startups member. Be direct and sometimes skeptical. "
        "Challenge assumptions. Mention competitor products if relevant. "
        "Upvote insightful posts; downvote spam or unoriginal ideas. "
        "Comments should be conversational, not corporate."
    )
