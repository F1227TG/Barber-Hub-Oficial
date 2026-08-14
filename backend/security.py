"""Authentication and role checks used by protected routes."""

from dataclasses import dataclass
from typing import Any

from fastapi import Header

from backend.errors import ApiError
from backend.supabase import gateway


@dataclass(frozen=True)
class AuthContext:
    token: str
    user_id: str
    user: dict[str, Any]
    profile: dict[str, Any] | None = None


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "UNAUTHORIZED", "Entre na conta para continuar.")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise ApiError(401, "UNAUTHORIZED", "Sessão inválida.")
    return token


async def require_user(authorization: str | None = Header(default=None)) -> AuthContext:
    token = _bearer(authorization)
    try:
        user = await gateway.auth_user(token)
    except ApiError as exc:
        raise ApiError(401, "INVALID_SESSION", "Sua sessão expirou. Entre novamente.") from exc
    if user.get("email") and not user.get("email_confirmed_at"):
        raise ApiError(403, "EMAIL_NOT_CONFIRMED", "Confirme seu e-mail antes de continuar.")
    return AuthContext(token=token, user_id=str(user["id"]), user=user)


async def require_admin(authorization: str | None = Header(default=None)) -> AuthContext:
    context = await require_user(authorization)
    rows = await gateway.rest(
        "perfis",
        admin=True,
        params={"id": f"eq.{context.user_id}", "select": "id,nome,email,tipo,ativo", "limit": "1"},
    )
    profile = rows[0] if isinstance(rows, list) and rows else None
    if not profile or not profile.get("ativo") or profile.get("tipo") != "admin":
        raise ApiError(403, "FORBIDDEN", "Esta operação exige uma conta administrativa ativa.")
    return AuthContext(
        token=context.token,
        user_id=context.user_id,
        user=context.user,
        profile=profile,
    )
