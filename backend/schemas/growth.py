"""Validated contracts for growth."""

from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class GoalCreate(BaseModel):
    estabelecimento_id: UUID
    profissional_id: UUID | None = None
    tipo: Literal["receita", "atendimentos", "ticket_medio", "novos_clientes", "ocupacao"]
    nome: str = Field(min_length=3, max_length=120)
    valor_alvo: Decimal = Field(gt=0, le=1_000_000_000)
    periodo_inicio: date
    periodo_fim: date

    @field_validator("periodo_fim")
    @classmethod
    def validate_goal_period(cls, value: date, info):
        start = info.data.get("periodo_inicio")
        if start and (value < start or (value - start).days > 366):
            raise ValueError("A meta precisa ter um período de até 367 dias.")
        return value


class GoalUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=3, max_length=120)
    valor_alvo: Decimal | None = Field(default=None, gt=0, le=1_000_000_000)
    status: Literal["ativa", "atingida", "encerrada", "cancelada"] | None = None


class OpportunityUpdate(BaseModel):
    status: Literal["aberta", "concluida", "ignorada", "expirada"]
