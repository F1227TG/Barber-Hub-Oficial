"""Retention services: waitlist, recurrence, loyalty, coupons and campaigns."""

from __future__ import annotations

from datetime import date
from typing import Any

from backend.errors import ApiError
from backend.models import (
    CampaignCreate,
    CouponCreate,
    CouponUpdate,
    LoyaltyProgramUpsert,
    LoyaltyRedeem,
    LoyaltyRewardCreate,
    LoyaltyRewardUpdate,
    RecurrenceCreate,
    WaitlistCreate,
    WaitlistUpdate,
)
from backend.security import AuthContext
from backend.services.access import first_visible, model_payload, require_feature
from backend.supabase import gateway


async def list_waitlist(establishment_id: str | None, auth: AuthContext, offset: int = 0, limit: int = 30) -> dict[str, Any]:
    safe_offset, safe_limit = min(max(offset, 0), 10_000), min(max(limit, 1), 60)
    params: dict[str, Any] = {
        "select": "id,estabelecimento_id,cliente_id,profissional_id,servico_id,data_inicio,data_fim,horario_inicio,horario_fim,observacao,status,avisado_em,aviso_expira_em,created_at,perfis(nome,email,telefone),estabelecimentos(nome,slug),profissionais(nome),servicos(nome,duracao_min)",
        "order": "status.asc,data_inicio.asc,created_at.asc",
        "offset": str(safe_offset), "limit": str(safe_limit + 1),
    }
    if establishment_id:
        await require_feature(establishment_id, auth, "permite_lista_espera", "Lista de espera disponível a partir do plano Profissional.")
        params["estabelecimento_id"] = f"eq.{establishment_id}"
    else:
        params["cliente_id"] = f"eq.{auth.user_id}"
    rows = await gateway.rest("lista_espera", token=auth.token, params=params) or []
    return {"items": rows[:safe_limit], "offset": safe_offset, "limit": safe_limit, "has_more": len(rows) > safe_limit}


async def join_waitlist(payload: WaitlistCreate, auth: AuthContext) -> dict[str, Any]:
    return await gateway.rest(
        "entrar_lista_espera_193", method="POST", token=auth.token, rpc=True,
        json={
            "p_estabelecimento_id": str(payload.estabelecimento_id),
            "p_servico_id": str(payload.servico_id),
            "p_profissional_id": str(payload.profissional_id) if payload.profissional_id else None,
            "p_data_inicio": payload.data_inicio.isoformat(),
            "p_data_fim": payload.data_fim.isoformat(),
            "p_horario_inicio": payload.horario_inicio.isoformat() if payload.horario_inicio else None,
            "p_horario_fim": payload.horario_fim.isoformat() if payload.horario_fim else None,
            "p_observacao": payload.observacao,
        },
    )


async def update_waitlist(item_id: str, payload: WaitlistUpdate, auth: AuthContext) -> dict[str, Any]:
    return await gateway.rest(
        "atualizar_lista_espera_193", method="POST", token=auth.token, rpc=True,
        json={"p_item_id": item_id, "p_status": payload.status},
    )


async def create_recurrence(appointment_id: str, payload: RecurrenceCreate, auth: AuthContext) -> dict[str, Any]:
    return await gateway.rest(
        "criar_recorrencia_agendamento_193", method="POST", token=auth.token, rpc=True,
        json={"p_agendamento_id": appointment_id, "p_frequencia": payload.frequencia, "p_total_ocorrencias": payload.total_ocorrencias},
    )


async def list_recurrences(establishment_id: str | None, auth: AuthContext, offset: int = 0, limit: int = 30) -> dict[str, Any]:
    safe_offset, safe_limit = min(max(offset, 0), 10_000), min(max(limit, 1), 60)
    params: dict[str, Any] = {
        "select": "id,estabelecimento_id,agendamento_origem_id,cliente_id,profissional_id,frequencia,total_ocorrencias,ocorrencias_criadas,status,created_at,perfis(nome),estabelecimentos(nome,slug),profissionais(nome)",
        "order": "created_at.desc,id.desc", "offset": str(safe_offset), "limit": str(safe_limit + 1),
    }
    if establishment_id:
        await require_feature(establishment_id, auth, "permite_recorrencia", "Recorrência disponível a partir do plano Essencial.")
        params["estabelecimento_id"] = f"eq.{establishment_id}"
    else:
        params["cliente_id"] = f"eq.{auth.user_id}"
    rows = await gateway.rest("agendamentos_recorrencias", token=auth.token, params=params) or []
    return {"items": rows[:safe_limit], "offset": safe_offset, "limit": safe_limit, "has_more": len(rows) > safe_limit}


async def loyalty_overview(establishment_id: str, auth: AuthContext) -> dict[str, Any]:
    await require_feature(establishment_id, auth, "permite_fidelidade", "Fidelidade disponível a partir do plano Profissional.")
    programs = await gateway.rest("fidelidade_programas", token=auth.token, params={"estabelecimento_id": f"eq.{establishment_id}", "select": "*", "limit": "1"}) or []
    program = programs[0] if programs else None
    if not program:
        return {"programa": None, "recompensas": [], "clientes": []}
    rewards, balances = await _loyalty_children(str(program["id"]), auth)
    return {"programa": program, "recompensas": rewards, "clientes": balances}


async def client_loyalty(auth: AuthContext) -> list[dict[str, Any]]:
    """Return only loyalty balances and rewards visible to the signed-in client."""
    balances = await gateway.rest(
        "fidelidade_saldos",
        token=auth.token,
        params={
            "cliente_id": f"eq.{auth.user_id}",
            "select": "programa_id,cliente_id,pontos,total_creditado,total_resgatado,updated_at",
            "order": "updated_at.desc",
            "limit": "100",
        },
    ) or []
    result: list[dict[str, Any]] = []
    for balance in balances:
        programs = await gateway.rest(
            "fidelidade_programas",
            token=auth.token,
            params={
                "id": f"eq.{balance['programa_id']}",
                "ativo": "eq.true",
                "select": "id,estabelecimento_id,nome,pontos_por_visita,reais_por_ponto,estabelecimentos(nome,slug)",
                "limit": "1",
            },
        ) or []
        if not programs:
            continue
        rewards = await gateway.rest(
            "fidelidade_recompensas",
            token=auth.token,
            params={
                "programa_id": f"eq.{balance['programa_id']}",
                "ativo": "eq.true",
                "select": "id,nome,descricao,pontos_necessarios,estoque",
                "order": "pontos_necessarios.asc",
                "limit": "100",
            },
        ) or []
        result.append({"programa": programs[0], "saldo": balance, "recompensas": rewards})
    return result


async def _loyalty_children(program_id: str, auth: AuthContext) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rewards = await gateway.rest("fidelidade_recompensas", token=auth.token, params={"programa_id": f"eq.{program_id}", "select": "*", "order": "pontos_necessarios.asc", "limit": "100"}) or []
    balances = await gateway.rest("fidelidade_saldos", token=auth.token, params={"programa_id": f"eq.{program_id}", "select": "programa_id,cliente_id,pontos,total_creditado,total_resgatado,updated_at,perfis(nome,email)", "order": "pontos.desc", "limit": "200"}) or []
    return rewards, balances


async def upsert_loyalty_program(payload: LoyaltyProgramUpsert, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id)
    await require_feature(establishment_id, auth, "permite_fidelidade", "Fidelidade disponível a partir do plano Profissional.")
    rows = await gateway.rest(
        "fidelidade_programas", method="POST", token=auth.token,
        params={"on_conflict": "estabelecimento_id"},
        json=model_payload(payload, exclude_unset=False),
        headers={"Prefer": "resolution=merge-duplicates,return=representation"},
    )
    if not rows:
        raise ApiError(403, "LOYALTY_PROGRAM_FORBIDDEN", "Não foi possível salvar o programa de fidelidade.")
    return rows[0]


async def create_reward(payload: LoyaltyRewardCreate, auth: AuthContext) -> dict[str, Any]:
    programs = await gateway.rest("fidelidade_programas", token=auth.token, params={"id": f"eq.{payload.programa_id}", "select": "id,estabelecimento_id", "limit": "1"}) or []
    if not programs:
        raise ApiError(404, "LOYALTY_PROGRAM_NOT_FOUND", "Programa de fidelidade não encontrado.")
    await require_feature(str(programs[0]["estabelecimento_id"]), auth, "permite_fidelidade", "Fidelidade indisponível no plano atual.")
    rows = await gateway.rest("fidelidade_recompensas", method="POST", token=auth.token, json=model_payload(payload, exclude_unset=False), headers={"Prefer": "return=representation"})
    if not rows:
        raise ApiError(403, "LOYALTY_REWARD_FORBIDDEN", "Não foi possível criar a recompensa.")
    return rows[0]


async def update_reward(reward_id: str, payload: LoyaltyRewardUpdate, auth: AuthContext) -> dict[str, Any]:
    data = model_payload(payload)
    if not data:
        raise ApiError(422, "EMPTY_UPDATE", "Informe ao menos um campo para atualizar.")
    rows = await gateway.rest("fidelidade_recompensas", method="PATCH", token=auth.token, params={"id": f"eq.{reward_id}"}, json=data, headers={"Prefer": "return=representation"})
    if not rows:
        raise ApiError(404, "LOYALTY_REWARD_NOT_FOUND", "Recompensa não encontrada ou sem permissão.")
    return rows[0]


async def redeem_reward(reward_id: str, payload: LoyaltyRedeem, auth: AuthContext) -> dict[str, Any]:
    return await gateway.rest("resgatar_recompensa_193", method="POST", token=auth.token, rpc=True, json={"p_recompensa_id": reward_id, "p_cliente_id": str(payload.cliente_id)})


async def list_coupons(establishment_id: str, auth: AuthContext, offset: int = 0, limit: int = 30) -> dict[str, Any]:
    await require_feature(establishment_id, auth, "permite_cupons", "Cupons disponíveis a partir do plano Essencial.")
    safe_offset, safe_limit = min(max(offset, 0), 10_000), min(max(limit, 1), 60)
    rows = await gateway.rest("cupons", token=auth.token, params={"estabelecimento_id": f"eq.{establishment_id}", "select": "*", "order": "ativo.desc,termina_em.asc.nullslast,created_at.desc,id.desc", "offset": str(safe_offset), "limit": str(safe_limit + 1)}) or []
    return {"items": rows[:safe_limit], "offset": safe_offset, "limit": safe_limit, "has_more": len(rows) > safe_limit}


async def create_coupon(payload: CouponCreate, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id)
    await require_feature(establishment_id, auth, "permite_cupons", "Cupons disponíveis a partir do plano Essencial.")
    data = model_payload(payload, exclude_unset=False)
    data["codigo"] = payload.codigo.upper()
    data["criado_por"] = auth.user_id
    rows = await gateway.rest("cupons", method="POST", token=auth.token, json=data, headers={"Prefer": "return=representation"})
    if not rows:
        raise ApiError(403, "COUPON_FORBIDDEN", "Não foi possível criar o cupom.")
    return rows[0]


async def update_coupon(coupon_id: str, payload: CouponUpdate, auth: AuthContext) -> dict[str, Any]:
    current = await first_visible("cupons", coupon_id, auth, select="id,estabelecimento_id", message="Cupom não encontrado.")
    await require_feature(str(current["estabelecimento_id"]), auth, "permite_cupons", "Cupons indisponíveis no plano atual.")
    data = model_payload(payload)
    if not data:
        raise ApiError(422, "EMPTY_UPDATE", "Informe ao menos um campo para atualizar.")
    rows = await gateway.rest("cupons", method="PATCH", token=auth.token, params={"id": f"eq.{coupon_id}"}, json=data, headers={"Prefer": "return=representation"})
    if not rows:
        raise ApiError(403, "COUPON_FORBIDDEN", "Não foi possível atualizar o cupom.")
    return rows[0]


async def create_campaign(payload: CampaignCreate, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id)
    await require_feature(establishment_id, auth, "permite_campanhas", "Campanhas segmentadas estão disponíveis no plano Elite.")
    return await gateway.rest(
        "criar_campanha_193", method="POST", token=auth.token, rpc=True,
        json={
            "p_estabelecimento_id": establishment_id, "p_nome": payload.nome,
            "p_segmento": payload.segmento, "p_canal": payload.canal,
            "p_assunto": payload.assunto, "p_mensagem": payload.mensagem,
            "p_agendada_para": payload.agendada_para.isoformat(),
        },
    )


async def list_campaigns(establishment_id: str, auth: AuthContext, campaign_offset: int = 0, queue_offset: int = 0, limit: int = 30) -> dict[str, Any]:
    await require_feature(establishment_id, auth, "permite_campanhas", "Campanhas segmentadas estão disponíveis no plano Elite.")
    safe_limit = min(max(limit, 1), 60)
    campaign_offset, queue_offset = min(max(campaign_offset, 0), 10_000), min(max(queue_offset, 0), 10_000)
    campaigns = await gateway.rest("campanhas", token=auth.token, params={"estabelecimento_id": f"eq.{establishment_id}", "select": "*", "order": "created_at.desc,id.desc", "offset": str(campaign_offset), "limit": str(safe_limit + 1)}) or []
    queue = await gateway.rest("automacoes_mensagens", token=auth.token, params={"estabelecimento_id": f"eq.{establishment_id}", "select": "id,tipo,canal,status,agendada_para,processada_em,ultimo_erro", "order": "agendada_para.desc,id.desc", "offset": str(queue_offset), "limit": str(safe_limit + 1)}) or []
    return {"campanhas": campaigns[:safe_limit], "fila": queue[:safe_limit], "campanhas_has_more": len(campaigns) > safe_limit,
            "fila_has_more": len(queue) > safe_limit, "campaign_offset": campaign_offset, "queue_offset": queue_offset, "limit": safe_limit}
