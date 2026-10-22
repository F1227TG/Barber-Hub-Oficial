"""Validated contracts for notifications."""

from datetime import datetime, time
from uuid import UUID
from pydantic import BaseModel, Field, model_validator


class PushSubscriptionCreate(BaseModel):
    estabelecimento_id: UUID | None = None
    endpoint: str = Field(min_length=20, max_length=2048, pattern=r"^https://")
    p256dh: str = Field(min_length=16, max_length=512, pattern=r"^[A-Za-z0-9_-]+={0,2}$")
    auth: str = Field(min_length=8, max_length=256, pattern=r"^[A-Za-z0-9_-]+={0,2}$")
    expiracao: datetime | None = None
    user_agent: str | None = Field(default=None, max_length=500)


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=20, max_length=2048, pattern=r"^https://")


class PushPreferencesUpdate(BaseModel):
    estabelecimento_id: UUID | None = None
    agendamentos: bool = True
    confirmacoes: bool = True
    cancelamentos: bool = True
    lembretes: bool = True
    lista_espera: bool = True
    oportunidades: bool = False
    campanhas: bool = False
    horario_silencioso_inicio: time | None = None
    horario_silencioso_fim: time | None = None

    @model_validator(mode="after")
    def validate_quiet_hours(self):
        if (self.horario_silencioso_inicio is None) != (self.horario_silencioso_fim is None):
            raise ValueError("Informe início e fim do horário silencioso.")
        return self
