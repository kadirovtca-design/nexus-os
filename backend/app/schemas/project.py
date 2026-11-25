from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import HexColor, ShortText, Timestamps

ProjectStatus = Literal["active", "on_hold", "completed", "archived"]


class ProjectBase(BaseModel):
    name: ShortText
    description: str | None = Field(default=None, max_length=5000)
    color: HexColor = "#7C5CFF"
    status: ProjectStatus = "active"
    deadline: date | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: ShortText | None = None
    description: str | None = Field(default=None, max_length=5000)
    color: HexColor | None = None
    status: ProjectStatus | None = None
    deadline: date | None = None


class ProjectOut(ProjectBase, Timestamps):
    id: int
    task_count: int = 0
    completed_count: int = 0
    progress: int = 0
