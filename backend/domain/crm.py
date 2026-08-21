"""Pure CRM classification and aggregation helpers."""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal


def classify_client(completed_visits: int, last_visit: datetime | None, now: datetime) -> str:
    if completed_visits <= 0 or last_visit is None:
        return "lead"
    inactive_after = now - timedelta(days=90)
    risk_after = now - timedelta(days=45)
    if last_visit < inactive_after:
        return "inativo"
    if last_visit < risk_after:
        return "em_risco"
    if completed_visits >= 2:
        return "recorrente"
    return "novo"


def average_ticket(total: Decimal, completed_visits: int) -> Decimal:
    if completed_visits <= 0:
        return Decimal("0.00")
    return (total / completed_visits).quantize(Decimal("0.01"))


def normalize_tags(tags: list[str], *, limit: int = 12) -> list[str]:
    normalized: list[str] = []
    for raw in tags:
        value = " ".join(str(raw).strip().lower().split())
        if value and value not in normalized:
            normalized.append(value[:40])
        if len(normalized) >= limit:
            break
    return normalized

