from backend.simulation.platforms.hackernews import HackerNews
from backend.simulation.platforms.producthunt import ProductHunt
from backend.simulation.platforms.indiehackers import IndieHackers
from backend.simulation.platforms.reddit_startups import RedditStartups
from backend.simulation.platforms.linkedin import LinkedIn

ALL_PLATFORMS = [HackerNews(), ProductHunt(), IndieHackers(), RedditStartups(), LinkedIn()]
PLATFORM_MAP = {p.name: p for p in ALL_PLATFORMS}
