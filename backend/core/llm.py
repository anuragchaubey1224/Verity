"""Central LLM client — single source of truth for all OpenRouter calls.

All modules import `llm` (sync) or `async_llm` (async) and `provider_kwargs`
from here. Provider is controlled via LLM_PROVIDER in .env.

Use `async_llm` on request paths (FastAPI streaming/generation) so a slow LLM
call never blocks the event loop. `llm` is kept for sync contexts: LangGraph
sync nodes, Celery ingestion, evaluation scripts.
"""
from openai import AsyncOpenAI, OpenAI

from backend.core.config import settings

llm = OpenAI(
    api_key=settings.openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)

async_llm = AsyncOpenAI(
    api_key=settings.openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)

fast_llm = llm  # Same client, different model at call time


def provider_kwargs() -> dict:
    """Inject provider routing into any .create() call.

    Usage:
        llm.chat.completions.create(model=..., messages=..., **provider_kwargs())

    With LLM_PROVIDER=Fireworks in .env → routes to Fireworks, avoids W&B caching.
    Without LLM_PROVIDER → OpenRouter auto-selects provider.
    """
    if not settings.llm_provider:
        return {}
    return {
        "extra_body": {
            "provider": {
                "order": [settings.llm_provider],
                "allow_fallbacks": True,
            }
        }
    }
