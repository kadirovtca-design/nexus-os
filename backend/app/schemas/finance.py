import datetime as dt
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import Label, Money, Timestamps

TxType = Literal["income", "expense"]


class TransactionBase(BaseModel):
    type: TxType
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    category: Label
    description: str | None = Field(default=None, max_length=255)
    date: dt.date


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    type: TxType | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    category: Label | None = None
    description: str | None = Field(default=None, max_length=255)
    date: dt.date | None = None


class TransactionOut(TransactionBase, Timestamps):
    id: int
    amount: Money


class BudgetUpsert(BaseModel):
    category: Label | None = None  # None = overall monthly budget
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class BudgetOut(BaseModel):
    id: int
    category: str | None
    amount: Money
    spent: Money
    remaining: Money
    percent: int


class CategoryTotal(BaseModel):
    category: str
    total: Money


class MonthPoint(BaseModel):
    month: str  # YYYY-MM
    income: Money
    expense: Money
    net: Money


class FinanceSummary(BaseModel):
    month: str
    balance: Money  # all-time income - expenses
    income: Money
    expense: Money
    net: Money
    savings_rate: float | None
    prev_income: Money
    prev_expense: Money
    budget: BudgetOut | None
    expense_by_category: list[CategoryTotal]
    income_by_category: list[CategoryTotal]
    daily_spend: list[dict]
    trend: list[MonthPoint]
