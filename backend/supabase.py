"""Asynchronous gateway to Supabase Auth and PostgREST."""

from typing import Any

import httpx

from backend.config import settings
from backend.errors import ApiError


class SupabaseGateway:
    def _ensure_configured(self, *, secret: bool = False) -> None:
        if not settings.supabase_url or not settings.publishable_key:
            raise ApiError(503, "BACKEND_NOT_CONFIGURED", "A API ainda não recebeu as variáveis do Supabase.")
        if secret and not settings.secret_key:
            raise ApiError(503, "BACKEND_NOT_CONFIGURED", "A chave protegida do backend não foi configurada.")

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

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.request(
                method,
                f"{settings.supabase_url}{path}",
                headers=request_headers,
                params=params,
                json=json,
            )

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

            message = details.get("message") if isinstance(details, dict) else "Não foi possível concluir a operação."
            raise ApiError(response.status_code, "SUPABASE_ERROR", message or "Não foi possível concluir a operação.", details)
        return response

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

    async def admin_auth_user(self, user_id: str) -> dict[str, Any]:
        response = await self.request(f"/auth/v1/admin/users/{user_id}", admin=True)
        return response.json()

    async def send_recovery_email(self, email: str) -> None:
        await self.request(
            "/auth/v1/recover",
            method="POST",
            json={"email": email, "gotrue_meta_security": {}},
            params={"redirect_to": settings.password_redirect_url},
        )


gateway = SupabaseGateway()
