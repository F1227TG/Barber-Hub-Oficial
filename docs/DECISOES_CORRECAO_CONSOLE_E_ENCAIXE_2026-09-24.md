# Decisões — correção de encaixe e console (2026-09-24)

## Diagnóstico confirmado

O `POST /api/v1/schedule/walk-ins` retornava `422` porque o formulário ainda
mantinha a data `2026-09-23`, enquanto a tentativa ocorreu em `2026-09-24`.
A RPC `criar_encaixe_operacional_19` recusou corretamente o horário já
encerrado. Não havia erro de RLS, de autorização do proprietário ou de schema
do Supabase neste caso.

## Decisões aplicadas

- Preservar a regra de banco: encaixes só podem ser atuais, futuros ou ter até
  quinze minutos de tolerância operacional; não flexibilizar a validação no
  Supabase.
- Impedir o envio no painel antes da chamada à API, usando o mesmo limite da
  RPC e reiniciando a data sugerida quando a agenda aberta estiver em dia
  anterior.
- Traduzir as rejeições de horário e de expediente em mensagens seguras e
  acionáveis no gateway, sem expor detalhes internos do Postgres.
- Redirecionar `/favicon.ico` para o ícone existente e usar a meta PWA padrão
  no painel, eliminando os avisos exibidos pelo navegador.
- Não criar migration nesta correção: os controles de proprietário e de
  agendamento permanecem no banco e a falha observada era uma validação de
  negócio esperada que precisava de melhor experiência no cliente.

## Evidências de validação

- API FastAPI iniciada localmente; `GET /api/v1/health` respondeu `200`.
- O contrato local em `/api/openapi.json` expõe `POST /api/v1/schedule/walk-ins`.
- 143 testes automatizados passaram, incluindo os novos cenários de horário e
  mensagens seguras.
- Sincronização mobile, compilação Python, validação estrutural e `git diff
  --check` concluídos sem erros.
