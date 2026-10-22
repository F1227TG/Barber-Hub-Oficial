"""Account persistence contract, independent of Supabase and HTTP."""
from typing import Any, Protocol


class AccountRepository(Protocol):
    async def profile(self, user_id: str) -> dict[str, Any] | None: ...

    async def session_active(self, user_id: str, session_id: str) -> bool: ...

    async def administer(self, *, actor_id: str, user_id: str, changes: dict[str, Any],
                         request_id: str | None) -> dict[str, Any]: ...
