import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import csrf_guard
from app.api.routes import (
    activity,
    analytics,
    assistant,
    auth,
    dashboard,
    events,
    finance,
    goals,
    habits,
    projects,
    tasks,
    users,
)
from app.core.config import get_settings

settings = get_settings()
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="NEXUS OS API",
    version="1.0.0",
    description="Personal operating system — tasks, projects, finance, goals, habits, calendar, analytics.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-Requested-With"],
)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.url.path.startswith("/api/") and "cache-control" not in response.headers:
        response.headers["Cache-Control"] = "no-store"
    return response


for module in (auth, users, tasks, projects, finance, goals, habits, events, activity, dashboard, analytics, assistant):
    app.include_router(module.router, prefix="/api", dependencies=[Depends(csrf_guard)])


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok", "ai_configured": settings.ai_configured}
