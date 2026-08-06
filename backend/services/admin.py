"""Administrative and account operations kept outside the browser."""

import asyncio

from backend.errors import ApiError
from backend.models import DeleteAccountRequest, PasswordRecoveryRequest
from backend.security import AuthContext
from backend.supabase import gateway


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
    if payload.confirmacao.strip().upper() != "EXCLUIR":
        raise ApiError(422, "CONFIRMATION_REQUIRED", "Digite EXCLUIR para confirmar a exclusão.")
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
