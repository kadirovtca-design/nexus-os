from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_validator

from app.schemas.common import ORMModel

Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


def _check_strength(v: str) -> str:
    if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
        raise ValueError("Password must contain at least one letter and one digit")
    return v


class RegisterIn(BaseModel):
    name: Name
    email: EmailStr
    password: Password
    timezone: str | None = Field(default=None, max_length=64)

    _strength = field_validator("password")(_check_strength)


class LoginIn(BaseModel):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class Preferences(BaseModel):
    theme: Literal["dark", "light", "system"] = "dark"
    accent: Literal["violet", "blue", "emerald", "amber", "rose", "cyan"] = "violet"
    currency: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")] = "USD"
    timezone: str = "UTC"
    week_starts_on: Literal[0, 1] = 1
    compact_sidebar: bool = False

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str) -> str:
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Unknown timezone") from exc
        return v


class PreferencesPatch(BaseModel):
    theme: Literal["dark", "light", "system"] | None = None
    accent: Literal["violet", "blue", "emerald", "amber", "rose", "cyan"] | None = None
    currency: Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$")] | None = None
    timezone: str | None = None
    week_starts_on: Literal[0, 1] | None = None
    compact_sidebar: bool | None = None


class UserOut(ORMModel):
    id: int
    email: EmailStr
    name: str
    created_at: datetime
    preferences: Preferences

    @classmethod
    def from_user(cls, user) -> "UserOut":
        return cls(id=user.id, email=user.email, name=user.name, created_at=user.created_at,
                   preferences=Preferences(**user.prefs))


class ProfileUpdate(BaseModel):
    name: Name | None = None
    email: EmailStr | None = None


class PasswordChange(BaseModel):
    current_password: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    new_password: Password

    _strength = field_validator("new_password")(_check_strength)


class AccountDelete(BaseModel):
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class SessionOut(ORMModel):
    id: int
    user_agent: str | None
    ip_address: str | None
    created_at: datetime
    last_seen_at: datetime
    current: bool = False
