from datetime import UTC, datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload, selectinload

from app.api.deps import DB, CurrentUser
from app.api.routes.tasks import PRIORITY_RANK
from app.models import ActivityLog, CalendarEvent, Goal, Habit, HabitCompletion, Task
from app.schemas.activity import ActivityOut
from app.schemas.event import EventOut
from app.schemas.goal import GoalOut
from app.schemas.task import TaskOut
from app.services import finance as fin
from app.services.crud import owned
from app.services.stats import productivity_series
from app.services.timeutil import month_bounds, user_tz

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _greeting(hour: int) -> str:
    if hour < 5:
        return "Working late"
    if hour < 12:
        return "Good morning"
    if hour < 18:
        return "Good afternoon"
    return "Good evening"


@router.get("")
def dashboard(user: CurrentUser, db: DB):
    tz = user_tz(user)
    now_local = datetime.now(tz)
    today = now_local.date()
    now = datetime.now(UTC)

    week = productivity_series(db, user, today - timedelta(days=6), today)
    today_stats = week[-1]
    prev = week[-2]

    open_today = db.scalar(select(func.count()).select_from(Task).where(
        Task.user_id == user.id, Task.due_date == today, Task.status != "done"))
    overdue = db.scalar(select(func.count()).select_from(Task).where(
        Task.user_id == user.id, Task.due_date < today, Task.status != "done"))
    open_total = db.scalar(select(func.count()).select_from(Task).where(
        Task.user_id == user.id, Task.status != "done"))
    in_progress = db.scalar(select(func.count()).select_from(Task).where(
        Task.user_id == user.id, Task.status == "in_progress"))

    focus = db.scalars(
        owned(Task, user.id).options(joinedload(Task.project))
        .where(Task.status != "done", Task.due_date.is_not(None), Task.due_date <= today + timedelta(days=3))
        .order_by(Task.due_date, PRIORITY_RANK).limit(6)
    ).unique().all()

    events = db.scalars(
        owned(CalendarEvent, user.id).options(joinedload(CalendarEvent.task))
        .where(CalendarEvent.end_at >= now, CalendarEvent.start_at < now + timedelta(days=7))
        .order_by(CalendarEvent.start_at).limit(5)
    ).unique().all()

    goals = db.scalars(
        owned(Goal, user.id).options(selectinload(Goal.milestones))
        .where(Goal.status == "active").order_by(Goal.deadline.nulls_last()).limit(4)
    ).all()
    goal_counts = dict(db.execute(
        select(Goal.status, func.count()).where(Goal.user_id == user.id).group_by(Goal.status)).all())

    habits_active = db.scalar(select(func.count()).select_from(Habit).where(
        Habit.user_id == user.id, Habit.archived.is_(False)))
    habits_done = db.scalar(select(func.count()).select_from(HabitCompletion).join(Habit).where(
        Habit.user_id == user.id, Habit.archived.is_(False), HabitCompletion.date == today))

    m_start, m_end = month_bounds(today)
    inc, exp = fin.totals(db, user.id, m_start, m_end)
    all_inc, all_exp = fin.totals(db, user.id)
    overall_budget = next((b for b in fin.budgets_with_spend(db, user.id, today) if b["category"] is None), None)

    recent = db.scalars(owned(ActivityLog, user.id).order_by(ActivityLog.id.desc()).limit(8)).all()

    return {
        "greeting": _greeting(now_local.hour),
        "name": user.name.split(" ")[0],
        "date": today.isoformat(),
        "timezone": str(tz),
        "productivity": {
            "score": today_stats["score"],
            "previous": prev["score"],
            "completed_today": today_stats["completed"],
            "due_today_open": open_today,
            "overdue": overdue,
            "open_total": open_total,
            "in_progress": in_progress,
        },
        "habits": {"done": habits_done, "active": habits_active},
        "week": week,
        "focus_tasks": [TaskOut.model_validate(t) for t in focus],
        "upcoming_events": [EventOut.model_validate(e) for e in events],
        "goals": {
            "items": [GoalOut.model_validate(g) for g in goals],
            "active": goal_counts.get("active", 0),
            "completed": goal_counts.get("completed", 0),
            "avg_progress": round(sum(g.progress for g in goals) / len(goals)) if goals else None,
        },
        "finance": {
            "month": today.strftime("%Y-%m"),
            "income": float(inc), "expense": float(exp), "net": float(inc - exp),
            "balance": float(all_inc - all_exp),
            "budget": {k: (float(v) if hasattr(v, "quantize") else v) for k, v in overall_budget.items()}
            if overall_budget else None,
        },
        "recent_activity": [ActivityOut.model_validate(a) for a in recent],
    }
