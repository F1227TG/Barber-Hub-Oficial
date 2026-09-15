# Barber Hub 1.11.0 — migrations e deploy seguro

> O nome do arquivo foi preservado porque documentos históricos já apontam para ele. O conteúdo abaixo representa o estado vigente da versão 1.11.0.

## Estado confirmado

No projeto Supabase conectado (`dhkqnfqrfqrpumrjjrcy`), as migrations gerenciadas da candidata foram aplicadas com sucesso, nesta ordem:

1. `supabase/migrations/20260911132254_conclusao_pos31_1_10_1.sql`;
2. `supabase/migrations/20260911132328_barberhub_1_11_confiabilidade_privacidade.sql`.

O verificador somente leitura `sql/verificar_33_release_1_11.sql` foi executado e todos os controles retornaram `true`. Os Advisors posteriores à aplicação estão registrados em `release-1.11/ADVISORS_SUPABASE_2026_09_11.md`.

Não edite nem reaplique uma migration já registrada. Uma correção futura recebe novo timestamp, passa por revisão e ganha seu próprio verificador.

## O que é uma migration

Migration é uma alteração versionada do banco. Ela cria ou ajusta tabelas, índices, regras de acesso, funções e gatilhos para manter banco e aplicação compatíveis. O Git guarda a receita; o Supabase registra e executa a alteração.

## Confirmação antes do deploy

1. abra o projeto correto e confira o identificador;
2. confirme backup recuperável, responsável, RPO e RTO;
3. verifique no histórico remoto os dois timestamps acima e sua ordem;
4. execute `sql/verificar_33_release_1_11.sql` sem alterar seu conteúdo;
5. interrompa a publicação se qualquer controle for falso ou houver exceção;
6. revise Security Advisor e Performance Advisor;
7. teste contas separadas por papel, plano e estabelecimento;
8. publique frontend/PWA e API compatíveis;
9. execute testes rápidos no deployment novo e monitore erros.

## O que a migration 1.11 consolida

- consentimentos versionados e pedidos de exclusão de conta;
- fila de e-mail, retenção e trabalhos operacionais internos;
- criação idempotente de agendamento;
- bloqueio de autoagendamento no próprio estabelecimento;
- busca regional e estabelecimentos operados;
- encerramento seguro de recorrência;
- assinatura administrativa idempotente;
- validações de CNPJ, agenda/plano, RLS, privilégios e índices.

## Configuração externa obrigatória

### Supabase Auth

- confirme Site URL e Redirect URLs exatas de produção e homologação;
- mantenha somente domínios autorizados para recuperação de senha;
- habilite e teste CAPTCHA/Turnstile;
- habilite proteção contra senhas vazadas quando disponível;
- mantenha confirmação de e-mail alinhada à política do produto.

### API e deploy

- `SUPABASE_URL`: somente nos ambientes necessários;
- chave pública/anon: pode chegar ao frontend, com RLS correta;
- `SUPABASE_SERVICE_ROLE_KEY`: somente servidor;
- `ALLOWED_ORIGINS`: domínios exatos de produção e homologação;
- `PASSWORD_REDIRECT_URL`: página oficial de redefinição;
- `TURNSTILE_SECRET_KEY`: somente servidor;
- `TURNSTILE_SITE_KEY`: valor público entregue pela configuração segura;
- VAPID pública/privada, assunto do remetente e segredo dos jobs: somente nos escopos corretos.

### Push, e-mail e tarefas

Web Push usa `GET /api/v1/jobs/push/deliver` com segredo no cabeçalho `Authorization`. O worker reivindica lotes, respeita horário silencioso, limita tentativas e desativa assinaturas expiradas. A fila interna continua funcionando sem provedor externo, mas entrega Push/e-mail real exige chaves, remetente, permissão do dispositivo e teste no domínio publicado.

## Homologação mínima

Teste cliente, profissional, recepção, gerente, proprietário, administrador, usuário sem vínculo e usuário de outro estabelecimento. Repita as ações críticas nos planos Gratuito, Essencial, Profissional e Elite. Inclua cadastro, recuperação, agenda, atendimento, financeiro, assinatura administrativa, RLS, exclusão de conta, PWA/offline e repetição após falha de rede.

## Rollback

O rollback preferencial do código é promover o deployment/commit anterior. Banco com dados reais não deve receber `DROP` improvisado. Se uma migration futura falhar, interrompa o deploy, preserve a evidência e prepare migration corretiva compatível depois de avaliar dados e dependências.

Runbooks completos: `release-1.11/BACKUP_E_RESTAURACAO.md`, `release-1.11/ROLLBACK_DEPLOY_E_MIGRATIONS.md` e `release-1.11/CHECKLIST_PRE_RELEASE.md`.
