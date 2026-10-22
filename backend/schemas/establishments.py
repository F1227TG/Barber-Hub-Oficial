"""Validated contracts for establishments."""

from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


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
    cnpj: str | None = Field(default=None, min_length=14, max_length=18)

    @field_validator("cnpj")
    @classmethod
    def validate_cnpj(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        from backend.domain.identity import validated_cnpj

        return validated_cnpj(value)


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


class EstablishmentLocationUpdate(BaseModel):
    logradouro: str = Field(min_length=2, max_length=180)
    numero: str | None = Field(default=None, max_length=30)
    complemento: str | None = Field(default=None, max_length=120)
    bairro: str = Field(min_length=2, max_length=120)
    cidade: str = Field(min_length=2, max_length=120)
    estado: str = Field(min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$")
    cep: str = Field(min_length=8, max_length=10)
    pais: str = Field(default="BR", min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$")
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)
    precisao_localizacao: Literal["endereco", "logradouro", "bairro", "cidade", "manual"] | None = None
    codigo_municipio_ibge: str | None = Field(default=None, pattern=r"^\d{7}$")
    raio_atendimento_km: Decimal | None = Field(default=None, ge=0, le=500)

    @model_validator(mode="after")
    def validate_coordinate_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Informe latitude e longitude juntas.")
        return self
