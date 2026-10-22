"""HTTP contracts for the finance domain."""

from __future__ import annotations

from datetime import date
from fastapi import Depends, Header, Query, Request, status
from fastapi.responses import JSONResponse
from backend.errors import ApiError
from backend.schemas.finance import CommissionRuleCreate
from backend.schemas.finance import CommissionRuleUpdate
from backend.schemas.finance import DayClosingCreate
from backend.schemas.finance import FinancialAdjustmentCreate
from backend.schemas.finance import ExpenseCreate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.domain.operations import choose_idempotency_key
from backend.services import finance as finance_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.get("/api/v1/finance/summary")
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


@router.get("/api/v1/finance/entries")
async def finance_entries(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    start: date = Query(),
    end: date = Query(),
    offset: int = Query(default=0, ge=0, le=10_000),
    limit: int = Query(default=40, ge=1, le=100),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    if end < start or (end - start).days > 366:
        raise ApiError(422, "INVALID_FINANCE_RANGE", "Consulte um período de até 367 dias.")
    await enforce_rate_limit(request, "finance-entries", limit=90, window_seconds=60, identity=auth.user_id)
    return ok(await finance_service.list_entries(establishment_id, start, end, offset, limit, auth))


@router.post("/api/v1/finance/adjustments", status_code=status.HTTP_201_CREATED)
async def create_financial_adjustment(
    request: Request,
    payload: FinancialAdjustmentCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "finance-adjustment", limit=30, window_seconds=300, identity=auth.user_id)
    try:
        key = choose_idempotency_key(idempotency_key, payload.chave_idempotencia)
    except ValueError as exc:
        raise ApiError(
            409 if idempotency_key and payload.chave_idempotencia else 422,
            "IDEMPOTENCY_KEY_MISMATCH" if idempotency_key and payload.chave_idempotencia else "INVALID_IDEMPOTENCY_KEY",
            str(exc),
        ) from exc
    return ok(await finance_service.create_adjustment(payload, auth, idempotency_key=key), status.HTTP_201_CREATED)


@router.post("/api/v1/finance/expenses", status_code=status.HTTP_201_CREATED)
async def create_financial_expense(
    request: Request,
    payload: ExpenseCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "finance-expense", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await finance_service.create_expense(payload, auth), status.HTTP_201_CREATED)


@router.post("/api/v1/finance/closings", status_code=status.HTTP_201_CREATED)
async def close_financial_day(
    request: Request,
    payload: DayClosingCreate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "finance-closing", limit=20, window_seconds=300, identity=auth.user_id)
    try:
        key = choose_idempotency_key(idempotency_key, payload.chave_idempotencia)
    except ValueError as exc:
        raise ApiError(
            409 if idempotency_key and payload.chave_idempotencia else 422,
            "IDEMPOTENCY_KEY_MISMATCH" if idempotency_key and payload.chave_idempotencia else "INVALID_IDEMPOTENCY_KEY",
            str(exc),
        ) from exc
    return ok(await finance_service.close_day(payload, auth, idempotency_key=key), status.HTTP_201_CREATED)


@router.get("/api/v1/finance/commission-rules")
async def commission_rules(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "commission-rules-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await finance_service.list_commission_rules(establishment_id, auth))


@router.post("/api/v1/finance/commission-rules", status_code=status.HTTP_201_CREATED)
async def create_commission_rule(
    request: Request,
    payload: CommissionRuleCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "commission-rules-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await finance_service.create_commission_rule(payload, auth), status.HTTP_201_CREATED)


@router.patch("/api/v1/finance/commission-rules/{rule_id}")
async def update_commission_rule(
    rule_id: str,
    request: Request,
    payload: CommissionRuleUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "commission-rules-update", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await finance_service.update_commission_rule(rule_id, payload, auth))
