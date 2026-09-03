"""Read-only access to immutable operational audit events."""

from __future__ import annotations

from typing import Any

from backend.security import AuthContext
from backend.supabase import gateway


async def list_events(establishment_id: str, resource: str | None, offset: int, limit: int, auth: AuthContext) -> dict[str, Any]:
    safe_limit = min(max(limit, 1), 100)
    safe_offset = min(max(offset, 0), 10_000)
    params = {
        "estabelecimento_id": f"eq.{establishment_id}",
        "select": "id,ator_id,recurso,acao,entidade,entidade_id,dados_anteriores,dados_novos,motivo,request_id,created_at,perfis(nome)",
        "order": "created_at.desc,id.desc", "offset": str(safe_offset), "limit": str(safe_limit + 1),
    }
    if resource:
        params["recurso"] = f"eq.{resource}"
    rows = await gateway.rest("auditoria_operacional", token=auth.token, params=params) or []
    return {"items": rows[:safe_limit], "offset": safe_offset, "limit": safe_limit,
            "has_more": len(rows) > safe_limit}
