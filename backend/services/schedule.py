"""Agenda 2.0 orchestration using caller-scoped RLS and transactional RPCs."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from backend.errors import ApiError
from backend.models import (
    AppointmentConfirmation,
    AppointmentReschedule,
    ScheduleBlockCreate,
    WalkInCreate,
)
from backend.security import AuthContext
from backend.services.access import first_visible, require_feature
from backend.supabase import gateway


async def list_range(
    establishment_id: str,
    start: date,
    end: date,
    professional_id: str | None,
    auth: AuthContext,
) -> dict[str, Any]:
    if end < start or end > start + timedelta(days=31):
        raise ApiError(422, "INVALID_SCHEDULE_RANGE", "Consulte um período entre 1 e 32 dias.")
    await require_feature(
        establishment_id,
        auth,
        "permite_agenda_avancada",
        "A Agenda 2.0 está disponível a partir do plano Essencial.",
    )
    params: dict[str, Any] = {
        "estabelecimento_id": f"eq.{establishment_id}",
        "data": f"gte.{start.isoformat()}",
        "and": f"(data.lte.{end.isoformat()})",
        "select": (
            "id,estabelecimento_id,profissional_id,cliente_id,cliente_nome,cliente_email,"
            "cliente_telefone,data,hora_inicio,hora_fim,inicio_previsto,fim_previsto,status,"
            "valor,observacao,tipo_atendimento,confirmacao_cliente,confirmacao_estabelecimento,"
            "reagendamentos_quantidade,no_show_em,recorrencia_id,recorrencia_sequencia,profissionais(id,nome,avatar_url),"
            "agendamento_servicos(ordem,nome_snapshot,preco_snapshot,duracao_min_snapshot)"
        ),
        "order": "inicio_previsto.asc,id.asc",
        "limit": "500",
    }
    if professional_id:
        params["profissional_id"] = f"eq.{professional_id}"
    appointments = await gateway.rest("agendamentos", token=auth.token, params=params)

    block_params: dict[str, Any] = {
        "estabelecimento_id": f"eq.{establishment_id}",
        "inicio": f"lt.{end.isoformat()}T23:59:59-03:00",
        "fim": f"gt.{start.isoformat()}T00:00:00-03:00",
        "select": "id,estabelecimento_id,profissional_id,inicio,fim,tipo,motivo,criado_por",
        "order": "inicio.asc,id.asc",
        "limit": "500",
    }
    if professional_id:
        block_params["or"] = f"(profissional_id.is.null,profissional_id.eq.{professional_id})"
    blocks = await gateway.rest("agenda_bloqueios", token=auth.token, params=block_params)
    return {"appointments": appointments or [], "blocks": blocks or [], "start": start.isoformat(), "end": end.isoformat()}


async def create_walk_in(payload: WalkInCreate, auth: AuthContext) -> dict[str, str]:
    establishment_id = str(payload.estabelecimento_id)
    await require_feature(
        establishment_id,
        auth,
        "permite_agenda_avancada",
        "Encaixes estão disponíveis a partir do plano Essencial.",
    )
    appointment_id = await gateway.rest(
        "criar_encaixe_operacional_19",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_estabelecimento_id": establishment_id,
            "p_profissional_id": str(payload.profissional_id),
            "p_servicos_ids": [str(item) for item in payload.servicos_ids],
            "p_cliente_nome": payload.cliente_nome,
            "p_cliente_email": str(payload.cliente_email) if payload.cliente_email else None,
            "p_cliente_telefone": payload.cliente_telefone,
            "p_data": payload.data.isoformat(),
            "p_hora_inicio": payload.hora_inicio.isoformat(),
            "p_observacao": payload.observacao,
        },
    )
    return {"id": str(appointment_id)}


async def reschedule(appointment_id: str, payload: AppointmentReschedule, auth: AuthContext) -> dict[str, Any]:
    current = await first_visible(
        "agendamentos",
        appointment_id,
        auth,
        select="id,estabelecimento_id,status",
        message="Agendamento não encontrado ou sem permissão para reagendar.",
    )
    await require_feature(
        str(current["estabelecimento_id"]),
        auth,
        "permite_agenda_avancada",
        "Reagendamento rápido está disponível a partir do plano Essencial.",
    )
    return await gateway.rest(
        "reagendar_agendamento_19",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_agendamento_id": appointment_id,
            "p_profissional_id": str(payload.profissional_id),
            "p_data": payload.data.isoformat(),
            "p_hora_inicio": payload.hora_inicio.isoformat(),
        },
    )


async def confirm(appointment_id: str, payload: AppointmentConfirmation, auth: AuthContext) -> dict[str, Any]:
    return await gateway.rest(
        "registrar_confirmacao_agendamento_19",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_agendamento_id": appointment_id,
            "p_origem": payload.origem,
            "p_confirmacao": payload.confirmacao,
        },
    )


async def mark_no_show(appointment_id: str, auth: AuthContext) -> dict[str, Any]:
    current = await first_visible(
        "agendamentos",
        appointment_id,
        auth,
        select="id,estabelecimento_id,status",
        message="Agendamento não encontrado ou sem permissão para registrar falta.",
    )
    await require_feature(
        str(current["estabelecimento_id"]),
        auth,
        "permite_agenda_avancada",
        "Controle de faltas está disponível a partir do plano Essencial.",
    )
    return await gateway.rest(
        "registrar_no_show_agendamento_19",
        method="POST",
        token=auth.token,
        rpc=True,
        json={"p_agendamento_id": appointment_id},
    )


async def create_block(payload: ScheduleBlockCreate, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id)
    await require_feature(
        establishment_id,
        auth,
        "permite_agenda_avancada",
        "Bloqueios por horário estão disponíveis a partir do plano Essencial.",
    )
    row = await gateway.rest(
        "criar_bloqueio_agenda_19",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_estabelecimento_id": establishment_id,
            "p_profissional_id": str(payload.profissional_id) if payload.profissional_id else None,
            "p_inicio": payload.inicio.isoformat(),
            "p_fim": payload.fim.isoformat(),
            "p_tipo": payload.tipo,
            "p_motivo": payload.motivo,
        },
    )
    if not row:
        raise ApiError(403, "SCHEDULE_BLOCK_FORBIDDEN", "Não foi possível criar o bloqueio nesta agenda.")
    return row


async def delete_block(block_id: str, auth: AuthContext) -> dict[str, bool]:
    rows = await gateway.rest(
        "agenda_bloqueios",
        method="DELETE",
        token=auth.token,
        params={"id": f"eq.{block_id}"},
        headers={"Prefer": "return=representation"},
    )
    if not rows:
        raise ApiError(404, "SCHEDULE_BLOCK_NOT_FOUND", "Bloqueio não encontrado ou sem permissão.")
    return {"deleted": True}
