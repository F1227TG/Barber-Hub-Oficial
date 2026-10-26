"""Provider-neutral async capabilities consumed by application services."""

from __future__ import annotations

from typing import Any, Protocol

import httpx


class DataGateway(Protocol):
    """HTTP/data operations required by the modular monolith.

    The current composition uses Supabase. Services depend on this port so a
    local test adapter or a different provider can be composed without
    importing the Supabase implementation into each module.
    """

    async def aclose(self) -> None: ...

    async def request(
        self, path: str, *, method: str = "GET", token: str | None = None,
        admin: bool = False, json: Any = None, headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
    ) -> httpx.Response: ...

    async def rest(
        self, table_or_rpc: str, *, method: str = "GET", token: str | None = None,
        admin: bool = False, params: dict[str, Any] | None = None, json: Any = None,
        headers: dict[str, str] | None = None, rpc: bool = False,
    ) -> Any: ...

    async def auth_user(self, token: str) -> dict[str, Any]: ...
    async def auth_sign_out(self, token: str, *, scope: str) -> None: ...
    async def external_request(self, method: str, url: str, **kwargs: Any) -> httpx.Response: ...
    async def admin_auth_user(self, user_id: str) -> dict[str, Any]: ...
    async def admin_delete_user(self, user_id: str) -> None: ...
    async def storage_remove(self, bucket: str, paths: list[str]) -> int: ...
    async def send_recovery_email(self, email: str) -> None: ...
