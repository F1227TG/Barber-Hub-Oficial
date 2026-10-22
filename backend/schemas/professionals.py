"""Validated contracts for professionals."""

from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


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
