# Homologação de operações — 23/09/2026

## Incidente corrigido

O fechamento financeiro do painel retornava indisponibilidade, embora a
autenticação, a autorização e o limite de requisições estivessem corretos. O
log de produção identificou a causa: a API chamava a RPC
`fechar_dia_financeiro_idempotente_1111`, mas ela não existia no banco de
produção (`PGRST202`, resposta upstream 404).

## Decisão aplicada

Foram aplicadas no projeto Supabase de produção, em ordem, as migrações
canônicas que já estavam versionadas neste repositório:

1. `20260917123000_reconciliacao_fechamento_financeiro`;
2. `20260917130000_idempotencia_ajustes_fechamentos`.

Elas adicionam os campos de reconciliação do fechamento, a tabela privada de
idempotência e as RPCs de ajuste e de fechamento idempotentes. Não foi criada
uma rota alternativa, não foram concedidas permissões ao papel `anon` e não
houve remoção ou alteração retroativa de registros financeiros.

## Evidência de homologação

- O encaixe presencial fictício foi criado para 24/09/2026 às 16:30 pelo
  fluxo do painel: `POST /api/v1/schedule/walk-ins` retornou `201`, e a RPC
  `criar_encaixe_operacional_19` retornou `200`.
- Após a correção, o fechamento do dia 23/09/2026 retornou `201` na API e
  `200` na RPC `fechar_dia_financeiro_idempotente_1111`; a interface mostrou
  “Operação concluída” e fechou o formulário.
- A tabela `fechamentos_diarios` registrou o fechamento de teste como
  `fechado`, sem valores financeiros inesperados.

## Registro de teste

Durante a janela de recarga do schema do PostgREST, uma tentativa que ainda
mostrava a mensagem anterior no navegador já havia sido processada. O reteste
limpo usou uma nova chave idempotente e gerou a revisão 2 do mesmo fechamento.
Os valores e a observação são os mesmos; o registro foi mantido para preservar
a trilha de auditoria do teste autorizado, sem exclusão de dados.

## Prevenção operacional

Antes de homologar uma nova versão que introduza RPCs, conferir no Supabase se
as migrações correspondentes foram efetivamente aplicadas e consultar o log
da rota da API. Testes unitários validam o contrato de código, mas não
substituem essa verificação de ambiente.
