# Barber Hub 1.9.3 — configuração externa restante

Estado confirmado em 24/08/2026: migrations 11–23 aplicadas no projeto Supabase `dhkqnfqrfqrpumrjjrcy`; migrations 24/25 aguardam aplicação. Os verificadores 17, 22 e 23 foram aprovados. O rate limit da API já é distribuído no PostgreSQL pela RPC `consumir_api_rate_limit`.

## 1. Cloudflare Turnstile e Supabase Auth

1. No Cloudflare, crie um widget Turnstile para `barberhuboficial.vercel.app`. Use outro widget/chaves para desenvolvimento local.
2. Copie a **Secret Key** para o Supabase em [Authentication > Bot and Abuse Protection](https://supabase.com/dashboard/project/dhkqnfqrfqrpumrjjrcy/auth/protection), selecione Cloudflare Turnstile, habilite CAPTCHA e salve.
3. Copie somente a **Site Key pública** para a variável de deploy `BARBER_HUB_TURNSTILE_SITE_KEY` nos ambientes autorizados.
4. Nunca coloque a Secret Key do Turnstile no GitHub, no JavaScript ou em `BARBER_HUB_TURNSTILE_SITE_KEY`.
5. Faça novo deploy e teste cadastro, login e recuperação. As três telas já enviam `captchaToken` ao Supabase Auth.

## 2. Proteção contra senhas vazadas

Em [Authentication > Password Security](https://supabase.com/dashboard/project/dhkqnfqrfqrpumrjjrcy/auth/protection):

1. mantenha mínimo de pelo menos 8 caracteres;
2. exija maiúsculas, minúsculas, números e símbolos;
3. habilite **Leaked password protection**;
4. salve e teste uma troca de senha.

Essa proteção é oferecida pelo Supabase no plano Pro ou superior. Se o projeto estiver no plano gratuito, o item continuará pendente até o upgrade.

## 3. URLs e e-mails de autenticação

Em [Authentication > URL Configuration](https://supabase.com/dashboard/project/dhkqnfqrfqrpumrjjrcy/auth/url-configuration), use:

- Site URL: `https://barberhuboficial.vercel.app`
- Redirect permitido: `https://barberhuboficial.vercel.app/html/login.html?confirmado=1`
- Redirect permitido: `https://barberhuboficial.vercel.app/html/redefinir-senha.html`
- Redirect permitido: `https://barberhuboficial.vercel.app/mobile/login.html?confirmado=1`
- Redirect permitido: `https://barberhuboficial.vercel.app/mobile/redefinir-senha.html`
- Desenvolvimento, se usado: `http://localhost:3000/**`

Nos templates de confirmação e recuperação, use `{{ .RedirectTo }}` quando o fluxo fornecer `emailRedirectTo`/`redirectTo`. Envie um e-mail real de teste antes do deploy.

## 4. Variáveis do deploy

| Variável | Ambiente | Conteúdo |
|---|---|---|
| `SUPABASE_URL` | backend | `https://dhkqnfqrfqrpumrjjrcy.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | backend/frontend seguro | chave `sb_publishable_...` ativa |
| `SUPABASE_SECRET_KEY` | somente backend | chave `sb_secret_...`; nunca no navegador |
| `BARBER_HUB_ALLOWED_ORIGINS` | backend | `https://barberhuboficial.vercel.app` |
| `BARBER_HUB_PASSWORD_REDIRECT_URL` | backend | `https://barberhuboficial.vercel.app/html/redefinir-senha.html` |
| `BARBER_HUB_TURNSTILE_SITE_KEY` | configuração pública da API | Site Key pública do widget de produção |

O frontend já foi atualizado para a chave pública moderna do projeto. Nenhuma credencial privada foi gravada no repositório.

## 5. Validação por papéis

Use contas separadas; não altere o papel da mesma conta durante o teste:

- visitante sem login: somente dados públicos;
- cliente: próprios agendamentos e confirmações;
- profissional: somente a própria agenda;
- recepção: agenda operacional, sem financeiro;
- gerente: agenda, CRM e financeiro conforme plano;
- proprietário: estabelecimento próprio;
- admin: administração global;
- usuário autenticado sem vínculo: nenhum dado privado de estabelecimento.

Repita pelo menos um teste tentando acessar o ID de outro estabelecimento. O resultado esperado é lista vazia, `403` ou erro de permissão, nunca dados cruzados.

## 6. Advisors

Antes das migrations 24/25, a leitura remota retornou 37 itens no Security Advisor:

- 1 informação para `api_rate_limits` com RLS e sem policy pública, intencional por ser serviço interno;
- 2 avisos para `unaccent` e `btree_gist` no schema `public`;
- 6 funções `SECURITY DEFINER` executáveis por `anon` e 27 por `authenticated`, que exigem revisão individual de autorização interna;
- proteção contra senhas vazadas desativada.

O Performance Advisor deve ser executado novamente depois das novas tabelas/índices e do primeiro volume de uso. Índice “não utilizado” logo após criação não prova que ele seja desnecessário.

Não mova `unaccent` ou `btree_gist` de schema durante o deploy sem um ensaio separado; isso pode afetar objetos existentes.

## 7. Supabase Cron para lembretes 1.9.3

1. aplique as migrations 24/25 e o verificador;
2. no Dashboard, abra **Integrations → Cron** e habilite `pg_cron`;
3. crie o job `barberhub-preparar-lembretes-193`, expressão `*/10 * * * *`, comando:

```sql
select public.preparar_lembretes_193();
```

4. crie o job `barberhub-processar-internas-193`, expressão `*/5 * * * *`, comando:

```sql
select public.processar_automacoes_internas_193(200);
```

5. aguarde um agendamento entrar na janela de 24h/2h; confirme registros em `automacoes_mensagens` e notificações internas;
6. acompanhe **Cron → Job Runs** e mantenha execuções curtas. Não reduza os intervalos sem medir carga.

Os jobs internos não enviam e-mail/WhatsApp. Eles preparam/processam notificações do próprio Barber Hub.

## 8. Provedor de e-mail/WhatsApp

Para mensagens com `canal = email` ou `whatsapp`, implante um worker server-side que:

1. leia somente itens `pendente` vencidos usando credencial privada;
2. respeite consentimento, destinatário e ambiente;
3. envie pelo provedor escolhido;
4. grave `enviada`, `falhou`, tentativas, mensagem de erro e identificador externo;
5. use retry com limite/idempotência e não exponha tokens no frontend.

Até esse worker existir, use canal `interno` nas campanhas. A interface informa essa dependência para não prometer envio inexistente.

## 9. Validação final da 1.9.3

Depois das migrations e do Cron:

1. execute `verificar_25_release_1_9_3.sql`;
2. rode Security Advisor e Performance Advisor;
3. teste lista de espera como cliente e gestão;
4. teste cupom simultâneo/limites e recorrência com conflito;
5. conclua atendimento e confirme crédito único de fidelidade;
6. teste permissões com contas distintas, inclusive tentativa por URL/API;
7. confirme que campanhas de WhatsApp e e-mail ignoram quem não consentiu com o canal correspondente;
8. só então publique API 1.5.0 e frontend/PWA 1.9.3.
