"""Financial summary, adjustments, commissions and daily closing services."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from backend.errors import ApiError
from backend.models import (
    CommissionRuleCreate,
    CommissionRuleUpdate,
    DayClosingCreate,
    FinancialAdjustmentCreate,
)
from backend.security import AuthContext
from backend.services.access import first_visible, model_payload, require_feature
from backend.supabase import gateway


async def summary(establishment_id: str, start: date, end: date, auth: AuthContext) -> dict[str, Any]:
    if end < start or end > start + timedelta(days=366):
        raise ApiError(422, "INVALID_FINANCE_RANGE", "Consulte um período entre 1 e 367 dias.")
    await require_feature(establishment_id, auth, "permite_financeiro", "O financeiro está disponível a partir do plano Essencial.")
    return await gateway.rest(
        "resumo_financeiro_19",
        method="POST",
        token=auth.token,
        rpc=True,
        json={"p_estabelecimento_id": establishment_id, "p_inicio": start.isoformat(), "p_fim": end.isoformat()},
    ) or {}


async def list_entries(establishment_id: str, start: date, end: date, limit: int, auth: AuthContext) -> list[dict[str, Any]]:
    if end < start or end > start + timedelta(days=366):
        raise ApiError(422, "INVALID_FINANCE_RANGE", "Consulte um período entre 1 e 367 dias.")
    await require_feature(establishment_id, auth, "permite_financeiro", "O financeiro está disponível a partir do plano Essencial.")
    return await gateway.rest(
        "lancamentos_financeiros",
        token=auth.token,
        params={
            "estabelecimento_id": f"eq.{establishment_id}",
            "competencia": f"gte.{start.isoformat()}",
            "and": f"(competencia.lte.{end.isoformat()})",
            "select": "id,agendamento_id,profissional_id,competencia,tipo,natureza,status,descricao,valor_bruto,desconto,valor_liquido,comissao_valor,motivo,origem,created_at",
            "order": "competencia.desc,created_at.desc,id.desc",
            "limit": str(limit),
        },
    ) or []


async def create_adjustment(payload: FinancialAdjustmentCreate, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id)
    await require_feature(establishment_id, auth, "permite_financeiro", "Ajustes financeiros estão indisponíveis no plano atual.")
    return await gateway.rest(
        "criar_ajuste_financeiro_19",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_estabelecimento_id": establishment_id,
            "p_competencia": payload.competencia.isoformat(),
            "p_natureza": payload.natureza,
            "p_valor": float(payload.valor),
            "p_descricao": payload.descricao,
            "p_motivo": payload.motivo,
        },
    )


async def close_day(payload: DayClosingCreate, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id)
    await require_feature(establishment_id, auth, "permite_financeiro", "O fechamento do dia está indisponível no plano atual.")
    return await gateway.rest(
        "fechar_dia_financeiro_19",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_estabelecimento_id": establishment_id,
            "p_data": payload.data.isoformat(),
            "p_observacao": payload.observacao,
        },
    )


async def list_commission_rules(establishment_id: str, auth: AuthContext) -> list[dict[str, Any]]:
    await require_feature(establishment_id, auth, "permite_comissoes", "Comissões estão disponíveis a partir do plano Profissional.")
    return await gateway.rest(
        "regras_comissao",
        token=auth.token,
        params={
            "estabelecimento_id": f"eq.{establishment_id}",
            "select": "id,estabelecimento_id,profissional_id,servico_id,tipo,valor,ativo,created_at,updated_at",
            "order": "updated_at.desc,id.desc",
        },
    ) or []


async def create_commission_rule(payload: CommissionRuleCreate, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id)
    await require_feature(establishment_id, auth, "permite_comissoes", "Comissões estão disponíveis a partir do plano Profissional.")
    rows = await gateway.rest(
        "regras_comissao",
        method="POST",
        token=auth.token,
        json=model_payload(payload, exclude_unset=False),
        headers={"Prefer": "return=representation"},
    )
    if not rows:
        raise ApiError(403, "COMMISSION_RULE_FORBIDDEN", "Não foi possível criar a regra de comissão.")
    return rows[0]


async def update_commission_rule(rule_id: str, payload: CommissionRuleUpdate, auth: AuthContext) -> dict[str, Any]:
    current = await first_visible(
        "regras_comissao", rule_id, auth,
        select="id,estabelecimento_id,tipo,valor", message="Regra de comissão não encontrada.",
    )
    await require_feature(str(current["estabelecimento_id"]), auth, "permite_comissoes", "Comissões estão indisponíveis no plano atual.")
    data = model_payload(payload)
    if not data:
        raise ApiError(422, "EMPTY_UPDATE", "Informe pelo menos um campo para atualizar.")
    effective_type = data.get("tipo", current.get("tipo"))
    effective_value = float(data.get("valor", current.get("valor", 0)))
    if effective_type == "percentual" and effective_value > 100:
        raise ApiError(422, "INVALID_COMMISSION", "A comissão percentual não pode ultrapassar 100%.")
    rows = await gateway.rest(
        "regras_comissao", method="PATCH", token=auth.token,
        params={"id": f"eq.{rule_id}"}, json=data, headers={"Prefer": "return=representation"},
    )
    if not rows:
        raise ApiError(403, "COMMISSION_RULE_FORBIDDEN", "Não foi possível atualizar a regra de comissão.")
    return rows[0]
