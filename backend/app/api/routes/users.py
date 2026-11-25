from fastapi import APIRouter, HTTPException, Response, status
from pydantic import ValidationError
from sqlalchemy import delete, func, select

from app.api.deps import DB, CurrentSession, CurrentUser
from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models import User, UserSession
from app.schemas.auth import (
    AccountDelete,
    PasswordChange,
    Preferences,
    PreferencesPatch,
    ProfileUpdate,
    SessionOut,
    UserOut,
)
from app.services import activity

router = APIRouter(prefix="/users/me", tags=["account"])


@router.patch("", response_model=UserOut)
def update_profile(payload: ProfileUpdate, user: CurrentUser, db: DB):
    if payload.email and payload.email.lower() != user.email:
        email = payload.email.lower()
        if db.scalar(select(User.id).where(func.lower(User.email) == email, User.id != user.id)):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email is already in use")
        user.email = email
    if payload.name:
        user.name = payload.name
    db.commit()
    return UserOut.from_user(user)


@router.patch("/preferences", response_model=UserOut)
def update_preferences(payload: PreferencesPatch, user: CurrentUser, db: DB):
    merged = {**user.prefs, **payload.model_dump(exclude_unset=True, exclude_none=True)}
    try:
        user.preferences = Preferences(**merged).model_dump()  # validates (e.g. timezone)
    except ValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            [{"msg": e["msg"], "loc": e["loc"]} for e in exc.errors()]) from exc
    db.commit()
    return UserOut.from_user(user)


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChange, user: CurrentUser, sess: CurrentSession, db: DB):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    # Revoke every other session: a password change should kick out other devices.
    db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.id != sess.id))
    activity.log(db, user.id, "updated", "account", user.id, "Password changed")
    db.commit()


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(user: CurrentUser, sess: CurrentSession, db: DB):
    rows = db.scalars(
        select(UserSession).where(UserSession.user_id == user.id).order_by(UserSession.last_seen_at.desc())
    ).all()
    return [SessionOut.model_validate(s).model_copy(update={"current": s.id == sess.id}) for s in rows]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_session(session_id: int, user: CurrentUser, db: DB):
    target = db.scalar(select(UserSession).where(UserSession.id == session_id, UserSession.user_id == user.id))
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    db.delete(target)
    db.commit()


@router.post("/sessions/revoke-others", status_code=status.HTTP_204_NO_CONTENT)
def revoke_others(user: CurrentUser, sess: CurrentSession, db: DB):
    db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.id != sess.id))
    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(payload: AccountDelete, user: CurrentUser, db: DB, response: Response):
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password is incorrect")
    db.delete(user)  # ON DELETE CASCADE removes every owned row
    db.commit()
    response.delete_cookie(get_settings().session_cookie_name, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
