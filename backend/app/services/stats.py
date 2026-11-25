"""Productivity metrics shared by the dashboard and analytics endpoints."""
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Task, User
from app.services.habits import daily_habit_ratio
from app.services.timeutil import day_bounds, user_tz


def completed_per_day(db: Session, user: User, start: date, end: date) -> dict[date, int]:
    tz = user_tz(user)
    lo, _ = day_bounds(user, start)
    _, hi = day_bounds(user, end)
    local_day = func.date(func.timezone(str(tz), Task.completed_at))
    rows = db.execute(
        select(local_day, func.count())
        .where(Task.user_id == user.id, Task.completed_at >= lo, Task.completed_at < hi)
        .group_by(local_day)
    ).all()
    return {d: c for d, c in rows}


def created_per_day(db: Session, user: User, start: date, end: date) -> dict[date, int]:
    tz = user_tz(user)
    lo, _ = day_bounds(user, start)
    _, hi = day_bounds(user, end)
    local_day = func.date(func.timezone(str(tz), Task.created_at))
    rows = db.execute(
        select(local_day, func.count())
        .where(Task.user_id == user.id, Task.created_at >= lo, Task.created_at < hi)
        .group_by(local_day)
    ).all()
    return {d: c for d, c in rows}


def due_open_per_day(db: Session, user: User, start: date, end: date) -> dict[date, int]:
    """Tasks due on a given day that are still not done (or were finished later)."""
    rows = db.execute(
        select(Task.due_date, Task.completed_at, Task.status)
        .where(Task.user_id == user.id, Task.due_date >= start, Task.due_date <= end)
    ).all()
    tz = user_tz(user)
    out: dict[date, int] = {}
    for due, completed_at, status in rows:
        finished_on_time = status == "done" and completed_at is not None and completed_at.astimezone(tz).date() <= due
        if not finished_on_time:
            out[due] = out.get(due, 0) + 1
    return out


def score(completed: int, missed: int, habits_done: int, habits_active: int) -> int | None:
    """0–100 daily productivity score. None when there is nothing to measure."""
    parts: list[tuple[float, float]] = []
    if completed + missed > 0:
        parts.append((0.6, completed / (completed + missed)))
    if habits_active > 0:
        parts.append((0.4, min(1.0, habits_done / habits_active)))
    if not parts:
        return None
    weight = sum(w for w, _ in parts)
    return round(100 * sum(w * v for w, v in parts) / weight)


def productivity_series(db: Session, user: User, start: date, end: date) -> list[dict]:
    done = completed_per_day(db, user, start, end)
    created = created_per_day(db, user, start, end)
    missed = due_open_per_day(db, user, start, end)
    habits = daily_habit_ratio(db, user.id, start, end)
    out = []
    d = start
    while d <= end:
        h_done, h_active = habits.get(d, (0, 0))
        out.append({
            "date": d.isoformat(),
            "completed": done.get(d, 0),
            "created": created.get(d, 0),
            "missed": missed.get(d, 0),
            "habits_done": h_done,
            "habits_active": h_active,
            "score": score(done.get(d, 0), missed.get(d, 0), h_done, h_active),
        })
        d += timedelta(days=1)
    return out
