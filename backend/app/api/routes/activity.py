from fastapi import APIRouter, Query

from app.api.deps import DB, CurrentUser
from app.models import ActivityLog
from app.schemas.activity import ActivityOut
from app.services.crud import owned

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("", response_model=list[ActivityOut])
def list_activity(user: CurrentUser, db: DB, limit: int = Query(default=30, ge=1, le=200),
                  before_id: int | None = None, entity_type: str | None = None):
    stmt = owned(ActivityLog, user.id)
    if before_id:
        stmt = stmt.where(ActivityLog.id < before_id)
    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
    return db.scalars(stmt.order_by(ActivityLog.id.desc()).limit(limit)).all()
