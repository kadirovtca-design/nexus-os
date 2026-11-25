from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.models import User


def user_tz(user: User) -> ZoneInfo:
    try:
        return ZoneInfo(user.prefs.get("timezone") or "UTC")
    except Exception:  # pragma: no cover - validated on write
        return ZoneInfo("UTC")


def today_for(user: User) -> date:
    return datetime.now(user_tz(user)).date()


def day_bounds(user: User, d: date) -> tuple[datetime, datetime]:
    """UTC [start, end) of a local calendar day for the user."""
    tz = user_tz(user)
    start = datetime.combine(d, time.min, tzinfo=tz)
    return start.astimezone(UTC), (start + timedelta(days=1)).astimezone(UTC)


def month_bounds(d: date) -> tuple[date, date]:
    start = d.replace(day=1)
    nxt = (start + timedelta(days=32)).replace(day=1)
    return start, nxt


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    y = d.year + m // 12
    return date(y, m % 12 + 1, 1)


def local_date(dt_: datetime, user: User) -> date:
    return dt_.astimezone(user_tz(user)).date()
