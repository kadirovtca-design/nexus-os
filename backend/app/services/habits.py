from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Habit, HabitCompletion


def streaks(days: set[date], today: date) -> tuple[int, int]:
    """Current and best daily streak.

    The current streak counts back from today; if today is not yet checked in,
    it counts back from yesterday (an unfinished day doesn't break a streak).
    """
    if not days:
        return 0, 0
    cur = 0
    d = today if today in days else today - timedelta(days=1)
    while d in days:
        cur += 1
        d -= timedelta(days=1)
    best = run = 0
    prev: date | None = None
    for d in sorted(days):
        run = run + 1 if prev is not None and d - prev == timedelta(days=1) else 1
        best = max(best, run)
        prev = d
    return cur, max(best, cur)


def completion_rate(days: set[date], today: date, created: date, target_per_week: int, window: int = 30) -> float:
    start = max(today - timedelta(days=window - 1), created)
    span = (today - start).days + 1
    expected = max(1.0, span * target_per_week / 7)
    done = sum(1 for d in days if start <= d <= today)
    return round(min(1.0, done / expected), 3)


def completion_days(db: Session, habit_ids: list[int]) -> dict[int, set[date]]:
    out: dict[int, set[date]] = {hid: set() for hid in habit_ids}
    if not habit_ids:
        return out
    rows = db.execute(
        select(HabitCompletion.habit_id, HabitCompletion.date).where(HabitCompletion.habit_id.in_(habit_ids))
    )
    for hid, d in rows:
        out[hid].add(d)
    return out


def daily_habit_ratio(db: Session, user_id: int, start: date, end: date) -> dict[date, tuple[int, int]]:
    """For each day in [start, end]: (check-ins, habits that existed & were active)."""
    habits = db.execute(
        select(Habit.id, Habit.created_at).where(Habit.user_id == user_id, Habit.archived.is_(False))
    ).all()
    counts = dict(
        db.execute(
            select(HabitCompletion.date, func.count())
            .join(Habit, Habit.id == HabitCompletion.habit_id)
            .where(Habit.user_id == user_id, Habit.archived.is_(False),
                   HabitCompletion.date >= start, HabitCompletion.date <= end)
            .group_by(HabitCompletion.date)
        ).all()
    )
    out = {}
    d = start
    while d <= end:
        active = sum(1 for _, created in habits if created.date() <= d)
        out[d] = (counts.get(d, 0), active)
        d += timedelta(days=1)
    return out
