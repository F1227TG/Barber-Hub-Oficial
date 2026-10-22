"""HTTP contracts for the appointments domain."""

from __future__ import annotations

from fastapi import Depends, Header, Request, status
from fastapi.responses import JSONResponse
from backend.errors import ApiError
from backend.schemas.appointments import AppointmentCancelRequest
from backend.schemas.appointments import AppointmentConfirmation
from backend.schemas.appointments import AppointmentCreate
from backend.schemas.appointments import AppointmentReschedule
from backend.schemas.appointments import AppointmentStatusUpdate
from backend.schemas.retention import RecurrenceCreate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.domain.operations import choose_idempotency_key
from backend.services import appointments as appointment_service
from backend.services import schedule as schedule_service
from backend.services import retention as retention_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.post("/api/v1/appointments", status_code=status.HTTP_201_CREATED)
async def create_appointment(
    request: Request,
    payload: AppointmentCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-create", limit=12, window_seconds=300, identity=auth.user_id)
    try:
        key = choose_idempotency_key(idempotency_key, payload.chave_idempotencia)
    except ValueError as exc:
        mismatch = bool(idempotency_key and payload.chave_idempotencia)
        raise ApiError(
            409 if mismatch else 422,
            "IDEMPOTENCY_KEY_MISMATCH" if mismatch else "INVALID_IDEMPOTENCY_KEY",
            str(exc),
        ) from exc
    result = await appointment_service.create(payload, auth, idempotency_key=key)
    return ok(result, status.HTTP_201_CREATED)


@router.patch("/api/v1/appointments/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: str,
    request: Request,
    payload: AppointmentStatusUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-status", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await appointment_service.update_status(appointment_id, payload, auth))


@router.delete("/api/v1/appointments/{appointment_id}")
async def cancel_appointment(
    appointment_id: str,
    request: Request,
    payload: AppointmentCancelRequest,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-cancel", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await appointment_service.cancel(appointment_id, payload, auth))


@router.patch("/api/v1/appointments/{appointment_id}/reschedule")
async def reschedule_appointment(
    appointment_id: str,
    request: Request,
    payload: AppointmentReschedule,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-reschedule", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.reschedule(appointment_id, payload, auth))


@router.patch("/api/v1/appointments/{appointment_id}/confirmation")
async def confirm_appointment(
    appointment_id: str,
    request: Request,
    payload: AppointmentConfirmation,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-confirmation", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.confirm(appointment_id, payload, auth))


@router.patch("/api/v1/appointments/{appointment_id}/no-show")
async def mark_appointment_no_show(
    appointment_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-no-show", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.mark_no_show(appointment_id, auth))


@router.post("/api/v1/appointments/{appointment_id}/recurrence", status_code=status.HTTP_201_CREATED)
async def create_appointment_recurrence(
    appointment_id: str,
    request: Request,
    payload: RecurrenceCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-recurrence-create", limit=10, window_seconds=600, identity=auth.user_id)
    return ok(await retention_service.create_recurrence(appointment_id, payload, auth), status.HTTP_201_CREATED)
