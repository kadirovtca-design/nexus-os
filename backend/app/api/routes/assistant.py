import json
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, StringConstraints

from app.api.deps import DB, CurrentUser
from app.core.config import get_settings
from app.services.ai.context import local_insights, snapshot
from app.services.ai.provider import AssistantError, ClaudeProvider

router = APIRouter(prefix="/assistant", tags=["assistant"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, StringConstraints(min_length=1, max_length=8000)]


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)


@router.get("/status")
def assistant_status(_: CurrentUser):
    s = get_settings()
    return {
        "configured": s.ai_configured,
        "provider": "anthropic",
        "model": s.ai_model if s.ai_configured else None,
        "setup": None if s.ai_configured else {
            "env_var": "ANTHROPIC_API_KEY",
            "steps": [
                "Create an API key at https://platform.claude.com/ (Settings → API keys).",
                "Add ANTHROPIC_API_KEY=... to backend/.env (or the backend service env in docker-compose).",
                "Optionally set AI_MODEL (default claude-opus-5-5) and AI_EFFORT (low|medium|high).",
                "Restart the backend. This page will switch to live AI automatically.",
            ],
        },
    }


@router.get("/insights")
def insights(user: CurrentUser, db: DB):
    return {"source": "local-rules", "items": local_insights(db, user)}


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(payload: ChatIn, user: CurrentUser, db: DB):
    settings = get_settings()
    if not settings.ai_configured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE,
                            {"code": "ai_not_configured", "message": "AI assistant is not configured."})
    if payload.messages[-1].role != "user":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Last message must be from the user")
    # Merge consecutive same-role turns so the history always alternates.
    history: list[dict] = []
    for m in payload.messages:
        if history and history[-1]["role"] == m.role:
            history[-1]["content"] += "\n\n" + m.content
        else:
            history.append({"role": m.role, "content": m.content})
    while history and history[0]["role"] != "user":
        history.pop(0)
    workspace = snapshot(db, user)
    db.close()  # don't hold a DB connection open for the length of the stream
    provider = ClaudeProvider(settings)

    async def gen():
        try:
            async for chunk in provider.stream(history, workspace):
                yield _sse("delta", {"text": chunk})
            yield _sse("done", {})
        except AssistantError as exc:
            yield _sse("error", {"code": exc.code, "message": str(exc)})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
