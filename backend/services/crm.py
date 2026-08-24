"""Persistent CRM services for establishment-client relationships."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from backend.domain.crm import normalize_tags
from backend.errors import ApiError
from backend.models import CRMClientUpdate, CRMNoteCreate
from backend.security import AuthContext
from backend.services.access import first_visible, model_payload, require_feature
from backend.supabase import gateway


async def list_clients(
    establishment_id: str,
    query: str | None,
    segment: str | None,
    cursor_last: datetime | None,
    cursor_id: str | None,
    limit: int,
    auth: AuthContext,
) -> list[dict[str, Any]]:
    await require_feature(establishment_id, auth, "permite_crm", "O CRM está disponível a partir do plano Essencial.")
    return await gateway.rest(
        "listar_clientes_crm_19",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_estabelecimento_id": establishment_id,
            "p_busca": query,
            "p_segmento": segment,
            "p_cursor_ultima": cursor_last.isoformat() if cursor_last else None,
            "p_cursor_id": cursor_id,
            "p_limite": limit,
        },
    ) or []


async def get_client(client_id: str, auth: AuthContext) -> dict[str, Any]:
    client = await first_visible(
        "clientes_estabelecimento",
        client_id,
        auth,
        select=(
            "id,estabelecimento_id,cliente_id,nome,email,telefone,preferencias,tags,permite_whatsapp,permite_email_marketing,data_nascimento,"
            "segmento,total_agendamentos,visitas_concluidas,cancelamentos,faltas,gasto_total,"
            "primeira_visita_em,ultima_visita_em,proxima_visita_em,profissional_preferido_id,servico_preferido_id"
        ),
        message="Cliente não encontrado ou sem permissão de acesso.",
    )
    await require_feature(str(client["estabelecimento_id"]), auth, "permite_crm", "O CRM está indisponível no plano atual.")
    notes = await gateway.rest(
        "cliente_notas",
        token=auth.token,
        params={
            "relacionamento_id": f"eq.{client_id}",
            "arquivada_em": "is.null",
            "select": "id,autor_id,conteudo,created_at,updated_at",
            "order": "created_at.desc,id.desc",
            "limit": "100",
        },
    )
    return {**client, "notes": notes or []}


async def update_client(client_id: str, payload: CRMClientUpdate, auth: AuthContext) -> dict[str, Any]:
    current = await first_visible(
        "clientes_estabelecimento",
        client_id,
        auth,
        select="id,estabelecimento_id",
        message="Cliente não encontrado ou sem permissão de edição.",
    )
    await require_feature(str(current["estabelecimento_id"]), auth, "permite_crm", "O CRM está indisponível no plano atual.")
    data = model_payload(payload)
    if "tags" in data and data["tags"] is not None:
        data["tags"] = normalize_tags(data["tags"])
    if not data:
        raise ApiError(422, "EMPTY_UPDATE", "Informe pelo menos um campo para atualizar.")
    rows = await gateway.rest(
        "clientes_estabelecimento",
        method="PATCH",
        token=auth.token,
        params={"id": f"eq.{client_id}"},
        json=data,
        headers={"Prefer": "return=representation"},
    )
    if not rows:
        raise ApiError(403, "CRM_UPDATE_FORBIDDEN", "Não foi possível atualizar a ficha do cliente.")
    return rows[0]


async def add_note(client_id: str, payload: CRMNoteCreate, auth: AuthContext) -> dict[str, Any]:
    current = await first_visible(
        "clientes_estabelecimento",
        client_id,
        auth,
        select="id,estabelecimento_id",
        message="Cliente não encontrado ou sem permissão para adicionar nota.",
    )
    await require_feature(str(current["estabelecimento_id"]), auth, "permite_crm", "O CRM está indisponível no plano atual.")
    rows = await gateway.rest(
        "cliente_notas",
        method="POST",
        token=auth.token,
        json={"relacionamento_id": client_id, "autor_id": auth.user_id, "conteudo": payload.conteudo.strip()},
        headers={"Prefer": "return=representation"},
    )
    if not rows:
        raise ApiError(403, "CRM_NOTE_FORBIDDEN", "Não foi possível salvar a nota interna.")
    return rows[0]

