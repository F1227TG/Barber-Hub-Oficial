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

## Diretriz de produto de 17/09/2026

Foi escolhida uma política **completa por categoria**, aproveitando os candidatos técnicos de curta retenção abaixo. Isso não autoriza descarte agora: a rotina continua exclusivamente em simulação e as colunas `ativa` e `execucao_habilitada` devem permanecer `false` até aprovação formal e migration específica.

| Categoria técnica | Candidato de prazo | Marco inicial | Ação futura candidata | Situação atual |
|---|---:|---|---|---|
| Limites de API expirados | 2 dias | `updated_at` | excluir | Simulação apenas |
| Metadados de e-mail entregue/descartado | 90 dias | `updated_at` após estado final | excluir | Simulação apenas |
| Metadados de Push enviado/descartado | 90 dias | `updated_at` após estado final | excluir | Simulação apenas |
| Financeiro, auditoria e consentimentos | Não definido | A definir | revisar/anonimizar conforme política | Sem descarte automático |

Antes de ativar qualquer uma das três primeiras linhas, privacidade/jurídico e negócio precisam aprovar finalidade, base legal, prazo, exceções de investigação/hold, responsável e tratamento após restore. A migration de ativação deve testar o candidato em homologação, guardar apenas evidência agregada e manter financeiro, auditoria e consentimentos fora do job automático.
