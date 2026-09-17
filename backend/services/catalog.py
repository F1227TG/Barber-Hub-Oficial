"""Public marketplace catalog operations.

Search is server-side and paginated. PostgreSQL FTS is the primary path while
migration 15 deliberately keeps ILIKE fallbacks for short/prefix terms.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from backend.errors import ApiError
from backend.services.access import object_payload, rows_payload
from backend.supabase import gateway

CATALOG_SELECT = (
    "id,tipo_estabelecimento,nome,slug,descricao,email_publico,telefone,whatsapp,"
    "instagram,tiktok,website,cep,cidade,estado,bairro,endereco,numero,complemento,"
    "foto_url,capa_url,status_manual,motivo_status,aceita_agendamento,avaliacao,"
    "intervalo_slots_min,antecedencia_min_horas,limite_dias_agendamento,verificado,destaque,timezone,"
    "latitude,longitude,precisao_localizacao,codigo_municipio_ibge,raio_atendimento_km,"
    "estabelecimento_horario_periodos(id,dia_semana,abre,fecha,fecha_dia_seguinte,ordem,ativo),"
    "horarios_funcionamento(id,dia_semana,aberto,abre,fecha,intervalo_inicio,intervalo_fim),"
    "dias_bloqueados(id,data),"
    "profissionais(id,estabelecimento_id,nome,especialidade,bio,avatar_url,ativo,aceita_agendamento,"
    "profissional_servicos(servico_id)),"
    "servicos(id,estabelecimento_id,nome,categoria,descricao,preco,duracao_min,ativo,publico,destaque),"
    "promocoes(id,estabelecimento_id,titulo,descricao,codigo,desconto_percentual,inicia_em,termina_em,ativo)"
)


def _public_catalog_params(*, reference: str, is_uuid: bool) -> dict[str, str]:
    """Build the one public projection used by both listing and detail routes.

    The API reads with server credentials, so relations must be filtered here
    instead of relying on a browser-side query or on broad anonymous grants.
    """

    return {
        "select": CATALOG_SELECT,
        "id" if is_uuid else "slug": f"eq.{reference}",
        "visivel": "eq.true",
        "onboarding_concluido": "eq.true",
        "profissionais.ativo": "eq.true",
        "servicos.ativo": "eq.true",
        "servicos.publico": "eq.true",
        "promocoes.ativo": "eq.true",
        "limit": "1",
    }


async def public_establishment(reference: str) -> dict[str, Any]:
    """Return one visible establishment without exposing owner/admin fields."""

    try:
        UUID(reference)
        is_uuid = True
    except (TypeError, ValueError):
        is_uuid = False

    rows = rows_payload(await gateway.rest(
        "estabelecimentos",
        admin=True,
        params=_public_catalog_params(reference=reference, is_uuid=is_uuid),
    ), message="Não foi possível carregar este estabelecimento agora.")
    if not rows:
        raise ApiError(404, "ESTABLISHMENT_NOT_FOUND", "Estabelecimento não encontrado ou indisponível.")

    establishment = rows[0]
    # A disponibilidade anunciada nunca pode depender apenas do checkbox do
    # estabelecimento: a RPC incorpora a assinatura efetiva e horários.
    try:
        agenda = await gateway.rest(
            "agenda_online_disponivel",
            method="POST",
            admin=False,
            rpc=True,
            json={"p_estabelecimento_id": establishment["id"]},
        )
        establishment["aceita_agendamento"] = bool(agenda)
    except ApiError:
        # Falhar fechado impede anunciar uma agenda que não foi validada.
        establishment["aceita_agendamento"] = False
    return establishment



async def summary() -> dict[str, int]:
    data = await gateway.rest("metricas_publicas", method="POST", admin=False, json={}, rpc=True)
    row = object_payload(data, message="Não foi possível carregar o resumo público agora.")
    return {
        "estabelecimentos": int(row.get("estabelecimentos") or 0),
        "agendamentos": int(row.get("com_agenda") or 0),
        "barbearias": int(row.get("barbearias") or 0),
        "saloes": int(row.get("saloes") or 0),
    }


async def _fetch_rows(ids: list[str]) -> list[dict[str, Any]]:
    if not ids:
        return []
    rows = await gateway.rest(
        "estabelecimentos",
        admin=True,
        params={
            "select": CATALOG_SELECT,
            "id": f"in.({','.join(ids)})",
            # A API usa service_role, portanto ela própria precisa reaplicar os
            # limites do catálogo público em relações embutidas.
            "profissionais.ativo": "eq.true",
            "servicos.ativo": "eq.true",
            "servicos.publico": "eq.true",
            "promocoes.ativo": "eq.true",
        },
    )
    rows = rows_payload(rows, message="Não foi possível carregar o catálogo agora.")
    by_id = {str(row.get("id")): row for row in rows if row.get("id")}
    return [by_id[item] for item in ids if item in by_id]


async def search(
    *,
    query: str | None = None,
    tipo: str | None = None,
    agenda: bool | None = None,
    status: str | None = None,
    offset: int = 0,
    limit: int = 24,
    featured_only: bool = False,
) -> dict[str, Any]:
    safe_limit = min(max(int(limit or 24), 1), 60)
    safe_offset = max(int(offset or 0), 0)
    ranks = await gateway.rest(
        "buscar_marketplace",
        method="POST",
        admin=True,
        rpc=True,
        json={
            "p_busca": (query or "").strip() or None,
            "p_tipo": tipo if tipo not in (None, "", "todos") else None,
            "p_agenda": agenda,
            "p_status": status if status not in (None, "", "todos") else None,
            "p_offset": safe_offset,
            "p_limit": safe_limit,
            "p_somente_destaques": bool(featured_only),
        },
    )
    rank_rows = rows_payload(ranks, message="Não foi possível pesquisar estabelecimentos agora.")
    ids = [str(item["id"]) for item in rank_rows if item.get("id")]
    rows = await _fetch_rows(ids)
    metadata = {str(item["id"]): item for item in rank_rows}
    for row in rows:
        meta = metadata.get(str(row.get("id")), {})
        row["marketplace_rank"] = float(meta.get("relevancia") or 0)
        row["aberto_agora"] = bool(meta.get("aberto_agora", False))
        # A configuração local só vira agenda pública quando o plano efetivo
        # também contém o benefício (inclusive após expiração/pausa).
        row["aceita_agendamento"] = bool(meta.get("agenda_disponivel", False))
    total = int(rank_rows[0].get("total") or 0) if rank_rows else 0
    return {
        "items": rows,
        "total": total,
        "offset": safe_offset,
        "limit": safe_limit,
        "has_more": safe_offset + len(rows) < total,
        "search_engine": "postgres_fts_with_ilike_fallback",
    }


async def featured(limit: int = 6) -> dict[str, Any]:
    return await search(limit=min(max(limit, 1), 12), featured_only=True)


async def regional_search(
    *, query: str | None = None, tipo: str | None = None, status: str | None = None,
    city: str | None = None, neighborhood: str | None = None,
    state: str | None = None, agenda: bool | None = None,
    latitude: float | None = None, longitude: float | None = None,
    radius_km: float | None = None, service: str | None = None,
    min_price: float | None = None, max_price: float | None = None,
    min_rating: float | None = None, offset: int = 0, limit: int = 24,
) -> dict[str, Any]:
    from backend.services.flags import require_enabled
    await require_enabled("marketplace.regional")
    safe_limit = min(max(int(limit or 24), 1), 60)
    safe_offset = min(max(int(offset or 0), 0), 10_000)
    ranked = await gateway.rest(
        "buscar_marketplace_regional_111", method="POST", admin=False, rpc=True,
        json={
            "p_busca": (query or "").strip() or None,
            "p_tipo": tipo if tipo not in (None, "", "todos") else None,
            "p_status": status if status not in (None, "", "todos") else None,
            "p_agenda": agenda,
            "p_cidade": (city or "").strip() or None,
            "p_bairro": (neighborhood or "").strip() or None,
            "p_estado": (state or "").strip().upper() or None,
            "p_latitude": latitude, "p_longitude": longitude, "p_raio_km": radius_km,
            "p_servico": (service or "").strip() or None,
            "p_preco_min": min_price, "p_preco_max": max_price, "p_avaliacao_min": min_rating,
            "p_offset": safe_offset, "p_limite": safe_limit,
        },
    )
    ranked = rows_payload(ranked, message="Não foi possível pesquisar estabelecimentos nesta região agora.")
    ids = [str(item["id"]) for item in ranked if item.get("id")]
    rows = await _fetch_rows(ids)
    metadata = {str(item["id"]): item for item in ranked}
    for row in rows:
        meta = metadata.get(str(row.get("id")), {})
        row["distancia_km"] = meta.get("distancia_km")
        row["aberto_agora"] = bool(meta.get("aberto", False))
        row["aceita_agendamento"] = bool(meta.get("aceita_agendamento", False))
    total = int(ranked[0].get("total_resultados") or 0) if ranked else 0
    return {"items": rows, "total": total, "offset": safe_offset, "limit": safe_limit,
            "has_more": safe_offset + len(rows) < total, "search_engine": "regional_distance"}


async def cover_library() -> list[dict[str, Any]]:
    from backend.services.flags import require_enabled
    await require_enabled("perfil.biblioteca_capas")
    return rows_payload(await gateway.rest(
        "biblioteca_capas", admin=False,
        params={"select": "id,chave,nome,estilo,url,texto_alternativo,cor_dominante,ordem", "ativo": "eq.true", "order": "ordem.asc,id.asc"},
    ), message="Não foi possível carregar as opções de capa agora.")


async def reviews(
    establishment_id: str, *, offset: int = 0, limit: int = 10, source: str = "all",
) -> dict[str, Any]:
    """Return only published review fields with stable server-side pagination."""

    safe_limit = min(max(int(limit), 1), 30)
    safe_offset = min(max(int(offset), 0), 10_000)
    safe_source = source if source in {"all", "verified", "community"} else "all"
    params = {
        "select": "id,nota,comentario,resposta_estabelecimento,respondido_em,origem,verificada,created_at,perfis(nome,avatar_url)",
        "estabelecimento_id": f"eq.{establishment_id}",
        "status": "eq.publicada",
        "order": "created_at.desc,id.desc",
        "offset": str(safe_offset),
        "limit": str(safe_limit),
    }
    if safe_source == "verified":
        params["or"] = "(verificada.is.true,origem.eq.agendamento)"
    elif safe_source == "community":
        params["verificada"] = "is.false"
        params["origem"] = "neq.agendamento"
    response = await gateway.request(
        "/rest/v1/avaliacoes",
        admin=True,
        params=params,
        headers={"Prefer": "count=exact"},
    )
    rows = rows_payload(response.json(), message="Não foi possível carregar as avaliações agora.")
    content_range = response.headers.get("content-range", "")
    try:
        total = int(content_range.rsplit("/", 1)[1])
    except (ValueError, IndexError):
        total = safe_offset + len(rows)
    establishment = await gateway.rest(
        "estabelecimentos",
        admin=True,
        params={"select": "avaliacao", "id": f"eq.{establishment_id}", "visivel": "eq.true", "limit": "1"},
    )
    establishment = rows_payload(establishment, message="Não foi possível validar este estabelecimento agora.")
    if not establishment:
        raise ApiError(404, "ESTABLISHMENT_NOT_FOUND", "Estabelecimento não encontrado.")
    return {
        "items": rows,
        "total": total,
        "offset": safe_offset,
        "limit": safe_limit,
        "source": safe_source,
        "has_more": safe_offset + len(rows) < total,
        "summary": {"average": float(establishment[0].get("avaliacao") or 0), "total": total},
    }
