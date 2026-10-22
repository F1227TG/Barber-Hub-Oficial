"""HTTP error envelopes and request observability."""

import json
import time
import re
from uuid import uuid4
from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from backend.errors import ApiError
from backend.version import API_VERSION


async def request_context(request: Request, call_next):
    """Attach a request id and emit one structured log line per request."""
    supplied = request.headers.get("x-request-id", "")
    request_id = supplied if re.fullmatch(r"[A-Za-z0-9._:-]{1,100}", supplied) else str(uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()
    response = None
    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        response = await unexpected_error_handler(request, exc)
        return response
    finally:
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        payload = {
            "event": "http_request",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": getattr(response, "status_code", 500),
            "duration_ms": elapsed_ms,
        }
        print(json.dumps(payload, ensure_ascii=False))
        if response is not None:
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Barber-Hub-API"] = API_VERSION


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers or {},
        content={
            "success": False,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
        },
    )


async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    fields = [
        {
            "field": ".".join(str(part) for part in error.get("loc", [])[1:]),
            "message": error.get("msg", "Valor inválido."),
            "type": error.get("type", "validation_error"),
        }
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Revise os dados informados.",
                "details": fields,
            },
        },
    )


async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    print(json.dumps({
        "event": "unexpected_error",
        "request_id": getattr(request.state, "request_id", None),
        "path": request.url.path,
        "error_type": type(exc).__name__,
    }, ensure_ascii=False))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Não foi possível concluir essa operação. Tente novamente em alguns instantes.",
                "details": None,
            },
        },
    )
