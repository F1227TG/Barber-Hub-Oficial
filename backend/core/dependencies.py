"""Infrastructure composition; consumers depend on provider-neutral contracts."""
from backend.ports.gateway import DataGateway
from backend.integrations.gateway import gateway as _default_gateway

gateway: DataGateway = _default_gateway

from backend.integrations.accounts import SupabaseAccountRepository
from backend.ports.accounts import AccountRepository
from backend.integrations.identity import SupabaseIdentityProvider
from backend.ports.identity import IdentityProvider

accounts: AccountRepository = SupabaseAccountRepository()
identity: IdentityProvider = SupabaseIdentityProvider()
