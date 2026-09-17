# Decisões de implementação — 17 de setembro de 2026

Este registro explica as decisões tomadas na execução das correções solicitadas, para que administração, desenvolvimento e operação do Supabase tenham a mesma referência.

## Decisões aplicadas

| Tema | Decisão | Motivo |
|---|---|---|
| Perfil de estabelecimento | Visitantes usam a rota pública `/api/v1/establishments/{id}/public`. | A leitura anônima não depende mais de relações internas protegidas por RLS e não recebe dados de gestão. |
| Agenda | A agenda básica é do plano Gratuito; só aparece ao público depois de o estabelecimento ativá-la e configurar períodos. | Mantém descoberta e agendamento acessíveis sem prometer recursos pagos ainda em homologação. |
| Planos | Essencial, Profissional e Elite permanecem `Em desenvolvimento`. | Não há cobrança enquanto recursos e preço não forem homologados. |
| Suporte | Abrir ticket exige conta confirmada e o e-mail de resposta vem da identidade autenticada. | Evita ticket anônimo, falsificação de e-mail e perda de histórico. |
| Avaliações | A página pública separa todas, verificadas por agendamento e comunidade, com paginação. | Dá transparência sem carregar uma lista excessiva. |
| Localização | Endereço válido segue como 422; falta de autorização para alterar local vira 403 com mensagem específica. | 422 não deve esconder uma falha de papel, vínculo ou RLS. |
| Administração | A área administrativa resolve planos, usuários, estabelecimentos, moderação, tickets, recuperação de senha, auditoria e saúde sem IA. | A IA não deve ser requisito para operações rotineiras de administração. |
| Auth do Supabase | `auth.users` é somente do Supabase Auth; `public.perfis` é o perfil de aplicação criado pelo fluxo/trigger. | Inserir diretamente em `auth.users` pode criar identidades inconsistentes e contornar o fluxo de senha/confirmação. |

## Modelo operacional de acesso

```text
Visitante  -> lê catálogo e perfil público
Conta      -> grava apenas dados próprios (agendamento, avaliação, favorito, suporte)
Equipe     -> opera apenas o estabelecimento e as permissões concedidas
Admin      -> modera, gerencia contas/planos e acompanha a saúde do sistema
API        -> valida contratos, limita requisições e orquestra regras
Supabase   -> confirma Auth + RLS/RPC e guarda os dados
```

## Aplicação obrigatória no Supabase de produção

O repositório foi alinhado para instalações novas em `sql/01_barberhub_supabase.sql` e no reforço `sql/23_advisors_pos_deploy_1_9.sql`: somente `authenticated` pode inserir em `tickets_suporte`, com `user_id = auth.uid()`.

Como o Supabase CLI/integração autenticada não estava disponível nesta sessão, nenhuma política foi alterada diretamente na produção. Antes de liberar esta etapa em produção, aplique esse reforço como **nova migration** no projeto conectado (nunca edite migration já aplicada):

```sql
alter policy tickets_insert_publico on public.tickets_suporte
  to authenticated
  with check (user_id = (select auth.uid()));

revoke insert on public.tickets_suporte from anon;
grant insert on public.tickets_suporte to authenticated;
```

Depois, confirme com uma janela anônima que `POST /rest/v1/tickets_suporte` falha e que a API aceita `POST /api/v1/support/tickets` somente com sessão válida.

## Pendências intencionais

- A migration já presente no repositório para agenda gratuita/estado comercial dos planos precisa estar aplicada no Supabase de produção antes de usar o campo `estado_comercial` em consultas diretas. A API agora tem fallback compatível, por isso o painel de assinaturas não deve mais devolver 422 por essa coluna ausente.
- Preço de planos permanece em homologação; não há novo valor publicado nem checkout habilitado.
- O e-mail de conclusão não foi enviado automaticamente: não havia conector de e-mail autenticado disponível nesta execução. O histórico de commits e este documento são o registro verificável da conclusão.

## Critério de liberação

1. Aplicar migrations pendentes e a correção de RLS acima no Supabase.
2. Publicar o commit no Vercel.
3. Testar em janela anônima: explorar estabelecimento e avaliações funciona; agendar, avaliar e abrir suporte pedem login.
4. Testar com três contas: cliente, profissional sem vínculo e admin, confirmando que cada uma vê apenas suas funções.
