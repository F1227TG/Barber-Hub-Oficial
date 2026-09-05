"""Preview and commit safe client/service imports through caller-scoped RLS."""

from __future__ import annotations

import base64
import binascii
import hashlib
from typing import Any

from backend.domain.imports import normalize_import_rows, parse_import_file
from backend.errors import ApiError
from backend.models import ImportPreviewRequest
from backend.security import AuthContext
from backend.supabase import gateway
from backend.services.flags import require_enabled
from backend.services.access import first_visible


async def preview(payload: ImportPreviewRequest, auth: AuthContext) -> dict[str, Any]:
    await require_enabled("dados.importacao", auth, str(payload.estabelecimento_id))
    try:
        content = base64.b64decode(payload.conteudo_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ApiError(422, "INVALID_IMPORT_ENCODING", "O conteúdo do arquivo está inválido.") from exc
    try:
        parsed = parse_import_file(payload.arquivo_nome, content)
        valid, rejected = normalize_import_rows(payload.tipo, parsed.rows)
    except ValueError as exc:
        raise ApiError(422, "INVALID_IMPORT_FILE", str(exc)) from exc

    establishment_id = str(payload.estabelecimento_id)
    content_hash = hashlib.sha256(content).hexdigest()
    existing = await gateway.rest(
        "importacoes_operacionais", token=auth.token,
        params={"estabelecimento_id": f"eq.{establishment_id}", "tipo": f"eq.{payload.tipo}",
                "conteudo_hash": f"eq.{content_hash}", "select": "id,status,relatorio,total_linhas,validas,rejeitadas", "limit": "1"},
    ) or []
    if existing:
        job = existing[0]
        samples = await gateway.rest("importacao_linhas", token=auth.token,
            params={"importacao_id": f"eq.{job['id']}", "select": "numero_linha,status,dados,erros", "order": "numero_linha.asc", "limit": "100"}) or []
        return {"id": str(job["id"]), "status": job["status"], "duplicada": True,
                "relatorio": job.get("relatorio") or {}, "total": job["total_linhas"],
                "validas": job["validas"], "rejeitadas": job["rejeitadas"], "amostra": samples}

    jobs = await gateway.rest(
        "importacoes_operacionais", method="POST", token=auth.token,
        json={"estabelecimento_id": establishment_id, "solicitado_por": auth.user_id,
              "tipo": payload.tipo, "arquivo_nome": payload.arquivo_nome, "formato": parsed.format,
              "conteudo_hash": content_hash, "status": "previa", "total_linhas": len(parsed.rows),
              "validas": len(valid), "rejeitadas": len(rejected)},
        headers={"Prefer": "return=representation"},
    ) or []
    if not jobs:
        raise ApiError(403, "IMPORT_FORBIDDEN", "Sua conta não pode preparar esta importação.")
    job_id = str(jobs[0]["id"])
    lines = [
        {"importacao_id": job_id, "numero_linha": item["linha"],
         "status": "rejeitada" if item["erros"] else "valida",
         "dados": item["dados"], "erros": item["erros"]}
        for item in [*valid, *rejected]
    ]
    for index in range(0, len(lines), 250):
        await gateway.rest("importacao_linhas", method="POST", token=auth.token,
                           json=lines[index:index + 250], headers={"Prefer": "return=minimal"})
    ordered = sorted(lines, key=lambda item: item["numero_linha"])
    return {"id": job_id, "status": "previa", "duplicada": False,
            "formato": parsed.format, "total": len(parsed.rows), "validas": len(valid),
            "rejeitadas": len(rejected), "amostra": ordered[:100]}


async def commit(import_id: str, auth: AuthContext) -> dict[str, Any]:
    job = await first_visible("importacoes_operacionais", import_id, auth,
        select="id,estabelecimento_id", message="Importação não encontrada.")
    await require_enabled("dados.importacao", auth, str(job["estabelecimento_id"]))
    result = await gateway.rest(
        "confirmar_importacao_110", method="POST", token=auth.token, rpc=True,
        json={"p_importacao_id": import_id},
    ) or {}
    if result.get("status") == "falhou":
        raise ApiError(422, "IMPORT_COMMIT_FAILED", result.get("erro") or "A importação não pôde ser concluída.")
    return result


async def list_jobs(establishment_id: str, offset: int, limit: int, auth: AuthContext) -> dict[str, Any]:
    safe_limit = min(max(limit, 1), 50)
    safe_offset = max(offset, 0)
    rows = await gateway.rest(
        "importacoes_operacionais", token=auth.token,
        params={"estabelecimento_id": f"eq.{establishment_id}",
                "select": "id,tipo,arquivo_nome,formato,status,total_linhas,validas,rejeitadas,importadas,ignoradas,relatorio,created_at,processada_em",
                "order": "created_at.desc,id.desc", "offset": str(safe_offset), "limit": str(safe_limit + 1)},
    ) or []
    return {"items": rows[:safe_limit], "offset": safe_offset, "limit": safe_limit,
            "has_more": len(rows) > safe_limit}
