"""Role capabilities shared by team services and offline tests."""

from __future__ import annotations

ROLE_CAPABILITIES: dict[str, frozenset[str]] = {
    "proprietario": frozenset({"agenda", "crm", "financeiro", "equipe", "configuracoes"}),
    "admin": frozenset({"agenda", "crm", "financeiro", "equipe", "configuracoes"}),
    "gerente": frozenset({"agenda", "crm", "financeiro", "equipe", "configuracoes"}),
    "recepcao": frozenset({"agenda", "crm"}),
    "profissional": frozenset({"agenda", "crm", "comissoes_proprias"}),
}


def role_can(role: str | None, capability: str) -> bool:
    return capability in ROLE_CAPABILITIES.get(role or "", frozenset())


def can_manage_appointment(
    role: str | None,
    *,
    linked_professional_id: str | None,
    appointment_professional_id: str | None,
) -> bool:
    if role in {"proprietario", "admin", "gerente", "recepcao"}:
        return True
    return (
        role == "profissional"
        and linked_professional_id is not None
        and linked_professional_id == appointment_professional_id
    )

