# Segurança — Barber Hub 1.6

## Três camadas de validação

```text
JavaScript → experiência e feedback rápido
Python/FastAPI → validação confiável de request/sessão/regra
PostgreSQL/RLS/RPC → integridade e autorização final
```

Validação no JavaScript nunca é tratada como barreira de segurança.

## Confirmação de e-mail

O frontend já suporta o comportamento do Supabase quando **Confirm Email** está ativo: `signUp` pode criar o usuário sem sessão e a UI mostra instrução para verificar a caixa de entrada. A API também recusa tokens cujo usuário não tenha `email_confirmed_at`.

A ativação é configuração do Supabase Auth e não é feita por migration SQL.

## CAPTCHA

`js/security.js` suporta Cloudflare Turnstile quando `BH_TURNSTILE_SITE_KEY` recebe uma site key pública. Login, cadastro e recuperação passam `captchaToken` ao Supabase Auth.

A secret do CAPTCHA deve existir apenas no Supabase Dashboard. Nunca coloque secret no repositório.

## Rate limiting

A migration 15 cria um contador distribuído no PostgreSQL. Isso evita usar memória local da função Vercel, que não seria consistente entre instâncias serverless.

Principais buckets atuais:
- marketplace/search;
- featured/summary;
- criar/cancelar/alterar agendamento;
- ticket de suporte;
- exclusão de conta;
- recuperação de senha por admin.

HTTP 429 recebe mensagem de “muitas tentativas”, não uma alegação incorreta de servidor sobrecarregado.

## Indisponibilidade

Falhas 5xx do Supabase são convertidas para 503 amigável sem devolver mensagens internas do provedor. A API emite `X-Request-ID` para correlação com logs.

## Logs

A API registra:
- request id;
- método;
- caminho;
- status;
- duração;
- tipo de erro inesperado.

Ela não deve registrar:
- senha;
- access token;
- secret keys;
- corpo sensível desnecessário.

## Exclusão de conta

Exige:
1. sessão;
2. reautenticação no frontend;
3. aceite explícito;
4. frase `EXCLUIR MINHA CONTA`;
5. validação da frase novamente no Python;
6. RPC de exclusão/anonimização no banco.
