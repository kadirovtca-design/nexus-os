from datetime import date

from sqlalchemy import Date, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import OwnedMixin, TimestampMixin


class Project(OwnedMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#7C5CFF")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    deadline: Mapped[date | None] = mapped_column(Date)

    tasks: Mapped[list["Task"]] = relationship(back_populates="project", passive_deletes=True)  # noqa: F821
