from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DB, CurrentUser
from app.models import Goal, Milestone
from app.schemas.goal import (
    GoalCreate,
    GoalOut,
    GoalStatus,
    GoalUpdate,
    MilestoneCreate,
    MilestoneOut,
    MilestoneUpdate,
)
from app.services import activity
from app.services.crud import apply_patch, get_owned_or_404, owned

router = APIRouter(prefix="/goals", tags=["goals"])


def _load(db, goal_id: int, user_id: int) -> Goal:
    goal = db.scalar(owned(Goal, user_id).where(Goal.id == goal_id).options(selectinload(Goal.milestones)))
    if goal is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Goal not found")
    return goal


def _milestone(db, goal_id: int, milestone_id: int, user_id: int) -> tuple[Goal, Milestone]:
    goal = _load(db, goal_id, user_id)
    ms = next((m for m in goal.milestones if m.id == milestone_id), None)
    if ms is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone not found")
    return goal, ms


def _auto_complete(db, goal: Goal, user_id: int) -> None:
    """A goal whose milestones are all done completes itself (and reopens if one is unchecked)."""
    if not goal.milestones:
        return
    all_done = all(m.done for m in goal.milestones)
    if all_done and goal.status == "active":
        goal.status, goal.completed_at = "completed", datetime.now(UTC)
        activity.log(db, user_id, "completed", "goal", goal.id, f'Achieved goal "{goal.title}"')
    elif not all_done and goal.status == "completed":
        goal.status, goal.completed_at = "active", None


@router.get("", response_model=list[GoalOut])
def list_goals(user: CurrentUser, db: DB, status_: GoalStatus | None = Query(default=None, alias="status"),
               category: str | None = None):
    stmt = owned(Goal, user.id).options(selectinload(Goal.milestones))
    if status_:
        stmt = stmt.where(Goal.status == status_)
    if category:
        stmt = stmt.where(Goal.category == category)
    return db.scalars(stmt.order_by(Goal.status, Goal.deadline.nulls_last(), Goal.created_at.desc())).all()


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(payload: GoalCreate, user: CurrentUser, db: DB):
    data = payload.model_dump(exclude={"milestones"})
    goal = Goal(user_id=user.id, **data)
    goal.milestones = [Milestone(title=m.title, due_date=m.due_date, position=i)
                       for i, m in enumerate(payload.milestones)]
    db.add(goal)
    db.flush()
    activity.log(db, user.id, "created", "goal", goal.id, f'Set a new goal "{goal.title}"')
    db.commit()
    return _load(db, goal.id, user.id)


@router.get("/{goal_id}", response_model=GoalOut)
def get_goal(goal_id: int, user: CurrentUser, db: DB):
    return _load(db, goal_id, user.id)


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: int, payload: GoalUpdate, user: CurrentUser, db: DB):
    goal = _load(db, goal_id, user.id)
    before = goal.status
    apply_patch(goal, payload)
    if goal.status == "completed" and before != "completed":
        goal.completed_at = datetime.now(UTC)
        activity.log(db, user.id, "completed", "goal", goal.id, f'Achieved goal "{goal.title}"')
    elif goal.status != "completed":
        goal.completed_at = None
        if payload.manual_progress is not None and not goal.milestones and goal.manual_progress >= 100:
            goal.status, goal.completed_at = "completed", datetime.now(UTC)
            activity.log(db, user.id, "completed", "goal", goal.id, f'Achieved goal "{goal.title}"')
    db.commit()
    return _load(db, goal.id, user.id)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, user: CurrentUser, db: DB):
    goal = get_owned_or_404(db, Goal, goal_id, user.id, "Goal")
    activity.log(db, user.id, "deleted", "goal", goal.id, f'Deleted goal "{goal.title}"')
    db.delete(goal)
    db.commit()


@router.post("/{goal_id}/milestones", response_model=MilestoneOut, status_code=status.HTTP_201_CREATED)
def add_milestone(goal_id: int, payload: MilestoneCreate, user: CurrentUser, db: DB):
    goal = _load(db, goal_id, user.id)
    pos = db.scalar(select(func.coalesce(func.max(Milestone.position), -1)).where(Milestone.goal_id == goal.id)) + 1
    ms = Milestone(goal_id=goal.id, title=payload.title, due_date=payload.due_date, position=pos)
    goal.milestones.append(ms)
    _auto_complete(db, goal, user.id)
    db.commit()
    return ms


@router.patch("/{goal_id}/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(goal_id: int, milestone_id: int, payload: MilestoneUpdate, user: CurrentUser, db: DB):
    goal, ms = _milestone(db, goal_id, milestone_id, user.id)
    was = ms.done
    apply_patch(ms, payload)
    if ms.done and not was:
        ms.completed_at = datetime.now(UTC)
        activity.log(db, user.id, "completed", "milestone", ms.id, f'Milestone "{ms.title}" reached')
    elif not ms.done:
        ms.completed_at = None
    _auto_complete(db, goal, user.id)
    db.commit()
    return ms


@router.delete("/{goal_id}/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(goal_id: int, milestone_id: int, user: CurrentUser, db: DB):
    goal, ms = _milestone(db, goal_id, milestone_id, user.id)
    goal.milestones.remove(ms)
    _auto_complete(db, goal, user.id)
    db.commit()
