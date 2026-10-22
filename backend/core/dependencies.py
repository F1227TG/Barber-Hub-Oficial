"""Infrastructure composition; services may inject alternative implementations."""
from backend.integrations.accounts import SupabaseAccountRepository
from backend.ports.accounts import AccountRepository
from backend.integrations.identity import SupabaseIdentityProvider
from backend.ports.identity import IdentityProvider

accounts: AccountRepository = SupabaseAccountRepository()
identity: IdentityProvider = SupabaseIdentityProvider()
