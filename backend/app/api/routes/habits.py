from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert

from app.api.deps import DB, CurrentUser
from app.models import Habit, HabitCompletion
from app.schemas.habit import CheckIn, HabitCreate, HabitOut, HabitUpdate
from app.services import activity
from app.services.crud import apply_patch, get_owned_or_404, owned
from app.services.habits import completion_days, completion_rate, streaks
from app.services.timeutil import local_date, today_for

router = APIRouter(prefix="/habits", tags=["habits"])


def _serialize(habits: list[Habit], days_by_habit: dict[int, set[date]], user, window_start: date) -> list[HabitOut]:
    today = today_for(user)
    out = []
    for h in habits:
        days = days_by_habit.get(h.id, set())
        cur, best = streaks(days, today)
        out.append(HabitOut(
            id=h.id, name=h.name, description=h.description, color=h.color, icon=h.icon,
            target_per_week=h.target_per_week, archived=h.archived,
            created_at=h.created_at, updated_at=h.updated_at,
            current_streak=cur, best_streak=best, total_completions=len(days),
            completion_rate_30d=completion_rate(days, today, local_date(h.created_at, user), h.target_per_week),
            completed_today=today in days,
            recent=sorted(d for d in days if d >= window_start),
        ))
    return out


@router.get("", response_model=list[HabitOut])
def list_habits(user: CurrentUser, db: DB, include_archived: bool = False,
                days: int = Query(default=120, ge=7, le=400)):
    stmt = owned(Habit, user.id)
    if not include_archived:
        stmt = stmt.where(Habit.archived.is_(False))
    habits = list(db.scalars(stmt.order_by(Habit.archived, Habit.created_at)))
    return _serialize(habits, completion_days(db, [h.id for h in habits]), user,
                      today_for(user) - timedelta(days=days - 1))


@router.post("", response_model=HabitOut, status_code=status.HTTP_201_CREATED)
def create_habit(payload: HabitCreate, user: CurrentUser, db: DB):
    habit = Habit(user_id=user.id, **payload.model_dump())
    db.add(habit)
    db.flush()
    activity.log(db, user.id, "created", "habit", habit.id, f'Started tracking "{habit.name}"')
    db.commit()
    db.refresh(habit)
    return _serialize([habit], {}, user, today_for(user))[0]


@router.patch("/{habit_id}", response_model=HabitOut)
def update_habit(habit_id: int, payload: HabitUpdate, user: CurrentUser, db: DB):
    habit = get_owned_or_404(db, Habit, habit_id, user.id, "Habit")
    apply_patch(habit, payload)
    db.commit()
    db.refresh(habit)
    return _serialize([habit], completion_days(db, [habit.id]), user, today_for(user) - timedelta(days=119))[0]


@router.delete("/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(habit_id: int, user: CurrentUser, db: DB):
    habit = get_owned_or_404(db, Habit, habit_id, user.id, "Habit")
    activity.log(db, user.id, "deleted", "habit", habit.id, f'Stopped tracking "{habit.name}"')
    db.delete(habit)
    db.commit()


@router.post("/{habit_id}/check-in", response_model=HabitOut)
def check_in(habit_id: int, payload: CheckIn, user: CurrentUser, db: DB):
    habit = get_owned_or_404(db, Habit, habit_id, user.id, "Habit")
    today = today_for(user)
    if payload.date > today:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Cannot check in for a future date")
    if payload.date < today - timedelta(days=365):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Date is too far in the past")
    if payload.done:
        res = db.execute(
            insert(HabitCompletion).values(habit_id=habit.id, date=payload.date)
            .on_conflict_do_nothing(constraint="uq_habit_completion_day")
        )
        if res.rowcount and payload.date == today:
            activity.log(db, user.id, "completed", "habit", habit.id, f'Checked in "{habit.name}"')
    else:
        db.execute(delete(HabitCompletion).where(HabitCompletion.habit_id == habit.id,
                                                 HabitCompletion.date == payload.date))
    db.commit()
    return _serialize([habit], completion_days(db, [habit.id]), user, today - timedelta(days=119))[0]
