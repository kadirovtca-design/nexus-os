"""Create a demo account with ~60 days of realistic history.

    python -m scripts.seed [--email demo@nexus.os] [--password demo12345] [--reset]
"""
import argparse
import random
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import (
    ActivityLog,
    Budget,
    CalendarEvent,
    Goal,
    Habit,
    HabitCompletion,
    Milestone,
    Project,
    Task,
    Transaction,
    User,
)
from app.models.user import DEFAULT_PREFERENCES


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", default="demo@nexus.os")
    ap.add_argument("--password", default="demo12345")
    ap.add_argument("--timezone", default="UTC")
    ap.add_argument("--reset", action="store_true")
    args = ap.parse_args()
    rnd = random.Random(42)
    db = SessionLocal()
    existing = db.scalar(select(User).where(User.email == args.email))
    if existing:
        if not args.reset:
            print(f"{args.email} already exists (use --reset to recreate)")
            return
        db.delete(existing)
        db.commit()

    tz = ZoneInfo(args.timezone)
    today = datetime.now(tz).date()
    user = User(email=args.email, name="Alex Morgan", password_hash=hash_password(args.password),
                preferences={**DEFAULT_PREFERENCES, "timezone": args.timezone})
    db.add(user)
    db.flush()
    uid = user.id

    def at(d: date, h: int, m: int = 0) -> datetime:
        return datetime.combine(d, time(h, m), tzinfo=tz).astimezone(UTC)

    projects = [
        Project(user_id=uid, name="Website Relaunch", color="#7C5CFF", description="New marketing site and docs.",
                deadline=today + timedelta(days=24)),
        Project(user_id=uid, name="Mobile App v2", color="#3B82F6", description="Offline mode, sync, new onboarding.",
                deadline=today + timedelta(days=55)),
        Project(user_id=uid, name="Home Renovation", color="#F59E0B", description="Kitchen and study.",
                deadline=today + timedelta(days=80)),
        Project(user_id=uid, name="Q4 Planning", color="#10B981", status="completed",
                deadline=today - timedelta(days=5)),
    ]
    db.add_all(projects)
    db.flush()

    titles = {
        0: ["Design hero section", "Write pricing copy", "Set up analytics", "SEO audit", "Migrate blog posts",
            "Accessibility pass", "Performance budget", "Docs navigation", "Launch checklist", "Social previews"],
        1: ["Sync engine spike", "Conflict resolution", "Onboarding flow", "Push notifications", "Crash reporting",
            "Beta release notes", "Offline cache", "Settings screen"],
        2: ["Get contractor quotes", "Pick countertops", "Order lighting", "Paint study", "Plumbing check"],
        3: ["OKR draft", "Budget review", "Hiring plan"],
        None: ["Renew passport", "Dentist appointment", "Call mom", "Read 'Deep Work'", "File taxes",
               "Plan weekend trip", "Clean inbox", "Backup laptop", "Gym bag prep", "Grocery run",
               "Update CV", "Car service"],
    }
    cats = {0: "Work", 1: "Work", 2: "Home", 3: "Work", None: "Personal"}
    prios = ["low", "medium", "medium", "high", "urgent"]
    tasks: list[Task] = []
    pos = 0
    for key, names in titles.items():
        for name in names:
            created = today - timedelta(days=rnd.randint(3, 50))
            due = created + timedelta(days=rnd.randint(2, 20))
            p = projects[key] if key is not None else None
            done_p = 0.95 if key == 3 else (0.75 if due < today else 0.25)
            status = "done" if rnd.random() < done_p else rnd.choice(["todo", "todo", "in_progress"])
            pos += 1024
            t = Task(user_id=uid, title=name, project_id=p.id if p else None, category=cats[key],
                     priority=rnd.choice(prios), due_date=due, status=status, position=pos,
                     created_at=at(created, 9), updated_at=at(created, 9))
            if status == "done":
                cd = min(today, due + timedelta(days=rnd.choice([-2, -1, 0, 0, 1, 2])))
                cd = max(cd, created)
                t.completed_at = min(at(cd, rnd.randint(9, 19), rnd.randint(0, 59)),
                                     datetime.now(UTC) - timedelta(minutes=rnd.randint(5, 240)))
            tasks.append(t)
    # a few for today
    for name, pr in [("Review pull requests", "high"), ("Prepare standup notes", "medium"),
                     ("Reply to design feedback", "urgent")]:
        pos += 1024
        tasks.append(Task(user_id=uid, title=name, category="Work", priority=pr, due_date=today, position=pos,
                          project_id=projects[0].id))
    db.add_all(tasks)
    db.flush()

    # Habits with realistic adherence
    habit_specs = [("Morning run", "#EF4444", "footprints", 4, 0.62), ("Read 30 min", "#7C5CFF", "book-open", 7, 0.8),
                   ("Meditate", "#10B981", "brain", 7, 0.7), ("No sugar", "#F59E0B", "apple", 7, 0.55),
                   ("Journal", "#3B82F6", "pen-line", 5, 0.66)]
    for name, color, icon, target, p in habit_specs:
        h = Habit(user_id=uid, name=name, color=color, icon=icon, target_per_week=target,
                  created_at=at(today - timedelta(days=60), 8))
        db.add(h)
        db.flush()
        streak_tail = rnd.randint(3, 9)
        for k in range(60, 0, -1):
            d = today - timedelta(days=k)
            if k <= streak_tail or rnd.random() < p:
                db.add(HabitCompletion(habit_id=h.id, date=d))
        if rnd.random() < 0.6:
            db.add(HabitCompletion(habit_id=h.id, date=today))

    # Goals
    goal_specs = [
        ("Run a half marathon", "Health", 70, ["Run 5k", "Run 10k", "Run 15k", "Run 21k"], 2),
        ("Save $10,000 emergency fund", "Finance", 120, ["$2,500", "$5,000", "$7,500", "$10,000"], 2),
        ("Ship Mobile App v2", "Career", 55, ["Spec", "Beta", "Store review", "Launch"], 1),
        ("Read 24 books this year", "Learning", 36, [], 0),
        ("Learn conversational Spanish", "Learning", 150, ["A1", "A2", "B1"], 3),
    ]
    for title, cat, days, ms, done in goal_specs:
        g = Goal(user_id=uid, title=title, category=cat, deadline=today + timedelta(days=days),
                 manual_progress=78 if not ms else 0)
        g.milestones = [Milestone(title=m, position=i, done=i < done,
                                  completed_at=at(today - timedelta(days=10 * (done - i)), 12) if i < done else None)
                        for i, m in enumerate(ms)]
        if ms and done == len(ms):
            g.status, g.completed_at = "completed", at(today - timedelta(days=3), 12)
        db.add(g)
    db.add(Goal(user_id=uid, title="Finish online design course", category="Learning", status="completed",
                completed_at=at(today - timedelta(days=12), 18), deadline=today - timedelta(days=10)))

    # Finance: 4 months
    for back in range(3, -1, -1):
        first = (today.replace(day=1) - timedelta(days=1)).replace(day=1) if back == 1 else today.replace(day=1)
        y, m = today.year, today.month - back
        while m <= 0:
            m += 12
            y -= 1
        first = date(y, m, 1)
        last_day = (first + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        end = min(last_day, today)
        def tx(t, amt, cat, desc, d):
            if d <= end:
                db.add(Transaction(user_id=uid, type=t, amount=Decimal(str(round(amt, 2))), category=cat,
                                   description=desc, date=d))
        tx("income", 5200, "Salary", "Monthly salary", first)
        if rnd.random() < 0.7:
            tx("income", rnd.uniform(300, 1200), "Freelance", "Client project", first + timedelta(days=14))
        tx("expense", 1650, "Housing", "Rent", first)
        tx("expense", rnd.uniform(90, 140), "Utilities", "Electricity & internet", first + timedelta(days=4))
        tx("expense", 15.99, "Subscriptions", "Streaming", first + timedelta(days=6))
        tx("expense", 9.99, "Subscriptions", "Cloud storage", first + timedelta(days=9))
        for k in range(0, 31, 3):
            tx("expense", rnd.uniform(25, 95), "Groceries", rnd.choice(["Supermarket", "Farmers market"]),
               first + timedelta(days=k))
        for k in range(1, 31, 4):
            tx("expense", rnd.uniform(12, 60), "Dining", rnd.choice(["Lunch", "Dinner out", "Coffee"]),
               first + timedelta(days=k))
        for k in range(2, 31, 7):
            tx("expense", rnd.uniform(20, 55), "Transport", "Fuel / transit", first + timedelta(days=k))
        tx("expense", rnd.uniform(60, 260), "Shopping", "Clothes & gear", first + timedelta(days=rnd.randint(5, 25)))
        tx("expense", rnd.uniform(30, 120), "Health", "Gym & pharmacy", first + timedelta(days=2))
    db.add_all([Budget(user_id=uid, category=None, amount=Decimal("3800")),
                Budget(user_id=uid, category="Groceries", amount=Decimal("550")),
                Budget(user_id=uid, category="Dining", amount=Decimal("250")),
                Budget(user_id=uid, category="Shopping", amount=Decimal("200"))])

    # Calendar: past and upcoming 2 weeks
    ev_specs = [("Team standup", 9, 30, 15, "#7C5CFF"), ("Design review", 14, 0, 60, "#3B82F6"),
                ("1:1 with Sam", 11, 0, 30, "#10B981"), ("Gym", 18, 30, 60, "#EF4444"),
                ("Focus block", 10, 0, 120, "#F59E0B")]
    for k in range(-10, 15):
        d = today + timedelta(days=k)
        if d.weekday() < 5:
            for title, h, mi, dur, color in ev_specs:
                if title == "Team standup" or rnd.random() < 0.35:
                    s = at(d, h, mi)
                    db.add(CalendarEvent(user_id=uid, title=title, start_at=s, end_at=s + timedelta(minutes=dur),
                                         color=color))
    db.add(CalendarEvent(user_id=uid, title="Website launch", all_day=True, color="#7C5CFF",
                         start_at=at(today + timedelta(days=24), 0), end_at=at(today + timedelta(days=24), 23, 59)))
    link = next(t for t in tasks if t.title == "Reply to design feedback")
    s = at(today, 15, 0)
    db.add(CalendarEvent(user_id=uid, title="Work on design feedback", start_at=s, end_at=s + timedelta(minutes=45),
                         color="#EC4899", task_id=link.id))

    # Activity feed from history
    for t in sorted([t for t in tasks if t.completed_at], key=lambda t: t.completed_at)[-25:]:
        db.add(ActivityLog(user_id=uid, action="completed", entity_type="task", entity_id=t.id,
                           message=f'Completed "{t.title}"', created_at=t.completed_at))
    db.commit()
    print(f"Seeded {args.email} / {args.password}")


if __name__ == "__main__":
    main()
