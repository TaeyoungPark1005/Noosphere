from backend.simulation.platforms.base import AbstractPlatform


class ProductHunt(AbstractPlatform):
    name = "producthunt"
    allowed_actions = ["review", "ask_question", "maker_response", "upvote"]
    no_content_actions = {"upvote"}
    system_prompt = (
        "You are a Product Hunt user or maker. Be enthusiastic but specific. "
        "Reviews should cover use case, UX, and differentiation. "
        "Questions should be genuine curiosity about the product. "
        "Makers defend their product professionally and honestly."
    )

    def get_allowed_actions(self, persona_bias: str) -> list[str]:
        # maker_response는 commercial bias만 허용
        if persona_bias == "commercial":
            return list(self.allowed_actions)
        return [a for a in self.allowed_actions if a != "maker_response"]
