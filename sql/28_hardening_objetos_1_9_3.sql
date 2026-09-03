-- Barber Hub 1.9.3: defesa em profundidade para os objetos da release.
-- Execute depois de 27_advisors_release_1_9_3.sql.

begin;

revoke all on table
  public.lista_espera,
  public.agendamentos_recorrencias,
  public.fidelidade_programas,
  public.fidelidade_recompensas,
  public.fidelidade_saldos,
  public.fidelidade_movimentos,
  public.cupons,
  public.cupom_usos,
  public.campanhas,
  public.campanha_destinatarios,
  public.automacoes_mensagens,
  public.membro_permissoes,
  public.metas_crescimento,
  public.oportunidades_crescimento,
  public.insights_operacionais
from public, anon;

grant select on table
  public.lista_espera,
  public.agendamentos_recorrencias,
  public.fidelidade_saldos,
  public.fidelidade_movimentos,
  public.cupom_usos,
  public.campanhas,
  public.campanha_destinatarios,
  public.automacoes_mensagens,
  public.membro_permissoes,
  public.oportunidades_crescimento,
  public.insights_operacionais
to authenticated;

grant select, insert, update on table
  public.fidelidade_programas,
  public.fidelidade_recompensas,
  public.cupons
to authenticated;

grant select, insert, update, delete on table
  public.metas_crescimento
to authenticated;

commit;
