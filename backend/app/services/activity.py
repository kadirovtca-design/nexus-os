from sqlalchemy.orm import Session

from app.models import ActivityLog


def log(db: Session, user_id: int, action: str, entity_type: str, entity_id: int | None, message: str) -> None:
    """Record a user-visible activity entry. Caller commits."""
    db.add(ActivityLog(user_id=user_id, action=action, entity_type=entity_type,
                       entity_id=entity_id, message=message[:300]))
