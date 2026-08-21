"""Smoke and security regression tests that do not need real credentials."""

import json
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.requests import Request

from api.index import (
    admin_health,
    admin_overview,
    admin_subscriptions,
    app,
    establishment_entitlements,
    list_support_tickets,
    navigation_audit,
    public_config,
)
from backend.models import AdminSubscriptionUpdate, PromotionCreate, ServiceCreate
from backend.security import AuthContext


class ApiSmokeTests(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_health_contract(self) -> None:
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["data"]["runtime"], "python-fastapi")

    def test_health_reports_api_version(self) -> None:
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["version"], "1.3.1")

    def test_support_validation_is_standardized(self) -> None:
        response = self.client.post("/api/v1/support/tickets", json={})
        self.assertEqual(response.status_code, 422)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "VALIDATION_ERROR")
        self.assertIsInstance(payload["error"]["details"], list)

    def test_admin_route_requires_session(self) -> None:
        response = self.client.get("/api/v1/admin/overview")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_admin_health_requires_session(self) -> None:
        response = self.client.get("/api/v1/admin/health")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_marketplace_limit_is_bounded_before_service_call(self) -> None:
        response = self.client.get("/api/v1/marketplace/search?limit=61")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "VALIDATION_ERROR")

    def test_management_route_requires_session(self) -> None:
        response = self.client.patch(
            "/api/v1/establishments/00000000-0000-0000-0000-000000000001",
            json={"nome": "Barbearia Teste"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_professional_create_requires_session(self) -> None:
        response = self.client.post(
            "/api/v1/professionals",
            json={
                "estabelecimento_id": "00000000-0000-0000-0000-000000000001",
                "nome": "João",
                "ativo": True,
                "aceita_agendamento": True,
            },
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_service_contract_rejects_invalid_duration(self) -> None:
        with self.assertRaises(ValidationError):
            ServiceCreate(
                estabelecimento_id="00000000-0000-0000-0000-000000000001",
                nome="Corte",
                preco=30,
                duracao_min=2,
            )

    def test_entitlements_route_requires_session(self) -> None:
        response = self.client.get(
            "/api/v1/establishments/00000000-0000-0000-0000-000000000001/entitlements"
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_admin_subscriptions_requires_session(self) -> None:
        response = self.client.get("/api/v1/admin/subscriptions")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_promotion_route_requires_session(self) -> None:
        response = self.client.post(
            "/api/v1/promotions",
            json={
                "estabelecimento_id": "00000000-0000-0000-0000-000000000001",
                "titulo": "Volte este mês",
                "descricao": "Desconto de fidelidade",
                "desconto_percentual": 10,
            },
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_subscription_contract_rejects_unknown_plan(self) -> None:
        with self.assertRaises(ValidationError):
            AdminSubscriptionUpdate(plano_slug="premium")

    def test_promotion_contract_rejects_inverted_period(self) -> None:
        with self.assertRaises(ValidationError):
            PromotionCreate(
                estabelecimento_id="00000000-0000-0000-0000-000000000001",
                titulo="Promoção teste",
                descricao="Período inválido",
                inicia_em="2026-09-10",
                termina_em="2026-09-01",
            )


class RateLimitRegressionTests(IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.request = Request({
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
            "scheme": "http",
            "query_string": b"",
        })
        self.auth = AuthContext(
            token="test-token",
            user_id="00000000-0000-0000-0000-000000000001",
            user={"id": "00000000-0000-0000-0000-000000000001"},
            profile={"tipo": "admin", "ativo": True},
        )

    async def _assert_limited(self, route, service_path: str, service_result) -> None:
        limiter = AsyncMock(return_value={"allowed": True, "remaining": 59, "retry_after": 0})
        service = AsyncMock(return_value=service_result)
        with patch("api.index.enforce_rate_limit", limiter), patch(service_path, service):
            response = await route(self.request, self.auth)
        self.assertEqual(response.status_code, 200)
        limiter.assert_awaited_once()
        self.assertEqual(limiter.await_args.kwargs["identity"], self.auth.user_id)
        service.assert_awaited_once()

    async def test_support_listing_is_rate_limited(self) -> None:
        await self._assert_limited(
            list_support_tickets,
            "api.index.support_service.list_for_user",
            [],
        )

    async def test_admin_overview_is_rate_limited(self) -> None:
        await self._assert_limited(admin_overview, "api.index.admin_service.overview", {})

    async def test_admin_health_is_rate_limited(self) -> None:
        await self._assert_limited(admin_health, "api.index.admin_service.health_details", {})

    async def test_admin_navigation_audit_is_rate_limited(self) -> None:
        await self._assert_limited(navigation_audit, "api.index.admin_service.navigation_audit", {})

    async def test_post_audit_subscriptions_route_is_rate_limited(self) -> None:
        await self._assert_limited(admin_subscriptions, "api.index.admin_service.list_subscriptions", [])

    async def test_entitlements_route_is_rate_limited(self) -> None:
        limiter = AsyncMock(return_value={"allowed": True, "remaining": 59, "retry_after": 0})
        service = AsyncMock(return_value={"plano_slug": "gratuito"})
        establishment_id = "00000000-0000-0000-0000-000000000002"
        with patch("api.index.enforce_rate_limit", limiter), patch(
            "api.index.management_service.get_entitlements", service
        ):
            response = await establishment_entitlements(establishment_id, self.request, self.auth)
        self.assertEqual(response.status_code, 200)
        limiter.assert_awaited_once()
        self.assertEqual(limiter.await_args.kwargs["identity"], self.auth.user_id)
        service.assert_awaited_once_with(establishment_id, self.auth)

    async def test_public_config_never_exposes_a_secret(self) -> None:
        limiter = AsyncMock(return_value={"allowed": True, "remaining": 119, "retry_after": 0})
        with patch("api.index.enforce_rate_limit", limiter):
            response = await public_config(self.request)
        payload = json.loads(response.body)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("secret", json.dumps(payload).lower())
        self.assertIn("turnstile_site_key", payload["data"])
        limiter.assert_awaited_once()
