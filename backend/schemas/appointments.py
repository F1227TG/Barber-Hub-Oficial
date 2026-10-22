"""Validated contracts for appointments."""

from datetime import date, time
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class AppointmentCreate(BaseModel):
    estabelecimento_id: UUID
    profissional_id: UUID
    servicos_ids: list[UUID] = Field(min_length=1, max_length=8)
    data: date
    hora_inicio: time
    observacao: str | None = Field(default=None, max_length=800)
    cupom_codigo: str | None = Field(default=None, min_length=3, max_length=40)
    chave_idempotencia: str | None = Field(
        default=None,
        min_length=16,
        max_length=100,
        pattern=r"^[A-Za-z0-9._:-]+$",
    )

    @field_validator("servicos_ids")
    @classmethod
    def unique_services(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Não repita o mesmo serviço.")
        return value


class AppointmentStatusUpdate(BaseModel):
    status: Literal["confirmado", "concluido", "recusado", "cancelado"]
    motivo: str | None = Field(default=None, max_length=500)


class AppointmentCancelRequest(BaseModel):
    motivo: str = Field(default="Cancelado pelo cliente", min_length=3, max_length=500)


class AppointmentReschedule(BaseModel):
    profissional_id: UUID
    data: date
    hora_inicio: time


class AppointmentConfirmation(BaseModel):
    origem: Literal["cliente", "estabelecimento"]
    confirmacao: Literal["confirmada", "recusada"]
