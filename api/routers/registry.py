"""Explicit module registration; no runtime discovery or import side effects."""

from api.routers.system import router as system_router
from api.routers.catalog import router as catalog_router
from api.routers.account import router as account_router
from api.routers.public import router as public_router
from api.routers.marketplace import router as marketplace_router
from api.routers.appointments import router as appointments_router
from api.routers.schedule import router as schedule_router
from api.routers.retention import router as retention_router
from api.routers.crm import router as crm_router
from api.routers.finance import router as finance_router
from api.routers.team import router as team_router
from api.routers.growth import router as growth_router
from api.routers.establishments import router as establishments_router
from api.routers.professionals import router as professionals_router
from api.routers.support import router as support_router
from api.routers.imports import router as imports_router
from api.routers.notifications import router as notifications_router
from api.routers.jobs import router as jobs_router
from api.routers.audit import router as audit_router
from api.routers.flags import router as flags_router
from api.routers.admin import router as admin_router


def register_routers(app):
    app.include_router(system_router)
    app.include_router(catalog_router)
    app.include_router(account_router)
    app.include_router(public_router)
    app.include_router(marketplace_router)
    app.include_router(appointments_router)
    app.include_router(schedule_router)
    app.include_router(retention_router)
    app.include_router(crm_router)
    app.include_router(finance_router)
    app.include_router(team_router)
    app.include_router(growth_router)
    app.include_router(establishments_router)
    app.include_router(professionals_router)
    app.include_router(support_router)
    app.include_router(imports_router)
    app.include_router(notifications_router)
    app.include_router(jobs_router)
    app.include_router(audit_router)
    app.include_router(flags_router)
    app.include_router(admin_router)
