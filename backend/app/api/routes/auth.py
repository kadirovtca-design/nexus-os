from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import func, select

from app.api.deps import DB, CurrentSession, CurrentUser
from app.api.ratelimit import SlidingWindowLimiter
from app.core.config import get_settings
from app.core.security import (
    hash_password,
    hash_token,
    needs_rehash,
    new_session_token,
    verify_password,
)
from app.models import User, UserSession
from app.models.user import DEFAULT_PREFERENCES
from app.schemas.auth import LoginIn, Preferences, RegisterIn, UserOut
from app.services import activity

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()
_login_limiter = SlidingWindowLimiter(settings.login_max_attempts, settings.login_window_seconds)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def start_session(db: DB, user: User, request: Request, response: Response) -> None:
    token = new_session_token()
    now = datetime.now(UTC)
    db.add(UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        user_agent=(request.headers.get("user-agent") or "")[:400] or None,
        ip_address=_client_ip(request),
        expires_at=now + timedelta(days=settings.session_ttl_days),
    ))
    response.set_cookie(
        settings.session_cookie_name, token,
        max_age=settings.session_ttl_days * 86400,
        httponly=True, secure=settings.cookie_secure, samesite="lax", path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, request: Request, response: Response, db: DB):
    email = payload.email.lower()
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    prefs = dict(DEFAULT_PREFERENCES)
    if payload.timezone:
        try:
            prefs["timezone"] = Preferences(timezone=payload.timezone).timezone
        except ValueError:
            pass
    user = User(email=email, name=payload.name, password_hash=hash_password(payload.password), preferences=prefs)
    db.add(user)
    db.flush()
    activity.log(db, user.id, "created", "account", user.id, "Welcome to NEXUS OS — account created")
    start_session(db, user, request, response)
    db.commit()
    return UserOut.from_user(user)


@router.post("/login", response_model=UserOut)
def login(payload: LoginIn, request: Request, response: Response, db: DB):
    email = payload.email.lower()
    key = f"{_client_ip(request)}:{email}"
    if not _login_limiter.hit(key):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many login attempts. Try again in a few minutes.")
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    if not verify_password(payload.password, user.password_hash if user else None) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    _login_limiter.reset(key)
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    start_session(db, user, request, response)
    db.commit()
    return UserOut.from_user(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(sess: CurrentSession, db: DB, response: Response):
    db.delete(sess)
    db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return UserOut.from_user(user)
