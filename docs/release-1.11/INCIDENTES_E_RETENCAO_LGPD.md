# Resposta a incidentes e retenção LGPD — Barber Hub 1.11

Este runbook apoia operação e engenharia. Prazos legais, bases legais e textos aos titulares precisam de validação do responsável por privacidade/jurídico; não são presumidos aqui.

## Contatos e autoridade

| Função | Titular | Substituto | Contato seguro |
|---|---|---|---|
| Comandante do incidente | A definir | A definir | A definir |
| Engenharia/API | A definir | A definir | A definir |
| Banco/Supabase | A definir | A definir | A definir |
| Segurança | A definir | A definir | A definir |
| Privacidade/DPO | A definir | A definir | A definir |
| Produto/suporte | A definir | A definir | A definir |
| Comunicação/jurídico | A definir | A definir | A definir |

## Quando abrir incidente

- indisponibilidade ou degradação relevante;
- acesso indevido entre usuários/estabelecimentos;
- exposição de segredo ou dado pessoal;
- perda, corrupção ou duplicação de agendamento/financeiro;
- migration ou restore com resultado inesperado;
- exclusão de conta incompleta ou destrutiva além do previsto;
- fila/Cron provocando repetição;
- futura cobrança indevida ou divergência com entitlement.

## Ciclo de resposta

### 1. Detectar e registrar

- horário/fuso, ambiente, deployment, commit e migrations;
- sintoma, primeiro `request_id` e fonte do alerta;
- escopo inicial e fluxos afetados;
- quem declarou e quem assumiu comando.

Não copie payload sensível para chat aberto.

### 2. Classificar

Use SEV-1 a SEV-4 do [plano de monitoramento](MONITORAMENTO_E_ALERTAS.md). Qualquer acesso cross-tenant ou segredo privado público é SEV-1 até prova em contrário.

### 3. Conter

- bloquear feature/rota/credencial afetada de forma reversível;
- pausar Cron/fila quando ele amplia o dano;
- promover deployment anterior somente após checar compatibilidade;
- restringir acesso sem apagar evidência;
- para segredo exposto, rotacionar e invalidar sessões/integrações conforme o alcance.

### 4. Preservar evidência

- exporte logs sanitizados e intervalos de tempo relevantes;
- preserve IDs, checksums, configurações e histórico de deploy/migrations;
- restrinja acesso à evidência;
- registre cada ação e executor;
- não faça consultas exploratórias com dados pessoais fora do necessário.

### 5. Avaliar impacto de dados pessoais

Com privacidade/jurídico:

- categorias e volume aproximado;
- titulares afetados;
- origem, período e quem teve acesso;
- risco de fraude, discriminação, constrangimento ou dano;
- proteção existente (criptografia, pseudonimização, acesso);
- possibilidade de contenção e recuperação;
- obrigações contratuais e regulatórias.

O responsável competente define se, quando e como comunicar autoridade e titulares dentro do prazo legal aplicável. Não adie essa avaliação esperando a causa raiz completa.

### 6. Erradicar e recuperar

- corrigir causa em ambiente isolado;
- revisar teste de regressão e autorização;
- seguir [rollback](ROLLBACK_DEPLOY_E_MIGRATIONS.md) ou [restauração](BACKUP_E_RESTAURACAO.md);
- reabrir gradualmente;
- acompanhar sinais reforçados;
- reconciliar filas, exclusões e escritas posteriores a restore.

### 7. Comunicar

Toda comunicação deve ser factual:

- o que ocorreu e quando foi detectado;
- o que foi afetado, sem especular;
- contenção aplicada;
- ação esperada do usuário, se houver;
- canal de suporte e próxima atualização.

Não atribua culpa, não minimize impacto e não prometa prazo sem validação.

### 8. Encerrar e aprender

- causa raiz e fatores contribuintes;
- linha do tempo;
- impacto confirmado;
- controles que funcionaram/falharam;
- ações com responsável e prazo;
- atualização de runbooks, testes e alertas;
- revisão de retenção e minimização.

## Registro de tratamento e retenção

Os prazos abaixo não foram definidos. Cada linha exige finalidade, base legal, prazo, evento inicial, descarte e aprovador antes do go-live.

| Categoria / exemplos | Finalidade | Base legal | Prazo/evento inicial | Descarte/anonimização | Responsável | Estado |
|---|---|---|---|---|---|---|
| Conta e perfil: nome, e-mail, telefone, avatar, papel | Conta, segurança e operação | A validar | A definir | Excluir ou anonimizar conforme obrigação | | Pendente |
| Credenciais no Supabase Auth | Autenticação | A validar | A definir | Exclusão pelo Auth; nunca copiar hash | | Pendente |
| Estabelecimento/equipe e permissões | Prestação do serviço e controle de acesso | A validar | A definir | Excluir/anonimizar vínculos quando cabível | | Pendente |
| Agendamentos, serviços snapshot e status | Execução, histórico e defesa de direitos | A validar | A definir | Anonimizar identificadores quando permitido | | Pendente |
| CRM: contato, notas e consentimentos de canal | Relacionamento autorizado | A validar por finalidade/canal | A definir | Remover contato/notas ou anonimizar | | Pendente |
| Financeiro/comissões/formas de pagamento | Operação e obrigações aplicáveis | A validar | A definir | Retenção legal e descarte seguro | | Pendente |
| Avaliações, denúncias e portfólio | Reputação, conteúdo e moderação | A validar | A definir | Excluir/anonimizar conforme vínculo/direito | | Pendente |
| Notificações internas | Comunicação transacional | A validar | A definir | Expirar/apagar conteúdo desnecessário | | Pendente |
| Push: endpoint, chaves públicas da assinatura, preferências e entregas | Aviso consentido no dispositivo | A validar | A definir; encerrar ao revogar | Desativar assinatura e remover identificadores | | Pendente |
| Lista de espera, recorrência, fidelidade, cupom e campanha | Retenção/serviço contratado | A validar separadamente | A definir | Expirar/remover quando finalidade acabar | | Pendente |
| Suporte | Atendimento e defesa de direitos | A validar | A definir | Redação/anônima ou exclusão | | Pendente |
| Importações e linhas de prévia | Onboarding operacional temporário | A validar | Prazo curto a definir | Purga automática e anonimização do solicitante | | Pendente |
| Auditoria operacional/admin | Segurança, prestação de contas e defesa | A validar | A definir | Preservar evento mínimo; anonimizar ator/alvo quando possível | | Pendente |
| Rate limit e logs técnicos | Segurança e diagnóstico | A validar | Prazo curto a definir | Agregação/purga | | Pendente |
| Geolocalização do navegador | Busca por proximidade | Consentimento/permissão a validar | Sessão/finalidade a definir | Não persistir além do necessário | | Pendente |
| Preferências locais e rascunhos | Continuidade e idempotência | A validar | TTL definido por tipo | Limpar em sucesso/logout/exclusão/expiração | | Pendente |
| Backups | Continuidade e segurança | A validar | Conforme RPO/retention aprovada | Expiração segura e reaplicação de exclusões após restore | | Pendente |
| Pagamentos futuros | Cobrança, fiscal e antifraude | N/A até provedor; reavaliar | N/A | N/A | | Condicional |

## Direitos do titular

Defina canal, autenticação do solicitante, responsável, prazo interno e evidência para:

- confirmação e acesso;
- correção;
- informação sobre compartilhamento;
- portabilidade quando aplicável;
- anonimização, bloqueio ou exclusão;
- revogação de consentimento;
- oposição/revisão quando cabível.

Não envie dados antes de validar identidade. Não exponha dados de outro usuário/estabelecimento em uma resposta de acesso.

## Exclusão de conta

Critérios operacionais:

- reautenticação e confirmação explícita;
- proteção do último admin;
- remoção no Auth e dos arquivos/vínculos definidos;
- anonimização do histórico legitimamente retido;
- limpeza de sessões, continuação e rascunhos do navegador;
- registro mínimo da operação sem senha ou dados excessivos;
- propagação para sistemas terceiros;
- tratamento de cópias em backup conforme prazo aprovado.

O comportamento técnico existente deve ser testado; este documento não o declara aprovado.

## Revisão periódica

- [ ] Inventário corresponde ao banco, Storage, navegador, logs e terceiros reais.
- [ ] Cada finalidade tem base e prazo aprovados.
- [ ] Jobs de purga foram implementados e testados quando necessários.
- [ ] Restore reaplica exclusões posteriores ao ponto recuperado.
- [ ] Contratos de terceiros cobrem retenção, suboperadores e incidente.
- [ ] Termos/Privacidade refletem a prática.
- [ ] Simulado de incidente foi realizado e gerou ações.

## Registro do incidente

| Campo | Valor |
|---|---|
| ID/severidade | |
| Início/detecção/contenção/fim | |
| Ambiente/versão | |
| Impacto técnico | |
| Dados pessoais/categorias | |
| Titulares estimados | |
| Decisão regulatória e aprovador | |
| Comunicação | |
| Causa raiz | |
| Ações e prazos | |
| Evidências restritas | |
