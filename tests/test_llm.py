import os
import pytest
from unittest.mock import patch


def test_check_provider_key_openai_missing():
    from backend.llm import check_provider_key
    with patch.dict(os.environ, {}, clear=True):
        # Remove OPENAI_API_KEY if set
        env = {k: v for k, v in os.environ.items() if k != "OPENAI_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            with pytest.raises(ValueError, match="OPENAI_API_KEY"):
                check_provider_key("openai")


def test_check_provider_key_openai_present():
    from backend.llm import check_provider_key
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test"}):
        check_provider_key("openai")  # should not raise


def test_check_provider_key_anthropic_missing():
    from backend.llm import check_provider_key
    with patch.dict(os.environ, {}, clear=True):
        env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
                check_provider_key("anthropic")


def test_check_provider_key_gemini_missing():
    from backend.llm import check_provider_key
    with patch.dict(os.environ, {}, clear=True):
        env = {k: v for k, v in os.environ.items() if k != "GEMINI_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            with pytest.raises(ValueError, match="GEMINI_API_KEY"):
                check_provider_key("gemini")


def test_check_provider_key_unknown_provider():
    from backend.llm import check_provider_key
    with pytest.raises(ValueError, match="Unknown provider"):
        check_provider_key("unknown")
