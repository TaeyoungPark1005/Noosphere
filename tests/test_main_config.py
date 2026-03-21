import pytest
from pydantic import ValidationError


def test_simconfig_default_provider():
    from backend.main import SimConfig
    cfg = SimConfig(input_text="hello")
    assert cfg.provider == "openai"


def test_simconfig_valid_providers():
    from backend.main import SimConfig
    for p in ("openai", "anthropic", "gemini"):
        cfg = SimConfig(input_text="hello", provider=p)
        assert cfg.provider == p


def test_simconfig_invalid_provider():
    from backend.main import SimConfig
    with pytest.raises(ValidationError):
        SimConfig(input_text="hello", provider="cohere")
