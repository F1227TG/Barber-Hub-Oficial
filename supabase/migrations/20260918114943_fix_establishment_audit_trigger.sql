-- Corrige a auditoria de configuração quando o próprio estabelecimento é alterado.
-- Essa tabela é identificada por `id`; as demais tabelas auditadas usam
-- `estabelecimento_id`. Referenciar a segunda coluna em estabelecimentos fazia
-- qualquer alteração de endereço/status falhar com SQLSTATE 42703.

begin;

-- O gatilho de estabelecimentos tem escopo apenas UPDATE. Uma função dedicada
-- evita misturar os formatos de linha dessa tabela com os formatos das tabelas
-- filhas que realmente possuem `estabelecimento_id`.
create or replace function private.auditar_estabelecimento_configuracao_1112()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb := to_jsonb(old) - 'updated_at';
  v_after jsonb := to_jsonb(new) - 'updated_at';
begin
  if v_before = v_after then
    return new;
  end if;

  insert into public.auditoria_operacional(
    estabelecimento_id, ator_id, recurso, acao, entidade, entidade_id,
    dados_anteriores, dados_novos, request_id
  ) values (
    new.id, (select auth.uid()), 'configuracao', 'update', 'estabelecimentos', new.id,
    v_before, v_after,
    nullif(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id', '')
  );
  return new;
end;
$$;

revoke all on function private.auditar_estabelecimento_configuracao_1112() from public, anon, authenticated;

-- Recria explicitamente o gatilho para documentar e preservar o escopo mínimo.
drop trigger if exists estabelecimentos_config_auditoria_1101 on public.estabelecimentos;
create trigger estabelecimentos_config_auditoria_1101
after update of aceita_agendamento, status_manual, motivo_status, capa_url, endereco,
  numero, complemento, bairro, cidade, estado, cep, latitude, longitude,
  precisao_localizacao, codigo_municipio_ibge, raio_atendimento_km, cnpj, encerrado_em
on public.estabelecimentos
for each row execute function private.auditar_estabelecimento_configuracao_1112();

commit;
