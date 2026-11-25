from datetime import date, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import DB, CurrentUser
from app.models import Goal, Habit, Task, Transaction
from app.services import finance as fin
from app.services.habits import completion_days
from app.services.stats import productivity_series
from app.services.timeutil import add_months, month_bounds, today_for, user_tz

router = APIRouter(prefix="/analytics", tags=["analytics"])
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _avg(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


@router.get("")
def analytics(user: CurrentUser, db: DB, days: int = Query(default=30, ge=7, le=365)):
    today = today_for(user)
    start = today - timedelta(days=days - 1)
    series = productivity_series(db, user, start, today)
    prev_series = productivity_series(db, user, start - timedelta(days=days), start - timedelta(days=1))

    completed = sum(d["completed"] for d in series)
    created = sum(d["created"] for d in series)
    scores = [d["score"] for d in series if d["score"] is not None]
    prev_scores = [d["score"] for d in prev_series if d["score"] is not None]

    # Weekday activity (tasks completed + habit check-ins)
    weekday = [{"day": w, "tasks": 0, "habits": 0} for w in WEEKDAYS]
    for d in series:
        idx = date.fromisoformat(d["date"]).weekday()
        weekday[idx]["tasks"] += d["completed"]
        weekday[idx]["habits"] += d["habits_done"]

    # Task completion rate: tasks due in the window, finished on time
    due_rows = db.execute(
        select(Task.status, Task.due_date, Task.completed_at)
        .where(Task.user_id == user.id, Task.due_date >= start, Task.due_date <= today)
    ).all()
    tz = user_tz(user)
    on_time = sum(1 for s, due, c in due_rows if s == "done" and c and c.astimezone(tz).date() <= due)
    late = sum(1 for s, due, c in due_rows if s == "done" and c and c.astimezone(tz).date() > due)
    status_counts = dict(db.execute(
        select(Task.status, func.count()).where(Task.user_id == user.id).group_by(Task.status)).all())
    priority_counts = dict(db.execute(
        select(Task.priority, func.count()).where(Task.user_id == user.id, Task.status != "done")
        .group_by(Task.priority)).all())
    total_tasks = sum(status_counts.values())

    # Habit consistency
    habits = list(db.scalars(select(Habit).where(Habit.user_id == user.id, Habit.archived.is_(False))))
    days_map = completion_days(db, [h.id for h in habits])
    habit_rows = []
    for h in habits:
        h_start = max(start, h.created_at.astimezone(tz).date())
        span = (today - h_start).days + 1
        expected = max(1.0, span * h.target_per_week / 7)
        done = sum(1 for d in days_map[h.id] if h_start <= d <= today)
        habit_rows.append({"id": h.id, "name": h.name, "color": h.color, "done": done,
                           "expected": round(expected, 1), "rate": round(min(1.0, done / expected), 3)})
    heatmap = [{"date": d["date"], "value": (d["habits_done"] / d["habits_active"]) if d["habits_active"] else None}
               for d in series]

    # Goals
    goal_counts = dict(db.execute(
        select(Goal.status, func.count()).where(Goal.user_id == user.id).group_by(Goal.status)).all())
    g_total = sum(v for k, v in goal_counts.items() if k != "archived")
    cat_col = func.coalesce(Goal.category, "Uncategorized")
    by_cat_rows = db.execute(
        select(cat_col, Goal.status, func.count())
        .where(Goal.user_id == user.id, Goal.status != "archived").group_by(cat_col, Goal.status)).all()
    goal_cats: dict[str, dict] = {}
    for cat, st, n in by_cat_rows:
        row = goal_cats.setdefault(cat, {"category": cat, "active": 0, "completed": 0})
        row[st] = row.get(st, 0) + n

    # Monthly statistics (last 6 months)
    first_month = add_months(today.replace(day=1), -5)
    monthly = []
    for k in range(6):
        m_start, m_end = month_bounds(add_months(first_month, k))
        series_m = productivity_series(db, user, m_start, min(m_end - timedelta(days=1), today)) \
            if m_start <= today else []
        inc, exp = fin.totals(db, user.id, m_start, m_end)
        monthly.append({
            "month": m_start.strftime("%Y-%m"),
            "tasks_completed": sum(d["completed"] for d in series_m),
            "tasks_created": sum(d["created"] for d in series_m),
            "habit_checkins": sum(d["habits_done"] for d in series_m),
            "avg_score": _avg([d["score"] for d in series_m if d["score"] is not None]),
            "income": float(inc), "expense": float(exp),
        })

    # Finance over window
    f_inc, f_exp = fin.totals(db, user.id, start, today + timedelta(days=1))
    top_expenses = fin.by_category(db, user.id, "expense", start, today + timedelta(days=1))
    tx_count = db.scalar(select(func.count()).select_from(Transaction).where(
        Transaction.user_id == user.id, Transaction.date >= start, Transaction.date <= today))

    return {
        "range": {"start": start.isoformat(), "end": today.isoformat(), "days": days},
        "productivity": {
            "series": series,
            "avg_score": _avg(scores),
            "prev_avg_score": _avg(prev_scores),
            "best_day": max(series, key=lambda d: d["score"] or -1)["date"] if scores else None,
            "completed": completed,
            "created": created,
            "prev_completed": sum(d["completed"] for d in prev_series),
        },
        "tasks": {
            "due_in_range": len(due_rows), "on_time": on_time, "late": late,
            "on_time_rate": round(on_time / len(due_rows), 3) if due_rows else None,
            "completion_rate": round(status_counts.get("done", 0) / total_tasks, 3) if total_tasks else None,
            "status": status_counts, "open_by_priority": priority_counts, "total": total_tasks,
        },
        "weekday": weekday,
        "habits": {"items": habit_rows, "heatmap": heatmap,
                   "avg_rate": _avg([r["rate"] * 100 for r in habit_rows])},
        "goals": {"active": goal_counts.get("active", 0), "completed": goal_counts.get("completed", 0),
                  "completion_rate": round(goal_counts.get("completed", 0) / g_total, 3) if g_total else None,
                  "by_category": list(goal_cats.values())},
        "finance": {"income": float(f_inc), "expense": float(f_exp), "net": float(f_inc - f_exp),
                    "transactions": tx_count,
                    "top_expenses": [{"category": r["category"], "total": float(r["total"])} for r in top_expenses[:6]],
                    "trend": [{k: (float(v) if k != "month" else v) for k, v in r.items()}
                              for r in fin.monthly_trend(db, user.id, today.replace(day=1), 6)]},
        "monthly": monthly,
    }
