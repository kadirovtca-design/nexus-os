"""Builds a compact, factual snapshot of the user's workspace for the assistant
and deterministic "local insights" that work without any LLM."""
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import CalendarEvent, Goal, Habit, Project, Task, User
from app.services import finance as fin
from app.services.habits import completion_days, streaks
from app.services.stats import productivity_series
from app.services.timeutil import month_bounds, today_for, user_tz


def snapshot(db: Session, user: User) -> dict:
    tz = user_tz(user)
    today = today_for(user)
    now = datetime.now(UTC)
    open_tasks = db.scalars(
        select(Task).options(joinedload(Task.project))
        .where(Task.user_id == user.id, Task.status != "done")
        .order_by(Task.due_date.nulls_last(), Task.id).limit(40)
    ).unique().all()
    events = db.scalars(
        select(CalendarEvent).where(CalendarEvent.user_id == user.id, CalendarEvent.end_at >= now,
                                    CalendarEvent.start_at < now + timedelta(days=3))
        .order_by(CalendarEvent.start_at).limit(15)
    ).all()
    habits = list(db.scalars(select(Habit).where(Habit.user_id == user.id, Habit.archived.is_(False))))
    hdays = completion_days(db, [h.id for h in habits])
    goals = db.scalars(select(Goal).options(selectinload(Goal.milestones))
                       .where(Goal.user_id == user.id, Goal.status == "active")).all()
    projects = db.scalars(select(Project).where(Project.user_id == user.id, Project.status == "active")).all()
    m_start, m_end = month_bounds(today)
    inc, exp = fin.totals(db, user.id, m_start, m_end)
    week = productivity_series(db, user, today - timedelta(days=6), today)
    done_week = sum(d["completed"] for d in week)

    return {
        "now_local": datetime.now(tz).strftime("%A %Y-%m-%d %H:%M"),
        "timezone": str(tz),
        "open_tasks": [
            {"id": t.id, "title": t.title, "status": t.status, "priority": t.priority,
             "due": t.due_date.isoformat() if t.due_date else None,
             "overdue": bool(t.due_date and t.due_date < today),
             "project": t.project.name if t.project else None, "category": t.category}
            for t in open_tasks
        ],
        "events_next_72h": [
            {"title": e.title, "start": e.start_at.astimezone(tz).strftime("%a %H:%M"),
             "end": e.end_at.astimezone(tz).strftime("%H:%M"), "all_day": e.all_day}
            for e in events
        ],
        "habits": [
            {"name": h.name, "done_today": today in hdays[h.id],
             "streak": streaks(hdays[h.id], today)[0], "target_per_week": h.target_per_week}
            for h in habits
        ],
        "active_goals": [
            {"title": g.title, "progress": g.progress, "deadline": g.deadline.isoformat() if g.deadline else None,
             "next_milestone": next((m.title for m in g.milestones if not m.done), None)}
            for g in goals
        ],
        "active_projects": [{"name": p.name, "deadline": p.deadline.isoformat() if p.deadline else None}
                            for p in projects],
        "finance_this_month": {"income": float(inc), "expense": float(exp),
                               "currency": user.prefs.get("currency", "USD")},
        "last_7_days": {"tasks_completed": done_week,
                        "scores": [d["score"] for d in week]},
    }


def local_insights(db: Session, user: User) -> list[dict]:
    """Rule-based observations. Explicitly NOT AI — labelled as such in the UI."""
    s = snapshot(db, user)
    out: list[dict] = []
    overdue = [t for t in s["open_tasks"] if t["overdue"]]
    rank = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
    today_iso = today_for(user).isoformat()
    due_today = [t for t in s["open_tasks"] if t["due"] == today_iso]

    if overdue:
        top = sorted(overdue, key=lambda t: (rank[t["priority"]], t["due"]))[:3]
        out.append({"kind": "warning", "title": f"{len(overdue)} overdue task{'s' if len(overdue) != 1 else ''}",
                    "body": "Start with: " + ", ".join(f'"{t["title"]}"' for t in top)})
    if due_today:
        out.append({"kind": "focus", "title": f"{len(due_today)} due today",
                    "body": ", ".join(t["title"] for t in sorted(due_today, key=lambda t: rank[t["priority"]])[:4])})
    urgent = [t for t in s["open_tasks"] if t["priority"] in ("urgent", "high") and not t["overdue"]]
    if urgent and not due_today:
        out.append({"kind": "focus", "title": "High-priority work waiting",
                    "body": ", ".join(t["title"] for t in urgent[:3])})
    pending_habits = [h for h in s["habits"] if not h["done_today"]]
    at_risk = [h for h in pending_habits if h["streak"] >= 3]
    if at_risk:
        out.append({"kind": "habit", "title": "Protect your streaks",
                    "body": ", ".join(f'{h["name"]} ({h["streak"]}-day streak)' for h in at_risk[:3])})
    elif pending_habits:
        out.append({"kind": "habit", "title": f"{len(pending_habits)} habit check-in{'s' if len(pending_habits) != 1 else ''} left today",
                    "body": ", ".join(h["name"] for h in pending_habits[:4])})
    if s["events_next_72h"]:
        e = s["events_next_72h"][0]
        out.append({"kind": "calendar", "title": "Next on your calendar",
                    "body": f'{e["title"]} — {e["start"]}'})
    soon_goals = [g for g in s["active_goals"] if g["deadline"] and g["progress"] < 100
                  and (datetime.fromisoformat(g["deadline"]).date() - today_for(user)).days <= 14]
    for g in soon_goals[:2]:
        out.append({"kind": "goal", "title": f'"{g["title"]}" is due soon',
                    "body": f'{g["progress"]}% complete' + (f' · next: {g["next_milestone"]}' if g["next_milestone"] else "")})
    f = s["finance_this_month"]
    if f["expense"] > f["income"] > 0:
        out.append({"kind": "finance", "title": "Spending exceeds income this month",
                    "body": f'Expenses {f["expense"]:,.2f} vs income {f["income"]:,.2f}'})
    scores = [x for x in s["last_7_days"]["scores"] if x is not None]
    if len(scores) >= 3:
        out.append({"kind": "trend", "title": "7-day productivity",
                    "body": f'Average score {round(sum(scores) / len(scores))} · '
                            f'{s["last_7_days"]["tasks_completed"]} tasks completed'})
    if not out:
        out.append({"kind": "info", "title": "All clear",
                    "body": "Nothing urgent. A good moment to plan the week or set a new goal."})
    return out


def count_open(db: Session, user: User) -> int:
    return db.scalar(select(func.count()).select_from(Task).where(Task.user_id == user.id, Task.status != "done"))
