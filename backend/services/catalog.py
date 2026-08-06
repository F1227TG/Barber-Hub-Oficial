"""Public catalog operations."""

from backend.supabase import gateway


async def summary() -> dict[str, int]:
    data = await gateway.rest("metricas_publicas", method="POST", admin=False, json={}, rpc=True)
    row = data[0] if isinstance(data, list) and data else (data or {})
    return {
        "estabelecimentos": int(row.get("estabelecimentos") or 0),
        "agendamentos": int(row.get("com_agenda") or 0),
        "barbearias": int(row.get("barbearias") or 0),
        "saloes": int(row.get("saloes") or 0),
    }
