from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Label, ORMModel, ShortText, Timestamps

TaskStatus = Literal["todo", "in_progress", "done"]
TaskPriority = Literal["low", "medium", "high", "urgent"]


class TaskBase(BaseModel):
    title: ShortText
    description: str | None = Field(default=None, max_length=10000)
    status: TaskStatus = "todo"
    priority: TaskPriority = "medium"
    category: Label | None = None
    due_date: date | None = None
    project_id: int | None = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: ShortText | None = None
    description: str | None = Field(default=None, max_length=10000)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    category: Label | None = None
    due_date: date | None = None
    project_id: int | None = None
    position: float | None = None


class TaskProjectRef(ORMModel):
    id: int
    name: str
    color: str


class TaskOut(TaskBase, Timestamps):
    id: int
    completed_at: datetime | None
    position: float
    project: TaskProjectRef | None = None
