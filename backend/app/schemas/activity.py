from datetime import datetime

from app.schemas.common import ORMModel


class ActivityOut(ORMModel):
    id: int
    action: str
    entity_type: str
    entity_id: int | None
    message: str
    created_at: datetime
