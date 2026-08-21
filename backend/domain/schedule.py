"""Pure scheduling rules for Agenda 2.0.

This module intentionally has no FastAPI, HTTP or Supabase imports so the
critical period calculations can be verified without network credentials.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta


@dataclass(frozen=True)
class Period:
    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        if self.start >= self.end:
            raise ValueError("O início precisa ser anterior ao fim.")


def periods_overlap(first: Period, second: Period) -> bool:
    """Return whether two half-open periods overlap."""
    return first.start < second.end and first.end > second.start


def appointment_period(day: date, start: time, duration_minutes: int) -> Period:
    """Build a naive local period used before the database applies timezone."""
    if not 5 <= duration_minutes <= 1_440:
        raise ValueError("A duração precisa ficar entre 5 e 1440 minutos.")
    starts_at = datetime.combine(day, start)
    return Period(starts_at, starts_at + timedelta(minutes=duration_minutes))


def schedule_range(anchor: date, view: str) -> tuple[date, date]:
    """Return inclusive dates for a day or Monday-to-Sunday week view."""
    if view == "dia":
        return anchor, anchor
    if view != "semana":
        raise ValueError("A visualização deve ser dia ou semana.")
    start = anchor - timedelta(days=anchor.weekday())
    return start, start + timedelta(days=6)


def validate_future_period(period: Period, now: datetime) -> None:
    """Reject periods that already ended; current walk-ins remain possible."""
    if period.end <= now:
        raise ValueError("Escolha um período atual ou futuro.")


def conflicts_with_blocks(period: Period, blocks: list[Period]) -> bool:
    return any(periods_overlap(period, block) for block in blocks)

