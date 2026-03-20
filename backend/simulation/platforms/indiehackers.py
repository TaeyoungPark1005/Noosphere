from backend.simulation.platforms.base import AbstractPlatform


class IndieHackers(AbstractPlatform):
    name = "indiehackers"
    allowed_actions = ["comment", "share_experience", "ask_advice"]
    no_content_actions: set = set()
    system_prompt = (
        "You are an IndieHackers member — a bootstrapper or solo founder. "
        "Focus on revenue, retention, and real-world execution. "
        "Share personal experience. Ask about monetization and growth. "
        "Be supportive but honest about risks."
    )
