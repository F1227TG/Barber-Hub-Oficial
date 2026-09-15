"""Account lifecycle request contracts."""

from pydantic import BaseModel, Field


class DeleteAccountRequest(BaseModel):
    confirmacao: str = Field(max_length=80)
    motivo: str | None = Field(default=None, max_length=500)
    retencao_ciente: bool = False
