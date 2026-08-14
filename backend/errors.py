"""Domain errors converted into the API's standard JSON response."""

from dataclasses import dataclass
from typing import Any


@dataclass
class ApiError(Exception):
    """Expected domain error safe to return to the browser.

    `headers` is useful for protocol-level errors such as 429, where clients
    should receive a standard `Retry-After` header in addition to JSON.
    """

    status_code: int
    code: str
    message: str
    details: Any = None
    headers: dict[str, str] | None = None

    def __str__(self) -> str:
        return self.message
