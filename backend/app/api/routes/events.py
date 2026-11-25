from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.orm import joinedload

from app.api.deps import DB, CurrentUser
from app.models import CalendarEvent, Task
from app.schemas.event import EventCreate, EventOut, EventUpdate
from app.services import activity
from app.services.crud import apply_patch, ensure_owned, get_owned_or_404, owned

router = APIRouter(prefix="/events", tags=["calendar"])


@router.get("", response_model=list[EventOut])
def list_events(user: CurrentUser, db: DB, start: datetime = Query(...), end: datetime = Query(...)):
    if end <= start:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "end must be after start")
    if (end - start).days > 400:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Range too large")
    stmt = (owned(CalendarEvent, user.id).options(joinedload(CalendarEvent.task))
            .where(CalendarEvent.start_at < end, CalendarEvent.end_at >= start)
            .order_by(CalendarEvent.start_at))
    return db.scalars(stmt).all()


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, user: CurrentUser, db: DB):
    ensure_owned(db, Task, payload.task_id, user.id, "Task")
    ev = CalendarEvent(user_id=user.id, **payload.model_dump())
    db.add(ev)
    db.flush()
    activity.log(db, user.id, "created", "event", ev.id, f'Scheduled "{ev.title}"')
    db.commit()
    db.refresh(ev)
    return ev


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: int, user: CurrentUser, db: DB):
    return get_owned_or_404(db, CalendarEvent, event_id, user.id, "Event")


@router.patch("/{event_id}", response_model=EventOut)
def update_event(event_id: int, payload: EventUpdate, user: CurrentUser, db: DB):
    ev = get_owned_or_404(db, CalendarEvent, event_id, user.id, "Event")
    if "task_id" in payload.model_fields_set:
        ensure_owned(db, Task, payload.task_id, user.id, "Task")
    apply_patch(ev, payload)
    if ev.end_at < ev.start_at:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "end_at must be after start_at")
    activity.log(db, user.id, "updated", "event", ev.id, f'Updated event "{ev.title}"')
    db.commit()
    db.refresh(ev)
    return ev


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, user: CurrentUser, db: DB):
    ev = get_owned_or_404(db, CalendarEvent, event_id, user.id, "Event")
    activity.log(db, user.id, "deleted", "event", ev.id, f'Removed event "{ev.title}"')
    db.delete(ev)
    db.commit()
