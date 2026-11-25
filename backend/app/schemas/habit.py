import datetime as dt
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.common import HexColor, Timestamps

HabitName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Icon = Annotated[str, StringConstraints(pattern=r"^[a-z0-9-]{1,40}$")]


class HabitBase(BaseModel):
    name: HabitName
    description: str | None = Field(default=None, max_length=2000)
    color: HexColor = "#7C5CFF"
    icon: Icon = "sparkles"
    target_per_week: int = Field(default=7, ge=1, le=7)


class HabitCreate(HabitBase):
    pass


class HabitUpdate(BaseModel):
    name: HabitName | None = None
    description: str | None = Field(default=None, max_length=2000)
    color: HexColor | None = None
    icon: Icon | None = None
    target_per_week: int | None = Field(default=None, ge=1, le=7)
    archived: bool | None = None


class HabitOut(HabitBase, Timestamps):
    id: int
    archived: bool
    current_streak: int
    best_streak: int
    total_completions: int
    completion_rate_30d: float
    completed_today: bool
    recent: list[dt.date]  # completions in the requested window


class CheckIn(BaseModel):
    date: dt.date
    done: bool = True
