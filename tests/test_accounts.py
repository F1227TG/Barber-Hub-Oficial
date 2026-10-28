"""Authorization and account lifecycle tests across the HTTP/service boundary."""
import base64
import json
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from api.index import app
from backend.errors import ApiError
from backend.security import AuthContext
from backend.services import admin_accounts

ACTOR = '00000000-0000-0000-0000-000000000001'
TARGET = '00000000-0000-0000-0000-000000000002'
CLAIMS = base64.urlsafe_b64encode(json.dumps({'session_id': TARGET}).encode()).decode().rstrip('=')
TOKEN = 'verified.' + CLAIMS + '.signature'


class AccountAuthorizationTests(TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.auth = patch('backend.security.dependencies.identity.verify', AsyncMock(return_value={
            'id': ACTOR, 'email': 'test@example.com', 'email_confirmed_at': '2026-01-01',
            'user_metadata': {'tipo': 'admin'},
        }))
        self.auth.start()
        self.addCleanup(self.auth.stop)
        self.session = patch('backend.security.dependencies.accounts.session_active', AsyncMock(return_value=True))
        self.session.start()
        self.addCleanup(self.session.stop)

    def request(self, profile, *, path=None, payload=None):
        with patch('backend.security.dependencies.accounts.profile', AsyncMock(return_value=profile)):
            return self.client.patch(path or f'/api/v1/admin/users/{TARGET}',
                                     headers={'Authorization': f'Bearer {TOKEN}'},
                                     json=payload if payload is not None else {'estado_conta': 'excluida'})

    def test_no_token_is_rejected(self):
        self.assertEqual(self.client.delete(f'/api/v1/admin/users/{TARGET}').status_code, 401)

    def test_identity_outage_is_not_reported_as_expired_session(self):
        for status in [429, 503]:
            with self.subTest(status=status), patch('backend.security.dependencies.identity.verify',
                    AsyncMock(side_effect=ApiError(status, 'UPSTREAM_UNAVAILABLE', 'Tente novamente.'))):
                response = self.client.get('/api/v1/account/profile', headers={'Authorization': f'Bearer {TOKEN}'})
                self.assertEqual(response.status_code, status)
                self.assertEqual(response.json()['error']['code'], 'UPSTREAM_UNAVAILABLE')

    def test_user_metadata_cannot_grant_admin(self):
        for role in ['cliente', 'barbeiro']:
            with self.subTest(role=role):
                response = self.request({'id': ACTOR, 'tipo': role, 'ativo': True, 'estado_conta': 'ativa'})
                self.assertEqual(response.status_code, 403)

    def test_inactive_deleted_suspended_and_missing_profile_are_rejected(self):
        for profile in [None, {'tipo': 'admin', 'ativo': False},
                        {'tipo': 'admin', 'ativo': True, 'estado_conta': 'excluida'},
                        {'tipo': 'admin', 'ativo': True, 'estado_conta': 'suspensa'}]:
            with self.subTest(profile=profile):
                response = self.request(profile)
                self.assertEqual(response.status_code, 403)
                self.assertEqual(response.json()['error']['code'], 'ACCOUNT_INACTIVE')

    def test_admin_payload_rejects_unknown_fields_null_and_empty(self):
        for payload in [{}, {'tipo': None}, {'ativo': True}, {'tipo': 'owner'}, {'estado_conta': 'apagada'}]:
            with self.subTest(payload=payload):
                response = self.request({'id': ACTOR, 'tipo': 'admin', 'ativo': True}, payload=payload)
                self.assertEqual(response.status_code, 422)

    def test_admin_route_binds_actor_to_authenticated_user(self):
        actor = {'id': ACTOR, 'tipo': 'admin', 'ativo': True}
        update = AsyncMock(return_value={'id': TARGET, 'estado_conta': 'excluida'})
        with patch('api.routers.admin.enforce_rate_limit', AsyncMock()), patch(
            'api.routers.admin.admin_accounts.update', update
        ):
            response = self.request(actor)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(update.await_args.args[0], TARGET)
        self.assertEqual(update.await_args.args[2].user_id, ACTOR)
        self.assertEqual(update.await_args.kwargs['request_id'], response.headers['X-Request-ID'])

    def test_role_and_state_are_checked_again_on_each_request(self):
        profile = {'id': ACTOR, 'tipo': 'cliente', 'ativo': True}
        with patch('backend.security.dependencies.accounts.profile', AsyncMock(return_value=profile)):
            self.assertEqual(self.client.get('/api/v1/account/profile', headers={'Authorization': f'Bearer {TOKEN}'}).status_code, 200)
            profile['ativo'] = False
            self.assertEqual(self.client.get('/api/v1/account/profile', headers={'Authorization': f'Bearer {TOKEN}'}).status_code, 403)

    def test_revoked_session_cannot_return_after_account_restoration(self):
        with patch('backend.security.dependencies.accounts.session_active', AsyncMock(return_value=False)):
            response = self.request({'id': ACTOR, 'tipo': 'admin', 'ativo': True})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['error']['code'], 'INVALID_SESSION')


class AccountServiceTests(IsolatedAsyncioTestCase):
    def test_numbered_sql_matches_managed_migration(self):
        from pathlib import Path
        source = Path('supabase/migrations/20261022155131_modernizacao_contas_administrativas.sql').read_text(encoding='utf-8')
        self.assertEqual(source, Path('sql/41_modernizacao_contas_administrativas.sql').read_text(encoding='utf-8'))

    async def test_self_change_stops_before_repository_write(self):
        repository = AsyncMock()
        repository.profile.return_value = {'id': ACTOR, 'tipo': 'admin', 'ativo': True}
        auth = AuthContext('token', ACTOR, {})
        with self.assertRaises(ApiError) as caught:
            await admin_accounts.update(ACTOR, {'estado_conta': 'excluida'}, auth, repository=repository)
        self.assertEqual(caught.exception.code, 'SELF_ACCOUNT_CHANGE')
        repository.administer.assert_not_awaited()

    async def test_repository_errors_are_not_reported_as_success(self):
        repository = AsyncMock()
        repository.profile.return_value = {'id': ACTOR, 'tipo': 'admin', 'ativo': True}
        repository.administer.side_effect = ApiError(409, 'LAST_ACTIVE_ADMIN', 'Último administrador')
        with self.assertRaises(ApiError):
            await admin_accounts.update(TARGET, {'estado_conta': 'excluida'}, AuthContext('token', ACTOR, {}), repository=repository)


class RequestContextTests(TestCase):
    def test_untrusted_request_id_is_replaced(self):
        client = TestClient(app)
        for request_id in ['x' * 200, '<script>']:
            response = client.get('/api/v1/health/live', headers={'X-Request-ID': request_id})
            self.assertNotEqual(response.headers['X-Request-ID'], request_id)
            self.assertEqual(len(response.headers['X-Request-ID']), 36)

    def test_safe_request_id_is_preserved(self):
        response = TestClient(app).get('/api/v1/health/live', headers={'X-Request-ID': 'web-123:abc'})
        self.assertEqual(response.headers['X-Request-ID'], 'web-123:abc')
