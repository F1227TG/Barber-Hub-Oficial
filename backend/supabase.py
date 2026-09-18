"""Asynchronous gateway to Supabase Auth and PostgREST.

The gateway owns one keep-alive HTTP pool per API process.  Besides avoiding a
new TLS connection for every operation, keeping the transport here gives the
application one place to translate provider failures into stable, public-safe
errors.
"""

import asyncio
import json
import unicodedata
from typing import Any
from urllib.parse import quote

import httpx

from backend.config import settings
from backend.errors import ApiError


class SupabaseGateway:
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._client_lock = asyncio.Lock()

    async def _get_client(self) -> httpx.AsyncClient:
        client = self._client
        if client is not None and not client.is_closed:
            return client
        async with self._client_lock:
            client = self._client
            if client is None or client.is_closed:
                self._client = httpx.AsyncClient(
                    timeout=httpx.Timeout(20.0, connect=7.0),
                    limits=httpx.Limits(max_connections=40, max_keepalive_connections=20, keepalive_expiry=30.0),
                    follow_redirects=False,
                )
            return self._client

    async def aclose(self) -> None:
        """Release pooled sockets during an orderly application shutdown."""

        async with self._client_lock:
            client, self._client = self._client, None
        if client is not None and not client.is_closed:
            await client.aclose()

    def _ensure_configured(self, *, secret: bool = False) -> None:
        if not settings.supabase_url or not settings.publishable_key:
            raise ApiError(503, "BACKEND_NOT_CONFIGURED", "O Barber Hub ainda está concluindo sua configuração.")
        if secret and not settings.secret_key:
            raise ApiError(503, "BACKEND_NOT_CONFIGURED", "Um serviço protegido do Barber Hub ainda não foi configurado.")

    async def request(
        self,
        path: str,
        *,
        method: str = "GET",
        token: str | None = None,
        admin: bool = False,
        json: Any = None,
        headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
    ) -> httpx.Response:
        self._ensure_configured(secret=admin)
        api_key = settings.secret_key if admin else settings.publishable_key
        request_headers = {
            "apikey": api_key,
            "Content-Type": "application/json",
            **(headers or {}),
        }
        if token:
            request_headers["Authorization"] = f"Bearer {token}"
        elif api_key.startswith("eyJ"):
            request_headers["Authorization"] = f"Bearer {api_key}"

        client = await self._get_client()
        try:
            response = await client.request(
                method,
                f"{settings.supabase_url}{path}",
                headers=request_headers,
                params=params,
                json=json,
            )
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            raise ApiError(
                503,
                "UPSTREAM_UNAVAILABLE",
                "Os serviços do Barber Hub estão temporariamente indisponíveis. Tente novamente em instantes.",
            ) from exc

        if response.is_error:
            try:
                details = response.json()
            except ValueError:
                details = response.text

            # Erros de infraestrutura não devolvem mensagens internas do provedor
            # para o navegador. O request_id da API permite investigar nos logs.
            if response.status_code == 429:
                retry_after = response.headers.get("retry-after")
                raise ApiError(
                    429,
                    "UPSTREAM_RATE_LIMITED",
                    "Muitas solicitações foram feitas em pouco tempo. Aguarde e tente novamente.",
                    None,
                    {"Retry-After": retry_after} if retry_after else None,
                )
            if response.status_code >= 500:
                raise ApiError(
                    503,
                    "UPSTREAM_UNAVAILABLE",
                    "Os serviços do Barber Hub estão temporariamente indisponíveis. Tente novamente em instantes.",
                )

            safe_error = self._safe_error(response.status_code, details)
            # Keep enough context to diagnose a PostgREST/RPC contract problem
            # in server logs without recording payloads, bearer tokens, row data
            # or provider messages that may contain internal details.
            provider_code = str(details.get("code") or "") if isinstance(details, dict) else ""
            print(json.dumps({
                "event": "supabase_upstream_error",
                "method": method,
                "path": path.split("?", 1)[0],
                "upstream_status": response.status_code,
                "provider_code": provider_code or None,
                "safe_code": safe_error.code,
            }, ensure_ascii=False))
            raise safe_error
        return response

    @staticmethod
    def _safe_error(status_code: int, details: Any) -> ApiError:
        """Map known business conflicts without returning provider internals."""

        provider_code = str(details.get("code") or "") if isinstance(details, dict) else ""
        provider_message = str(details.get("message") or "") if isinstance(details, dict) else str(details or "")
        normalized = unicodedata.normalize("NFKD", provider_message).encode("ascii", "ignore").decode().lower()
        stable_code = normalized.strip().upper()

        if "nao pode alterar a localizacao" in normalized or "sem permissao para alterar a localizacao" in normalized:
            return ApiError(
                403,
                "ESTABLISHMENT_LOCATION_FORBIDDEN",
                "Sua conta não tem permissão para alterar a localização deste estabelecimento.",
            )
        if provider_code in {"42501", "PGRST301"} or any(term in normalized for term in (
            "nao pode", "sem permissao", "permission denied", "row-level security", "conta nao pertence",
        )):
            return ApiError(
                403,
                "UPSTREAM_PERMISSION_DENIED",
                "Sua conta não tem permissão para concluir esta alteração.",
            )
        if provider_code in {"PGRST202", "PGRST204", "42703", "42883", "42P01"} or any(term in normalized for term in (
            "schema cache", "could not find the function", "could not find the table", "column",
        )):
            return ApiError(
                503,
                "DATABASE_SCHEMA_OUTDATED",
                "O banco de dados ainda está recebendo uma atualização necessária. Tente novamente em instantes.",
            )
        if "autenticacao obrigatoria" in normalized or "authentication required" in normalized:
            return ApiError(401, "INVALID_SESSION", "Sua sessão expirou. Entre novamente.")
        if provider_code == "23505" or "idempot" in normalized or stable_code in {
            "IDEMPOTENCY_KEY_REUSED", "IDEMPOTENCY_HASH_MISMATCH",
        }:
            return ApiError(
                409,
                "IDEMPOTENCY_CONFLICT" if "idempot" in normalized else "RESOURCE_CONFLICT",
                "Esta operação já foi registrada. Atualize os dados antes de tentar novamente.",
            )
        if stable_code == "OWN_ESTABLISHMENT_BOOKING_FORBIDDEN" or "proprio estabelecimento" in normalized or "propria barbearia" in normalized:
            return ApiError(
                409,
                "SELF_BOOKING_NOT_ALLOWED",
                "Use a agenda profissional para registrar atendimentos no seu próprio estabelecimento.",
            )
        if stable_code in {"SLOT_CONFLICT", "SLOT_BLOCKED", "BOOKING_RESOURCE_UNAVAILABLE"} or any(
            term in normalized for term in ("horario indisponivel", "conflito de horario", "ja existe agendamento")
        ):
            return ApiError(409, "APPOINTMENT_CONFLICT", "Esse horário acabou de ficar indisponível. Escolha outro horário.")
        if stable_code == "RECENT_AUTH_REQUIRED":
            return ApiError(403, "RECENT_AUTH_REQUIRED", "Confirme novamente sua identidade para continuar.")
        if stable_code == "LAST_ACTIVE_ADMIN":
            return ApiError(409, "LAST_ACTIVE_ADMIN", "Defina outro administrador antes de solicitar a exclusão desta conta.")
        if "endereco" in normalized and any(term in normalized for term in ("invalido", "obrigatorio", "informe", "revise")):
            return ApiError(
                422,
                "INVALID_ESTABLISHMENT_LOCATION",
                "Revise endereço, cidade, estado e CEP antes de salvar.",
            )
        if status_code == 401:
            return ApiError(401, "INVALID_SESSION", "Sua sessão expirou. Entre novamente.")
        if status_code == 403:
            return ApiError(403, "FORBIDDEN", "Sua conta não pode realizar esta operação.")
        if status_code == 404 or provider_code == "PGRST116":
            return ApiError(404, "RESOURCE_NOT_FOUND", "O item solicitado não foi encontrado.")
        if status_code == 409:
            return ApiError(409, "RESOURCE_CONFLICT", "Os dados mudaram durante a operação. Atualize e tente novamente.")
        if status_code in {400, 405, 406, 415, 422} or stable_code in {
            "IDEMPOTENCY_KEY_INVALID", "SERVICES_INVALID", "DELETE_REASON_TOO_LONG", "LIMIT_INVALID",
        }:
            return ApiError(422, "UPSTREAM_VALIDATION_ERROR", "Revise os dados informados e tente novamente.")
        return ApiError(
            502,
            "UPSTREAM_ERROR",
            "Não foi possível concluir a operação neste momento. Tente novamente em instantes.",
        )

    async def rest(
        self,
        table_or_rpc: str,
        *,
        method: str = "GET",
        token: str | None = None,
        admin: bool = False,
        params: dict[str, Any] | None = None,
        json: Any = None,
        headers: dict[str, str] | None = None,
        rpc: bool = False,
    ) -> Any:
        path = f"/rest/v1/{'rpc/' if rpc else ''}{table_or_rpc}"
        response = await self.request(
            path,
            method=method,
            token=token,
            admin=admin,
            params=params,
            json=json,
            headers=headers,
        )
        if not response.content:
            return None
        return response.json()

    async def auth_user(self, token: str) -> dict[str, Any]:
        response = await self.request("/auth/v1/user", token=token)
        return response.json()

    async def auth_sign_out(self, token: str, *, scope: str) -> None:
        if scope not in {"global", "local", "others"}:
            raise ValueError("Escopo de encerramento de sessão inválido.")
        await self.request(
            "/auth/v1/logout",
            method="POST",
            token=token,
            params={"scope": scope},
        )

    async def external_request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        """Use the shared transport for a configured server-side integration."""

        client = await self._get_client()
        try:
            return await client.request(method, url, **kwargs)
        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            raise ApiError(503, "INTEGRATION_UNAVAILABLE", "O envio está temporariamente indisponível.") from exc

    async def admin_auth_user(self, user_id: str) -> dict[str, Any]:
        response = await self.request(f"/auth/v1/admin/users/{user_id}", admin=True)
        return response.json()

    async def admin_delete_user(self, user_id: str) -> None:
        """Hard-delete one Auth identity through the supported Admin API."""

        await self.request(
            f"/auth/v1/admin/users/{quote(user_id, safe='')}",
            method="DELETE",
            admin=True,
            json={"should_soft_delete": False},
        )

    async def storage_remove(self, bucket: str, paths: list[str]) -> int:
        """Delete physical objects through Storage API, never its SQL tables."""

        clean_paths = [str(item).strip() for item in paths if str(item).strip()]
        if not clean_paths:
            return 0
        response = await self.request(
            f"/storage/v1/object/{quote(bucket, safe='')}",
            method="DELETE",
            admin=True,
            json={"prefixes": clean_paths},
        )
        try:
            removed = response.json()
        except ValueError:
            removed = []
        return len(removed) if isinstance(removed, list) else len(clean_paths)

    async def send_recovery_email(self, email: str) -> None:
        await self.request(
            "/auth/v1/recover",
            method="POST",
            json={"email": email, "gotrue_meta_security": {}},
            params={"redirect_to": settings.password_redirect_url},
        )


gateway = SupabaseGateway()
