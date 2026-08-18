"""Validated request models exposed by the Barber Hub API."""

from datetime import date, time
from decimal import Decimal
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


class AppointmentStatusUpdate(BaseModel):
    status: Literal["confirmado", "concluido", "recusado", "cancelado"]
    motivo: str | None = Field(default=None, max_length=500)


class AppointmentCancelRequest(BaseModel):
    motivo: str = Field(default="Cancelado pelo cliente", min_length=3, max_length=500)


class EstablishmentUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=140)
    descricao: str | None = Field(default=None, max_length=3000)
    email_publico: EmailStr | None = None
    telefone: str | None = Field(default=None, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=40)
    instagram: str | None = Field(default=None, max_length=120)
    tiktok: str | None = Field(default=None, max_length=120)
    website: str | None = Field(default=None, max_length=500)
    cep: str | None = Field(default=None, max_length=16)
    cidade: str | None = Field(default=None, max_length=120)
    estado: str | None = Field(default=None, min_length=2, max_length=2)
    bairro: str | None = Field(default=None, max_length=120)
    endereco: str | None = Field(default=None, max_length=180)
    numero: str | None = Field(default=None, max_length=30)
    complemento: str | None = Field(default=None, max_length=120)
    foto_url: str | None = Field(default=None, max_length=1200)
    capa_url: str | None = Field(default=None, max_length=1200)
    status_manual: Literal["automatico", "aberto", "fechado"] | None = None
    motivo_status: str | None = Field(default=None, max_length=240)
    aceita_agendamento: bool | None = None
    intervalo_slots_min: int | None = Field(default=None, ge=10, le=180)
    antecedencia_min_horas: int | None = Field(default=None, ge=0, le=168)
    limite_dias_agendamento: int | None = Field(default=None, ge=1, le=365)


class EstablishmentStatusUpdate(BaseModel):
    status: Literal["automatico", "aberto", "fechado"]
    motivo: str | None = Field(default=None, max_length=240)


class ServiceCreate(BaseModel):
    estabelecimento_id: UUID
    nome: str = Field(min_length=2, max_length=140)
    categoria: str = Field(default="Serviço", min_length=2, max_length=100)
    descricao: str = Field(default="", max_length=2000)
    preco: Decimal = Field(ge=0, le=1_000_000)
    duracao_min: int = Field(ge=5, le=480)
    ativo: bool = True
    publico: bool = True
    destaque: bool = False


class ServiceUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=140)
    categoria: str | None = Field(default=None, min_length=2, max_length=100)
    descricao: str | None = Field(default=None, max_length=2000)
    preco: Decimal | None = Field(default=None, ge=0, le=1_000_000)
    duracao_min: int | None = Field(default=None, ge=5, le=480)
    ativo: bool | None = None
    publico: bool | None = None
    destaque: bool | None = None


class ProfessionalCreate(BaseModel):
    estabelecimento_id: UUID
    nome: str = Field(min_length=2, max_length=140)
    email: EmailStr | None = None
    telefone: str | None = Field(default=None, max_length=40)
    especialidade: str | None = Field(default=None, max_length=180)
    bio: str | None = Field(default=None, max_length=2000)
    avatar_url: str | None = Field(default=None, max_length=1200)
    ativo: bool = True
    aceita_agendamento: bool = True


class ProfessionalUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=140)
    email: EmailStr | None = None
    telefone: str | None = Field(default=None, max_length=40)
    especialidade: str | None = Field(default=None, max_length=180)
    bio: str | None = Field(default=None, max_length=2000)
    avatar_url: str | None = Field(default=None, max_length=1200)
    ativo: bool | None = None
    aceita_agendamento: bool | None = None


class AdminSubscriptionUpdate(BaseModel):
    plano_slug: Literal["gratuito", "essencial", "profissional", "elite"]
    status: Literal["teste", "ativa", "atrasada", "pausada", "cancelada", "expirada"] = "ativa"
    periodo_fim: date | None = None
    observacoes: str | None = Field(default=None, max_length=800)


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


class SupportTicketCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    categoria: Literal["duvida", "suporte", "cadastro", "financeiro", "sugestao", "outro"] = "duvida"
    prioridade: Literal["baixa", "normal", "alta", "urgente"] = "normal"
    assunto: str = Field(min_length=5, max_length=160)
    mensagem: str = Field(min_length=15, max_length=4000)
    website: str = Field(default="", max_length=200)


class DeleteAccountRequest(BaseModel):
    confirmacao: str = Field(max_length=80)


class PasswordRecoveryRequest(BaseModel):
    motivo: str | None = Field(default=None, max_length=300)
