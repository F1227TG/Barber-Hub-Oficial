"""Supabase Auth adapter. Only this boundary knows how tokens are verified."""
from backend.integrations.gateway import gateway


class SupabaseIdentityProvider:
    async def verify(self, token):
        return await gateway.auth_user(token)
