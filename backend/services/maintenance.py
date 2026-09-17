"""Trusted maintenance worker for account deletion and transactional e-mail."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from backend.config import settings
from backend.errors import ApiError
from backend.services import email_delivery
from backend.services.access import rows_payload
from backend.supabase import gateway


async def _rpc(name: str, payload: dict[str, Any]) -> Any:
    return await gateway.rest(name, method="POST", admin=True, rpc=True, json=payload)


async def _remove_account_files(request_id: str, user_id: str) -> int:
    """Remove every owned object through Storage API in bounded batches."""

    removed_total = 0
    for _ in range(100):
        rows = await _rpc(
            "listar_arquivos_conta_exclusao_111",
            {"p_solicitacao_id": request_id, "p_user_id": user_id, "p_limite": 100},
        )
        items = rows_payload(rows, message="Não foi possível preparar a limpeza dos arquivos agora.")
        grouped: dict[str, list[str]] = defaultdict(list)
        for item in items:
            if not isinstance(item, dict):
                continue
            bucket = str(item.get("bucket_id") or "").strip()
            name = str(item.get("nome") or "").strip()
            if bucket and name:
                grouped[bucket].append(name)
        if not grouped:
            return removed_total
        for bucket, paths in grouped.items():
            removed_total += await gateway.storage_remove(bucket, paths)
    raise ApiError(503, "ACCOUNT_STORAGE_LIMIT", "A limpeza segura da conta precisa continuar em outra execução.")


async def process_account_deletions(limit: int = 5) -> dict[str, int]:
    claimed = await _rpc("reservar_exclusoes_conta_111", {"p_limite": min(max(int(limit), 1), 20)})
    jobs = rows_payload(claimed, message="Não foi possível preparar as exclusões de conta agora.")
    completed = failed = files_removed = 0
    for row in jobs:
        if not isinstance(row, dict):
            continue
        request_id = str(row.get("solicitacao_id") or "")
        user_id = str(row.get("user_id") or "")
        if not request_id or not user_id:
            continue
        try:
            files_removed += await _remove_account_files(request_id, user_id)
            await _rpc(
                "anonimizar_conta_exclusao_111",
                {"p_solicitacao_id": request_id, "p_user_id": user_id},
            )
            try:
                await gateway.admin_delete_user(user_id)
            except ApiError as exc:
                # A execução anterior pode ter removido Auth e caído antes da
                # confirmação final. Nesse caso, finalizar é o retry correto.
                if exc.status_code != 404:
                    raise
            await _rpc("concluir_exclusao_conta_111", {"p_solicitacao_id": request_id})
            completed += 1
        except Exception as exc:
            error_code = type(exc).__name__[:80]
            try:
                await _rpc(
                    "falhar_exclusao_conta_111",
                    {"p_solicitacao_id": request_id, "p_erro_codigo": error_code},
                )
            except Exception:
                # O erro original continua contabilizado; nenhum detalhe do
                # usuário ou do provedor é exposto na resposta do job.
                pass
            failed += 1
    return {
        "claimed": len(jobs),
        "completed": completed,
        "failed": failed,
        "files_removed": files_removed,
    }


async def run(*, email_limit: int = 30, deletion_limit: int = 5) -> dict[str, Any]:
    deletions = await process_account_deletions(deletion_limit)
    if settings.external_notifications_enabled and settings.email_api_url and settings.email_api_key and settings.email_from:
        try:
            emails: dict[str, Any] = await email_delivery.deliver_pending(email_limit)
        except Exception as exc:
            emails = {"processed": 0, "sent": 0, "failed": 1, "error": type(exc).__name__}
    else:
        emails = {"processed": 0, "sent": 0, "failed": 0, "configured": False}
    return {"deletions": deletions, "emails": emails}
