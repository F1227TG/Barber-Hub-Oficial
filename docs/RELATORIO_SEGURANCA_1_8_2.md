# Barber Hub 1.8.2 — relatório de segurança diferencial

## Escopo e método

Esta revisão comparou os achados V01–V06 de `AUDITORIA_SEGURANCA_BARBER_HUB.docx` com a árvore atual do projeto e com o estado de migrations do Supabase conectado. A análise considerou frontend, API FastAPI, funções/triggers PostgreSQL, RLS, configuração de autenticação e testes de regressão.

Nenhuma migration foi aplicada no banco de produção durante esta entrega. O código está preparado para publicação, mas os controles de banco só entram em vigor depois do procedimento descrito em **Antes do deploy**.

## Classificação diferencial

| Achado | Severidade original | Estado encontrado | Estado no pacote 1.8.2 | Evidência principal |
|---|---|---|---|---|
| V01 — proprietário altera campos administrativos | Crítica | **Ainda vulnerável** | **Corrigido no código; pendente migration 17 em produção** | trigger protege verificação, destaque, suspensão e avaliação; suspensão administrativa foi separada de `visivel`; RLS exclui suspensos |
| V02 — transição livre de status do agendamento | Alta | **Ainda vulnerável** | **Corrigido no código; pendente migration 17 em produção** | máquina de estados idêntica no domínio Python e em trigger PostgreSQL |
| V03 — limites de plano contornáveis | Alta | **Parcialmente corrigido** | **Corrigido no código; pendente migrations 16 e 17 em produção** | locks transacionais por estabelecimento, validação de reativação e agenda direta |
| V04 — contador de curtidas editável | Média | **Ainda vulnerável** | **Corrigido no código; pendente migration 17 em produção** | valor derivado de `portfolio_curtidas`, inserção inicia em zero e contadores legados são reparados |
| V05 — rotas sem rate limit | Baixa | **Ainda vulnerável** | **Corrigido no código; pendente migration 15 em produção** | buckets adicionados a suporte/listagem e rotas administrativas, com testes de regressão |
| V06 — CAPTCHA desativado | Baixa | **Parcialmente corrigido** | **Parcialmente corrigido: integração pronta, depende de configuração externa** | site key pública carregada em runtime; secret permanece fora do código |

## Correções implementadas

### V01 — moderação e campos derivados

- nova flag `suspenso_pela_moderacao`, com autor/data/motivo;
- constraint impede página suspensa de permanecer visível;
- proprietário não pode alterar `verificado`, `destaque`, suspensão, metadados de verificação nem nota agregada;
- atualização interna legítima da média de avaliações continua permitida;
- painel admin passou a suspender/restaurar explicitamente, sem confundir suspensão com a escolha do proprietário de ocultar a página;
- policies públicas/autenticadas excluem estabelecimentos suspensos.

### V02 — agendamentos

Transições válidas:

```text
pendente → confirmado | recusado | cancelado
confirmado → concluido | cancelado
recusado | concluido | cancelado → estado terminal
```

A regra existe em `backend/domain/appointments.py` e no PostgreSQL. O banco continua sendo a barreira final mesmo se uma escrita não passar pela API.

### V03 — planos

- inserção/reativação de profissional é serializada por estabelecimento;
- reativar publicação arquivada volta a consumir limite;
- inserts diretos de agendamento verificam plano, visibilidade, onboarding e suspensão;
- verificações de API usam funções puras testáveis offline, mas triggers PostgreSQL continuam definitivos.

### V04 — curtidas

- cliente não escolhe `curtidas_count` no insert;
- qualquer update comum recalcula o total na tabela fonte;
- somente o trigger interno de curtida pode atualizar diretamente o contador;
- migration repara divergências legadas.

### V05 — rate limiting

Foram adicionados buckets para:

- `support-list`;
- `admin-overview`;
- `admin-health`;
- `admin-navigation-audit`;
- `admin-subscriptions`;
- `establishment-entitlements`;
- `public-config`.

### V06 — CAPTCHA

O navegador consulta `GET /api/v1/public-config` para receber apenas a site key pública do Turnstile. Nenhuma secret é enviada ao frontend. Login, cadastro e recuperação de senha já enviam o token do CAPTCHA ao Supabase Auth.

## Senhas: decisão de segurança

O requisito de “ter a senha na tabela” já é atendido pelo Supabase Auth da forma segura: `auth.users.encrypted_password` guarda um **hash bcrypt**, não a senha original. Hash não é criptografia reversível e não deve ser exibido no painel nem copiado para `public.perfis`.

Não foi criado endpoint, coluna pública ou mecanismo para visualizar/reverter senhas. A administração usa recuperação de senha, revogação de sessões e trilha de auditoria. Duplicar hashes em tabela pública aumentaria o impacto de vazamento sem entregar uma função legítima ao produto.

## Antes do deploy no Supabase

O projeto conectado foi encontrado com histórico aplicado somente até a migration 10. Aplicar, nesta ordem e em ambiente de homologação primeiro:

1. `sql/11_planos_assinaturas.sql`;
2. `sql/12_comunidade_conta_admin_mobile.sql`;
3. `sql/13_modais_status_avaliacoes_comunidade.sql`;
4. `sql/14_api_python_agendamento_multisservicos.sql`;
5. `sql/15_marketplace_fts_api_seguranca.sql`;
6. `sql/16_assinaturas_entitlements_beneficios.sql`;
7. `sql/17_correcao_auditoria_seguranca.sql`;
8. executar `sql/verificar_17_correcao_auditoria.sql` e confirmar todos os controles como `OK`;
9. testar suspensão/restauração, transições de agendamento, concorrência de limites e curtidas em homologação.

Não edite migrations antigas e não pule diretamente para a 17, porque ela depende das estruturas criadas nas 11–16.

## Configuração externa obrigatória/recomendada

### Vercel ou outro host da API

- `SUPABASE_URL`;
- `SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_SECRET_KEY` — somente servidor;
- `BARBER_HUB_ALLOWED_ORIGINS`;
- `BARBER_HUB_PASSWORD_REDIRECT_URL`;
- `BARBER_HUB_TURNSTILE_SITE_KEY` — site key pública.

### Supabase Auth e Cloudflare

- ativar CAPTCHA no Supabase Auth e cadastrar a **secret key** do Turnstile;
- ativar proteção contra senhas vazadas;
- manter confirmação de e-mail ativa;
- revisar URLs permitidas de redirecionamento e recuperação.

### Pendências adicionais do Security Advisor

- avaliar mover as extensões `unaccent` e `btree_gist` para schema dedicado numa manutenção planejada;
- manter `api_rate_limits` sem policy de cliente: é uma tabela operacional acessada pela função controlada;
- revisar periodicamente grants de funções `security definer`, fora do escopo V01–V06.

## Verificação executada

- 27/27 controles estáticos V01–V06;
- 26/26 testes Python/FastAPI;
- 5 desses testes executam apenas regras de domínio, sem internet ou Supabase;
- sintaxe Python e JavaScript validada;
- sincronização desktop/mobile validada;
- validação estrutural e de referências incluída no comando de release.

Os testes de comportamento dos triggers no PostgreSQL permanecem condicionados à aplicação das migrations em homologação. A consulta de verificação fornecida confirma instalação, grants e divergências de contador sem modificar dados.
