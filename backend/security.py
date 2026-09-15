"""Authentication and role checks used by protected routes."""

import base64
import json
import time
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
    claims: dict[str, Any] | None = None


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
    return AuthContext(token=token, user_id=str(user["id"]), user=user, claims=_verified_claims(token))


def _verified_claims(token: str) -> dict[str, Any]:
    """Decode claims only after GoTrue accepted the bearer token.

    This helper never performs authorization by itself.  ``require_user`` has
    already asked Auth to validate the signature, expiry and account state.
    """

    try:
        encoded = token.split(".", 2)[1]
        encoded += "=" * (-len(encoded) % 4)
        value = json.loads(base64.urlsafe_b64decode(encoded.encode("ascii")))
        return value if isinstance(value, dict) else {}
    except (IndexError, ValueError, TypeError, json.JSONDecodeError):
        return {}


def recent_authentication_age(context: AuthContext, *, now: float | None = None) -> float | None:
    """Return seconds since the latest strong authentication in a valid JWT."""

    timestamps: list[float] = []
    for item in (context.claims or {}).get("amr") or []:
        if not isinstance(item, dict):
            continue
        method = str(item.get("method") or "").lower()
        if method not in {"password", "otp", "totp", "webauthn", "sso", "sso/saml", "oauth", "recovery", "reauthentication"}:
            continue
        try:
            timestamps.append(float(item["timestamp"]))
        except (KeyError, TypeError, ValueError):
            continue
    if not timestamps:
        return None
    return max(0.0, (time.time() if now is None else now) - max(timestamps))


async def require_recent_user(authorization: str | None = Header(default=None)) -> AuthContext:
    context = await require_user(authorization)
    age = recent_authentication_age(context)
    if age is None or age > 10 * 60:
        raise ApiError(
            403,
            "RECENT_AUTH_REQUIRED",
            "Confirme novamente sua identidade para continuar.",
            {"max_age_seconds": 600},
        )
    return context


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
        claims=context.claims,
    )
