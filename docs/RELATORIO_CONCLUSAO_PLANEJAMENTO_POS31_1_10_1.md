# Conferência final do Planejamento Pós-31 — Barber Hub 1.10.1

Documento comparado: `PLANEJAMENTO_POS_31_BARBER_HUB_ATUALIZADO_V2.docx`.

SHA-256 do documento revisado: `967C2FF43CA4E4DD86702196F2F69FFC32A3F1FF64A20B3045F921D55967316F`.

Data da segunda revisão: **5 de setembro de 2026**.

## Critério

- **Concluído no produto:** código, banco versionado, interface e regressão existem.
- **Preparado; validação externa pendente:** a capacidade técnica existe, mas a comprovação depende do ambiente ou de usuários/aparelhos reais.
- **Decisão concluída:** o estudo foi feito e uma decisão arquitetural foi registrada.

## Matriz item a item

| Seção do planejamento | Resultado 1.10.1 | Evidência principal |
|---|---|---|
| Direção da fase | Concluído no produto | operação mobile e quatro pilares preservados; linguagem comercial separada da infraestrutura |
| Múltiplos períodos | Concluído no produto | períodos por dia, cópia, virada de dia, sobreposição bloqueada, status e página pública |
| Planos por proposta de valor | Concluído no produto | Gratuito/Essencial/Profissional/Elite comunicados por problema resolvido e validados por entitlement |
| Mobile principal | Concluído no produto; aparelhos reais pendentes | dock profissional, “Mais” por acesso, ações rápidas, cards sem corte e breakpoints 320–768 px |
| Atendimento sem agendamento | Concluído no produto | atendimento manual, cliente opcional, serviço avulso, profissional, origem e pagamento |
| Financeiro simples | Concluído no produto | receita, gastos, resultado estimado, comissão, ticket e filtros de período |
| Biblioteca de imagens | Concluído no produto | biblioteca oficial WebP e escolha no cadastro, mantendo upload próprio |
| Mapa e localização | Concluído no produto | endereço estruturado, mapa, rota, fallback e validação de coordenadas |
| Jacinto e expansão regional | Preparado; piloto externo pendente | filtros/ranking regional e feature flags; roteiro de piloto disponível |
| Compatibilidade ampla | Preparado; homologação física pendente | layout e testes estruturais; matriz de aparelhos documentada |
| Entrevistas com barbeiros | Preparado; execução externa pendente | questionário, amostra, métricas e termo de evidência em `PILOTO_VALIDACAO_OPERACIONAL.md` |
| Paginação | Concluído no produto | marketplace, CRM, agenda, finanças, avaliações, notificações, portfólio, retenção e Admin paginados |
| Hashing/autenticação | Auditoria concluída | credencial pertence ao Supabase Auth; nenhuma cópia própria de senha no Barber Hub |
| Possível união de repositórios | Decisão concluída | Barber monorepo web/PWA/API mantido; Beauty separado; reavaliar apenas com ciclos independentes |
| Identidade Barber + Beauty | Concluído no escopo Barber | marca, metadados e página Beauty coerentes; Beauty continua produto e repositório independentes |
| Organização estrutural | Concluído com compatibilidade | `js/core`, `js/features`, `backend/domain`, `backend/services`; rotas públicas preservadas |
| Continuidade após autenticação | Concluído no produto | agendamento completo, favoritos e avaliações retomados com destino seguro e expiração |
| Notificações/Web Push | Concluído no código; configuração externa pendente | consentimento, preferências, fila, Service Worker e worker Cron autenticado |
| Importação inicial | Concluído no produto | CSV/XLSX de clientes/serviços, prévia, limites, duplicidade, fórmulas e relatório |
| Internet ruim | Concluído nos fluxos críticos | estados de conexão, rascunho persistente e repetição idempotente |
| Auditoria operacional | Concluído no banco versionado | histórico append-only ampliado e consulta administrativa paginada |
| Feature flags/piloto | Concluído no banco e API | alvos, expiração, plano, estabelecimento e kill switch; guards no banco |

## Backlog P0–P3 do documento

| Prioridade | Estado |
|---|---|
| P0 Operação real | concluída no código e nos testes |
| P0 Mobile/compatibilidade | concluída tecnicamente; aparelhos reais ainda precisam homologação |
| P1 Planos | concluída tecnicamente; preços finais dependem do piloto comercial |
| P1 Página pública | concluída |
| P1 Escala/performance | concluída no código; monitoramento de produção permanece operacional |
| P1 Segurança/hash | auditoria concluída; sem autenticação própria |
| P1 Estrutura do ecossistema | decisão registrada; sem migração arriscada perto do lançamento |
| P1 Organização | concluída nas áreas alteradas, com caminhos/testes atualizados |
| P1 Continuidade | concluída |
| P1 Notificações | concluída tecnicamente; VAPID/Cron externos pendentes |
| P1 Importação | concluída |
| P1 Resiliência | concluída nos fluxos críticos |
| P1 Auditoria | concluída pela migration 32 |
| P1 Feature flags | concluída pela migration 32 |
| P1 Identidade | aplicada no Barber Hub; evolução contínua não é bloqueador de release |
| P2 Marketplace regional | concluído tecnicamente; expansão depende do piloto |
| P3 Expansão | não é alteração de código; depende do resultado Jacinto → Vale → outras regiões |

## Itens que não podem ser “implementados” dentro do repositório

O documento exige ouvir barbeiros, testar aparelhos reais, decidir preço pela disposição de pagar e executar expansão geográfica. O repositório entrega instrumentos, métricas e controles para isso, mas não pode fabricar evidência de campo. Tratar esses itens como concluídos sem piloto seria incorreto.

## Conclusão da revisão

Não restou item técnico solicitado pelo documento sem implementação ou decisão. Restam somente operações externas claramente identificadas: aplicar a migration 32, configurar os provedores/segredos, homologar papéis e aparelhos reais e conduzir o piloto comercial.
