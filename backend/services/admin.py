"""Administrative and account operations kept outside the browser."""

import asyncio
import re

from backend.config import settings
from backend.errors import ApiError
from backend.models import AdminSubscriptionUpdate, DeleteAccountRequest, PasswordRecoveryRequest
from backend.security import AuthContext
from backend.supabase import gateway


_ADMIN_RESOURCES = {
    "perfis": {
        "table": "perfis",
        "select": "*",
        "search": ("nome", "email"),
        "statuses": {"cliente", "barbeiro", "admin", "inativo"},
    },
    "estabelecimentos": {
        "table": "estabelecimentos",
        "select": "*",
        "search": ("nome", "cidade", "bairro"),
        "statuses": {"visiveis", "ocultos", "suspensos", "verificados", "destaques"},
    },
    "agendamentos": {
        "table": "agendamentos",
        "select": "*,servicos(id,nome,preco,duracao_min),profissionais(nome),estabelecimentos(nome),agendamento_servicos(servico_id,ordem,nome_snapshot,preco_snapshot,duracao_min_snapshot,servicos(id,nome,preco,duracao_min))",
        "search": (),
        "statuses": {"pendente", "confirmado", "concluido", "cancelado", "recusado", "faltou"},
    },
    "tickets": {
        "table": "tickets_suporte",
        "select": "*",
        "search": ("nome", "email", "assunto"),
        "statuses": {"aberto", "em_atendimento", "respondido", "fechado"},
    },
    "denuncias": {
        "table": "portfolio_denuncias",
        "select": "*,perfis(nome,email),portfolio_publicacoes(id,titulo,status,estabelecimento_id,estabelecimentos(nome))",
        "search": (),
        "statuses": {"aberta", "analisando", "resolvida", "rejeitada"},
    },
    "avaliacoes": {
        "table": "avaliacoes",
        "select": "*,perfis(nome,email),estabelecimentos(nome),agendamentos(data,hora_inicio,servicos(nome),profissionais(nome),agendamento_servicos(ordem,nome_snapshot)),portfolio_publicacoes(id,titulo)",
        "search": (),
        "statuses": {"publicada", "em_analise", "ocultada"},
    },
}


async def list_records(
    resource: str,
    _auth: AuthContext,
    *,
    offset: int = 0,
    limit: int = 50,
    query: str | None = None,
    status: str | None = None,
) -> dict[str, object]:
    """Paginate admin records server-side through a strict allow-list."""

    config = _ADMIN_RESOURCES.get(resource)
    if not config:
        raise ApiError(404, "ADMIN_RESOURCE_NOT_FOUND", "Lista administrativa não encontrada.")
    page_limit = max(1, min(limit, 100))
    page_offset = max(0, min(offset, 100_000))
    params: dict[str, str] = {
        "select": str(config["select"]),
        "order": "created_at.desc,id.desc",
        "offset": str(page_offset),
        "limit": str(page_limit),
    }
    clean_query = re.sub(r"[^0-9A-Za-zÀ-ÿ@ _+\-]", " ", query or "").strip()[:80]
    search_fields = tuple(config["search"])
    if clean_query and search_fields:
        params["or"] = "(" + ",".join(f"{field}.ilike.*{clean_query}*" for field in search_fields) + ")"
    clean_status = (status or "").strip().lower()
    if clean_status and clean_status != "todos":
        if clean_status not in config["statuses"]:
            raise ApiError(422, "INVALID_ADMIN_FILTER", "Filtro administrativo inválido.")
        if resource == "perfis":
            params["ativo"] = "eq.false" if clean_status == "inativo" else "eq.true"
            if clean_status != "inativo":
                params["tipo"] = f"eq.{clean_status}"
        elif resource == "estabelecimentos":
            if clean_status == "visiveis":
                params.update({"visivel": "eq.true", "suspenso_pela_moderacao": "eq.false"})
            elif clean_status == "ocultos":
                params.update({"visivel": "eq.false", "suspenso_pela_moderacao": "eq.false"})
            elif clean_status == "suspensos":
                params["suspenso_pela_moderacao"] = "eq.true"
            elif clean_status == "verificados":
                params["verificado"] = "eq.true"
            elif clean_status == "destaques":
                params["destaque"] = "eq.true"
        else:
            params["status"] = f"eq.{clean_status}"
    response = await gateway.request(
        f"/rest/v1/{config['table']}",
        admin=True,
        params=params,
        headers={"Prefer": "count=exact"},
    )
    items = response.json() or []
    content_range = response.headers.get("content-range", "")
    try:
        total = int(content_range.rsplit("/", 1)[1])
    except (ValueError, IndexError):
        total = page_offset + len(items)
    return {
        "items": items,
        "offset": page_offset,
        "limit": page_limit,
        "total": total,
        "has_more": page_offset + len(items) < total,
    }


async def _count(table: str, filters: dict[str, str] | None = None) -> int:
    response = await gateway.request(
        f"/rest/v1/{table}",
        admin=True,
        params={"select": "id", "limit": "1", **(filters or {})},
        headers={"Prefer": "count=exact", "Range": "0-0"},
    )
    content_range = response.headers.get("content-range", "0/0")
    try:
        return int(content_range.rsplit("/", 1)[1])
    except (ValueError, IndexError):
        return 0


async def delete_own_account(payload: DeleteAccountRequest, auth: AuthContext) -> None:
    if payload.confirmacao.strip().upper() != "EXCLUIR MINHA CONTA":
        raise ApiError(422, "CONFIRMATION_REQUIRED", "Digite EXCLUIR MINHA CONTA para confirmar a exclusão.")
    await gateway.rest(
        "excluir_minha_conta",
        method="POST",
        token=auth.token,
        rpc=True,
        json={},
    )


async def overview(_auth: AuthContext) -> dict[str, int]:
    usuarios, estabelecimentos, agendamentos, tickets, avaliacoes = await asyncio.gather(
        _count("perfis"),
        _count("estabelecimentos"),
        _count("agendamentos"),
        _count("tickets_suporte", {"status": "in.(aberto,em_atendimento,respondido)"}),
        _count("avaliacoes"),
    )
    return {
        "usuarios": usuarios,
        "estabelecimentos": estabelecimentos,
        "agendamentos": agendamentos,
        "tickets_abertos": tickets,
        "avaliacoes": avaliacoes,
    }


async def send_password_recovery(
    user_id: str,
    payload: PasswordRecoveryRequest,
    auth: AuthContext,
) -> dict[str, str | bool]:
    # Passwords are hashes and are never readable. The safe administrative
    # action is to issue a recovery flow to the account owner's e-mail.
    user = await gateway.admin_auth_user(user_id)
    email = user.get("email")
    if not email:
        raise ApiError(404, "USER_EMAIL_NOT_FOUND", "A conta não possui e-mail disponível para recuperação.")
    await gateway.send_recovery_email(email)
    print(
        f"[Barber Hub API] password recovery admin={auth.user_id} user={user_id} "
        f"reason={(payload.motivo or '')[:120]!r}"
    )
    return {"sent": True, "email_masked": _mask_email(email)}


def _mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    if len(local) <= 2:
        masked = local[:1] + "*"
    else:
        masked = local[:2] + "*" * max(2, len(local) - 2)
    return f"{masked}@{domain}"


async def navigation_audit(_auth: AuthContext) -> dict[str, str]:
    return {
        "source": "docs/MAPA_DE_NAVEGACAO.md",
        "page": "/html/mapa-sistema.html",
        "status": "available",
    }


async def health_details(auth: AuthContext) -> dict[str, object]:
    """Protected health view for the administrative dashboard.

    Reaching this function already proves that the bearer token was validated by
    Supabase Auth. In addition to normal database counts, we probe the 1.8 FTS
    RPC so the admin can distinguish "API online" from "marketplace migration
    missing" after a deploy.
    """
    overview_data = await overview(auth)
    marketplace = {"status": "online", "engine": "postgres-fts"}
    try:
        await gateway.rest(
            "buscar_marketplace",
            method="POST",
            admin=True,
            rpc=True,
            json={
                "p_busca": None,
                "p_tipo": None,
                "p_agenda": None,
                "p_status": None,
                "p_offset": 0,
                "p_limit": 1,
                "p_somente_destaques": False,
            },
        )
    except Exception:
        marketplace = {"status": "migration_required", "engine": "postgres-fts"}
    release_probes = await asyncio.gather(
        _release_probe("estabelecimento_horario_periodos"),
        _release_probe("biblioteca_capas"),
        _release_probe("feature_flags"),
        return_exceptions=True,
    )
    migrations = {
        "29": release_probes[0] is True,
        "30": release_probes[1] is True,
        "31": release_probes[2] is True,
    }
    return {
        "api": {"status": "online", "version": "1.6.0"},
        "database": {"status": "online", "provider": "supabase-postgres"},
        "auth": {"status": "online", "provider": "supabase-auth"},
        "marketplace": marketplace,
        "overview": overview_data,
        "release": {
            "version": "1.10.0",
            "migrations": migrations,
            "configuration": {
                "allowed_origins": bool(settings.allowed_origins),
                "password_redirect": bool(settings.password_redirect_url),
                "captcha": bool(settings.turnstile_site_key),
                "device_notifications": bool(settings.vapid_public_key),
            },
        },
    }


async def _release_probe(table: str) -> bool:
    """Check a release object without returning its rows or leaking metadata."""
    await gateway.rest(table, method="GET", admin=True, params={"select": "id", "limit": "1"})
    return True


async def audit_action(
    auth: AuthContext,
    *,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    details: dict | None = None,
    request_id: str | None = None,
) -> None:
    """Persist a searchable administrative audit event without sensitive data."""
    try:
        await gateway.rest(
            "auditoria_admin",
            method="POST",
            admin=True,
            json={
                "admin_id": auth.user_id,
                "acao": action,
                "alvo_tipo": target_type,
                "alvo_id": target_id,
                "detalhes": details or {},
                "request_id": request_id,
            },
        )
    except Exception as exc:
        # Audit logging must not break the primary admin action.
        print(f"[Barber Hub API] audit write failed: {exc!r}")


async def list_subscriptions(_auth: AuthContext) -> dict[str, object]:
    """Return the administrative subscription workspace in one request."""
    plans, establishments, profiles, subscriptions = await asyncio.gather(
        gateway.rest(
            "planos",
            method="GET",
            admin=True,
            params={"select": "*", "ativo": "eq.true", "order": "ordenacao.asc"},
        ),
        gateway.rest(
            "estabelecimentos",
            method="GET",
            admin=True,
            params={
                "select": "id,owner_id,nome,cidade,estado,aceita_agendamento,created_at",
                "order": "created_at.desc",
                "limit": "500",
            },
        ),
        gateway.rest(
            "perfis",
            method="GET",
            admin=True,
            params={"select": "id,nome,email,tipo,ativo", "limit": "1000"},
        ),
        gateway.rest(
            "assinaturas",
            method="GET",
            admin=True,
            params={
                "select": "id,estabelecimento_id,plano_id,status,inicio_em,teste_termina_em,periodo_atual_inicio,periodo_atual_fim,observacoes,updated_at,planos(id,slug,nome,ordenacao)",
                "limit": "500",
            },
        ),
    )
    return {
        "plans": plans or [],
        "establishments": establishments or [],
        "profiles": profiles or [],
        "subscriptions": subscriptions or [],
    }


async def assign_subscription(
    establishment_id: str,
    payload: AdminSubscriptionUpdate,
    auth: AuthContext,
) -> dict[str, object]:
    rows = await gateway.rest(
        "admin_atribuir_plano",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_estabelecimento_id": establishment_id,
            "p_plano_slug": payload.plano_slug,
            "p_status": payload.status,
            "p_periodo_fim": payload.periodo_fim.isoformat() if payload.periodo_fim else None,
            "p_observacoes": payload.observacoes,
        },
    )
    if isinstance(rows, list):
        return rows[0] if rows else {}
    return rows or {}
