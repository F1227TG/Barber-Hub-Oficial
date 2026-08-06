"""Smoke tests that do not require real Supabase credentials."""

from unittest import TestCase

from fastapi.testclient import TestClient

from api.index import app


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
