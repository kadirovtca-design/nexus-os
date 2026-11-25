from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import Budget, Transaction
from app.services.timeutil import add_months, month_bounds

ZERO = Decimal("0.00")


def totals(db: Session, user_id: int, start: date | None = None, end: date | None = None) -> tuple[Decimal, Decimal]:
    """(income, expense) in [start, end)."""
    stmt = select(
        func.coalesce(func.sum(case((Transaction.type == "income", Transaction.amount), else_=0)), 0),
        func.coalesce(func.sum(case((Transaction.type == "expense", Transaction.amount), else_=0)), 0),
    ).where(Transaction.user_id == user_id)
    if start:
        stmt = stmt.where(Transaction.date >= start)
    if end:
        stmt = stmt.where(Transaction.date < end)
    inc, exp = db.execute(stmt).one()
    return Decimal(inc).quantize(ZERO), Decimal(exp).quantize(ZERO)


def by_category(db: Session, user_id: int, type_: str, start: date, end: date) -> list[dict]:
    rows = db.execute(
        select(Transaction.category, func.sum(Transaction.amount))
        .where(Transaction.user_id == user_id, Transaction.type == type_,
               Transaction.date >= start, Transaction.date < end)
        .group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc())
    ).all()
    return [{"category": c, "total": Decimal(t)} for c, t in rows]


def monthly_trend(db: Session, user_id: int, month: date, months: int) -> list[dict]:
    first = add_months(month, -(months - 1))
    _, end = month_bounds(month)
    m = func.to_char(Transaction.date, "YYYY-MM")
    rows = db.execute(
        select(
            m,
            func.coalesce(func.sum(case((Transaction.type == "income", Transaction.amount), else_=0)), 0),
            func.coalesce(func.sum(case((Transaction.type == "expense", Transaction.amount), else_=0)), 0),
        ).where(Transaction.user_id == user_id, Transaction.date >= first, Transaction.date < end).group_by(m)
    ).all()
    data = {k: (Decimal(i), Decimal(e)) for k, i, e in rows}
    out = []
    for k in range(months):
        key = add_months(first, k).strftime("%Y-%m")
        inc, exp = data.get(key, (ZERO, ZERO))
        out.append({"month": key, "income": inc, "expense": exp, "net": inc - exp})
    return out


def daily_spend(db: Session, user_id: int, start: date, end: date) -> list[dict]:
    rows = dict(db.execute(
        select(Transaction.date, func.sum(Transaction.amount))
        .where(Transaction.user_id == user_id, Transaction.type == "expense",
               Transaction.date >= start, Transaction.date < end)
        .group_by(Transaction.date)
    ).all())
    out, running, d = [], ZERO, start
    while d < end:
        amt = Decimal(rows.get(d, 0))
        running += amt
        out.append({"date": d.isoformat(), "amount": float(amt), "cumulative": float(running)})
        d += timedelta(days=1)
    return out


def budgets_with_spend(db: Session, user_id: int, month: date) -> list[dict]:
    start, end = month_bounds(month)
    spent_by_cat = {r["category"]: r["total"] for r in by_category(db, user_id, "expense", start, end)}
    total_spent = sum(spent_by_cat.values(), ZERO)
    out = []
    for b in db.scalars(select(Budget).where(Budget.user_id == user_id).order_by(Budget.category.nulls_first())):
        spent = total_spent if b.category is None else spent_by_cat.get(b.category, ZERO)
        out.append({
            "id": b.id, "category": b.category, "amount": b.amount, "spent": spent,
            "remaining": b.amount - spent, "percent": int(spent * 100 / b.amount) if b.amount else 0,
        })
    return out
