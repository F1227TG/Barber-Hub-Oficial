"""Growth services for insights, opportunities, goals and team permissions."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from backend.errors import ApiError
from backend.models import GoalCreate, GoalUpdate, OpportunityUpdate, TeamPermissionsUpdate
from backend.security import AuthContext
from backend.services.access import first_visible, model_payload, require_feature
from backend.supabase import gateway


async def permissions(establishment_id: str, auth: AuthContext) -> dict[str, Any]:
    return await gateway.rest("obter_minhas_permissoes_193", method="POST", token=auth.token, rpc=True, json={"p_estabelecimento_id": establishment_id}) or {}


async def update_member_permissions(member_id: str, payload: TeamPermissionsUpdate, auth: AuthContext) -> dict[str, Any]:
    return await gateway.rest("atualizar_permissoes_membro_193", method="POST", token=auth.token, rpc=True, json={"p_membro_id": member_id, "p_permissoes": payload.permissoes}) or {}


async def insights(establishment_id: str, start: date, end: date, auth: AuthContext) -> dict[str, Any]:
    if end < start or end > start + timedelta(days=366):
        raise ApiError(422, "INVALID_GROWTH_RANGE", "Consulte um período de até 367 dias.")
    await require_feature(establishment_id, auth, "permite_insights", "Insights estão disponíveis no plano Elite.")
    return await gateway.rest("resumo_crescimento_193", method="POST", token=auth.token, rpc=True, json={"p_estabelecimento_id": establishment_id, "p_inicio": start.isoformat(), "p_fim": end.isoformat()}) or {}


async def opportunities(establishment_id: str, auth: AuthContext) -> list[dict[str, Any]]:
    await require_feature(establishment_id, auth, "permite_oportunidades", "Central de Oportunidades disponível no plano Elite.")
    await gateway.rest("recalcular_oportunidades_193", method="POST", token=auth.token, rpc=True, json={"p_estabelecimento_id": establishment_id})
    return await gateway.rest("oportunidades_crescimento", token=auth.token, params={"estabelecimento_id": f"eq.{establishment_id}", "status": "eq.aberta", "select": "*", "order": "prioridade.asc,detectada_em.desc", "limit": "100"}) or []


async def update_opportunity(opportunity_id: str, payload: OpportunityUpdate, auth: AuthContext) -> dict[str, Any]:
    return await gateway.rest("atualizar_oportunidade_193", method="POST", token=auth.token, rpc=True, json={"p_oportunidade_id": opportunity_id, "p_status": payload.status})


async def list_goals(establishment_id: str, auth: AuthContext) -> list[dict[str, Any]]:
    await require_feature(establishment_id, auth, "permite_metas", "Metas estão disponíveis a partir do plano Profissional.")
    goals = await gateway.rest("metas_crescimento", token=auth.token, params={"estabelecimento_id": f"eq.{establishment_id}", "select": "*,profissionais(nome)", "order": "status.asc,periodo_fim.asc", "limit": "100"}) or []
    for goal in goals:
        goal["progresso"] = await gateway.rest("progresso_meta_193", method="POST", token=auth.token, rpc=True, json={"p_meta_id": str(goal["id"])}) or {}
    return goals


async def create_goal(payload: GoalCreate, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id)
    await require_feature(establishment_id, auth, "permite_metas", "Metas estão disponíveis a partir do plano Profissional.")
    data = model_payload(payload, exclude_unset=False)
    data["criado_por"] = auth.user_id
    rows = await gateway.rest("metas_crescimento", method="POST", token=auth.token, json=data, headers={"Prefer": "return=representation"})
    if not rows:
        raise ApiError(403, "GOAL_FORBIDDEN", "Não foi possível criar a meta.")
    return rows[0]


async def update_goal(goal_id: str, payload: GoalUpdate, auth: AuthContext) -> dict[str, Any]:
    current = await first_visible("metas_crescimento", goal_id, auth, select="id,estabelecimento_id", message="Meta não encontrada.")
    await require_feature(str(current["estabelecimento_id"]), auth, "permite_metas", "Metas indisponíveis no plano atual.")
    data = model_payload(payload)
    if not data:
        raise ApiError(422, "EMPTY_UPDATE", "Informe ao menos um campo para atualizar.")
    rows = await gateway.rest("metas_crescimento", method="PATCH", token=auth.token, params={"id": f"eq.{goal_id}"}, json=data, headers={"Prefer": "return=representation"})
    if not rows:
        raise ApiError(403, "GOAL_FORBIDDEN", "Não foi possível atualizar a meta.")
    return rows[0]
