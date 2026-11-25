from datetime import UTC, date, datetime
from typing import Literal

from fastapi import APIRouter, Query, status
from sqlalchemy import case, func, nulls_last, or_, select
from sqlalchemy.orm import joinedload

from app.api.deps import DB, CurrentUser
from app.models import Project, Task
from app.schemas.task import TaskCreate, TaskOut, TaskPriority, TaskStatus, TaskUpdate
from app.services import activity
from app.services.crud import apply_patch, ensure_owned, get_owned_or_404, owned

router = APIRouter(prefix="/tasks", tags=["tasks"])

PRIORITY_RANK = case(
    {"urgent": 0, "high": 1, "medium": 2, "low": 3}, value=Task.priority, else_=4
)
SortKey = Literal["due_date", "priority", "created_at", "title", "position", "updated_at"]


def _sync_completion(task: Task) -> None:
    if task.status == "done" and task.completed_at is None:
        task.completed_at = datetime.now(UTC)
    elif task.status != "done":
        task.completed_at = None


def _next_position(db, user_id: int, status_: str) -> float:
    current = db.scalar(select(func.max(Task.position)).where(Task.user_id == user_id, Task.status == status_))
    return (current or 0) + 1024


@router.get("", response_model=list[TaskOut])
def list_tasks(
    user: CurrentUser,
    db: DB,
    q: str | None = Query(default=None, max_length=200),
    status_: list[TaskStatus] | None = Query(default=None, alias="status"),
    priority: list[TaskPriority] | None = Query(default=None),
    category: str | None = Query(default=None, max_length=60),
    project_id: int | None = None,
    due_before: date | None = None,
    due_after: date | None = None,
    overdue: bool = False,
    sort: SortKey = "position",
    order: Literal["asc", "desc"] = "asc",
    limit: int = Query(default=500, ge=1, le=1000),
):
    stmt = owned(Task, user.id).options(joinedload(Task.project))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Task.title.ilike(like), Task.description.ilike(like), Task.category.ilike(like)))
    if status_:
        stmt = stmt.where(Task.status.in_(status_))
    if priority:
        stmt = stmt.where(Task.priority.in_(priority))
    if category:
        stmt = stmt.where(Task.category == category)
    if project_id is not None:
        stmt = stmt.where(Task.project_id == project_id)
    if due_before:
        stmt = stmt.where(Task.due_date <= due_before)
    if due_after:
        stmt = stmt.where(Task.due_date >= due_after)
    if overdue:
        from app.services.timeutil import today_for

        stmt = stmt.where(Task.due_date < today_for(user), Task.status != "done")

    col = {
        "due_date": Task.due_date, "priority": PRIORITY_RANK, "created_at": Task.created_at,
        "title": func.lower(Task.title), "position": Task.position, "updated_at": Task.updated_at,
    }[sort]
    primary = col.desc() if order == "desc" else col.asc()
    if sort == "due_date":
        primary = nulls_last(primary)
    stmt = stmt.order_by(primary, Task.id.desc()).limit(limit)
    return db.scalars(stmt).unique().all()


@router.get("/categories", response_model=list[str])
def categories(user: CurrentUser, db: DB):
    rows = db.scalars(
        select(Task.category).where(Task.user_id == user.id, Task.category.is_not(None))
        .distinct().order_by(Task.category)
    )
    return list(rows)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, user: CurrentUser, db: DB):
    ensure_owned(db, Project, payload.project_id, user.id, "Project")
    task = Task(user_id=user.id, **payload.model_dump())
    task.position = _next_position(db, user.id, task.status)
    _sync_completion(task)
    db.add(task)
    db.flush()
    activity.log(db, user.id, "created", "task", task.id, f'Created task "{task.title}"')
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, user: CurrentUser, db: DB):
    return get_owned_or_404(db, Task, task_id, user.id, "Task")


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, payload: TaskUpdate, user: CurrentUser, db: DB):
    task = get_owned_or_404(db, Task, task_id, user.id, "Task")
    if "project_id" in payload.model_fields_set:
        ensure_owned(db, Project, payload.project_id, user.id, "Project")
    was_done = task.status == "done"
    old_status = task.status
    changes = apply_patch(task, payload)
    if "status" in changes and task.status != old_status and "position" not in changes:
        task.position = _next_position(db, user.id, task.status)
    _sync_completion(task)
    if task.status == "done" and not was_done:
        activity.log(db, user.id, "completed", "task", task.id, f'Completed "{task.title}"')
    elif was_done and task.status != "done":
        activity.log(db, user.id, "reopened", "task", task.id, f'Reopened "{task.title}"')
    elif changes and set(changes) - {"position"}:
        activity.log(db, user.id, "updated", "task", task.id, f'Updated task "{task.title}"')
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, user: CurrentUser, db: DB):
    task = get_owned_or_404(db, Task, task_id, user.id, "Task")
    activity.log(db, user.id, "deleted", "task", task.id, f'Deleted task "{task.title}"')
    db.delete(task)
    db.commit()
