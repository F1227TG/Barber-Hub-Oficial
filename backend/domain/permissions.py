"""Role capabilities shared by team services and offline tests."""

from __future__ import annotations

ROLE_CAPABILITIES: dict[str, frozenset[str]] = {
    "proprietario": frozenset({"agenda", "crm", "financeiro", "equipe", "configuracoes", "retencao", "crescimento", "campanhas", "metas", "permissoes"}),
    "admin": frozenset({"agenda", "crm", "financeiro", "equipe", "configuracoes", "retencao", "crescimento", "campanhas", "metas", "permissoes"}),
    "gerente": frozenset({"agenda", "crm", "financeiro", "equipe", "configuracoes", "retencao", "crescimento", "campanhas", "metas"}),
    "recepcao": frozenset({"agenda", "crm", "retencao"}),
    "profissional": frozenset({"agenda", "crm", "comissoes_proprias", "retencao"}),
}


def role_can(role: str | None, capability: str) -> bool:
    return capability in ROLE_CAPABILITIES.get(role or "", frozenset())


def effective_capabilities(
    role: str | None,
    overrides: dict[str, bool] | None = None,
    *,
    granular_enabled: bool = False,
) -> frozenset[str]:
    """Resolve fixed defaults plus Elite owner-defined overrides."""
    capabilities = set(ROLE_CAPABILITIES.get(role or "", frozenset()))
    if granular_enabled and role not in {"proprietario", "admin"}:
        for capability, allowed in (overrides or {}).items():
            if allowed:
                capabilities.add(capability)
            else:
                capabilities.discard(capability)
    return frozenset(capabilities)


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

