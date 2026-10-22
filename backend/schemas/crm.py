"""Validated contracts for crm."""

from datetime import date
from pydantic import BaseModel, Field


class CRMClientUpdate(BaseModel):
    preferencias: str | None = Field(default=None, max_length=2000)
    tags: list[str] | None = Field(default=None, max_length=12)
    permite_whatsapp: bool | None = None
    permite_email_marketing: bool | None = None
    data_nascimento: date | None = None


class CRMNoteCreate(BaseModel):
    conteudo: str = Field(min_length=2, max_length=2000)
