-- A portabilidade da conta inclui os relacionamentos em que a pessoa e
-- titular/cliente. Dados de outros clientes de um estabelecimento nao entram
-- no arquivo, mesmo quando o titular tambem opera esse estabelecimento.

create or replace function public.exportar_meus_dados_111()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  return jsonb_build_object(
    'gerado_em',now(),
    'perfil',(select to_jsonb(p)-'acessibilidade' from public.perfis p where p.id=v_user),
    'acessibilidade',(select p.acessibilidade from public.perfis p where p.id=v_user),
    'estabelecimentos',coalesce((
      select jsonb_agg(to_jsonb(e)-'search_vector' order by e.created_at)
      from public.estabelecimentos e where e.owner_id=v_user
    ),'[]'::jsonb),
    'vinculos_equipe',coalesce((
      select jsonb_agg(jsonb_build_object(
        'estabelecimento_id',m.estabelecimento_id,'papel',m.papel,'status',m.status,
        'aceito_em',m.aceito_em,'created_at',m.created_at
      ) order by m.created_at) from public.estabelecimento_membros m where m.user_id=v_user
    ),'[]'::jsonb),
    'permissoes_equipe',coalesce((
      select jsonb_agg(jsonb_build_object(
        'membro_id',mp.membro_id,'recurso',mp.recurso,'permitido',mp.permitido,
        'created_at',mp.created_at,'updated_at',mp.updated_at
      ) order by mp.created_at)
      from public.membro_permissoes mp
      join public.estabelecimento_membros m on m.id=mp.membro_id
      where m.user_id=v_user
    ),'[]'::jsonb),
    'perfil_profissional',coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at)
      from public.profissionais p where p.user_id=v_user
    ),'[]'::jsonb),
    'agendamentos',coalesce((
      select jsonb_agg(to_jsonb(a)-'idempotencia_hash'-'chave_idempotencia' order by a.created_at)
      from public.agendamentos a where a.cliente_id=v_user
    ),'[]'::jsonb),
    'lista_espera',coalesce((
      select jsonb_agg(to_jsonb(l)-'criado_por' order by l.created_at)
      from public.lista_espera l where l.cliente_id=v_user
    ),'[]'::jsonb),
    'recorrencias',coalesce((
      select jsonb_agg(to_jsonb(r)-'criado_por' order by r.created_at)
      from public.agendamentos_recorrencias r where r.cliente_id=v_user
    ),'[]'::jsonb),
    'fidelidade_saldos',coalesce((
      select jsonb_agg(to_jsonb(s) order by s.updated_at)
      from public.fidelidade_saldos s where s.cliente_id=v_user
    ),'[]'::jsonb),
    'fidelidade_movimentos',coalesce((
      select jsonb_agg(to_jsonb(m)-'criado_por' order by m.created_at)
      from public.fidelidade_movimentos m where m.cliente_id=v_user
    ),'[]'::jsonb),
    'usos_cupom',coalesce((
      select jsonb_agg(to_jsonb(u) order by u.created_at)
      from public.cupom_usos u where u.cliente_id=v_user
    ),'[]'::jsonb),
    'favoritos',coalesce((
      select jsonb_agg(to_jsonb(f) order by f.created_at) from public.favoritos f where f.cliente_id=v_user
    ),'[]'::jsonb),
    'avaliacoes',coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at) from public.avaliacoes a where a.cliente_id=v_user
    ),'[]'::jsonb),
    'notificacoes',coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at) from public.notificacoes n where n.user_id=v_user
    ),'[]'::jsonb),
    'suporte',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at) from public.tickets_suporte t where t.user_id=v_user
    ),'[]'::jsonb),
    'consentimentos',coalesce((
      select jsonb_agg(to_jsonb(c)-'user_hash' order by c.created_at)
      from public.consentimentos_usuario c where c.user_id=v_user
    ),'[]'::jsonb),
    'preferencias_de_avisos',coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at) from public.push_preferencias p where p.user_id=v_user
    ),'[]'::jsonb),
    'dispositivos_push',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'estabelecimento_id',p.estabelecimento_id,'ativa',p.ativa,'expiracao',p.expiracao,
        'user_agent',p.user_agent,'ultimo_sucesso_em',p.ultimo_sucesso_em,'ultima_falha_em',p.ultima_falha_em,
        'created_at',p.created_at
      ) order by p.created_at) from public.push_assinaturas p where p.user_id=v_user
    ),'[]'::jsonb),
    'resumo_atividade_profissional',coalesce((
      select jsonb_agg(jsonb_build_object(
        'profissional_id',p.id,'estabelecimento_id',p.estabelecimento_id,
        'atendimentos',(select count(*) from public.agendamentos a where a.profissional_id=p.id)
      ) order by p.created_at) from public.profissionais p where p.user_id=v_user
    ),'[]'::jsonb),
    'exclusoes_justificadas',jsonb_build_array(
      'Segredos de Push, endpoints de dispositivos, hashes de idempotencia, tokens, senhas e hashes de senha.',
      'Dados de outros clientes, inclusive CRM, agenda, financeiro, campanhas e importacoes de estabelecimentos operados pelo titular.'
    )
  );
end;
$$;
revoke all on function public.exportar_meus_dados_111() from public, anon;
grant execute on function public.exportar_meus_dados_111() to authenticated, service_role;
