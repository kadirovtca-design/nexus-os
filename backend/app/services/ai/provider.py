"""LLM provider for the assistant (Anthropic Claude via the official SDK)."""
import json
import logging
from collections.abc import AsyncIterator

import anthropic

from app.core.config import Settings

log = logging.getLogger("nexus.ai")

SYSTEM_PROMPT = """You are NEXUS, the built-in assistant of NEXUS OS — a personal operating system for tasks, \
projects, habits, goals, calendar and personal finance.

You receive a JSON snapshot of the user's workspace with every request. Ground every statement in that \
snapshot; if the data does not contain something, say so rather than guessing. Refer to tasks, events and \
goals by their exact titles. You cannot modify data yourself — when you suggest changes, phrase them as \
concrete steps the user can take in the app.

Style: concise, warm, practical. Use short markdown sections and bullet lists. When planning a day, produce \
a time-blocked schedule that respects existing calendar events and puts overdue and urgent work first. \
When analysing productivity, cite the numbers from the snapshot."""

FALLBACK_BETA = "server-side-fallback-2026-07-01"
# Models that accept the server-side refusal fallback parameter.
_FALLBACK_MODELS = {"claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"}


class AssistantError(Exception):
    def __init__(self, message: str, code: str = "ai_error") -> None:
        super().__init__(message)
        self.code = code


class ClaudeProvider:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key, max_retries=2, timeout=120.0)

    async def stream(self, history: list[dict], workspace: dict) -> AsyncIterator[str]:
        s = self.settings
        kwargs: dict = {
            "model": s.ai_model,
            "max_tokens": s.ai_max_tokens,
            "system": [
                # Stable prefix first so it can be cached; the volatile snapshot goes after it.
                {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}},
                {"type": "text", "text": "Workspace snapshot:\n" + json.dumps(workspace, ensure_ascii=False)},
            ],
            "messages": history,
            "output_config": {"effort": s.ai_effort},
        }
        if s.ai_refusal_fallback and s.ai_model in _FALLBACK_MODELS:
            kwargs["betas"] = [FALLBACK_BETA]
            kwargs["fallbacks"] = "default"
        try:
            async with self.client.beta.messages.stream(**kwargs) as stream:
                async for text in stream.text_stream:
                    yield text
                final = await stream.get_final_message()
            if final.stop_reason == "refusal":
                yield "\n\n_The model declined to answer this request._"
            elif final.stop_reason == "max_tokens":
                yield "\n\n_…response truncated (token limit reached)._"
        except anthropic.AuthenticationError as exc:
            raise AssistantError("The configured ANTHROPIC_API_KEY was rejected.", "ai_auth") from exc
        except anthropic.PermissionDeniedError as exc:
            raise AssistantError("The API key lacks permission for this model.", "ai_permission") from exc
        except anthropic.NotFoundError as exc:
            raise AssistantError(f"Model '{s.ai_model}' is not available to this API key.", "ai_model") from exc
        except anthropic.RateLimitError as exc:
            raise AssistantError("Rate limited by the AI provider. Try again shortly.", "ai_rate_limit") from exc
        except anthropic.BadRequestError as exc:
            log.warning("Anthropic bad request: %s", exc)
            raise AssistantError("The AI provider rejected the request.", "ai_bad_request") from exc
        except anthropic.APIStatusError as exc:
            raise AssistantError(f"AI provider error ({exc.status_code}).", "ai_upstream") from exc
        except anthropic.APIConnectionError as exc:
            raise AssistantError("Could not reach the AI provider.", "ai_network") from exc
