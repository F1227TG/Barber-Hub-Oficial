"""Validated contracts for imports."""

from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field


class ImportPreviewRequest(BaseModel):
    estabelecimento_id: UUID
    tipo: Literal["clientes", "servicos"]
    arquivo_nome: str = Field(min_length=5, max_length=180, pattern=r"(?i)^.+\.(csv|xlsx)$")
    conteudo_base64: str = Field(min_length=4, max_length=5_700_000)


class ImportCommitRequest(BaseModel):
    confirmar: Literal[True]
