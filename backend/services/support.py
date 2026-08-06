"""Support ticket validation, anti-spam and persistence."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Request

from backend.errors import ApiError
from backend.models import SupportTicketCreate
from backend.security import AuthContext
from backend.supabase import gateway


async def _optional_user(authorization: str | None) -> AuthContext | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        user = await gateway.auth_user(token)
    except ApiError:
        return None
    return AuthContext(token=token, user_id=str(user["id"]), user=user)


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
    return rows if isinstance(rows, list) else []


async def create(
    payload: SupportTicketCreate,
    authorization: str | None,
    request: Request,
) -> dict:
    if payload.website.strip():
        raise ApiError(422, "SPAM_DETECTED", "Não foi possível validar o envio.")

    auth = await _optional_user(authorization)
    since = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    recent = await gateway.rest(
        "tickets_suporte",
        admin=True,
        params={
            "email": f"eq.{payload.email}",
            "created_at": f"gte.{since}",
            "select": "id",
            "limit": "1",
        },
    )
    if isinstance(recent, list) and recent:
        raise ApiError(429, "RATE_LIMITED", "Aguarde um minuto antes de enviar outro ticket.")

    row = {
        "id": str(uuid4()),
        "user_id": auth.user_id if auth else None,
        "nome": payload.nome.strip(),
        "email": str(payload.email).lower(),
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
    print(f"[Barber Hub API] support ticket={row['id']} authenticated={bool(auth)} ip={ip[:80]}")
    return created[0] if isinstance(created, list) and created else row
