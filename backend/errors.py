"""Domain errors converted into the API's standard JSON response."""

from dataclasses import dataclass
from typing import Any


@dataclass
class ApiError(Exception):
    status_code: int
    code: str
    message: str
    details: Any = None

    def __str__(self) -> str:
        return self.message
