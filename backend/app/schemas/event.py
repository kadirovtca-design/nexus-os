from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import HexColor, ORMModel, ShortText, Timestamps


class EventBase(BaseModel):
    title: ShortText
    description: str | None = Field(default=None, max_length=5000)
    location: str | None = Field(default=None, max_length=200)
    start_at: datetime
    end_at: datetime
    all_day: bool = False
    color: HexColor = "#3B82F6"
    task_id: int | None = None

    @model_validator(mode="after")
    def _order(self):
        if self.end_at < self.start_at:
            raise ValueError("end_at must be after start_at")
        if self.start_at.tzinfo is None or self.end_at.tzinfo is None:
            raise ValueError("Datetimes must include a timezone offset")
        return self


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: ShortText | None = None
    description: str | None = Field(default=None, max_length=5000)
    location: str | None = Field(default=None, max_length=200)
    start_at: datetime | None = None
    end_at: datetime | None = None
    all_day: bool | None = None
    color: HexColor | None = None
    task_id: int | None = None


class EventTaskRef(ORMModel):
    id: int
    title: str
    status: str


class EventOut(EventBase, Timestamps):
    id: int
    task: EventTaskRef | None = None
