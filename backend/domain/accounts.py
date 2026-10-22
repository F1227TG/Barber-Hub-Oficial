"""Pure account access and administrative transition rules."""
from backend.errors import ApiError

ROLES = frozenset({'admin', 'barbeiro', 'cliente'})
STATES = frozenset({'ativa', 'desativada', 'suspensa', 'excluida'})


def is_active(profile):
    # Older deployments have only ativo; explicit non-active states always win.
    return bool(profile and profile.get('ativo') is True
                and profile.get('estado_conta', 'ativa') == 'ativa'
                and profile.get('tipo') in ROLES)


def validate_admin_change(actor, target_id, changes):
    if not is_active(actor) or actor.get('tipo') != 'admin':
        raise ApiError(403, 'FORBIDDEN', 'Esta operação exige uma conta administrativa ativa.')
    if actor['id'] == target_id:
        raise ApiError(409, 'SELF_ACCOUNT_CHANGE', 'Sua conta é protegida nesta operação administrativa.')
    if not changes:
        raise ApiError(422, 'EMPTY_ACCOUNT_CHANGE', 'Informe a alteração desejada.')
    if set(changes) - {'tipo', 'estado_conta'}:
        raise ApiError(422, 'INVALID_ACCOUNT_CHANGE', 'Alteração de conta inválida.')
    if ('tipo' in changes and changes['tipo'] not in ROLES
            or 'estado_conta' in changes and changes['estado_conta'] not in STATES):
        raise ApiError(422, 'INVALID_ACCOUNT_CHANGE', 'Alteração de conta inválida.')
