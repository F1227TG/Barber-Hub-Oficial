"""Smoke tests that do not require real Supabase credentials."""

from unittest import TestCase

from fastapi.testclient import TestClient

from api.index import app
from backend.models import AdminSubscriptionUpdate, PromotionCreate, ServiceCreate
from pydantic import ValidationError


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

    def test_health_reports_api_version(self) -> None:
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["version"], "1.3.0")
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

