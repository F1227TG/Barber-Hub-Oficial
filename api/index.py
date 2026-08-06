"""Barber Hub API v1.

Entry point detected by Vercel's Python runtime. The web client uses the same
origin under /api/v1, while Supabase remains responsible for Auth, PostgreSQL
and Storage.
"""

from fastapi import Depends, FastAPI, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.errors import ApiError
from backend.models import (
    AppointmentCreate,
    DeleteAccountRequest,
    PasswordRecoveryRequest,
    SupportTicketCreate,
)
from backend.security import AuthContext, require_admin, require_user
from backend.services import admin as admin_service
from backend.services import appointments as appointment_service
from backend.services import catalog as catalog_service
from backend.services import support as support_service

app = FastAPI(
    title="Barber Hub API",
    version="1.1.0",
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


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
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
    """Normalize Pydantic/FastAPI validation errors for every client."""
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
async def unexpected_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    # Never leak database credentials, stack traces or internal implementation.
    print(f"[Barber Hub API] unexpected error: {exc!r}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "A API não conseguiu concluir a operação.",
                "details": None,
            },
        },
    )


def ok(data: object, status_code: int = 200) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": True, "data": data})


@app.get("/api/v1/health")
async def health() -> JSONResponse:
    return ok(
        {
            "service": "barber-hub-api",
            "runtime": "python-fastapi",
            "version": "1.1.0",
            "status": "ready" if settings.is_configured else "configuration_required",
        }
    )


@app.get("/api/v1/catalog/summary")
async def catalog_summary() -> JSONResponse:
    return ok(await catalog_service.summary())


@app.post("/api/v1/appointments", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    result = await appointment_service.create(payload, auth)
    return ok(result, status.HTTP_201_CREATED)


@app.get("/api/v1/support/tickets")
async def list_support_tickets(auth: AuthContext = Depends(require_user)) -> JSONResponse:
    return ok(await support_service.list_for_user(auth))


@app.post("/api/v1/support/tickets", status_code=status.HTTP_201_CREATED)
async def create_support_ticket(
    request: Request,
    payload: SupportTicketCreate,
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    result = await support_service.create(payload, authorization, request)
    return ok(result, status.HTTP_201_CREATED)


@app.delete("/api/v1/account")
async def delete_account(
    payload: DeleteAccountRequest,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await admin_service.delete_own_account(payload, auth)
    return ok({"deleted": True, "user_id": auth.user_id})


@app.get("/api/v1/admin/overview")
async def admin_overview(auth: AuthContext = Depends(require_admin)) -> JSONResponse:
    return ok(await admin_service.overview(auth))


@app.post("/api/v1/admin/users/{user_id}/password-recovery")
async def admin_password_recovery(
    user_id: str,
    payload: PasswordRecoveryRequest,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    result = await admin_service.send_password_recovery(user_id, payload, auth)
    return ok(result)


@app.get("/api/v1/admin/navigation-audit")
async def navigation_audit(auth: AuthContext = Depends(require_admin)) -> JSONResponse:
    """Small protected endpoint used by the internal system map."""
    return ok(await admin_service.navigation_audit(auth))
