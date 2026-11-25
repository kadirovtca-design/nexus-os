from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.api.deps import DB, CurrentUser
from app.models import Budget, Transaction
from app.schemas.finance import (
    BudgetOut,
    BudgetUpsert,
    FinanceSummary,
    TransactionCreate,
    TransactionOut,
    TransactionUpdate,
)
from app.services import activity
from app.services import finance as fin
from app.services.crud import apply_patch, get_owned_or_404, owned
from app.services.timeutil import add_months, month_bounds, today_for

router = APIRouter(prefix="/finance", tags=["finance"])


def _parse_month(month: str | None, user) -> date:
    if not month:
        return today_for(user).replace(day=1)
    try:
        y, m = month.split("-")
        return date(int(y), int(m), 1)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "month must be YYYY-MM") from exc


def _fmt(amount) -> str:
    return f"{amount:,.2f}"


@router.get("/transactions", response_model=list[TransactionOut])
def list_transactions(
    user: CurrentUser, db: DB,
    type: Literal["income", "expense"] | None = None,
    category: str | None = Query(default=None, max_length=60),
    q: str | None = Query(default=None, max_length=200),
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
):
    stmt = owned(Transaction, user.id)
    if type:
        stmt = stmt.where(Transaction.type == type)
    if category:
        stmt = stmt.where(Transaction.category == category)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Transaction.description.ilike(like), Transaction.category.ilike(like)))
    if month:
        start, end = month_bounds(_parse_month(month, user))
        stmt = stmt.where(Transaction.date >= start, Transaction.date < end)
    stmt = stmt.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit).offset(offset)
    return db.scalars(stmt).all()


@router.get("/categories", response_model=dict[str, list[str]])
def categories(user: CurrentUser, db: DB):
    rows = db.execute(
        select(Transaction.type, Transaction.category).where(Transaction.user_id == user.id)
        .group_by(Transaction.type, Transaction.category).order_by(func.count().desc())
    ).all()
    out: dict[str, list[str]] = {"income": [], "expense": []}
    for t, c in rows:
        out[t].append(c)
    return out


@router.post("/transactions", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate, user: CurrentUser, db: DB):
    tx = Transaction(user_id=user.id, **payload.model_dump())
    db.add(tx)
    db.flush()
    sign = "+" if tx.type == "income" else "−"
    activity.log(db, user.id, "created", "transaction", tx.id, f"{sign}{_fmt(tx.amount)} · {tx.category}")
    db.commit()
    return tx


@router.patch("/transactions/{tx_id}", response_model=TransactionOut)
def update_transaction(tx_id: int, payload: TransactionUpdate, user: CurrentUser, db: DB):
    tx = get_owned_or_404(db, Transaction, tx_id, user.id, "Transaction")
    apply_patch(tx, payload)
    activity.log(db, user.id, "updated", "transaction", tx.id, f"Edited transaction · {tx.category}")
    db.commit()
    return tx


@router.delete("/transactions/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(tx_id: int, user: CurrentUser, db: DB):
    tx = get_owned_or_404(db, Transaction, tx_id, user.id, "Transaction")
    activity.log(db, user.id, "deleted", "transaction", tx.id, f"Deleted transaction · {tx.category}")
    db.delete(tx)
    db.commit()


@router.get("/budgets", response_model=list[BudgetOut])
def list_budgets(user: CurrentUser, db: DB, month: str | None = None):
    return fin.budgets_with_spend(db, user.id, _parse_month(month, user))


@router.put("/budgets", response_model=BudgetOut)
def upsert_budget(payload: BudgetUpsert, user: CurrentUser, db: DB):
    stmt = owned(Budget, user.id).where(
        Budget.category.is_(None) if payload.category is None else Budget.category == payload.category
    )
    budget = db.scalar(stmt)
    if budget is None:
        budget = Budget(user_id=user.id, category=payload.category, amount=payload.amount)
        db.add(budget)
    else:
        budget.amount = payload.amount
    db.flush()
    label = payload.category or "overall"
    activity.log(db, user.id, "updated", "budget", budget.id, f"Set {label} budget to {_fmt(payload.amount)}")
    db.commit()
    month = today_for(user).replace(day=1)
    return next(b for b in fin.budgets_with_spend(db, user.id, month) if b["id"] == budget.id)


@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: int, user: CurrentUser, db: DB):
    db.delete(get_owned_or_404(db, Budget, budget_id, user.id, "Budget"))
    db.commit()


@router.get("/summary", response_model=FinanceSummary)
def summary(user: CurrentUser, db: DB, month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
            months: int = Query(default=6, ge=1, le=24)):
    m = _parse_month(month, user)
    start, end = month_bounds(m)
    prev_start, _ = month_bounds(add_months(m, -1))
    all_inc, all_exp = fin.totals(db, user.id)
    inc, exp = fin.totals(db, user.id, start, end)
    p_inc, p_exp = fin.totals(db, user.id, prev_start, start)
    budgets = fin.budgets_with_spend(db, user.id, m)
    overall = next((b for b in budgets if b["category"] is None), None)
    return {
        "month": m.strftime("%Y-%m"),
        "balance": all_inc - all_exp,
        "income": inc, "expense": exp, "net": inc - exp,
        "savings_rate": round(float((inc - exp) / inc), 4) if inc > 0 else None,
        "prev_income": p_inc, "prev_expense": p_exp,
        "budget": overall,
        "expense_by_category": fin.by_category(db, user.id, "expense", start, end),
        "income_by_category": fin.by_category(db, user.id, "income", start, end),
        "daily_spend": fin.daily_spend(db, user.id, start, end),
        "trend": fin.monthly_trend(db, user.id, m, months),
    }
