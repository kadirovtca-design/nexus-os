from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Label, ORMModel, ShortText, Timestamps

GoalStatus = Literal["active", "completed", "archived"]


class MilestoneCreate(BaseModel):
    title: ShortText
    due_date: date | None = None


class MilestoneUpdate(BaseModel):
    title: ShortText | None = None
    done: bool | None = None
    due_date: date | None = None
    position: int | None = None


class MilestoneOut(ORMModel):
    id: int
    title: str
    done: bool
    due_date: date | None
    position: int
    completed_at: datetime | None


class GoalBase(BaseModel):
    title: ShortText
    description: str | None = Field(default=None, max_length=5000)
    category: Label | None = None
    deadline: date | None = None


class GoalCreate(GoalBase):
    milestones: list[MilestoneCreate] = Field(default_factory=list, max_length=50)
    manual_progress: int = Field(default=0, ge=0, le=100)


class GoalUpdate(BaseModel):
    title: ShortText | None = None
    description: str | None = Field(default=None, max_length=5000)
    category: Label | None = None
    deadline: date | None = None
    status: GoalStatus | None = None
    manual_progress: int | None = Field(default=None, ge=0, le=100)


class GoalOut(GoalBase, Timestamps):
    id: int
    status: GoalStatus
    manual_progress: int
    progress: int
    completed_at: datetime | None
    milestones: list[MilestoneOut]
