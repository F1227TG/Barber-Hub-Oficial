"""Barber Hub API v1.5.0.

FastAPI is the server-side validation layer of the marketplace. Supabase keeps
Auth, PostgreSQL, Storage and Realtime responsibilities; sensitive business
rules increasingly pass through this API before reaching those services.
"""

from __future__ import annotations

import json
import time
from datetime import date, datetime
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, Query, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.config import settings
from backend.errors import ApiError
from backend.models import (
    AppointmentCancelRequest,
    AppointmentConfirmation,
    AppointmentCreate,
    AppointmentReschedule,
    AppointmentStatusUpdate,
    AdminSubscriptionUpdate,
    CampaignCreate,
    CRMClientUpdate,
    CRMNoteCreate,
    CommissionRuleCreate,
    CommissionRuleUpdate,
    DayClosingCreate,
    DeleteAccountRequest,
    EstablishmentStatusUpdate,
    EstablishmentUpdate,
    FinancialAdjustmentCreate,
    GoalCreate,
    GoalUpdate,
    CouponCreate,
    CouponUpdate,
    LoyaltyProgramUpsert,
    LoyaltyRedeem,
    LoyaltyRewardCreate,
    LoyaltyRewardUpdate,
    OpportunityUpdate,
    PasswordRecoveryRequest,
    ProfessionalCreate,
    ProfessionalUpdate,
    PromotionCreate,
    PromotionUpdate,
    ServiceCreate,
    ServiceUpdate,
    ScheduleBlockCreate,
    SupportTicketCreate,
    TeamMemberLink,
    TeamMemberUpdate,
    TeamPermissionsUpdate,
    RecurrenceCreate,
    WaitlistCreate,
    WaitlistUpdate,
    WalkInCreate,
)
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_admin, require_user
from backend.services import admin as admin_service
from backend.services import appointments as appointment_service
from backend.services import catalog as catalog_service
from backend.services import crm as crm_service
from backend.services import finance as finance_service
from backend.services import growth as growth_service
from backend.services import management as management_service
from backend.services import schedule as schedule_service
from backend.services import retention as retention_service
from backend.services import support as support_service
from backend.services import team as team_service

API_VERSION = "1.5.0"

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


@app.get("/api/v1/public-config")
async def public_config(request: Request) -> JSONResponse:
    """Expose only browser-safe runtime configuration; secrets never leave the API."""
    await enforce_rate_limit(request, "public-config", limit=120, window_seconds=60)
    return ok({
        "turnstile_site_key": settings.turnstile_site_key or None,
        "captcha_required": bool(settings.turnstile_site_key),
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


@app.get("/api/v1/schedule/range")
async def schedule_range(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    start: date = Query(),
    end: date = Query(),
    professional_id: str | None = Query(default=None, min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    if end < start or (end - start).days > 31:
        raise ApiError(422, "INVALID_SCHEDULE_RANGE", "Consulte no máximo 32 dias por vez.")
    await enforce_rate_limit(request, "schedule-range", limit=120, window_seconds=60, identity=auth.user_id)
    return ok(await schedule_service.list_range(establishment_id, start, end, professional_id, auth))


@app.post("/api/v1/schedule/walk-ins", status_code=status.HTTP_201_CREATED)
async def create_walk_in(
    request: Request,
    payload: WalkInCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "schedule-walk-in", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.create_walk_in(payload, auth), status.HTTP_201_CREATED)


@app.post("/api/v1/schedule/blocks", status_code=status.HTTP_201_CREATED)
async def create_schedule_block(
    request: Request,
    payload: ScheduleBlockCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "schedule-block-create", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.create_block(payload, auth), status.HTTP_201_CREATED)


@app.delete("/api/v1/schedule/blocks/{block_id}")
async def delete_schedule_block(
    block_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "schedule-block-delete", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.delete_block(block_id, auth))


@app.patch("/api/v1/appointments/{appointment_id}/reschedule")
async def reschedule_appointment(
    appointment_id: str,
    request: Request,
    payload: AppointmentReschedule,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-reschedule", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.reschedule(appointment_id, payload, auth))


@app.patch("/api/v1/appointments/{appointment_id}/confirmation")
async def confirm_appointment(
    appointment_id: str,
    request: Request,
    payload: AppointmentConfirmation,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-confirmation", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.confirm(appointment_id, payload, auth))


@app.patch("/api/v1/appointments/{appointment_id}/no-show")
async def mark_appointment_no_show(
    appointment_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "appointments-no-show", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.mark_no_show(appointment_id, auth))


@app.get("/api/v1/retention/waitlist")
async def retention_waitlist(
    request: Request,
    establishment_id: str | None = Query(default=None, min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-waitlist-list", limit=90, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.list_waitlist(establishment_id, auth))


@app.post("/api/v1/retention/waitlist", status_code=status.HTTP_201_CREATED)
async def join_retention_waitlist(
    request: Request,
    payload: WaitlistCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-waitlist-create", limit=12, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.join_waitlist(payload, auth), status.HTTP_201_CREATED)


@app.patch("/api/v1/retention/waitlist/{item_id}")
async def update_retention_waitlist(
    item_id: str,
    request: Request,
    payload: WaitlistUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-waitlist-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.update_waitlist(item_id, payload, auth))


@app.post("/api/v1/appointments/{appointment_id}/recurrence", status_code=status.HTTP_201_CREATED)
async def create_appointment_recurrence(
    appointment_id: str,
    request: Request,
    payload: RecurrenceCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-recurrence-create", limit=10, window_seconds=600, identity=auth.user_id)
    return ok(await retention_service.create_recurrence(appointment_id, payload, auth), status.HTTP_201_CREATED)


@app.get("/api/v1/retention/recurrences")
async def retention_recurrences(
    request: Request,
    establishment_id: str | None = Query(default=None, min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-recurrence-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.list_recurrences(establishment_id, auth))


@app.get("/api/v1/retention/loyalty")
async def loyalty_overview(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-loyalty-overview", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.loyalty_overview(establishment_id, auth))


@app.get("/api/v1/client/loyalty")
async def client_loyalty(
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "client-loyalty", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.client_loyalty(auth))


@app.put("/api/v1/retention/loyalty/program")
async def upsert_loyalty_program(
    request: Request,
    payload: LoyaltyProgramUpsert,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-loyalty-program", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.upsert_loyalty_program(payload, auth))


@app.post("/api/v1/retention/loyalty/rewards", status_code=status.HTTP_201_CREATED)
async def create_loyalty_reward(
    request: Request,
    payload: LoyaltyRewardCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-loyalty-reward-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.create_reward(payload, auth), status.HTTP_201_CREATED)


@app.patch("/api/v1/retention/loyalty/rewards/{reward_id}")
async def update_loyalty_reward(
    reward_id: str,
    request: Request,
    payload: LoyaltyRewardUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-loyalty-reward-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.update_reward(reward_id, payload, auth))


@app.post("/api/v1/retention/loyalty/rewards/{reward_id}/redeem")
async def redeem_loyalty_reward(
    reward_id: str,
    request: Request,
    payload: LoyaltyRedeem,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-loyalty-redeem", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.redeem_reward(reward_id, payload, auth))


@app.get("/api/v1/retention/coupons")
async def retention_coupons(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-coupon-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.list_coupons(establishment_id, auth))


@app.post("/api/v1/retention/coupons", status_code=status.HTTP_201_CREATED)
async def create_retention_coupon(
    request: Request,
    payload: CouponCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-coupon-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.create_coupon(payload, auth), status.HTTP_201_CREATED)


@app.patch("/api/v1/retention/coupons/{coupon_id}")
async def update_retention_coupon(
    coupon_id: str,
    request: Request,
    payload: CouponUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-coupon-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.update_coupon(coupon_id, payload, auth))


@app.get("/api/v1/retention/campaigns")
async def retention_campaigns(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-campaign-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.list_campaigns(establishment_id, auth))


@app.post("/api/v1/retention/campaigns", status_code=status.HTTP_201_CREATED)
async def create_retention_campaign(
    request: Request,
    payload: CampaignCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-campaign-create", limit=20, window_seconds=600, identity=auth.user_id)
    return ok(await retention_service.create_campaign(payload, auth), status.HTTP_201_CREATED)


@app.get("/api/v1/crm/clients")
async def list_crm_clients(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    q: str | None = Query(default=None, max_length=120),
    segment: str | None = Query(default=None, pattern="^(lead|novo|recorrente|em_risco|inativo)?$"),
    cursor_last: datetime | None = Query(default=None),
    cursor_id: str | None = Query(default=None, min_length=36, max_length=36),
    limit: int = Query(default=30, ge=1, le=60),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "crm-list", limit=90, window_seconds=60, identity=auth.user_id)
    return ok(await crm_service.list_clients(establishment_id, q, segment, cursor_last, cursor_id, limit, auth))


@app.get("/api/v1/crm/clients/{client_id}")
async def get_crm_client(
    client_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "crm-detail", limit=120, window_seconds=60, identity=auth.user_id)
    return ok(await crm_service.get_client(client_id, auth))


@app.patch("/api/v1/crm/clients/{client_id}")
async def update_crm_client(
    client_id: str,
    request: Request,
    payload: CRMClientUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "crm-update", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await crm_service.update_client(client_id, payload, auth))


@app.post("/api/v1/crm/clients/{client_id}/notes", status_code=status.HTTP_201_CREATED)
async def add_crm_note(
    client_id: str,
    request: Request,
    payload: CRMNoteCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "crm-note-create", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await crm_service.add_note(client_id, payload, auth), status.HTTP_201_CREATED)


@app.get("/api/v1/finance/summary")
async def finance_summary(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    start: date = Query(),
    end: date = Query(),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    if end < start or (end - start).days > 366:
        raise ApiError(422, "INVALID_FINANCE_RANGE", "Consulte um período de até 367 dias.")
    await enforce_rate_limit(request, "finance-summary", limit=90, window_seconds=60, identity=auth.user_id)
    return ok(await finance_service.summary(establishment_id, start, end, auth))


@app.get("/api/v1/finance/entries")
async def finance_entries(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    start: date = Query(),
    end: date = Query(),
    limit: int = Query(default=100, ge=1, le=500),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    if end < start or (end - start).days > 366:
        raise ApiError(422, "INVALID_FINANCE_RANGE", "Consulte um período de até 367 dias.")
    await enforce_rate_limit(request, "finance-entries", limit=90, window_seconds=60, identity=auth.user_id)
    return ok(await finance_service.list_entries(establishment_id, start, end, limit, auth))


@app.post("/api/v1/finance/adjustments", status_code=status.HTTP_201_CREATED)
async def create_financial_adjustment(
    request: Request,
    payload: FinancialAdjustmentCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "finance-adjustment", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await finance_service.create_adjustment(payload, auth), status.HTTP_201_CREATED)


@app.post("/api/v1/finance/closings", status_code=status.HTTP_201_CREATED)
async def close_financial_day(
    request: Request,
    payload: DayClosingCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "finance-closing", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await finance_service.close_day(payload, auth), status.HTTP_201_CREATED)


@app.get("/api/v1/finance/commission-rules")
async def commission_rules(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "commission-rules-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await finance_service.list_commission_rules(establishment_id, auth))


@app.post("/api/v1/finance/commission-rules", status_code=status.HTTP_201_CREATED)
async def create_commission_rule(
    request: Request,
    payload: CommissionRuleCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "commission-rules-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await finance_service.create_commission_rule(payload, auth), status.HTTP_201_CREATED)


@app.patch("/api/v1/finance/commission-rules/{rule_id}")
async def update_commission_rule(
    rule_id: str,
    request: Request,
    payload: CommissionRuleUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "commission-rules-update", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await finance_service.update_commission_rule(rule_id, payload, auth))


@app.get("/api/v1/team/members")
async def team_members(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "team-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await team_service.list_members(establishment_id, auth))


@app.post("/api/v1/team/members", status_code=status.HTTP_201_CREATED)
async def link_team_member(
    request: Request,
    payload: TeamMemberLink,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "team-link", limit=20, window_seconds=600, identity=auth.user_id)
    return ok(await team_service.link_member(payload, auth), status.HTTP_201_CREATED)


@app.patch("/api/v1/team/members/{member_id}")
async def update_team_member(
    member_id: str,
    request: Request,
    payload: TeamMemberUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "team-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await team_service.update_member(member_id, payload, auth))


@app.get("/api/v1/team/permissions")
async def team_permissions(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "team-permissions", limit=90, window_seconds=60, identity=auth.user_id)
    return ok(await growth_service.permissions(establishment_id, auth))


@app.patch("/api/v1/team/members/{member_id}/permissions")
async def update_team_permissions(
    member_id: str,
    request: Request,
    payload: TeamPermissionsUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "team-permissions-update", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await growth_service.update_member_permissions(member_id, payload, auth))


@app.get("/api/v1/growth/insights")
async def growth_insights(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    start: date = Query(),
    end: date = Query(),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-insights", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await growth_service.insights(establishment_id, start, end, auth))


@app.get("/api/v1/growth/opportunities")
async def growth_opportunities(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-opportunities", limit=40, window_seconds=60, identity=auth.user_id)
    return ok(await growth_service.opportunities(establishment_id, auth))


@app.patch("/api/v1/growth/opportunities/{opportunity_id}")
async def update_growth_opportunity(
    opportunity_id: str,
    request: Request,
    payload: OpportunityUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-opportunity-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await growth_service.update_opportunity(opportunity_id, payload, auth))


@app.get("/api/v1/growth/goals")
async def growth_goals(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-goals-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await growth_service.list_goals(establishment_id, auth))


@app.post("/api/v1/growth/goals", status_code=status.HTTP_201_CREATED)
async def create_growth_goal(
    request: Request,
    payload: GoalCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-goals-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await growth_service.create_goal(payload, auth), status.HTTP_201_CREATED)


@app.patch("/api/v1/growth/goals/{goal_id}")
async def update_growth_goal(
    goal_id: str,
    request: Request,
    payload: GoalUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-goals-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await growth_service.update_goal(goal_id, payload, auth))


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


@app.get("/api/v1/establishments/{establishment_id}/entitlements")
async def establishment_entitlements(
    establishment_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "establishment-entitlements", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await management_service.get_entitlements(establishment_id, auth))


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


@app.post("/api/v1/promotions", status_code=status.HTTP_201_CREATED)
async def create_promotion(
    request: Request,
    payload: PromotionCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "promotions-create", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.create_promotion(payload, auth), status.HTTP_201_CREATED)


@app.patch("/api/v1/promotions/{promotion_id}")
async def update_promotion(
    promotion_id: str,
    request: Request,
    payload: PromotionUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "promotions-update", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.update_promotion(promotion_id, payload, auth))


@app.delete("/api/v1/promotions/{promotion_id}")
async def delete_promotion(
    promotion_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "promotions-delete", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.delete_promotion(promotion_id, auth))


@app.get("/api/v1/support/tickets")
async def list_support_tickets(
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "support-list", limit=60, window_seconds=60, identity=auth.user_id)
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
async def admin_overview(
    request: Request,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-overview", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await admin_service.overview(auth))


@app.get("/api/v1/admin/health")
async def admin_health(
    request: Request,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-health", limit=60, window_seconds=60, identity=auth.user_id)
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


@app.get("/api/v1/admin/subscriptions")
async def admin_subscriptions(
    request: Request,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-subscriptions", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await admin_service.list_subscriptions(auth))


@app.patch("/api/v1/admin/establishments/{establishment_id}/subscription")
async def admin_assign_subscription(
    establishment_id: str,
    request: Request,
    payload: AdminSubscriptionUpdate,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-subscription-update", limit=40, window_seconds=600, identity=auth.user_id)
    result = await admin_service.assign_subscription(establishment_id, payload, auth)
    await admin_service.audit_action(
        auth,
        action="subscription_changed",
        target_type="establishment",
        target_id=establishment_id,
        details={"plan": payload.plano_slug, "status": payload.status},
        request_id=getattr(request.state, "request_id", None),
    )
    return ok(result)


@app.get("/api/v1/admin/navigation-audit")
async def navigation_audit(
    request: Request,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-navigation-audit", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await admin_service.navigation_audit(auth))
    CRMClientUpdate,
    CRMNoteCreate,
    CommissionRuleCreate,
    CommissionRuleUpdate,
    DayClosingCreate,
    FinancialAdjustmentCreate,
    ScheduleBlockCreate,
