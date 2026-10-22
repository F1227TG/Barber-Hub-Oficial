"""Validated contracts for support."""

from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class SupportTicketCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    categoria: Literal["duvida", "suporte", "cadastro", "financeiro", "sugestao", "outro"] = "duvida"
    prioridade: Literal["baixa", "normal", "alta", "urgente"] = "normal"
    assunto: str = Field(min_length=5, max_length=160)
    mensagem: str = Field(min_length=15, max_length=4000)
    website: str = Field(default="", max_length=200)
