"""Pure subscription-plan limit rules."""

from __future__ import annotations


def normalized_limit(value: object, *, minimum: int = 1) -> int:
    """Normalize an entitlement value to a safe positive integer limit."""
    try:
        parsed = int(value) if value is not None else minimum
    except (TypeError, ValueError):
        parsed = minimum
    return max(parsed, minimum)


def plan_limit_reached(active_count: int, limit: int) -> bool:
    """Return whether another active resource would exceed the plan limit."""
    return max(active_count, 0) >= normalized_limit(limit)

