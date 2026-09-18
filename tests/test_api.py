"""Smoke and security regression tests that do not need real credentials."""

import asyncio
import json
import time
from datetime import date, datetime, timedelta, timezone
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.requests import Request

from api.index import (
    admin_health,
    admin_assign_subscription,
    admin_overview,
    admin_subscriptions,
    app,
    client_loyalty,
    establishment_entitlements,
    list_support_tickets,
    navigation_audit,
    public_config,
    create_appointment,
    create_support_ticket,
)
from backend.domain.identity import cnpj_is_valid, normalize_cnpj
from backend.models import (
    AdminSubscriptionUpdate, AppointmentCreate, DeleteAccountRequest, EstablishmentLocationUpdate,
    EstablishmentUpdate, FinancialAdjustmentCreate, DayClosingCreate, ManualServiceCreate, OpeningPeriodsReplace,
    PromotionCreate, ServiceCreate, RecurrenceUpdate, WaitlistCreate,
    PushSubscriptionCreate,
)
from backend.security import AuthContext, recent_authentication_age
from backend.supabase import SupabaseGateway
from backend.errors import ApiError
from backend.services import account as account_service
from backend.services import appointments as appointment_service
from backend.services import catalog as catalog_service
from backend.services import email_delivery as email_service
from backend.services import admin as admin_service
from backend.services import maintenance as maintenance_service
from backend.services import management as management_service
from backend.services import push as push_service
from backend.services import retention as retention_service


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
        self.assertEqual(response.json()["data"]["version"], "1.7.0")

    def test_liveness_is_independent_from_external_services(self) -> None:
        response = self.client.get("/api/v1/health/live")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["status"], "alive")

    def test_support_ticket_requires_session_before_accepting_data(self) -> None:
        response = self.client.post("/api/v1/support/tickets", json={})
        self.assertEqual(response.status_code, 401)
        payload = response.json()
        self.assertEqual(payload["error"]["code"], "UNAUTHORIZED")

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

    def test_agenda_2_route_requires_session(self) -> None:
        response = self.client.get(
            "/api/v1/schedule/range?establishment_id=00000000-0000-0000-0000-000000000001&start=2026-08-20&end=2026-08-20"
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_crm_route_requires_session(self) -> None:
        response = self.client.get(
            "/api/v1/crm/clients?establishment_id=00000000-0000-0000-0000-000000000001"
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_finance_route_requires_session(self) -> None:
        response = self.client.get(
            "/api/v1/finance/summary?establishment_id=00000000-0000-0000-0000-000000000001&start=2026-08-01&end=2026-08-20"
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_team_route_requires_session(self) -> None:
        response = self.client.get(
            "/api/v1/team/members?establishment_id=00000000-0000-0000-0000-000000000001"
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_active_subscription_rejects_expired_period(self) -> None:
        with self.assertRaises(ValidationError):
            AdminSubscriptionUpdate(
                plano_slug="essencial",
                status="ativa",
                periodo_fim=date.today() - timedelta(days=1),
            )

    def test_admin_paginated_records_require_session(self) -> None:
        response = self.client.get("/api/v1/admin/records/perfis?offset=0&limit=50")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_financial_writes_require_an_idempotency_key(self) -> None:
        establishment = "00000000-0000-0000-0000-000000000001"
        with self.assertRaises(ValidationError):
            FinancialAdjustmentCreate(
                estabelecimento_id=establishment, competencia=date.today(), natureza="credito",
                valor=10, descricao="Ajuste", motivo="Correção manual",
            )
        with self.assertRaises(ValidationError):
            DayClosingCreate(estabelecimento_id=establishment, data=date.today())

    def test_release_110_operational_routes_require_session(self) -> None:
        establishment = "00000000-0000-0000-0000-000000000001"
        cases = [
            ("get", f"/api/v1/schedule/opening-periods?establishment_id={establishment}", None),
            ("put", "/api/v1/schedule/opening-periods", {"estabelecimento_id": establishment, "periodos": []}),
            ("post", "/api/v1/imports/preview", {"estabelecimento_id": establishment, "tipo": "clientes", "arquivo_nome": "dados.csv", "conteudo_base64": "YWJjZA=="}),
            ("get", f"/api/v1/audit/operational?establishment_id={establishment}", None),
            ("post", "/api/v1/features/evaluate", {"estabelecimento_id": establishment, "chaves": ["operacao.atendimento_manual"]}),
        ]
        for method, path, body in cases:
            with self.subTest(path=path):
                response = self.client.request(method, path, json=body)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_push_delivery_job_rejects_unsigned_requests(self) -> None:
        response = self.client.get("/api/v1/jobs/push/deliver")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "JOB_UNAUTHORIZED")

    def test_email_delivery_job_rejects_unsigned_requests(self) -> None:
        response = self.client.get("/api/v1/jobs/email/deliver")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "JOB_UNAUTHORIZED")

    def test_maintenance_job_rejects_unsigned_requests(self) -> None:
        response = self.client.get("/api/v1/jobs/maintenance/run")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "JOB_UNAUTHORIZED")

    def test_job_auth_accepts_vercel_and_external_secrets_independently(self) -> None:
        from types import SimpleNamespace
        from api.index import _valid_job_secret

        configured = SimpleNamespace(cron_secret="vercel-secret", jobs_secret="external-secret")
        with patch("api.index.settings", configured):
            self.assertTrue(_valid_job_secret("vercel-secret"))
            self.assertTrue(_valid_job_secret("external-secret"))
            self.assertFalse(_valid_job_secret("wrong-secret"))
            self.assertFalse(_valid_job_secret(None))

    def test_account_privacy_routes_require_session(self) -> None:
        cases = [
            ("get", "/api/v1/account/deletion"),
            ("post", "/api/v1/account/deletion"),
            ("delete", "/api/v1/account/deletion"),
            ("get", "/api/v1/account/export"),
            ("get", "/api/v1/account/sessions"),
            ("delete", "/api/v1/account/sessions/others"),
            ("delete", "/api/v1/account/sessions"),
        ]
        for method, path in cases:
            with self.subTest(path=path):
                response = self.client.request(method, path, json={} if method == "post" else None)
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_business_update_normalizes_legacy_and_alphanumeric_cnpj(self) -> None:
        legacy = EstablishmentUpdate(cnpj="04.252.011/0001-10")
        modern = EstablishmentUpdate(cnpj="00.000.000/E08G-12")
        self.assertEqual(legacy.cnpj, "04252011000110")
        self.assertEqual(modern.cnpj, "00000000E08G12")
        with self.assertRaises(ValidationError):
            EstablishmentUpdate(cnpj="00.000.000/E08G-13")

    def test_location_contract_requires_coordinate_pair(self) -> None:
        with self.assertRaises(ValidationError):
            EstablishmentLocationUpdate(
                logradouro="Rua Um", bairro="Centro", cidade="Jacinto", estado="MG", cep="39930000",
                latitude=-16.1,
            )

    def test_location_contract_accepts_the_panel_address_format(self) -> None:
        payload = EstablishmentLocationUpdate(
            logradouro="Avenida Defensor Público Fabio Ruas",
            numero="523",
            complemento="Estabelecimento",
            bairro="Centro",
            cidade="Jacinto",
            estado="MG",
            cep="39930-000",
            precisao_localizacao="endereco",
        )
        self.assertEqual(payload.cep, "39930-000")
        self.assertEqual(payload.estado, "MG")

    def test_establishment_contract_accepts_the_panel_configuration_format(self) -> None:
        payload = EstablishmentUpdate(
            nome="Barbearia Teste", cnpj="04.252.011/0001-10", telefone="(33) 99999-0000",
            whatsapp="5533999990000", instagram="barbearia.teste", tiktok="barbearia.teste",
            endereco="Avenida Defensor Público Fabio Ruas", descricao="Atendimento com hora marcada.",
            status_manual="automatico", motivo_status=None, aceita_agendamento=True,
            foto_url="https://example.com/foto.webp", capa_url="https://example.com/capa.webp",
        )
        self.assertEqual(payload.cnpj, "04252011000110")
        self.assertTrue(payload.aceita_agendamento)

    def test_opening_period_contract_rejects_overlap(self) -> None:
        with self.assertRaises(ValidationError):
            OpeningPeriodsReplace(
                estabelecimento_id="00000000-0000-0000-0000-000000000001",
                periodos=[
                    {"dia_semana": 1, "abre": "08:00", "fecha": "12:00", "ordem": 1},
                    {"dia_semana": 1, "abre": "11:00", "fecha": "14:00", "ordem": 2},
                ],
            )

    def test_manual_service_requires_duration_for_custom_service(self) -> None:
        with self.assertRaises(ValidationError):
            ManualServiceCreate(
                estabelecimento_id="00000000-0000-0000-0000-000000000001",
                profissional_id="00000000-0000-0000-0000-000000000002",
                servico_nome="Corte especial",
                inicio=datetime.now(timezone.utc),
                valor=50,
                forma_pagamento="pix",
                canal_origem="balcao",
                chave_idempotencia="manual-service-test-001",
                concluir=True,
            )

    def test_manual_service_accepts_custom_service_with_duration(self) -> None:
        payload = ManualServiceCreate(
            estabelecimento_id="00000000-0000-0000-0000-000000000001",
            profissional_id="00000000-0000-0000-0000-000000000002",
            servico_nome="Corte especial",
            duracao_min=45,
            inicio=datetime.now(timezone.utc),
            valor=50,
            forma_pagamento="credito",
            canal_origem="whatsapp",
            chave_idempotencia="manual-service-test-002",
            concluir=True,
        )
        self.assertIsNone(payload.servico_id)
        self.assertEqual(payload.duracao_min, 45)

    def test_retention_route_requires_session(self) -> None:
        response = self.client.get("/api/v1/retention/waitlist")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_recurrence_cancel_requires_session(self) -> None:
        response = self.client.patch(
            "/api/v1/retention/recurrences/00000000-0000-0000-0000-000000000001",
            json={"status": "cancelada"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_recurrence_update_only_accepts_cancellation(self) -> None:
        self.assertEqual(RecurrenceUpdate(status="cancelada").status, "cancelada")
        with self.assertRaises(ValidationError):
            RecurrenceUpdate(status="pausada")

    def test_client_loyalty_requires_session(self) -> None:
        response = self.client.get("/api/v1/client/loyalty")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_growth_route_requires_session(self) -> None:
        response = self.client.get(
            "/api/v1/growth/insights?establishment_id=00000000-0000-0000-0000-000000000001&start=2026-08-01&end=2026-08-20"
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"]["code"], "UNAUTHORIZED")

    def test_waitlist_contract_rejects_inverted_dates(self) -> None:
        with self.assertRaises(ValidationError):
            WaitlistCreate(**{
                "estabelecimento_id": "00000000-0000-0000-0000-000000000001",
                "servico_id": "00000000-0000-0000-0000-000000000002",
                "data_inicio": "2026-09-20",
                "data_fim": "2026-09-01",
            })

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

    async def test_client_loyalty_is_rate_limited(self) -> None:
        await self._assert_limited(
            client_loyalty,
            "api.index.retention_service.client_loyalty",
            [],
        )

    async def test_support_creation_is_bound_to_authenticated_user(self) -> None:
        limiter = AsyncMock(return_value={"allowed": True, "remaining": 5, "retry_after": 0})
        service = AsyncMock(return_value={"id": "ticket-1"})
        from backend.models import SupportTicketCreate
        payload = SupportTicketCreate(
            nome="Conta de teste", email="outro@example.com", assunto="Problema na agenda",
            mensagem="A agenda não confirmou o atendimento de teste.",
        )
        with patch("api.index.enforce_rate_limit", limiter), patch("api.index.support_service.create", service):
            response = await create_support_ticket(self.request, payload, self.auth)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(limiter.await_args.kwargs["identity"], self.auth.user_id)
        service.assert_awaited_once_with(payload, self.auth, self.request)

    async def test_public_config_never_exposes_a_secret(self) -> None:
        limiter = AsyncMock(return_value={"allowed": True, "remaining": 119, "retry_after": 0})
        with patch("api.index.enforce_rate_limit", limiter):
            response = await public_config(self.request)
        payload = json.loads(response.body)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("secret", json.dumps(payload).lower())
        self.assertIn("turnstile_site_key", payload["data"])
        limiter.assert_awaited_once()


class SecurityAndLifecycleRegressionTests(IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.auth = AuthContext(
            token="validated-token",
            user_id="00000000-0000-0000-0000-000000000001",
            user={"id": "00000000-0000-0000-0000-000000000001"},
            claims={"session_id": "session-current", "amr": [{"method": "password", "timestamp": int(time.time())}]},
        )

    async def test_admin_subscription_uses_safe_idempotent_rpc(self) -> None:
        rest = AsyncMock(return_value={"reutilizado": False, "assinatura": {"id": "subscription-1"}})
        payload = AdminSubscriptionUpdate(
            plano_slug="profissional",
            status="ativa",
            periodo_fim=date.today() + timedelta(days=90),
            chave_idempotencia="admin-subscription-test-0001",
        )
        with patch("backend.services.admin.gateway.rest", rest):
            result = await admin_service.assign_subscription(
                "00000000-0000-0000-0000-000000000010",
                payload,
                self.auth,
                idempotency_key="admin-subscription-test-0001",
            )
        self.assertFalse(result["reutilizado"])
        self.assertEqual(rest.await_args.args[0], "admin_atribuir_plano_111")
        self.assertEqual(rest.await_args.kwargs["json"]["p_chave_idempotencia"], "admin-subscription-test-0001")
        self.assertTrue(rest.await_args.kwargs["rpc"])
        self.assertFalse(rest.await_args.kwargs.get("admin", False))

    async def test_admin_subscription_rejects_conflicting_idempotency_keys(self) -> None:
        request = Request({
            "type": "http", "method": "PATCH", "path": "/api/v1/admin/establishments/x/subscription",
            "headers": [], "client": ("127.0.0.1", 12345), "server": ("testserver", 80),
            "scheme": "http", "query_string": b"",
        })
        payload = AdminSubscriptionUpdate(
            plano_slug="elite",
            chave_idempotencia="admin-subscription-body-0001",
        )
        with patch("api.index.enforce_rate_limit", AsyncMock()), self.assertRaises(ApiError) as caught:
            await admin_assign_subscription(
                "00000000-0000-0000-0000-000000000010",
                request,
                payload,
                "admin-subscription-header-0001",
                self.auth,
            )
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(caught.exception.code, "IDEMPOTENCY_KEY_MISMATCH")

    async def test_gateway_maps_provider_details_to_safe_conflict(self) -> None:
        error = SupabaseGateway._safe_error(400, {"code": "P0001", "message": "chave de idempotência reutilizada com payload diferente", "details": "private"})
        self.assertEqual(error.status_code, 409)
        self.assertEqual(error.code, "IDEMPOTENCY_CONFLICT")
        self.assertIsNone(error.details)
        slot = SupabaseGateway._safe_error(400, {"code": "P0001", "message": "SLOT_CONFLICT"})
        self.assertEqual((slot.status_code, slot.code), (409, "APPOINTMENT_CONFLICT"))

    async def test_gateway_keeps_permission_and_schema_errors_out_of_422(self) -> None:
        denied = SupabaseGateway._safe_error(400, {
            "code": "P0001", "message": "Sua conta não pode alterar a localização.",
        })
        self.assertEqual((denied.status_code, denied.code), (403, "ESTABLISHMENT_LOCATION_FORBIDDEN"))
        rls = SupabaseGateway._safe_error(401, {
            "code": "42501", "message": "new row violates row-level security policy",
        })
        self.assertEqual((rls.status_code, rls.code), (403, "UPSTREAM_PERMISSION_DENIED"))
        missing_rpc = SupabaseGateway._safe_error(404, {
            "code": "PGRST202", "message": "Could not find the function in the schema cache",
        })
        self.assertEqual((missing_rpc.status_code, missing_rpc.code), (503, "DATABASE_SCHEMA_OUTDATED"))

    async def test_owner_update_forwards_the_callers_token_to_rls(self) -> None:
        payload = EstablishmentUpdate(nome="Barbearia do dono", descricao="Atualização autorizada.")
        rest = AsyncMock(return_value=[{"id": "00000000-0000-0000-0000-000000000010", "nome": payload.nome}])
        with patch("backend.services.management.gateway.rest", rest):
            result = await management_service.update_establishment(
                "00000000-0000-0000-0000-000000000010", payload, self.auth,
            )
        self.assertEqual(result["nome"], "Barbearia do dono")
        self.assertEqual(rest.await_args.kwargs["token"], self.auth.token)
        self.assertEqual(rest.await_args.kwargs["method"], "PATCH")
        self.assertEqual(rest.await_args.kwargs["params"]["id"], "eq.00000000-0000-0000-0000-000000000010")

    async def test_owner_configuration_with_online_agenda_checks_entitlement_then_updates(self) -> None:
        payload = EstablishmentUpdate(
            nome="Barbearia do dono", descricao="Atualização autorizada.", aceita_agendamento=True,
        )
        rest = AsyncMock(side_effect=[
            {"permite_agenda": True},
            [{"id": "00000000-0000-0000-0000-000000000010", "aceita_agendamento": True}],
        ])
        with patch("backend.services.management.gateway.rest", rest):
            result = await management_service.update_establishment(
                "00000000-0000-0000-0000-000000000010", payload, self.auth,
            )
        self.assertTrue(result["aceita_agendamento"])
        self.assertEqual(rest.await_args_list[0].args[0], "obter_meus_entitlements")
        self.assertEqual(rest.await_args_list[1].args[0], "estabelecimentos")
        self.assertEqual(rest.await_args_list[1].kwargs["token"], self.auth.token)

    async def test_owner_location_update_serializes_the_panel_payload(self) -> None:
        payload = EstablishmentLocationUpdate(
            logradouro="Avenida Defensor Público Fabio Ruas", numero="523", complemento="Estabelecimento",
            bairro="Centro", cidade="Jacinto", estado="MG", cep="39930-000", precisao_localizacao="endereco",
        )
        rest = AsyncMock(return_value={"id": "00000000-0000-0000-0000-000000000010"})
        with patch("backend.services.management.gateway.rest", rest):
            result = await management_service.update_location(
                "00000000-0000-0000-0000-000000000010", payload, self.auth,
            )
        self.assertEqual(result["id"], "00000000-0000-0000-0000-000000000010")
        self.assertEqual(rest.await_args.kwargs["token"], self.auth.token)
        self.assertTrue(rest.await_args.kwargs["rpc"])
        sent = rest.await_args.kwargs["json"]
        self.assertEqual(sent["p_cep"], "39930-000")
        self.assertEqual(sent["p_estado"], "MG")
        self.assertIsNone(sent["p_latitude"])
        self.assertNotIn("pais", sent)

    async def test_recent_authentication_uses_strong_amr_timestamp(self) -> None:
        age = recent_authentication_age(self.auth, now=time.time() + 25)
        self.assertIsNotNone(age)
        self.assertLess(age, 30)
        missing = AuthContext(token="x", user_id="u", user={}, claims={})
        self.assertIsNone(recent_authentication_age(missing))

    async def test_account_deletion_requires_explicit_retention_acknowledgement(self) -> None:
        with self.assertRaises(ApiError) as caught:
            await account_service.request_deletion(
                DeleteAccountRequest(confirmacao="EXCLUIR MINHA CONTA", retencao_ciente=False),
                self.auth,
            )
        self.assertEqual(caught.exception.code, "RETENTION_ACK_REQUIRED")

    async def test_account_deletion_uses_delayed_rpc_contract(self) -> None:
        rest = AsyncMock(return_value={
            "status": "agendada", "agendado_para": "2026-09-16T12:00:00Z", "reutilizado": False,
        })
        with patch("backend.services.account.gateway.rest", rest):
            result = await account_service.request_deletion(
                DeleteAccountRequest(
                    confirmacao="EXCLUIR MINHA CONTA", motivo="Decisão pessoal", retencao_ciente=True,
                ),
                self.auth,
            )
        self.assertTrue(result["scheduled"])
        self.assertEqual(result["grace_period_days"], 7)
        self.assertEqual(rest.await_args.args[0], "solicitar_exclusao_conta_111")

    async def test_connected_session_ids_are_not_exposed(self) -> None:
        rows = [{
            "id": "session-current", "user_agent": "Browser Test", "ip_masked": "192.0.2.xxx",
            "created_at": "2026-09-09T10:00:00Z", "updated_at": "2026-09-09T10:01:00Z",
        }]
        with patch("backend.services.account.gateway.rest", AsyncMock(return_value=rows)):
            result = await account_service.list_sessions(self.auth)
        self.assertTrue(result["items"][0]["current"])
        self.assertNotEqual(result["items"][0]["id"], "session-current")
        self.assertEqual(result["items"][0]["ip_masked"], "192.0.2.xxx")

    async def test_booking_is_idempotent_and_uses_new_rpc(self) -> None:
        payload = AppointmentCreate(
            estabelecimento_id="00000000-0000-0000-0000-000000000010",
            profissional_id="00000000-0000-0000-0000-000000000011",
            servicos_ids=["00000000-0000-0000-0000-000000000012"],
            data="2026-09-15",
            hora_inicio="10:00",
        )
        rest = AsyncMock(side_effect=[[], [], [], {"id": "appointment-1", "reutilizado": True, "status": "pendente"}])
        with patch("backend.services.appointments.gateway.rest", rest):
            result = await appointment_service.create(payload, self.auth, idempotency_key="booking-test-key-0001")
        self.assertEqual(result["id"], "appointment-1")
        self.assertTrue(result["replayed"])
        self.assertEqual(rest.await_args_list[-1].args[0], "criar_agendamento_idempotente_111")
        sent = rest.await_args_list[-1].kwargs["json"]
        self.assertEqual(sent["p_chave_idempotencia"], "booking-test-key-0001")
        self.assertNotIn("p_idempotencia_hash", sent)

    async def test_booking_rejects_conflicting_header_and_body_keys(self) -> None:
        request = Request({
            "type": "http", "method": "POST", "path": "/api/v1/appointments", "headers": [],
            "client": ("127.0.0.1", 12345), "server": ("testserver", 80), "scheme": "http", "query_string": b"",
        })
        payload = AppointmentCreate(
            estabelecimento_id="00000000-0000-0000-0000-000000000010",
            profissional_id="00000000-0000-0000-0000-000000000011",
            servicos_ids=["00000000-0000-0000-0000-000000000012"],
            data="2026-09-15", hora_inicio="10:00", chave_idempotencia="booking-body-key-0001",
        )
        with patch("api.index.enforce_rate_limit", AsyncMock()), self.assertRaises(ApiError) as caught:
            await create_appointment(request, payload, "booking-header-key-1", self.auth)
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(caught.exception.code, "IDEMPOTENCY_KEY_MISMATCH")

    async def test_professional_cannot_book_own_establishment(self) -> None:
        payload = AppointmentCreate(
            estabelecimento_id="00000000-0000-0000-0000-000000000010",
            profissional_id="00000000-0000-0000-0000-000000000011",
            servicos_ids=["00000000-0000-0000-0000-000000000012"],
            data="2026-09-15",
            hora_inicio="10:00",
        )
        rest = AsyncMock(side_effect=[[{"id": "owned"}], [], []])
        with patch("backend.services.appointments.gateway.rest", rest), self.assertRaises(ApiError) as caught:
            await appointment_service.create(payload, self.auth, idempotency_key="booking-test-key-0002")
        self.assertEqual(caught.exception.code, "SELF_BOOKING_NOT_ALLOWED")

    async def test_concurrent_retries_keep_one_booking_identity(self) -> None:
        payload = AppointmentCreate(
            estabelecimento_id="00000000-0000-0000-0000-000000000010",
            profissional_id="00000000-0000-0000-0000-000000000011",
            servicos_ids=["00000000-0000-0000-0000-000000000012"],
            data="2026-09-15",
            hora_inicio="10:00",
        )
        rpc_calls = 0

        async def fake_rest(resource, **kwargs):
            nonlocal rpc_calls
            if resource in {"estabelecimentos", "profissionais", "estabelecimento_membros"}:
                return []
            self.assertEqual(resource, "criar_agendamento_idempotente_111")
            self.assertEqual(kwargs["json"]["p_chave_idempotencia"], "booking-concurrent-0001")
            rpc_calls += 1
            return {"id": "appointment-one", "reutilizado": rpc_calls > 1, "status": "pendente"}

        with patch("backend.services.appointments.gateway.rest", side_effect=fake_rest):
            first, second = await asyncio.gather(
                appointment_service.create(payload, self.auth, idempotency_key="booking-concurrent-0001"),
                appointment_service.create(payload, self.auth, idempotency_key="booking-concurrent-0001"),
            )
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(rpc_calls, 2)

    async def test_recurrences_include_remaining_and_next_occurrence_in_one_batch(self) -> None:
        recurrence_id = "00000000-0000-0000-0000-000000000091"
        recurrence_rows = [{
            "id": recurrence_id,
            "cliente_id": self.auth.user_id,
            "status": "ativa",
            "frequencia": "quinzenal",
            "total_ocorrencias": 6,
            "ocorrencias_criadas": 6,
        }]
        occurrence_rows = [
            {"recorrencia_id": recurrence_id, "data": date.today().isoformat(), "hora_inicio": "14:30:00", "status": "confirmado"},
            {"recorrencia_id": recurrence_id, "data": (date.today() + timedelta(days=14)).isoformat(), "hora_inicio": "14:30:00", "status": "pendente"},
        ]
        # The gateway may preserve provider envelopes. The service boundary
        # must normalize them instead of treating the object like a list.
        rest = AsyncMock(side_effect=[{"items": recurrence_rows}, {"data": occurrence_rows}])
        with patch("backend.services.retention.gateway.rest", rest):
            result = await retention_service.list_recurrences(None, self.auth)
        self.assertEqual(result["items"][0]["ocorrencias_restantes"], 2)
        self.assertEqual(result["items"][0]["proxima_ocorrencia"]["hora_inicio"], "14:30:00")
        self.assertEqual(rest.await_count, 2)
        occurrence_query = rest.await_args_list[1].kwargs["params"]
        self.assertEqual(occurrence_query["recorrencia_id"], f"in.({recurrence_id})")
        self.assertEqual(occurrence_query["status"], "in.(pendente,confirmado)")

    async def test_waitlist_accepts_provider_data_envelope(self) -> None:
        row = {
            "id": "00000000-0000-0000-0000-000000000092",
            "cliente_id": self.auth.user_id,
            "status": "aguardando",
        }
        with patch(
            "backend.services.retention.gateway.rest",
            AsyncMock(return_value={"data": [row]}),
        ):
            result = await retention_service.list_waitlist(None, self.auth)
        self.assertEqual(result["items"], [row])
        self.assertFalse(result["has_more"])

    async def test_waitlist_fails_cleanly_on_invalid_provider_shape(self) -> None:
        with patch(
            "backend.services.retention.gateway.rest",
            AsyncMock(return_value={"message": "unexpected upstream payload"}),
        ), self.assertRaises(ApiError) as caught:
            await retention_service.list_waitlist(None, self.auth)
        self.assertEqual(caught.exception.status_code, 502)
        self.assertEqual(caught.exception.code, "UPSTREAM_RESPONSE_INVALID")

    async def test_http_pool_is_shared_and_closed_explicitly(self) -> None:
        gateway = SupabaseGateway()
        first, second = await asyncio.gather(gateway._get_client(), gateway._get_client())
        self.assertIs(first, second)
        await gateway.aclose()
        self.assertTrue(first.is_closed)

    async def test_storage_cleanup_uses_supported_storage_api(self) -> None:
        import httpx

        gateway = SupabaseGateway()
        request = AsyncMock(return_value=httpx.Response(200, json=[{"name": "user/photo.webp"}]))
        with patch.object(gateway, "request", request):
            removed = await gateway.storage_remove("barberhub-public", ["user/photo.webp"])
        self.assertEqual(removed, 1)
        self.assertEqual(request.await_args.args[0], "/storage/v1/object/barberhub-public")
        self.assertEqual(request.await_args.kwargs["method"], "DELETE")
        self.assertEqual(request.await_args.kwargs["json"], {"prefixes": ["user/photo.webp"]})
        self.assertTrue(request.await_args.kwargs["admin"])

    async def test_account_deletion_worker_cleans_storage_before_auth(self) -> None:
        rpc = AsyncMock(side_effect=[
            [{"solicitacao_id": "request-1", "user_id": "user-1"}],
            [{"bucket_id": "barberhub-public", "nome": "user-1/avatar/photo.webp"}],
            [],
            {"anonimizada": True},
            {"status": "concluida"},
        ])
        remove = AsyncMock(return_value=1)
        delete_user = AsyncMock()
        with patch("backend.services.maintenance._rpc", rpc), patch(
            "backend.services.maintenance.gateway.storage_remove", remove
        ), patch("backend.services.maintenance.gateway.admin_delete_user", delete_user):
            result = await maintenance_service.process_account_deletions(5)
        self.assertEqual(result, {"claimed": 1, "completed": 1, "failed": 0, "files_removed": 1})
        remove.assert_awaited_once_with("barberhub-public", ["user-1/avatar/photo.webp"])
        delete_user.assert_awaited_once_with("user-1")
        called_rpcs = [call.args[0] for call in rpc.await_args_list]
        self.assertLess(called_rpcs.index("listar_arquivos_conta_exclusao_111"), called_rpcs.index("anonimizar_conta_exclusao_111"))
        self.assertLess(called_rpcs.index("anonimizar_conta_exclusao_111"), called_rpcs.index("concluir_exclusao_conta_111"))

    async def test_account_deletion_worker_concludes_when_auth_was_already_removed(self) -> None:
        rpc = AsyncMock(side_effect=[
            [{"solicitacao_id": "request-1", "user_id": "user-1"}],
            [],
            {"anonimizada": True},
            {"status": "concluida"},
        ])
        delete_user = AsyncMock(side_effect=ApiError(404, "AUTH_USER_NOT_FOUND", "Usuário já removido."))
        with patch("backend.services.maintenance._rpc", rpc), patch(
            "backend.services.maintenance.gateway.admin_delete_user", delete_user
        ):
            result = await maintenance_service.process_account_deletions(5)
        self.assertEqual(result, {"claimed": 1, "completed": 1, "failed": 0, "files_removed": 0})
        self.assertEqual([call.args[0] for call in rpc.await_args_list][-1], "concluir_exclusao_conta_111")

    async def test_device_push_stays_disabled_during_the_internal_notification_pilot(self) -> None:
        from types import SimpleNamespace

        with patch("backend.services.push.settings", SimpleNamespace(
            external_notifications_enabled=False,
            vapid_public_key="public", vapid_private_key="private", vapid_subject="mailto:ops@example.invalid",
        )):
            self.assertEqual(await push_service.config(), {"supported": False, "vapid_public_key": None})
            with self.assertRaises(ApiError) as caught:
                await push_service.subscribe(
                    PushSubscriptionCreate(
                        endpoint="https://push.example.invalid/subscription", p256dh="p" * 16, auth="a" * 8,
                    ),
                    self.auth,
                )
        self.assertEqual(caught.exception.code, "EXTERNAL_NOTIFICATIONS_DISABLED")

    async def test_reviews_are_paginated_and_hide_private_profile_fields(self) -> None:
        import httpx

        response = httpx.Response(
            200,
            json=[{"id": "r1", "nota": 5, "comentario": "Ótimo", "perfis": {"nome": "Ana"}}],
            headers={"content-range": "0-0/12"},
        )
        with patch("backend.services.catalog.gateway.request", AsyncMock(return_value=response)) as request_mock, patch(
            "backend.services.catalog.gateway.rest", AsyncMock(return_value=[{"avaliacao": 4.8}])
        ):
            page = await catalog_service.reviews("establishment-1", offset=0, limit=1)
        self.assertEqual(page["total"], 12)
        self.assertTrue(page["has_more"])
        selected = request_mock.await_args.kwargs["params"]["select"]
        self.assertNotIn("email", selected)
        self.assertNotIn("telefone", selected)

    async def test_reviews_filter_verified_and_community_at_the_query_boundary(self) -> None:
        import httpx

        response = httpx.Response(200, json=[], headers={"content-range": "*/0"})
        request = AsyncMock(return_value=response)
        with patch("backend.services.catalog.gateway.request", request), patch(
            "backend.services.catalog.gateway.rest", AsyncMock(return_value=[{"avaliacao": 0}])
        ):
            await catalog_service.reviews("establishment-1", source="verified")
            verified = request.await_args.kwargs["params"]
            await catalog_service.reviews("establishment-1", source="community")
            community = request.await_args.kwargs["params"]
        self.assertEqual(verified["or"], "(verificada.is.true,origem.eq.agendamento)")
        self.assertEqual(community["verificada"], "is.false")
        self.assertEqual(community["origem"], "neq.agendamento")

    async def test_public_establishment_uses_a_filtered_server_projection(self) -> None:
        row = {
            "id": "5022cf83-66c9-47ad-a8af-8590b20b6c18",
            "nome": "Barbearia do Igão",
            "aceita_agendamento": True,
        }
        rest = AsyncMock(side_effect=[[row], True])
        with patch("backend.services.catalog.gateway.rest", rest):
            result = await catalog_service.public_establishment(row["id"])
        self.assertTrue(result["aceita_agendamento"])
        params = rest.await_args_list[0].kwargs["params"]
        self.assertEqual(params["visivel"], "eq.true")
        self.assertEqual(params["onboarding_concluido"], "eq.true")
        self.assertEqual(params["profissionais.ativo"], "eq.true")
        self.assertNotIn("owner_id", params["select"])

    async def test_subscription_listing_does_not_depend_on_unapplied_plan_column(self) -> None:
        rest = AsyncMock(return_value=[])
        with patch("backend.services.admin.gateway.rest", rest):
            await admin_service.list_subscriptions(self.auth)
        subscription_call = next(
            call for call in rest.await_args_list if call.args and call.args[0] == "assinaturas"
        )
        selected = subscription_call.kwargs["params"]["select"]
        self.assertNotIn("estado_comercial", selected)

    async def test_regional_marketplace_keeps_all_filters_in_one_query(self) -> None:
        rest = AsyncMock(return_value=[])
        with patch("backend.services.flags.require_enabled", AsyncMock()), patch(
            "backend.services.catalog.gateway.rest", rest
        ):
            result = await catalog_service.regional_search(
                query="unhas",
                tipo="salao",
                status="fechada",
                agenda=False,
                city="Jacinto",
                neighborhood="Centro",
                state="MG",
                service="manicure",
                min_price=20,
                max_price=80,
                min_rating=4,
            )
        self.assertEqual(result["items"], [])
        self.assertEqual(rest.await_args.args[0], "buscar_marketplace_regional_111")
        sent = rest.await_args.kwargs["json"]
        self.assertEqual(sent["p_tipo"], "salao")
        self.assertEqual(sent["p_status"], "fechada")
        self.assertIs(sent["p_agenda"], False)
        self.assertEqual(sent["p_servico"], "manicure")

    async def test_email_worker_records_delivery_without_exposing_provider_body(self) -> None:
        from types import SimpleNamespace
        import httpx

        fake_settings = SimpleNamespace(
            external_notifications_enabled=True,
            email_api_url="https://mailer.invalid/send",
            email_api_key="private-test-key",
            email_from="Barber Hub <avisos@example.test>",
        )
        rest = AsyncMock(side_effect=[[
            {"id": "00000000-0000-0000-0000-000000000099", "destinatario": "ana@example.test", "assunto": "Aviso", "html": "<p>Olá</p>", "texto": "Olá"}
        ], None])
        response = httpx.Response(202, json={"id": "provider-message-1"})
        with patch("backend.services.email_delivery.settings", fake_settings), patch(
            "backend.services.email_delivery.gateway.rest", rest
        ), patch("backend.services.email_delivery.gateway.external_request", AsyncMock(return_value=response)):
            result = await email_service.deliver_pending(1)
        self.assertEqual(result, {"processed": 1, "sent": 1, "failed": 0})
        finalized = rest.await_args_list[-1].kwargs["json"]
        self.assertEqual(finalized["p_provedor_id"], "provider-message-1")
        self.assertNotIn("private-test-key", json.dumps(finalized))
