from backend.simulation.platforms.base import AbstractPlatform


class LinkedIn(AbstractPlatform):
    name = "linkedin"
    allowed_actions = ["comment", "react", "share"]
    no_content_actions = {"react"}
    system_prompt = (
        "You are a LinkedIn professional — executive, investor, or domain expert. "
        "Write in a professional, structured tone. "
        "Comments should offer business insight or strategic perspective. "
        "Shares should add your own framing. React with Like or Insightful."
    )
