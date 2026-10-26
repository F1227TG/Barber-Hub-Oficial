"""Supabase implementation of the account repository contract."""
from backend.errors import ApiError
from backend.integrations.gateway import gateway


class SupabaseAccountRepository:
    async def session_active(self, user_id, session_id):
        return await gateway.rest('sessao_conta_ativa', method='POST', admin=True, rpc=True,
                                   json={'p_user_id': user_id, 'p_session_id': session_id}) is True

    async def profile(self, user_id):
        rows = await gateway.rest('perfis', admin=True,
                                  params={'id': f'eq.{user_id}', 'select': '*', 'limit': '1'})
        if not isinstance(rows, list):
            raise ApiError(502, 'UPSTREAM_RESPONSE_INVALID', 'Não foi possível validar a conta.')
        return rows[0] if rows else None

    async def administer(self, *, actor_id, user_id, changes, request_id):
        result = await gateway.rest('administrar_conta', method='POST', admin=True, rpc=True,
                                    json={'p_actor_id': actor_id, 'p_user_id': user_id,
                                          'p_changes': changes, 'p_request_id': request_id})
        if not isinstance(result, dict) or result.get('id') != user_id:
            raise ApiError(502, 'UPSTREAM_RESPONSE_INVALID', 'Não foi possível confirmar a alteração da conta.')
        return result
