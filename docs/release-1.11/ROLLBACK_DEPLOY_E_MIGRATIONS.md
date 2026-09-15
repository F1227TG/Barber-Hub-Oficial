# Runbook de rollback — deploy e migrations do Barber Hub 1.11

## Princípios

- Reverter frontend/API e reverter banco são decisões diferentes.
- Para migrations aditivas já aplicadas com dados reais, **forward-fix** costuma ser mais seguro que remover objetos.
- Não execute `DROP`, restauração ou down migration improvisada.
- Feature flag/kill switch, interrupção de Cron e promoção do deployment anterior são as primeiras contenções quando resolvem o impacto.
- Toda ação deve preservar evidência e respeitar RPO/RTO aprovados.

## Pré-requisitos antes do deploy

| Item | Registro obrigatório |
|---|---|
| Deployment candidato | |
| Deployment anterior estável | |
| Commit candidato/anterior | |
| Migrations da 1.11 em ordem | |
| Compatibilidade: código antigo × banco novo | |
| Compatibilidade: código novo × banco antigo | |
| Backup recuperável | |
| Feature flags/kill switches relevantes | |
| Responsável e substituto | |

Sem esses dados, o deploy é **no-go**.

## Classificação rápida

| Sintoma | Primeira contenção | Próximo passo |
|---|---|---|
| Erro apenas visual/rota/CTA | Promover deployment anterior | Smoke test e observar cache/PWA |
| API nova com erro, banco compatível | Promover API anterior | Verificar contrato e filas |
| Recurso isolado com dano | Acionar kill switch aprovado | Corrigir e ensaiar reativação |
| Cron/Push repetindo ou falhando | Pausar agendamento/segredo conforme procedimento do provedor | Preservar fila e investigar idempotência |
| Migration falha antes de concluir | Interromper; não publicar código dependente | Avaliar transação/log e preparar correção |
| Migration conclui, sem corrupção, mas código falha | Voltar código se compatível com banco novo | Forward-fix do banco/código |
| Dados corrompidos/perdidos | Declarar incidente; bloquear escritas | Avaliar restore pelo runbook de backup |
| Suspeita de vazamento/credencial | Conter acesso e rotacionar segredo afetado | Seguir runbook de incidente/LGPD |

## Rollback de frontend e API

1. Declare incidente e registre o `request_id`/deployment/horário do primeiro erro.
2. Pare novas mudanças e confirme que a migration não torna o código anterior incompatível.
3. Promova o deployment anterior conhecido como estável pelo mecanismo da plataforma.
4. Não copie variáveis entre ambientes manualmente sem revisão; confirme que o deployment usa o conjunto correto.
5. Execute smoke tests:
   - home e Explorar públicos;
   - página de estabelecimento e início de agendamento;
   - login;
   - painel/cliente;
   - `GET /api/v1/health`;
   - um acesso permitido e um negado por RLS.
6. Observe erros, latência, Auth, agenda, notificações e jobs.
7. Mantenha o incidente aberto até estabilidade e impacto serem confirmados.

## Service Worker e cache PWA

Rollback do hosting não garante que uma instalação já controlada pelo Service Worker use imediatamente os mesmos arquivos.

- Teste sessão nova, sessão existente, aba aberta durante a troca e aplicativo instalado.
- Confirme que HTML, JS, CSS e Service Worker pertencem a uma combinação compatível.
- Verifique atualização após fechar/reabrir e após recuperar a rede.
- Não instrua usuários a apagar todos os dados como primeira resposta; isso pode remover rascunhos e sessões úteis. Use comunicação específica somente se o comportamento for comprovado.

## Migrations: decisão segura

### Antes da aplicação

- valide a ordem, dependências, locks esperados e tempo observado em homologação;
- confirme backup/restauração;
- confirme que o código anterior tolera o schema novo;
- prefira alterações expansivas antes de remoções.

### Falha durante aplicação

1. Não repita automaticamente.
2. Determine se a ferramenta/SQL executou em uma transação única ou deixou estado parcial.
3. Capture erro, objetos alterados e histórico remoto.
4. Não edite o arquivo já aplicado para “fazer passar”.
5. Crie uma migration corretiva nova após análise e ensaio.

### Migration aplicada com sucesso

- Se não houver corrupção e o banco continuar compatível, volte apenas o código e prepare forward-fix.
- Se houver alteração irreversível ou corrupção, o comandante decide entre reparo controlado e restauração.
- Down migration só pode ser usada quando foi escrita, revisada e ensaiada antes da janela, sem destruir dados necessários.

## Restauração do banco

Use [Backup e restauração](BACKUP_E_RESTAURACAO.md). Antes de restaurar:

- quantifique escritas posteriores ao ponto de recuperação;
- preserve evidências;
- interrompa processos e jobs que voltariam a gravar;
- obtenha autorização do responsável técnico e de negócio;
- planeje reconciliação de agendamentos/notificações criados após o ponto;
- reexecute solicitações de exclusão/anonimização posteriores ao backup.

## Cron, filas e idempotência

- Pausar o job não significa apagar a fila.
- Não marque itens como enviados sem confirmação do provedor.
- Antes de reprocessar, valide chaves de idempotência e estados `pendente`, `processando`, `falhou` e `descartada`.
- Após retorno, libere em lote pequeno e observe duplicação/erro.

## Pagamentos — condicional

Enquanto não houver provedor real, este bloco é N/A justificado. Se houver integração:

- suspenda checkout/webhook antes de rollback incompatível;
- preserve eventos assinados e IDs externos;
- não refaça cobrança para “testar” reconciliação;
- compare estado local e do provedor antes de reprocessar;
- envolva suporte/financeiro em estorno, chargeback e comunicação.

## Encerramento

- [ ] Serviço voltou e smoke tests passaram.
- [ ] Banco e código estão em combinação suportada.
- [ ] Cache/PWA foi verificado.
- [ ] Jobs/filas estão em estado conhecido.
- [ ] Não há vazamento cross-tenant.
- [ ] Impacto e dados afetados foram quantificados.
- [ ] Comunicação e ticket de correção foram abertos.
- [ ] Post-mortem tem responsável e prazo.

## Registro

| Campo | Valor |
|---|---|
| Incidente | |
| Início/fim | |
| Deployment antes/depois | |
| Banco/migrations | |
| Contenção usada | |
| Dados afetados | |
| RPO/RTO observado | |
| Resultado | Não executado |
| Responsáveis | |
| Evidências/post-mortem | |
