"""Appointment creation through the database's transactional RPC."""

from backend.models import AppointmentCreate
from backend.security import AuthContext
from backend.supabase import gateway


async def create(payload: AppointmentCreate, auth: AuthContext) -> dict[str, str]:
    appointment_id = await gateway.rest(
        "criar_agendamento_multisservico",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_estabelecimento_id": str(payload.estabelecimento_id),
            "p_profissional_id": str(payload.profissional_id),
            "p_servicos_ids": [str(item) for item in payload.servicos_ids],
            "p_data": payload.data.isoformat(),
            "p_hora_inicio": payload.hora_inicio.strftime("%H:%M:%S"),
            "p_observacao": payload.observacao,
        },
    )
    return {"id": str(appointment_id)}
