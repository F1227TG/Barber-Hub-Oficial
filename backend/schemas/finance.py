"""Validated contracts for finance."""

from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class FinancialAdjustmentCreate(BaseModel):
    estabelecimento_id: UUID
    competencia: date
    natureza: Literal["credito", "debito"]
    valor: Decimal = Field(gt=0, le=1_000_000)
    descricao: str = Field(min_length=2, max_length=180)
    motivo: str = Field(min_length=3, max_length=500)
    chave_idempotencia: str = Field(min_length=16, max_length=100, pattern=r"^[A-Za-z0-9._:-]+$")


class CommissionRuleCreate(BaseModel):
    estabelecimento_id: UUID
    profissional_id: UUID | None = None
    servico_id: UUID | None = None
    tipo: Literal["percentual", "fixo"]
    valor: Decimal = Field(ge=0, le=1_000_000)
    ativo: bool = True

    @field_validator("valor")
    @classmethod
    def validate_commission_value(cls, value: Decimal, info):
        if info.data.get("tipo") == "percentual" and value > 100:
            raise ValueError("A comissão percentual não pode ultrapassar 100%.")
        return value


class CommissionRuleUpdate(BaseModel):
    tipo: Literal["percentual", "fixo"] | None = None
    valor: Decimal | None = Field(default=None, ge=0, le=1_000_000)
    ativo: bool | None = None


class DayClosingCreate(BaseModel):
    estabelecimento_id: UUID
    data: date
    observacao: str | None = Field(default=None, max_length=800)
    chave_idempotencia: str = Field(min_length=16, max_length=100, pattern=r"^[A-Za-z0-9._:-]+$")


class ExpenseCreate(BaseModel):
    estabelecimento_id: UUID
    competencia: date
    valor: Decimal = Field(gt=0, le=1_000_000)
    categoria: str = Field(min_length=2, max_length=80)
    descricao: str = Field(min_length=2, max_length=180)
    forma_pagamento: Literal["dinheiro", "pix", "credito", "debito", "boleto", "transferencia", "outro"] | None = None
    observacao: str | None = Field(default=None, max_length=500)
    chave_idempotencia: str = Field(min_length=16, max_length=100, pattern=r"^[A-Za-z0-9._:-]+$")
