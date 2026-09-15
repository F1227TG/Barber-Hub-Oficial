"""Brazilian business identity rules shared by forms and API services."""

from __future__ import annotations

import re

_FIRST_WEIGHTS = (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)
_SECOND_WEIGHTS = (6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)


def normalize_cnpj(value: str) -> str:
    """Return the 14-character Receita Federal representation."""

    normalized = re.sub(r"[.\-/\s]", "", (value or "").strip()).upper()
    if not re.fullmatch(r"[A-Z0-9]{12}[0-9]{2}", normalized):
        raise ValueError("Informe um CNPJ válido, com 14 caracteres.")
    return normalized


def _digit(characters: str, weights: tuple[int, ...]) -> str:
    total = sum((ord(char) - 48) * weight for char, weight in zip(characters, weights, strict=True))
    remainder = total % 11
    return "0" if remainder in {0, 1} else str(11 - remainder)


def cnpj_is_valid(value: str) -> bool:
    """Validate both legacy numeric and the Receita alphanumeric format."""

    try:
        normalized = normalize_cnpj(value)
    except ValueError:
        return False
    if len(set(normalized)) == 1:
        return False
    first = _digit(normalized[:12], _FIRST_WEIGHTS)
    second = _digit(normalized[:12] + first, _SECOND_WEIGHTS)
    return normalized[-2:] == first + second


def validated_cnpj(value: str) -> str:
    normalized = normalize_cnpj(value)
    if not cnpj_is_valid(normalized):
        raise ValueError("Os dígitos verificadores do CNPJ são inválidos.")
    return normalized
