"""Validated contracts for team."""

from typing import Literal
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator


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
