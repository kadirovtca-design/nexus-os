from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import hash_token
from app.models import User, UserSession

DB = Annotated[Session, Depends(get_db)]

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "nexus"


def csrf_guard(request: Request) -> None:
    """Reject cookie-authenticated state changes that lack the custom header.

    Browsers do not let cross-site forms set custom headers, and cross-origin
    fetch with custom headers needs a CORS preflight we do not grant.
    """
    if request.method not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing CSRF header")


def get_current_session(request: Request, db: DB) -> UserSession:
    settings = get_settings()
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    sess = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    now = datetime.now(UTC)
    if sess is None or sess.expires_at <= now:
        # Clear the stale cookie so the browser stops sending it.
        clear = f"{settings.session_cookie_name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax"
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired", headers={"Set-Cookie": clear})
    # Sliding expiration, written at most once per hour to limit DB writes.
    if now - sess.last_seen_at > timedelta(hours=1):
        sess.last_seen_at = now
        sess.expires_at = now + timedelta(days=settings.session_ttl_days)
        db.commit()
    return sess


CurrentSession = Annotated[UserSession, Depends(get_current_session)]


def get_current_user(sess: CurrentSession, db: DB) -> User:
    user = db.get(User, sess.user_id)
    if user is None:  # pragma: no cover - FK cascade makes this unreachable
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
