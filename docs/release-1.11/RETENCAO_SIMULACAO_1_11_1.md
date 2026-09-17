# Retenção controlada — 1.11.1

Esta etapa não ativa descarte automático. Ela substitui a rotina diária que usava prazos fixos por uma simulação registrada, orientada pela tabela `politicas_retencao_dados`.

## Inventário técnico coberto pela simulação

| Recurso de política | Fonte | Evento analisado | Ação configurada | Estado |
|---|---|---|---|---|
| `fila_email_entregue` | `fila_emails` | `enviado` ou `descartado`, por `updated_at` | excluir | Mapeado; bloqueado até aprovação |
| `entrega_push_finalizada` | `push_entregas` | `enviada` ou `descartada`, por `updated_at` | excluir | Mapeado; bloqueado até aprovação |
| `limite_api_expirado` | `api_rate_limits` | por `updated_at` | excluir | Mapeado; bloqueado até aprovação |
| `solicitacao_exclusao` | `solicitacoes_exclusao_conta` | atendimento ao pedido do titular | anonimizar | Sem rotina automática |
| `auditoria_operacional` | `auditoria_operacional` | trilha operacional | revisar | Sem rotina automática |
| `consentimento` | `consentimentos_usuario` | prova de escolha/versionamento | revisar | Sem rotina automática |

As demais categorias do inventário LGPD continuam no documento [INCIDENTES_E_RETENCAO_LGPD.md](INCIDENTES_E_RETENCAO_LGPD.md). Elas não são candidatas a exclusão até que tenham finalidade, base legal, evento inicial, prazo, ação final e responsável aprovados.

## Como funciona

- O cron existente chama `executar_retencao_tecnica_111()`, que agora somente chama `simular_retencao_tecnica_1111('cron')`.
- A simulação registra contagens agregadas em `retencao_simulacoes_1111`; não registra conteúdo, identificadores ou destinatários.
- Toda política foi migrada para `ativa=false` e `execucao_habilitada=false`. As sementes anteriores não são consideradas aprovação.
- A ativação real deve ocorrer em migration separada, depois de decisão por categoria, com teste de homologação, exceções, backup/restore e verificador correspondente.

## Decisão necessária antes da aplicação real

Para cada linha: aprovador (privacidade/jurídico e negócio), prazo em dias, marco inicial, exceções/hold, ação final, responsável pela operação e evidência do restore. Histórico financeiro, consentimentos e auditoria não serão apagados por esta rotina.
