"""Tenant-scoped data access helpers.

Every query for user-owned data must go through these helpers so that the
`user_id` filter can never be forgotten. Cross-tenant access yields 404.
"""
from typing import Any, TypeVar

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

T = TypeVar("T")


def owned(model: type[T], user_id: int) -> Select[tuple[T]]:
    return select(model).where(model.user_id == user_id)  # type: ignore[attr-defined]


def get_owned_or_404(db: Session, model: type[T], obj_id: int, user_id: int, label: str | None = None) -> T:
    obj = db.scalar(owned(model, user_id).where(model.id == obj_id))  # type: ignore[attr-defined]
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label or model.__name__} not found")
    return obj


def ensure_owned(db: Session, model: type[T], obj_id: int | None, user_id: int, label: str) -> None:
    """Validate a foreign key from a payload belongs to the caller."""
    if obj_id is None:
        return
    if db.scalar(owned(model, user_id).where(model.id == obj_id)) is None:  # type: ignore[attr-defined]
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"{label} does not exist")


def apply_patch(obj: Any, patch: BaseModel) -> dict[str, Any]:
    changes = patch.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(obj, key, value)
    return changes
