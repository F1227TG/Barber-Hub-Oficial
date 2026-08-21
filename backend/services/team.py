"""Operational team membership services."""

from __future__ import annotations

from typing import Any

from backend.errors import ApiError
from backend.models import TeamMemberLink, TeamMemberUpdate
from backend.security import AuthContext
from backend.services.access import first_visible, model_payload, require_feature
from backend.supabase import gateway


async def list_members(establishment_id: str, auth: AuthContext) -> list[dict[str, Any]]:
    await require_feature(establishment_id, auth, "permite_equipe_acesso", "Acesso individual da equipe está disponível a partir do plano Profissional.")
    return await gateway.rest(
        "estabelecimento_membros",
        token=auth.token,
        params={
            "estabelecimento_id": f"eq.{establishment_id}",
            "select": "id,estabelecimento_id,user_id,profissional_id,papel,status,aceito_em,created_at,perfis(nome,email),profissionais(nome,avatar_url)",
            "order": "status.asc,papel.asc,created_at.asc",
        },
    ) or []


async def link_member(payload: TeamMemberLink, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id)
    await require_feature(establishment_id, auth, "permite_equipe_acesso", "Acesso individual da equipe está disponível a partir do plano Profissional.")
    return await gateway.rest(
        "vincular_membro_estabelecimento_19",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_estabelecimento_id": establishment_id,
            "p_email": str(payload.email),
            "p_papel": payload.papel,
            "p_profissional_id": str(payload.profissional_id) if payload.profissional_id else None,
        },
    )


async def update_member(member_id: str, payload: TeamMemberUpdate, auth: AuthContext) -> dict[str, Any]:
    current = await first_visible(
        "estabelecimento_membros", member_id, auth,
        select="id,estabelecimento_id,user_id,papel,status", message="Membro da equipe não encontrado.",
    )
    data = model_payload(payload)
    if not data:
        raise ApiError(422, "EMPTY_UPDATE", "Informe pelo menos um campo para atualizar.")
    row = await gateway.rest(
        "atualizar_membro_estabelecimento_19", method="POST", token=auth.token,
        rpc=True, json={"p_membro_id": member_id, "p_alteracoes": data},
    )
    if not row:
        raise ApiError(403, "TEAM_MEMBER_UPDATE_FORBIDDEN", "Não foi possível atualizar o acesso da equipe.")
    return row
