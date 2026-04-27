import pytest
from app.services.llm_runtime import (
    LLMRequestOverride,
    llm_request_context,
    effective_provider,
    effective_model,
)
from app.core.config import settings

def test_llm_runtime_default():
    """Verify that without overrides, we get the default settings."""
    # Ensure no context leaks
    assert effective_provider() == settings.LLM_PROVIDER
    assert effective_model("reasoning") == settings.GROQ_REASONING_MODEL

def test_llm_runtime_override():
    """Verify that the context manager correctly overrides providers/models."""
    override = LLMRequestOverride(
        provider="openai",
        reasoning_model="gpt-4o",
        fast_model="gpt-4o-mini"
    )
    
    with llm_request_context(override):
        assert effective_provider() == "openai"
        assert effective_model("reasoning") == "gpt-4o"
        assert effective_model("fast") == "gpt-4o-mini"
        
    # Should revert after context
    assert effective_provider() == settings.LLM_PROVIDER
