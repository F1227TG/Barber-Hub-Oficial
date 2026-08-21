"""Pure appointment state-machine rules shared by API services and tests."""

from __future__ import annotations

APPOINTMENT_TRANSITIONS: dict[str, frozenset[str]] = {
    "pendente": frozenset({"confirmado", "recusado", "cancelado"}),
    "confirmado": frozenset({"concluido", "cancelado", "faltou"}),
    "recusado": frozenset(),
    "concluido": frozenset(),
    "cancelado": frozenset(),
    "faltou": frozenset(),
}


def allowed_transitions(status: str) -> frozenset[str]:
    """Return the immutable set of valid next states for ``status``."""
    return APPOINTMENT_TRANSITIONS.get(status, frozenset())


def can_transition(previous: str, target: str) -> bool:
    """Return whether an appointment may move from ``previous`` to ``target``."""
    return target in allowed_transitions(previous)

