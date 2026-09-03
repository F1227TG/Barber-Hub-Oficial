"""Pure rules shared by the real-world operation API.

The functions in this module deliberately avoid FastAPI and Supabase imports so
opening-hours, pagination and idempotency can be regression-tested offline.
"""

from __future__ import annotations

import hashlib
import json
from datetime import time
from decimal import Decimal
from typing import Any, Iterable, Mapping


def _minute(value: time) -> int:
    return value.hour * 60 + value.minute


def opening_period_interval(
    day_of_week: int,
    opens_at: time,
    closes_at: time,
    closes_next_day: bool,
) -> tuple[int, int]:
    """Return a half-open weekly interval measured in minutes.

    ``day_of_week`` follows PostgreSQL ``extract(dow)``: Sunday is 0 and
    Saturday is 6. A period ending at 00:00 must explicitly cross into the next
    day, which avoids treating it as a zero-length period.
    """

    if not 0 <= day_of_week <= 6:
        raise ValueError("O dia da semana precisa ficar entre 0 e 6.")
    start = day_of_week * 1_440 + _minute(opens_at)
    end = day_of_week * 1_440 + _minute(closes_at)
    if closes_next_day:
        end += 1_440
    duration = end - start
    if duration <= 0 or duration > 1_440:
        raise ValueError("Cada período precisa durar entre 1 minuto e 24 horas.")
    return start, end


def validate_opening_periods(periods: Iterable[Mapping[str, Any]]) -> None:
    """Reject duplicate/overlapping weekly periods, including week rollover."""

    intervals: list[tuple[int, int]] = []
    for item in periods:
        start, end = opening_period_interval(
            int(item["dia_semana"]),
            item["abre"],
            item["fecha"],
            bool(item.get("fecha_dia_seguinte", False)),
        )
        intervals.append((start, end))

    week = 7 * 1_440
    expanded = intervals + [(start + week, end + week) for start, end in intervals]
    for index, (start, end) in enumerate(intervals):
        for other_start, other_end in expanded:
            if start == other_start and end == other_end:
                # Skip only this exact representation once. Duplicates are
                # caught below by counting the original intervals.
                continue
            if start < other_end and end > other_start:
                raise ValueError("Os períodos de funcionamento não podem se sobrepor.")
        if intervals.count((start, end)) > 1:
            raise ValueError("Não repita o mesmo período de funcionamento.")


def canonical_request_hash(payload: Mapping[str, Any]) -> str:
    """Create a deterministic SHA-256 used to bind an idempotency key to data."""

    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def normalize_page(limit: int, offset: int = 0, *, maximum: int = 100) -> tuple[int, int]:
    """Bound offset pagination even when services are called outside FastAPI."""

    return min(max(int(limit), 1), maximum), max(int(offset), 0)


def financial_result(income: Decimal | int | float | str, expenses: Decimal | int | float | str) -> Decimal:
    """Return an estimated result; never label it as accounting profit."""

    return (Decimal(str(income)) - Decimal(str(expenses))).quantize(Decimal("0.01"))


def normalize_payment_method(value: str | None) -> str:
    """Translate the public form vocabulary to the database vocabulary."""

    return {"credito": "cartao_credito", "debito": "cartao_debito"}.get(value or "", value or "nao_informado")


def normalize_origin_channel(value: str | None) -> str:
    """Translate assisted booking channels without exposing storage terms in the UI."""

    return {"balcao": "presencial", "barber_hub": "interno"}.get(value or "", value or "outro")
