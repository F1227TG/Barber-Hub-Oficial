"""Pure money and commission calculations for offline regression tests."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")


def money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_commission(gross: Decimal, rule_type: str, rule_value: Decimal) -> Decimal:
    gross = max(money(gross), Decimal("0.00"))
    value = max(money(rule_value), Decimal("0.00"))
    if rule_type == "percentual":
        if value > 100:
            raise ValueError("A comissão percentual não pode ultrapassar 100%.")
        return money(gross * value / 100)
    if rule_type == "fixo":
        return min(value, gross)
    raise ValueError("Tipo de comissão inválido.")


def net_revenue(gross: Decimal, credits: Decimal, debits: Decimal) -> Decimal:
    return money(money(gross) + money(credits) - money(debits))

