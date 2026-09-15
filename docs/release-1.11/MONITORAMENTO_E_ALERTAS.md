# Monitoramento e alertas — Barber Hub 1.11

## Objetivo

Detectar indisponibilidade, regressão, vazamento de autorização, filas paradas e degradação dos fluxos principais antes que o impacto se prolongue. Este documento define sinais e resposta; ele não afirma que uma ferramenta externa ou alerta já esteja configurado.

## Responsabilidade

| Papel | Titular | Substituto | Canal |
|---|---|---|---|
| Operação técnica | A definir | A definir | A definir |
| Banco/Supabase | A definir | A definir | A definir |
| Produto/suporte | A definir | A definir | A definir |
| Segurança/privacidade | A definir | A definir | A definir |

Não ative alertas sem destinatário e rota de escalonamento.

## Fontes disponíveis na referência do repositório

- `GET /api/v1/health`: presença da configuração básica da API;
- `GET /api/v1/admin/health`: visão protegida de API/banco/Auth/marketplace;
- logs HTTP estruturados com `request_id`, método, rota, status e duração;
- cabeçalho `X-Request-ID` para correlação;
- logs de Functions/deploy;
- logs e métricas do Supabase, Auth, banco, Cron e Advisors;
- tabelas/estados de notificações internas, `push_entregas` e `push_assinaturas`;
- auditoria operacional e administrativa;
- eventos do Service Worker/console durante testes sintéticos.

Confirme que cada fonte existe e é acessível no ambiente alvo. Endpoint saudável não substitui transação sintética.

## Catálogo de sinais

Os limiares numéricos devem ser definidos após medir uma linha de base. Até lá, trate qualquer falha sustentada do fluxo crítico ou qualquer acesso indevido como alerta.

| Sinal | Fonte | Condição a alertar | Primeira ação |
|---|---|---|---|
| API indisponível/configuração ausente | `/api/v1/health` | Sem resposta, 5xx ou status diferente do esperado para produção | Conferir deployment/variáveis e correlacionar logs |
| Saúde administrativa | `/api/v1/admin/health` | Banco, Auth ou FTS indisponível | Impedir go-live ou abrir incidente |
| Erros HTTP | Logs da API | Crescimento sustentado de 5xx/429 ou nova rota falhando | Agrupar por rota, código e deployment |
| Latência | Logs `duration_ms` | Degradação em relação à baseline aprovada | Ver banco, chamadas externas e volume |
| Auth | Supabase Auth/API | Pico de falha de login/cadastro/refresh/recuperação | Conferir URL, CAPTCHA, rate limit e provedor |
| RLS/autorização | Logs, teste sintético, auditoria | Qualquer leitura/escrita cross-tenant bem-sucedida | SEV-1; conter acesso imediatamente |
| Marketplace/Explorar | Sintético + API | Busca/filtros retornam erro ou resultado incompatível | Isolar filtros/endpoint e usar kill switch se previsto |
| Agenda pública | Sintético | Não é possível chegar à confirmação ou há duplicidade | Conter criação se houver risco de duplicação |
| Entitlements | Sintético + banco | Recurso pago abre sem direito ou direito válido bloqueia | Fail-closed; revisar fonte canônica |
| Notificações internas | Tabelas/UI | Contador diverge, fila não avança ou criação para de ocorrer | Comparar evento de origem e notificação |
| Web Push | Cron + `push_entregas` | Job falha, itens ficam processando, retry cresce ou descartes aumentam | Pausar/reduzir lote e verificar VAPID/provedor |
| Cron | Vercel/Supabase Cron | Execução perdida, não autorizada, longa ou repetida | Ver segredo, agenda e idempotência |
| Storage | Supabase Storage | Upload/download/remoção falha ou política expõe arquivo | Conter bucket/fluxo e revisar policies |
| Exclusão de conta | Auditoria/teste | Dados identificáveis permanecem fora da política ou histórico é apagado indevidamente | Abrir incidente de privacidade/integridade |
| PWA/cache | Sintético/cliente | Shell incompatível, offline quebrado ou API em cache | Ver Service Worker/deployment e executar rollback seguro |
| Advisors | Supabase | Novo erro ou warning sem decisão | Classificar antes de publicar |

## Alertas mínimos por severidade

| Severidade | Exemplos | Resposta |
|---|---|---|
| SEV-1 | Vazamento cross-tenant, segredo exposto, corrupção ampla, autoagendamento gerando dano, cobrança indevida futura | Acionamento imediato, contenção, comandante e privacidade |
| SEV-2 | Agenda/login indisponível, migration degradando produção, fila crítica parada, exclusão incorreta | Acionamento urgente e decisão de rollback |
| SEV-3 | Falha parcial com alternativa, degradação relevante, Push indisponível com notificação interna funcionando | Tratar na janela definida e comunicar suporte |
| SEV-4 | Defeito cosmético ou telemetria sem impacto funcional | Backlog com evidência |

Tempos de resposta e escalonamento devem ser definidos pela equipe; não estão aprovados neste documento.

## Transações sintéticas

Execute com dados e contas de teste, sem criar ruído em produção:

1. abrir home e Explorar;
2. pesquisar e aplicar um filtro conhecido;
3. abrir estabelecimento e consultar agenda pública;
4. validar login em ambiente apropriado;
5. consultar painel/cliente e notificações;
6. checar um acesso negado cross-tenant;
7. em homologação, completar um agendamento e limpar o dado segundo o roteiro.

Não use conta administrativa em monitor público. Não grave senha/token no sistema de monitoração.

## Web Push e Cron

- Meça execuções autorizadas, duração, examinadas, enviadas, retry, descartadas e silêncio.
- Alerte para item preso em `processando` além do mecanismo de recuperação previsto.
- Confirme que 404/410 desativa assinatura inválida.
- Verifique se o horário atual do Cron atende a expectativa do produto; a referência do repositório agenda `0 11 * * *`, mas a frequência de produção precisa de decisão explícita.
- Tentativa sem segredo deve falhar; nunca logue o segredo fornecido.
- Notificações internas devem continuar sendo a alternativa quando Push não está disponível.

## Privacidade dos logs

Permitido:

- `request_id`;
- rota normalizada, método, status e duração;
- códigos de erro estáveis;
- IDs técnicos quando necessários e com acesso restrito.

Não permitido:

- senha, token, cookie, chave, CAPTCHA token;
- endpoint e chaves de assinatura Push;
- observação de agendamento, nota de CRM ou mensagem de suporte integral;
- e-mail/telefone completos;
- corpo integral de requisição por padrão.

Defina e aplique a retenção dos logs na [política LGPD](INCIDENTES_E_RETENCAO_LGPD.md).

## Janela pós-deploy

- T+0: saúde da API, deployment, migration/verificador e smoke público.
- T+15 min: Auth, erros, latência, agenda, filtros e RLS sintético.
- T+60 min: notificações, filas, Storage e feedback de suporte.
- Próxima execução de cada Cron: confirmar autorização e resultado.
- Próximo dia útil: revisar tendência, Advisors e exceções.

Esses marcos são pontos de observação, não afirmações de SLA.

## Pagamentos — condicional

Sem gateway real, registre `N/A — provedor não integrado` e monitore apenas a coerência comercial dos planos. Se houver integração, acrescente antes do go-live:

- disponibilidade/latência do provedor;
- webhooks recebidos, assinaturas inválidas e backlog;
- idempotência e duplicidade;
- divergência entre cobrança, assinatura e entitlement;
- falha de renovação, cancelamento, reembolso e chargeback;
- reconciliação diária e responsável financeiro.

## Registro de ativação

| Sinal | Ferramenta/consulta | Limiar aprovado | Destinatário | Teste do alerta | Estado |
|---|---|---|---|---|---|
| API | | A definir | | | Não configurado |
| Auth | | A definir | | | Não configurado |
| Banco/RLS | | A definir | | | Não configurado |
| Agenda | | A definir | | | Não configurado |
| Notificações/Push | | A definir | | | Não configurado |
| PWA | | A definir | | | Não configurado |
| Pagamentos (condicional) | | N/A até provedor | | | N/A condicional |
