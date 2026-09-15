"""Optional transactional e-mail outbox worker.

Messages are claimed and finalized through database functions so retries are
auditable and two worker instances do not send the same row concurrently.
"""

from __future__ import annotations

from typing import Any

from backend.config import settings
from backend.errors import ApiError
from backend.services.access import rows_payload
from backend.supabase import gateway


async def _finish(
    message_id: str,
    *,
    success: bool,
    error_code: str | None = None,
    provider_id: str | None = None,
) -> None:
    await gateway.rest(
        "finalizar_email_pendente_111",
        method="POST",
        admin=True,
        rpc=True,
        json={
            "p_email_id": message_id,
            "p_sucesso": success,
            "p_erro_codigo": error_code,
            "p_provedor_id": provider_id,
        },
    )


async def deliver_pending(limit: int = 30) -> dict[str, int]:
    if not (settings.email_api_url and settings.email_api_key and settings.email_from):
        raise ApiError(503, "EMAIL_DELIVERY_NOT_CONFIGURED", "O envio de mensagens está temporariamente indisponível.")

    claimed = await gateway.rest(
        "reservar_emails_pendentes_111",
        method="POST",
        admin=True,
        rpc=True,
        json={"p_limite": min(max(int(limit), 1), 100)},
    )
    messages = rows_payload(claimed, message="Não foi possível preparar as mensagens pendentes agora.")
    sent = failed = 0
    for row in messages:
        if not isinstance(row, dict) or not row.get("id"):
            continue
        message_id = str(row["id"])
        try:
            response = await gateway.external_request(
                "POST",
                settings.email_api_url,
                headers={
                    "Authorization": f"Bearer {settings.email_api_key}",
                    "Content-Type": "application/json",
                    "Idempotency-Key": f"barber-hub-email-{message_id}",
                },
                json={
                    "from": settings.email_from,
                    "to": [str(row.get("destinatario") or "")],
                    "subject": str(row.get("assunto") or "Barber Hub"),
                    "html": row.get("html") or None,
                    "text": row.get("texto") or None,
                },
                timeout=15.0,
            )
            success = 200 <= response.status_code < 300
            provider_id = None
            if success:
                try:
                    provider_data = response.json()
                    provider_id = str(provider_data.get("id") or "")[:240] or None
                except (ValueError, AttributeError):
                    provider_id = None
            await _finish(
                message_id,
                success=success,
                error_code=None if success else f"HTTP_{response.status_code}",
                provider_id=provider_id,
            )
            sent += int(success)
            failed += int(not success)
        except Exception as exc:
            # Store only a stable class, never provider bodies, addresses or
            # message content.
            await _finish(message_id, success=False, error_code=type(exc).__name__[:80])
            failed += 1
    return {"processed": sent + failed, "sent": sent, "failed": failed}
