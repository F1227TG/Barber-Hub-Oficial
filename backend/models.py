"""Validated request models exposed by the Barber Hub API."""

from datetime import date, datetime, time
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
    cupom_codigo: str | None = Field(default=None, min_length=3, max_length=40)

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


class CRMClientUpdate(BaseModel):
    preferencias: str | None = Field(default=None, max_length=2000)
    tags: list[str] | None = Field(default=None, max_length=12)
    permite_whatsapp: bool | None = None
    permite_email_marketing: bool | None = None
    data_nascimento: date | None = None


class CRMNoteCreate(BaseModel):
    conteudo: str = Field(min_length=2, max_length=2000)


class FinancialAdjustmentCreate(BaseModel):
    estabelecimento_id: UUID
    competencia: date
    natureza: Literal["credito", "debito"]
    valor: Decimal = Field(gt=0, le=1_000_000)
    descricao: str = Field(min_length=2, max_length=180)
    motivo: str = Field(min_length=3, max_length=500)


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


class TeamMemberLink(BaseModel):
    estabelecimento_id: UUID
    email: EmailStr
    papel: Literal["gerente", "recepcao", "profissional"]
    profissional_id: UUID | None = None

    @field_validator("profissional_id")
    @classmethod
    def validate_professional_link(cls, value: UUID | None, info):
        if info.data.get("papel") == "profissional" and value is None:
            raise ValueError("Vincule o papel profissional a um cadastro da equipe.")
        return value


class TeamMemberUpdate(BaseModel):
    papel: Literal["gerente", "recepcao", "profissional"] | None = None
    profissional_id: UUID | None = None
    status: Literal["ativo", "suspenso", "removido"] | None = None


class TeamPermissionsUpdate(BaseModel):
    permissoes: dict[
        Literal["agenda", "crm", "financeiro", "equipe", "configuracoes", "retencao", "campanhas", "crescimento", "metas"],
        bool,
    ] = Field(min_length=1, max_length=9)


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
