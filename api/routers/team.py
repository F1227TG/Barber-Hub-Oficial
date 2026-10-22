"""HTTP contracts for the team domain."""

from __future__ import annotations

from fastapi import Depends, Query, Request, status
from fastapi.responses import JSONResponse
from backend.schemas.team import TeamMemberLink
from backend.schemas.team import TeamMemberUpdate
from backend.schemas.team import TeamPermissionsUpdate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import growth as growth_service
from backend.services import team as team_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.get("/api/v1/team/members")
async def team_members(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "team-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await team_service.list_members(establishment_id, auth))


@router.post("/api/v1/team/members", status_code=status.HTTP_201_CREATED)
async def link_team_member(
    request: Request,
    payload: TeamMemberLink,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "team-link", limit=20, window_seconds=600, identity=auth.user_id)
    return ok(await team_service.link_member(payload, auth), status.HTTP_201_CREATED)


@router.patch("/api/v1/team/members/{member_id}")
async def update_team_member(
    member_id: str,
    request: Request,
    payload: TeamMemberUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "team-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await team_service.update_member(member_id, payload, auth))


@router.get("/api/v1/team/permissions")
async def team_permissions(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "team-permissions", limit=90, window_seconds=60, identity=auth.user_id)
    return ok(await growth_service.permissions(establishment_id, auth))


@router.patch("/api/v1/team/members/{member_id}/permissions")
async def update_team_permissions(
    member_id: str,
    request: Request,
    payload: TeamPermissionsUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "team-permissions-update", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await growth_service.update_member_permissions(member_id, payload, auth))
