"""Administrative account use cases with an injectable persistence boundary."""
from backend.core import dependencies
from backend.domain.accounts import validate_admin_change
from backend.ports.accounts import AccountRepository


async def update(user_id, changes, auth, *, request_id=None, repository: AccountRepository | None = None):
    repository = repository or dependencies.accounts
    actor = await repository.profile(auth.user_id)
    validate_admin_change(actor, user_id, changes)
    # Repository atomically checks actor/target/last admin, mutates and audits.
    return await repository.administer(actor_id=auth.user_id, user_id=user_id,
                                       changes=changes, request_id=request_id)
