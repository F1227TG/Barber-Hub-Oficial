"""Validated request models exposed by the Barber Hub API."""

from datetime import date, time
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class AppointmentCreate(BaseModel):
    estabelecimento_id: UUID
    profissional_id: UUID
    servicos_ids: list[UUID] = Field(min_length=1, max_length=8)
    data: date
    hora_inicio: time
    observacao: str | None = Field(default=None, max_length=800)

    @field_validator("servicos_ids")
    @classmethod
    def unique_services(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Não repita o mesmo serviço.")
        return value


class SupportTicketCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    categoria: Literal["duvida", "suporte", "cadastro", "financeiro", "sugestao", "outro"] = "duvida"
    prioridade: Literal["baixa", "normal", "alta", "urgente"] = "normal"
    assunto: str = Field(min_length=5, max_length=160)
    mensagem: str = Field(min_length=15, max_length=4000)
    website: str = Field(default="", max_length=200)


class DeleteAccountRequest(BaseModel):
    confirmacao: str = Field(max_length=20)


class PasswordRecoveryRequest(BaseModel):
    motivo: str | None = Field(default=None, max_length=300)
