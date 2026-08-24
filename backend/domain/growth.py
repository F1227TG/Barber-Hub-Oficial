"""Pure growth, opportunity and goal calculations."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP


HUNDRED = Decimal("100")


def percentage(part: int | Decimal, whole: int | Decimal) -> Decimal:
    denominator = Decimal(str(whole))
    if denominator <= 0:
        return Decimal("0.00")
    value = Decimal(str(part)) * HUNDRED / denominator
    return max(Decimal("0"), min(value, HUNDRED)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def occupancy_rate(booked_minutes: int, available_minutes: int) -> Decimal:
    return percentage(max(booked_minutes, 0), max(available_minutes, 0))


def retention_rate(returning_clients: int, served_clients: int) -> Decimal:
    return percentage(max(returning_clients, 0), max(served_clients, 0))


def goal_progress(current: Decimal | int | float | str, target: Decimal | int | float | str) -> Decimal:
    return percentage(Decimal(str(current)), Decimal(str(target)))


def opportunity_priority(impact: int, urgency: int) -> str:
    score = max(impact, 0) + max(urgency, 0)
    if score >= 8:
        return "alta"
    if score >= 5:
        return "media"
    return "baixa"
