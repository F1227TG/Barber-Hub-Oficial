# Configuração externa — Barber Hub 1.11

Este checklist descreve nomes e superfícies encontrados na referência local. Ele não confirma valores nem estado do ambiente publicado. Valores secretos devem permanecer no gestor de segredos; a evidência deve mostrar apenas presença, escopo, versão ou fingerprint.

## Inventário de variáveis

| Nome | Escopo | Segredo | Validação |
|---|---|---:|---|
| `SUPABASE_URL` | Backend; configuração pública correspondente no frontend | Não | Projeto correto, HTTPS, sem placeholder |
| `SUPABASE_PUBLISHABLE_KEY` | Backend e cliente quando aplicável | Não | Chave pública do mesmo projeto |
| `SUPABASE_SECRET_KEY` | Somente backend | Sim | Nunca presente em HTML/JS/log |
| `SUPABASE_ANON_KEY` | Compatibilidade legada | Não | Usar apenas se o projeto ainda depender |
| `SUPABASE_SERVICE_ROLE_KEY` | Compatibilidade legada, somente backend | Sim | Nunca cliente; preferir nome moderno quando disponível |
| `BARBER_HUB_ALLOWED_ORIGINS` | Backend | Não | Lista exata, separada por vírgulas, sem `*` em produção |
| `BARBER_HUB_PASSWORD_REDIRECT_URL` | Backend | Não | HTTPS e tela oficial do ambiente |
| `BARBER_HUB_TURNSTILE_SITE_KEY` | Config pública da API/cliente | Não | Site key do widget do ambiente |
| `BARBER_HUB_VAPID_PUBLIC_KEY` | Backend/cliente por config pública | Não | Par correspondente à privada |
| `BARBER_HUB_VAPID_PRIVATE_KEY` | Somente backend | Sim | Mesmo par; nunca resposta pública |
| `BARBER_HUB_VAPID_SUBJECT` | Backend | Não sensível | `mailto:` ou origem aprovada |
| `CRON_SECRET` | Vercel/job | Sim | Aleatório, restrito, rotacionável |
| `BARBER_HUB_JOBS_SECRET` | Agendador externo/compatibilidade | Sim | Alternativa aceita pelo backend; não duplicar sem necessidade |
| `BARBER_HUB_EMAIL_API_URL` | Somente backend | Não | Endpoint HTTPS aprovado do provedor transacional |
| `BARBER_HUB_EMAIL_API_KEY` | Somente backend | Sim | Chave restrita ao envio; nunca cliente/log |
| `BARBER_HUB_EMAIL_FROM` | Somente backend | Não sensível | Remetente e domínio verificados no provedor |

Não documente o valor real neste arquivo.

## Supabase Auth: URLs

Preencha com os domínios reais:

| Item | Valor aprovado | Testado |
|---|---|---|
| Site URL de produção | A definir | Não |
| Site URL de homologação | A definir | Não |
| Login confirmado desktop | `<origem>/html/login.html?confirmado=1` | Não |
| Redefinição desktop | `<origem>/html/redefinir-senha.html` | Não |
| Login confirmado mobile | `<origem>/mobile/login.html?confirmado=1` | Não |
| Redefinição mobile | `<origem>/mobile/redefinir-senha.html` | Não |
| Desenvolvimento autorizado | A definir; não adicionar wildcard amplo em produção | Não |

Critérios:

- [ ] Cada ambiente possui apenas origens necessárias.
- [ ] Links de confirmação e recuperação chegam ao mesmo ambiente que iniciou o fluxo.
- [ ] Destino externo ou protocolo inseguro é rejeitado.
- [ ] Template de e-mail respeita o redirect fornecido.
- [ ] Cadastro, login e recuperação foram testados com e-mail real controlado.

## Turnstile

A secret do Turnstile é configurada no Supabase Auth/Bot and Abuse Protection; o aplicativo expõe apenas a site key pública.

- [ ] Widget separado por ambiente/domínios quando necessário.
- [ ] Secret permanece no painel seguro do Supabase, não em variável pública do frontend.
- [ ] `BARBER_HUB_TURNSTILE_SITE_KEY` contém a site key correspondente.
- [ ] `/api/v1/public-config` indica a exigência esperada sem revelar secret.
- [ ] Login, cadastro e recuperação enviam token válido.
- [ ] Token ausente, inválido, expirado e reutilizado falham de modo seguro.
- [ ] Indisponibilidade tem mensagem útil e não libera bypass em produção.

## Proteção contra senhas vazadas

- [ ] Verificar disponibilidade no plano atual do Supabase.
- [ ] Ativar no ambiente alvo quando disponível.
- [ ] Testar cadastro/troca com credencial conhecida como comprometida usando procedimento seguro.
- [ ] Se indisponível, registrar risco, mitigação, responsável e condição de reavaliação.

Não faça upgrade pago sem autorização. Não marque como aprovado apenas porque o frontend valida complexidade.

## VAPID e Web Push

- [ ] Gerar/armazenar o par por processo autorizado.
- [ ] Pública e privada pertencem ao mesmo par e ambiente.
- [ ] Private key existe apenas no backend/gestor de segredos.
- [ ] Subject identifica contato/origem válida.
- [ ] Rotação possui plano para assinaturas antigas.
- [ ] Ativar/desativar dispositivo funciona.
- [ ] Permissão negada e navegador sem suporte mantêm notificações internas.
- [ ] Endpoint 404/410 desativa assinatura inválida.
- [ ] Horário silencioso e preferências por categoria foram testados.

## Cron e jobs

A referência do repositório contém:

- rotas publicadas no `vercel.json`: `/api/v1/jobs/push/deliver?limit=50` e `/api/v1/jobs/maintenance/run?email_limit=50&deletion_limit=5`; a rota direta `/api/v1/jobs/email/deliver?limit=50` também existe para um agendador externo autorizado;
- métodos aceitos pela API: GET e POST;
- autenticação: Bearer com `CRON_SECRET` ou `X-Jobs-Secret` com `BARBER_HUB_JOBS_SECRET`;
- agendas no `vercel.json`: Push diário (`0 11 * * *`) e manutenção diária de exclusões/e-mail (`15 11 * * *`). Essas frequências respeitam o plano Hobby atualmente conectado; entrega transacional mais rápida exige agendador externo autorizado ou mudança de plano.

Validação:

- [ ] Frequência e fuso atendem a expectativa do produto; registrar decisão.
- [ ] URL aponta para deployment de produção correto.
- [ ] Execução com segredo retorna resultado esperado.
- [ ] Execução sem/segredo incorreto retorna 401.
- [ ] Logs não imprimem segredo.
- [ ] Lote/retry/idempotência foram exercitados.
- [ ] Domínio do remetente foi verificado e a fila de e-mail conclui/reagenda sem duplicar mensagens.
- [ ] Antes de prometer e-mail em tempo real, definir um agendador mais frequente compatível com o plano contratado; notificações internas continuam sendo a fonte imediata.
- [ ] Cron interno do Supabase para lembretes/automação também está presente e saudável quando aplicável.
- [ ] Existe alerta para execução perdida/falha.

## Advisors

Depois de todas as migrations e antes do go-live:

1. capture Security Advisor e Performance Advisor;
2. compare com a fotografia anterior apenas como referência;
3. classifique cada item novo;
4. não revogue `SECURITY DEFINER`, mova extensão ou remova índice em massa;
5. registre decisão, responsável e prazo.

| Advisor | Momento | Erros | Avisos | Informações | Evidência | Estado |
|---|---|---:|---:|---:|---|---|
| Security | Antes | | | | | Não executado |
| Security | Depois das migrations 32/33 | 0 | 68 | 3 | [Registro de 11/09/2026](ADVISORS_SUPABASE_2026_09_11.md) | Revisado; 1 configuração externa pendente |
| Performance | Antes | | | | | Não executado |
| Performance | Depois das migrations 32/33 | 0 | 0 | 101 | [Registro de 11/09/2026](ADVISORS_SUPABASE_2026_09_11.md) | Revisado; aguardar telemetria |

## Headers, domínio e CORS

- [ ] Domínio canônico, certificado e redirects estão corretos.
- [ ] CORS aceita somente origens necessárias.
- [ ] CSP permanece compatível com Supabase, Turnstile, fontes e mapa sem abrir fontes amplas.
- [ ] `frame-ancestors`/`X-Frame-Options` impedem framing indevido.
- [ ] Service Worker recebe política de revalidação.
- [ ] `/api/` não é armazenado pelo cache PWA.
- [ ] Ambiente de preview não usa secrets de produção sem aprovação.

## Segredos e rotação

- [ ] Inventário tem owner, data de criação/rotação e ambientes.
- [ ] Privilégio mínimo foi aplicado.
- [ ] Logs e evidências ocultam valores.
- [ ] Revogação pode ser feita sem editar código.
- [ ] Rotação de secret Supabase, VAPID e Cron foi ensaiada ou documentada.
- [ ] Ex-colaborador/integração removida não mantém acesso.

## Pagamentos — condicional

Estado de referência documental: sem gateway integrado. Confirme novamente.

- [ ] Nenhuma variável de provedor, webhook ou checkout é necessária nesta release.
- [ ] Copy não promete cobrança real.
- [ ] N/A justificado foi registrado no go/no-go.

Se um provedor entrar no escopo, suspenda a aprovação até documentar credenciais por ambiente, webhook secret, URLs, eventos, idempotência, conciliação, alertas, retenção e suporte.

## Registro por ambiente

| Ambiente | Variáveis validadas | Auth/Turnstile | VAPID/Cron | Advisors | Executor/data | Estado |
|---|---|---|---|---|---|---|
| Homologação | | | | | | Não executado |
| Produção | | | | | | Não executado |
