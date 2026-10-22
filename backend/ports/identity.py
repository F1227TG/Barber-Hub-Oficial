"""Identity verification contract; tokens are never trusted before verification."""
from typing import Any, Protocol


class IdentityProvider(Protocol):
    async def verify(self, token: str) -> dict[str, Any]: ...
