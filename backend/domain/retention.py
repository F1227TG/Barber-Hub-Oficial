"""Pure retention rules shared by API services and offline regression tests."""

from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP


CENT = Decimal("0.01")
RECURRENCE_LIMITS = {"semanal": 7, "quinzenal": 14, "mensal": None}


def recurrence_dates(start: date, frequency: str, occurrences: int) -> list[date]:
    """Return future occurrence dates including the source date."""
    if frequency not in RECURRENCE_LIMITS:
        raise ValueError("Frequência de recorrência inválida.")
    if not 2 <= occurrences <= 24:
        raise ValueError("A recorrência precisa ter entre 2 e 24 ocorrências.")
    result = [start]
    for sequence in range(1, occurrences):
        days = RECURRENCE_LIMITS[frequency]
        if days is not None:
            result.append(date.fromordinal(start.toordinal() + days * sequence))
            continue
        month_index = start.month - 1 + sequence
        year = start.year + month_index // 12
        month = month_index % 12 + 1
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        last_day = date.fromordinal(next_month.toordinal() - 1).day
        result.append(date(year, month, min(start.day, last_day)))
    return result


def loyalty_points(
    amount: Decimal | int | float | str,
    *,
    points_per_visit: int,
    currency_per_point: Decimal | int | float | str = 0,
) -> int:
    """Calculate deterministic points for a completed appointment."""
    visit_points = max(int(points_per_visit), 0)
    divisor = Decimal(str(currency_per_point))
    value = max(Decimal(str(amount)), Decimal("0"))
    money_points = int(value // divisor) if divisor > 0 else 0
    return visit_points + money_points


def coupon_discount(
    subtotal: Decimal | int | float | str,
    *,
    discount_type: str,
    discount_value: Decimal | int | float | str,
    maximum_discount: Decimal | int | float | str | None = None,
) -> Decimal:
    """Return a non-negative discount never greater than the subtotal."""
    total = max(Decimal(str(subtotal)), Decimal("0"))
    value = max(Decimal(str(discount_value)), Decimal("0"))
    if discount_type == "percentual":
        if value > 100:
            raise ValueError("O desconto percentual não pode ultrapassar 100%.")
        discount = total * value / Decimal("100")
    elif discount_type == "fixo":
        discount = value
    else:
        raise ValueError("Tipo de desconto inválido.")
    if maximum_discount is not None:
        discount = min(discount, max(Decimal(str(maximum_discount)), Decimal("0")))
    return min(discount, total).quantize(CENT, rounding=ROUND_HALF_UP)


def waitlist_window_is_valid(start: date, end: date, *, max_days: int = 31) -> bool:
    return start <= end and (end - start).days <= max_days
