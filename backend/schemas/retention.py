"""Validated contracts for retention."""

from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class WaitlistCreate(BaseModel):
    estabelecimento_id: UUID
    servico_id: UUID
    profissional_id: UUID | None = None
    data_inicio: date
    data_fim: date
    horario_inicio: time | None = None
    horario_fim: time | None = None
    observacao: str | None = Field(default=None, max_length=500)

    @field_validator("data_fim")
    @classmethod
    def validate_waitlist_dates(cls, value: date, info):
        start = info.data.get("data_inicio")
        if start and (value < start or (value - start).days > 31):
            raise ValueError("Escolha um período de até 32 dias.")
        return value

    @field_validator("horario_fim")
    @classmethod
    def validate_waitlist_times(cls, value: time | None, info):
        start = info.data.get("horario_inicio")
        if value and start and value <= start:
            raise ValueError("O horário final precisa ser posterior ao inicial.")
        return value


class WaitlistUpdate(BaseModel):
    status: Literal["aguardando", "avisado", "agendado", "cancelado", "expirado"]


class RecurrenceCreate(BaseModel):
    frequencia: Literal["semanal", "quinzenal", "mensal"]
    total_ocorrencias: int = Field(ge=2, le=24)


class RecurrenceUpdate(BaseModel):
    status: Literal["cancelada"]


class LoyaltyProgramUpsert(BaseModel):
    estabelecimento_id: UUID
    nome: str = Field(default="Clube de fidelidade", min_length=3, max_length=100)
    pontos_por_visita: int = Field(default=1, ge=0, le=10_000)
    reais_por_ponto: Decimal = Field(default=0, ge=0, le=1_000_000)
    validade_dias: int | None = Field(default=None, ge=1, le=3650)
    ativo: bool = True


class LoyaltyRewardCreate(BaseModel):
    programa_id: UUID
    nome: str = Field(min_length=3, max_length=120)
    descricao: str | None = Field(default=None, max_length=600)
    pontos_necessarios: int = Field(gt=0, le=10_000_000)
    estoque: int | None = Field(default=None, ge=0, le=1_000_000)
    ativo: bool = True


class LoyaltyRewardUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=3, max_length=120)
    descricao: str | None = Field(default=None, max_length=600)
    pontos_necessarios: int | None = Field(default=None, gt=0, le=10_000_000)
    estoque: int | None = Field(default=None, ge=0, le=1_000_000)
    ativo: bool | None = None


class LoyaltyRedeem(BaseModel):
    cliente_id: UUID


class CouponCreate(BaseModel):
    estabelecimento_id: UUID
    codigo: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9_-]+$")
    nome: str = Field(min_length=3, max_length=120)
    tipo_desconto: Literal["percentual", "fixo"]
    valor_desconto: Decimal = Field(gt=0, le=1_000_000)
    desconto_maximo: Decimal | None = Field(default=None, gt=0, le=1_000_000)
    valor_minimo: Decimal = Field(default=0, ge=0, le=1_000_000)
    limite_total: int | None = Field(default=None, gt=0, le=1_000_000)
    limite_por_cliente: int = Field(default=1, ge=1, le=100)
    inicia_em: datetime
    termina_em: datetime | None = None
    ativo: bool = True

    @field_validator("valor_desconto")
    @classmethod
    def validate_coupon_value(cls, value: Decimal, info):
        if info.data.get("tipo_desconto") == "percentual" and value > 100:
            raise ValueError("O desconto percentual não pode ultrapassar 100%.")
        return value

    @field_validator("termina_em")
    @classmethod
    def validate_coupon_period(cls, value: datetime | None, info):
        start = info.data.get("inicia_em")
        if value and start and value <= start:
            raise ValueError("A data final precisa ser posterior à inicial.")
        return value


class CouponUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=3, max_length=120)
    valor_desconto: Decimal | None = Field(default=None, gt=0, le=1_000_000)
    desconto_maximo: Decimal | None = Field(default=None, gt=0, le=1_000_000)
    valor_minimo: Decimal | None = Field(default=None, ge=0, le=1_000_000)
    limite_total: int | None = Field(default=None, gt=0, le=1_000_000)
    limite_por_cliente: int | None = Field(default=None, ge=1, le=100)
    termina_em: datetime | None = None
    ativo: bool | None = None


class CampaignCreate(BaseModel):
    estabelecimento_id: UUID
    nome: str = Field(min_length=3, max_length=120)
    segmento: Literal["todos", "novo", "recorrente", "em_risco", "inativo", "aniversariante"]
    canal: Literal["interno", "email", "whatsapp"]
    assunto: str | None = Field(default=None, max_length=160)
    mensagem: str = Field(min_length=5, max_length=1000)
    agendada_para: datetime
