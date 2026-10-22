"""Validated contracts for admin."""

from pydantic import ConfigDict

from datetime import date
from typing import Literal
from pydantic import BaseModel, Field, model_validator


class AdminAccountUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tipo: Literal["admin", "barbeiro", "cliente"] | None = None
    estado_conta: Literal["ativa", "desativada", "suspensa", "excluida"] | None = None

    @model_validator(mode="after")
    def meaningful_change(self):
        if not self.model_fields_set or any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError("Informe um papel ou estado de conta válido.")
        return self


class AdminSubscriptionUpdate(BaseModel):
    plano_slug: Literal["gratuito", "essencial", "profissional", "elite"]
    status: Literal["teste", "ativa", "atrasada", "pausada", "cancelada", "expirada"] = "ativa"
    periodo_fim: date | None = None
    observacoes: str | None = Field(default=None, max_length=800)
    chave_idempotencia: str | None = Field(
        default=None,
        min_length=16,
        max_length=100,
        pattern=r"^[A-Za-z0-9._:-]+$",
    )

    @model_validator(mode="after")
    def validate_effective_period(self):
        if self.status in {"teste", "ativa"} and self.periodo_fim and self.periodo_fim < date.today():
            raise ValueError("A validade de uma assinatura ativa ou em teste não pode estar no passado.")
        return self


class PasswordRecoveryRequest(BaseModel):
    motivo: str | None = Field(default=None, max_length=300)
