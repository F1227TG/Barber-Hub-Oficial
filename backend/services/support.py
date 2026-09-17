"""Support ticket validation, anti-spam and persistence."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Request

from backend.errors import ApiError
from backend.models import SupportTicketCreate
from backend.security import AuthContext
from backend.services.access import rows_payload
from backend.supabase import gateway


async def list_for_user(auth: AuthContext) -> list[dict]:
    rows = await gateway.rest(
        "tickets_suporte",
        token=auth.token,
        params={
            "user_id": f"eq.{auth.user_id}",
            "select": "*",
            "order": "created_at.desc",
            "limit": "100",
        },
    )
    return rows_payload(rows, message="Não foi possível carregar seus atendimentos agora.")


async def create(
    payload: SupportTicketCreate,
    auth: AuthContext,
    request: Request,
) -> dict:
    if payload.website.strip():
        raise ApiError(422, "SPAM_DETECTED", "Não foi possível validar o envio.")

    account_email = str(auth.user.get("email") or "").strip().lower()
    if not account_email:
        raise ApiError(403, "ACCOUNT_EMAIL_REQUIRED", "A conta precisa ter um e-mail válido para abrir um ticket.")

    since = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    recent = await gateway.rest(
        "tickets_suporte",
        admin=True,
        params={
            "user_id": f"eq.{auth.user_id}",
            "created_at": f"gte.{since}",
            "select": "id",
            "limit": "1",
        },
    )
    recent = rows_payload(recent, message="Não foi possível validar o envio agora.")
    if recent:
        raise ApiError(429, "RATE_LIMITED", "Aguarde um minuto antes de enviar outro ticket.")

    row = {
        "id": str(uuid4()),
        "user_id": auth.user_id,
        "nome": payload.nome.strip(),
        # Bind the reply channel to the verified identity, never a browser field.
        "email": account_email,
        "categoria": payload.categoria,
        "prioridade": payload.prioridade,
        "assunto": payload.assunto.strip(),
        "mensagem": payload.mensagem.strip(),
    }
    created = await gateway.rest(
        "tickets_suporte",
        method="POST",
        admin=True,
        json=row,
        headers={"Prefer": "return=representation"},
    )
    ip = request.headers.get("x-forwarded-for", "")
    print(f"[Barber Hub API] support ticket={row['id']} user={auth.user_id} ip={ip[:80]}")
    created_rows = rows_payload(created, message="Não foi possível confirmar o envio agora.")
    return created_rows[0] if created_rows else row
