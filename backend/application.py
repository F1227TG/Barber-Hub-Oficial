"""Application composition; domain behavior lives in routers and services."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.errors import ApiError
from backend.integrations.gateway import gateway
from backend.version import API_VERSION
from backend.core.http import request_context, api_error_handler, validation_error_handler, unexpected_error_handler
from api.routers.registry import register_routers


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        yield
    finally:
        await gateway.aclose()


def create_app() -> FastAPI:
    app = FastAPI(title="Barber Hub API", version=API_VERSION,
                  description="API própria do Barber Hub, executada em Python/FastAPI.",
                  docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json",
                  lifespan=lifespan)
    if settings.allowed_origins:
        app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins,
                           allow_credentials=True,
                           allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                           allow_headers=["Authorization", "Content-Type", "X-Request-ID", "Idempotency-Key"],
                           expose_headers=["X-Request-ID", "X-Barber-Hub-API"])
    app.middleware("http")(request_context)
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unexpected_error_handler)
    register_routers(app)
    return app
