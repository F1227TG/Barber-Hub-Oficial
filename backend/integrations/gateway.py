"""Provider boundary for services. Supabase is selected here by composition."""

from backend.ports.gateway import DataGateway
from backend.supabase import gateway as _supabase_gateway

gateway: DataGateway = _supabase_gateway

__all__ = ["gateway"]
