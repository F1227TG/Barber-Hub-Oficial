"""Validated contracts for schedule."""

from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class WalkInCreate(BaseModel):
    estabelecimento_id: UUID
    profissional_id: UUID
    servicos_ids: list[UUID] = Field(min_length=1, max_length=8)
    cliente_nome: str = Field(min_length=2, max_length=140)
    cliente_email: EmailStr | None = None
    cliente_telefone: str | None = Field(default=None, max_length=40)
    data: date
    hora_inicio: time
    observacao: str | None = Field(default=None, max_length=800)

    @field_validator("servicos_ids")
    @classmethod
    def unique_walk_in_services(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Não repita o mesmo serviço.")
        return value


class ScheduleBlockCreate(BaseModel):
    estabelecimento_id: UUID
    profissional_id: UUID | None = None
    inicio: datetime
    fim: datetime
    tipo: Literal["bloqueio", "pausa", "indisponibilidade"] = "bloqueio"
    motivo: str | None = Field(default=None, max_length=300)

    @field_validator("inicio")
    @classmethod
    def validate_block_timezone(cls, value: datetime):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Informe o fuso horário do início do bloqueio.")
        return value

    @field_validator("fim")
    @classmethod
    def validate_block_period(cls, value: datetime, info):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Informe o fuso horário do fim do bloqueio.")
        start = info.data.get("inicio")
        if start and value <= start:
            raise ValueError("O fim do bloqueio precisa ser posterior ao início.")
        return value


class OpeningPeriodInput(BaseModel):
    dia_semana: int = Field(ge=0, le=6)
    abre: time
    fecha: time
    fecha_dia_seguinte: bool = False
    ordem: int = Field(default=1, ge=1, le=8)
    ativo: bool = True


class OpeningPeriodsReplace(BaseModel):
    estabelecimento_id: UUID
    periodos: list[OpeningPeriodInput] = Field(default_factory=list, max_length=56)

    @model_validator(mode="after")
    def validate_periods(self):
        from backend.domain.operations import validate_opening_periods

        validate_opening_periods([item.model_dump() for item in self.periodos if item.ativo])
        return self


class ManualServiceCreate(BaseModel):
    estabelecimento_id: UUID
    profissional_id: UUID
    servico_id: UUID | None = None
    servico_nome: str | None = Field(default=None, min_length=2, max_length=140)
    duracao_min: int | None = Field(default=None, ge=5, le=480)
    cliente_id: UUID | None = None
    cliente_nome: str | None = Field(default=None, min_length=2, max_length=140)
    cliente_email: EmailStr | None = None
    cliente_telefone: str | None = Field(default=None, max_length=40)
    inicio: datetime
    valor: Decimal = Field(ge=0, le=1_000_000)
    forma_pagamento: Literal["dinheiro", "pix", "credito", "debito", "outro"]
    canal_origem: Literal["balcao", "whatsapp", "telefone", "barber_hub", "outro"]
    observacao: str | None = Field(default=None, max_length=800)
    chave_idempotencia: str = Field(min_length=16, max_length=100, pattern=r"^[A-Za-z0-9._:-]+$")
    concluir: Literal[True] = True

    @field_validator("inicio")
    @classmethod
    def validate_manual_service_timezone(cls, value: datetime):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Informe o fuso horário do atendimento.")
        return value

    @model_validator(mode="after")
    def validate_service_reference(self):
        if not self.servico_id and not (self.servico_nome or "").strip():
            raise ValueError("Informe um serviço cadastrado ou o nome do serviço realizado.")
        if not self.servico_id and self.duracao_min is None:
            raise ValueError("Informe a duração do serviço avulso.")
        return self
