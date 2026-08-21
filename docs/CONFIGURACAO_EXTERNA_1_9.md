# Barber Hub 1.9.0 — configuração externa restante

Estado em 21/08/2026: migrations 11–23 aplicadas no projeto Supabase `dhkqnfqrfqrpumrjjrcy`. Os verificadores 17, 22 e 23 foram aprovados. O rate limit da API já é distribuído no PostgreSQL pela RPC `consumir_api_rate_limit`.

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

Depois da migration 23:

- o Performance Advisor ficou sem warnings; permanecem apenas índices ainda não utilizados, esperado logo após a criação;
- o Security Advisor continua exibindo RPCs `SECURITY DEFINER` intencionais com validação interna, duas extensões legadas no schema `public`, a tabela de rate limit sem policy pública por ser fechada ao `service_role`, e a proteção contra senhas vazadas até sua ativação externa.

Não mova `unaccent` ou `btree_gist` de schema durante o deploy sem um ensaio separado; isso pode afetar objetos existentes.
