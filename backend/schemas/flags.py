"""Validated contracts for flags."""

import re
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class FeatureFlagEvaluationRequest(BaseModel):
    estabelecimento_id: UUID | None = None
    chaves: list[str] = Field(min_length=1, max_length=50)

    @field_validator("chaves")
    @classmethod
    def validate_feature_keys(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip().lower() for item in value]
        if any(not re.fullmatch(r"[a-z0-9][a-z0-9_.-]{1,79}", item) for item in cleaned):
            raise ValueError("Use apenas chaves de funcionalidade válidas.")
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("Não repita chaves de funcionalidade.")
        return cleaned
