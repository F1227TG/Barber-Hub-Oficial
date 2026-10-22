"""HTTP contracts for the retention domain."""

from __future__ import annotations

from fastapi import Depends, Query, Request, status
from fastapi.responses import JSONResponse
from backend.schemas.retention import CampaignCreate
from backend.schemas.retention import CouponCreate
from backend.schemas.retention import CouponUpdate
from backend.schemas.retention import LoyaltyProgramUpsert
from backend.schemas.retention import LoyaltyRedeem
from backend.schemas.retention import LoyaltyRewardCreate
from backend.schemas.retention import LoyaltyRewardUpdate
from backend.schemas.retention import RecurrenceUpdate
from backend.schemas.retention import WaitlistCreate
from backend.schemas.retention import WaitlistUpdate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import retention as retention_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.get("/api/v1/retention/waitlist")
async def retention_waitlist(
    request: Request,
    establishment_id: str | None = Query(default=None, min_length=36, max_length=36),
    offset: int = Query(default=0, ge=0, le=10_000),
    limit: int = Query(default=30, ge=1, le=60),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-waitlist-list", limit=90, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.list_waitlist(establishment_id, auth, offset, limit))


@router.post("/api/v1/retention/waitlist", status_code=status.HTTP_201_CREATED)
async def join_retention_waitlist(
    request: Request,
    payload: WaitlistCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-waitlist-create", limit=12, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.join_waitlist(payload, auth), status.HTTP_201_CREATED)


@router.patch("/api/v1/retention/waitlist/{item_id}")
async def update_retention_waitlist(
    item_id: str,
    request: Request,
    payload: WaitlistUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-waitlist-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.update_waitlist(item_id, payload, auth))


@router.get("/api/v1/retention/recurrences")
async def retention_recurrences(
    request: Request,
    establishment_id: str | None = Query(default=None, min_length=36, max_length=36),
    offset: int = Query(default=0, ge=0, le=10_000),
    limit: int = Query(default=30, ge=1, le=60),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-recurrence-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.list_recurrences(establishment_id, auth, offset, limit))


@router.patch("/api/v1/retention/recurrences/{recurrence_id}")
async def update_retention_recurrence(
    recurrence_id: str,
    request: Request,
    payload: RecurrenceUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-recurrence-update", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.update_recurrence(recurrence_id, payload, auth))


@router.get("/api/v1/retention/loyalty")
async def loyalty_overview(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-loyalty-overview", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.loyalty_overview(establishment_id, auth))


@router.get("/api/v1/client/loyalty")
async def client_loyalty(
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "client-loyalty", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.client_loyalty(auth))


@router.put("/api/v1/retention/loyalty/program")
async def upsert_loyalty_program(
    request: Request,
    payload: LoyaltyProgramUpsert,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-loyalty-program", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.upsert_loyalty_program(payload, auth))


@router.post("/api/v1/retention/loyalty/rewards", status_code=status.HTTP_201_CREATED)
async def create_loyalty_reward(
    request: Request,
    payload: LoyaltyRewardCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-loyalty-reward-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.create_reward(payload, auth), status.HTTP_201_CREATED)


@router.patch("/api/v1/retention/loyalty/rewards/{reward_id}")
async def update_loyalty_reward(
    reward_id: str,
    request: Request,
    payload: LoyaltyRewardUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-loyalty-reward-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.update_reward(reward_id, payload, auth))


@router.post("/api/v1/retention/loyalty/rewards/{reward_id}/redeem")
async def redeem_loyalty_reward(
    reward_id: str,
    request: Request,
    payload: LoyaltyRedeem,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-loyalty-redeem", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.redeem_reward(reward_id, payload, auth))


@router.get("/api/v1/retention/coupons")
async def retention_coupons(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    offset: int = Query(default=0, ge=0, le=10_000),
    limit: int = Query(default=30, ge=1, le=60),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-coupon-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.list_coupons(establishment_id, auth, offset, limit))


@router.post("/api/v1/retention/coupons", status_code=status.HTTP_201_CREATED)
async def create_retention_coupon(
    request: Request,
    payload: CouponCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-coupon-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.create_coupon(payload, auth), status.HTTP_201_CREATED)


@router.patch("/api/v1/retention/coupons/{coupon_id}")
async def update_retention_coupon(
    coupon_id: str,
    request: Request,
    payload: CouponUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-coupon-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await retention_service.update_coupon(coupon_id, payload, auth))


@router.get("/api/v1/retention/campaigns")
async def retention_campaigns(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    campaign_offset: int = Query(default=0, ge=0, le=10_000),
    queue_offset: int = Query(default=0, ge=0, le=10_000),
    limit: int = Query(default=30, ge=1, le=60),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-campaign-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await retention_service.list_campaigns(establishment_id, auth, campaign_offset, queue_offset, limit))


@router.post("/api/v1/retention/campaigns", status_code=status.HTTP_201_CREATED)
async def create_retention_campaign(
    request: Request,
    payload: CampaignCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "retention-campaign-create", limit=20, window_seconds=600, identity=auth.user_id)
    return ok(await retention_service.create_campaign(payload, auth), status.HTTP_201_CREATED)
