"""Barber Hub API v1.2.

FastAPI is the server-side validation layer of the marketplace. Supabase keeps
Auth, PostgreSQL, Storage and Realtime responsibilities; sensitive business
rules increasingly pass through this API before reaching those services.
"""

from __future__ import annotations

import json
import time
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.errors import ApiError
from backend.models import (
    AppointmentCancelRequest,
    AppointmentCreate,
    AppointmentStatusUpdate,
    DeleteAccountRequest,
    EstablishmentStatusUpdate,
    EstablishmentUpdate,
    PasswordRecoveryRequest,
    ProfessionalCreate,
    ProfessionalUpdate,
    ServiceCreate,
    ServiceUpdate,
    SupportTicketCreate,
)
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_admin, require_user
from backend.services import admin as admin_service
from backend.services import appointments as appointment_service
from backend.services import catalog as catalog_service
from backend.services import management as management_service
from backend.services import support as support_service

API_VERSION = "1.2.0"

app = FastAPI(
    title="Barber Hub API",
    version=API_VERSION,
    description="API própria do Barber Hub, executada em Python/FastAPI.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

if settings.allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Attach a request id and emit one structured log line per request."""
    request_id = request.headers.get("x-request-id") or str(uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()
    response = None
    try:
        response = await call_next(request)
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


@app.exception_handler(ApiError)
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


@app.exception_handler(RequestValidationError)
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


@app.exception_handler(Exception)
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


def ok(data: object, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": True, "data": data})


@app.get("/api/v1/health")
async def health() -> JSONResponse:
    return ok({
        "service": "barber-hub-api",
        "runtime": "python-fastapi",
        "version": API_VERSION,
        "status": "ready" if settings.is_configured else "configuration_required",
    })


@app.get("/api/v1/catalog/summary")
async def catalog_summary(request: Request) -> JSONResponse:
    await enforce_rate_limit(request, "catalog-summary", limit=120, window_seconds=60)
    return ok(await catalog_service.summary())


@app.get("/api/v1/marketplace/search")
async def marketplace_search(
    request: Request,
    q: str | None = Query(default=None, max_length=120),
    tipo: str | None = Query(default=None, pattern="^(barbearia|salao|todos)?$"),
    agenda: bool | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status", pattern="^(aberta|fechada|todos)?$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=60),
) -> JSONResponse:
    await enforce_rate_limit(request, "marketplace-search", limit=180, window_seconds=60)
    return ok(await catalog_service.search(
        query=q,
        tipo=tipo,
        agenda=agenda,
        status=status_filter,
        offset=offset,
        limit=limit,
    ))


@app.get("/api/v1/marketplace/featured")
async def marketplace_featured(request: Request, limit: int = Query(default=6, ge=1, le=12)) -> JSONResponse:
    await enforce_rate_limit(request, "marketplace-featured", limit=120, window_seconds=60)
    return ok(await catalog_service.featured(limit))


@app.post("/api/v1/appointments", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    request: Request,
    payload: AppointmentCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-create", limit=12, window_seconds=300, identity=auth.user_id)
    result = await appointment_service.create(payload, auth)
    return ok(result, status.HTTP_201_CREATED)


@app.patch("/api/v1/appointments/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: str,
    request: Request,
    payload: AppointmentStatusUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-status", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await appointment_service.update_status(appointment_id, payload, auth))


@app.delete("/api/v1/appointments/{appointment_id}")
async def cancel_appointment(
    appointment_id: str,
    request: Request,
    payload: AppointmentCancelRequest,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-cancel", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await appointment_service.cancel(appointment_id, payload, auth))


@app.patch("/api/v1/establishments/{establishment_id}")
async def update_establishment(
    establishment_id: str,
    request: Request,
    payload: EstablishmentUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "establishment-update", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.update_establishment(establishment_id, payload, auth))


@app.patch("/api/v1/establishments/{establishment_id}/status")
async def update_establishment_status(
    establishment_id: str,
    request: Request,
    payload: EstablishmentStatusUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "establishment-status", limit=80, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.update_establishment_status(establishment_id, payload, auth))


@app.post("/api/v1/services", status_code=status.HTTP_201_CREATED)
async def create_service(
    request: Request,
    payload: ServiceCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "services-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.create_service(payload, auth), status.HTTP_201_CREATED)


@app.patch("/api/v1/services/{service_id}")
async def update_service(
    service_id: str,
    request: Request,
    payload: ServiceUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "services-update", limit=80, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.update_service(service_id, payload, auth))


@app.delete("/api/v1/services/{service_id}")
async def delete_service(
    service_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "services-delete", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.delete_service(service_id, auth))


@app.post("/api/v1/professionals", status_code=status.HTTP_201_CREATED)
async def create_professional(
    request: Request,
    payload: ProfessionalCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "professionals-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.create_professional(payload, auth), status.HTTP_201_CREATED)


@app.patch("/api/v1/professionals/{professional_id}")
async def update_professional(
    professional_id: str,
    request: Request,
    payload: ProfessionalUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "professionals-update", limit=80, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.update_professional(professional_id, payload, auth))


@app.delete("/api/v1/professionals/{professional_id}")
async def delete_professional(
    professional_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "professionals-delete", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.delete_professional(professional_id, auth))


@app.get("/api/v1/support/tickets")
async def list_support_tickets(auth: AuthContext = Depends(require_user)) -> JSONResponse:
    return ok(await support_service.list_for_user(auth))


@app.post("/api/v1/support/tickets", status_code=status.HTTP_201_CREATED)
async def create_support_ticket(
    request: Request,
    payload: SupportTicketCreate,
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    await enforce_rate_limit(request, "support-create", limit=6, window_seconds=600)
    result = await support_service.create(payload, authorization, request)
    return ok(result, status.HTTP_201_CREATED)


@app.delete("/api/v1/account")
async def delete_account(
    request: Request,
    payload: DeleteAccountRequest,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "account-delete", limit=3, window_seconds=900, identity=auth.user_id)
    await admin_service.delete_own_account(payload, auth)
    return ok({"deleted": True, "user_id": auth.user_id})


@app.get("/api/v1/admin/overview")
async def admin_overview(auth: AuthContext = Depends(require_admin)) -> JSONResponse:
    return ok(await admin_service.overview(auth))


@app.get("/api/v1/admin/health")
async def admin_health(auth: AuthContext = Depends(require_admin)) -> JSONResponse:
    return ok(await admin_service.health_details(auth))


@app.post("/api/v1/admin/users/{user_id}/password-recovery")
async def admin_password_recovery(
    user_id: str,
    request: Request,
    payload: PasswordRecoveryRequest,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-password-recovery", limit=10, window_seconds=900, identity=auth.user_id)
    result = await admin_service.send_password_recovery(user_id, payload, auth)
    await admin_service.audit_action(
        auth,
        action="password_recovery_requested",
        target_type="user",
        target_id=user_id,
        details={"reason_provided": bool(payload.motivo)},
        request_id=getattr(request.state, "request_id", None),
    )
    return ok(result)


@app.get("/api/v1/admin/navigation-audit")
async def navigation_audit(auth: AuthContext = Depends(require_admin)) -> JSONResponse:
    return ok(await admin_service.navigation_audit(auth))
