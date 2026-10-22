"""Validated contracts for marketplace."""

from datetime import date
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class PromotionCreate(BaseModel):
    estabelecimento_id: UUID
    titulo: str = Field(min_length=3, max_length=120)
    descricao: str = Field(min_length=3, max_length=600)
    codigo: str | None = Field(default=None, max_length=40)
    desconto_percentual: Decimal | None = Field(default=None, ge=0, le=100)
    inicia_em: date | None = None
    termina_em: date | None = None
    ativo: bool = True

    @field_validator("termina_em")
    @classmethod
    def validate_period(cls, value, info):
        inicio = info.data.get("inicia_em")
        if value and inicio and value < inicio:
            raise ValueError("A data final não pode ser anterior ao início.")
        return value


class PromotionUpdate(BaseModel):
    titulo: str | None = Field(default=None, min_length=3, max_length=120)
    descricao: str | None = Field(default=None, min_length=3, max_length=600)
    codigo: str | None = Field(default=None, max_length=40)
    desconto_percentual: Decimal | None = Field(default=None, ge=0, le=100)
    inicia_em: date | None = None
    termina_em: date | None = None
    ativo: bool | None = None
