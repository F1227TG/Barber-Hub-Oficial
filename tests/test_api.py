"""Smoke tests that do not require real Supabase credentials."""

from unittest import TestCase

from fastapi.testclient import TestClient

from api.index import app
from backend.models import ServiceCreate
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
        self.assertEqual(response.json()["data"]["version"], "1.2.0")
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

