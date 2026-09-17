# Testes de perfis, planos e RLS — Barber Hub 1.11

## Objetivo

Provar autorização positiva e negativa em UI, API e banco. Botão escondido não é controle de acesso; cada operação proibida deve ser tentada diretamente com o token do próprio usuário.

## Regras do ensaio

- Use homologação e dados sintéticos.
- Crie contas separadas; não altere repetidamente o papel da mesma conta.
- Use dois estabelecimentos independentes, A e B.
- Nunca use `service_role` para representar um usuário.
- Não copie JWT, cookie, senha ou dado pessoal para a evidência.
- Registre status HTTP/código estável e resultado sanitizado.
- Limpe os dados pelo fluxo aprovado depois do teste.

## Identidades necessárias

| Código | Identidade | Vínculo |
|---|---|---|
| V0 | Visitante | Sem sessão |
| C-A | Cliente | Dados/agendamentos próprios no estabelecimento A |
| C-B | Cliente | Usuário distinto para tentativa cruzada |
| P-A | Profissional de equipe | Estabelecimento A |
| R-A | Recepção | Estabelecimento A |
| G-A | Gerente | Estabelecimento A |
| O-A | Proprietário | Estabelecimento A |
| O-B | Proprietário | Estabelecimento B |
| ADM | Administrador | Conta separada e não usada nos testes comuns |
| SV | Autenticado sem vínculo | Nenhum estabelecimento |

Cada identidade deve ter ID registrado em cofre/evidência restrita, não neste documento.

## Preparação de dados

- [ ] Estabelecimentos A e B têm serviços, profissionais, agenda e itens privados distintos.
- [ ] Existem notificações para C-A e O-A.
- [ ] Existem itens de CRM/financeiro/equipe apenas em A e apenas em B.
- [ ] Existem conteúdo público e conteúdo privado/rascunho/oculto.
- [ ] Há um plano de cada nível em cenários separados ou uma estratégia controlada de troca.
- [ ] IDs A/B usados nas tentativas cruzadas foram registrados.
- [ ] Feature flags relevantes têm estado conhecido.
- [ ] A limpeza pós-teste foi definida.

## Resultado esperado por identidade

| Identidade | Deve conseguir | Deve ser impedida |
|---|---|---|
| V0 | Ler marketplace e conteúdo público; iniciar agendamento até antes da confirmação | Dados privados, notificações, painel, confirmar agendamento sem login |
| C-A | Próprio perfil, agenda, favoritos, espera/recorrência permitida, próprias notificações | Dados de C-B, painel profissional, admin, agenda como cliente no negócio próprio se também for responsável |
| P-A | Ações de A permitidas pelo papel e plano | Financeiro/permissões fora do papel, dados de B, admin |
| R-A | Agenda/CRM/retention definidos para recepção e overrides válidos | Financeiro/equipe/configuração sem permissão, dados de B |
| G-A | Capacidades de gerente intersectadas com plano/overrides | Permissões de proprietário/admin e dados de B |
| O-A | Gestão completa de A limitada por plano; própria conta | Alterar B, forçar entitlement, avaliar/agendar no próprio estabelecimento |
| O-B | Gestão de B | Ler/alterar A |
| ADM | Rotas administrativas previstas e ações auditadas | Excluir/desativar o último admin; leitura de senha |
| SV | Próprio perfil e superfícies públicas | Qualquer dado privado de A/B ou painel |

## Matriz de domínios

Para cada linha execute: operação permitida, mesma operação com ID de outro usuário/estabelecimento e acesso direto sem usar a UI.

| Domínio | Leitura permitida a validar | Escrita permitida a validar | Negativos obrigatórios |
|---|---|---|---|
| Perfis/Auth | Próprio perfil; admin conforme regra | Atualizar próprios campos permitidos | Autoelevação de papel/ativo/onboarding; ler outro perfil privado; senha visível |
| Estabelecimentos | Público visível; equipe A conforme papel | O-A/configuração permitida em A | O-A/P-A/R-A alterando B; campo administrativo protegido |
| Serviços/profissionais/promoções | Público conforme status; equipe A | Papel autorizado e entitlement | Outro tenant; exceder limite; recurso sem plano |
| Agenda/agendamentos | Cliente próprio; equipe A | Criar/alterar conforme transição | Cliente de outro, equipe B, sobreposição, autoagendamento |
| CRM | Equipe A conforme capacidade | Nota/consentimento permitido | Recepção/ profissional além do papel; B; exportação sem direito |
| Financeiro/comissões | Papel/planos autorizados em A | Ajuste/gasto/regra idempotente | Cliente/recepção; B; comissão fora do direito |
| Equipe/permissões | Papel autorizado em A | Proprietário/gerente conforme regra | Elevar além do papel/plano; alterar B; conceder entitlement ausente |
| Espera/recorrência/fidelidade | Cliente próprio e equipe A | Ação prevista por plano | Item de outro usuário/tenant; plano bloqueado; duplicidade |
| Cupons/campanhas/metas/insights | Papel e plano corretos | Ação prevista | Forçar por API; consentimento de canal ignorado; B |
| Avaliações/portfólio/denúncias | Conteúdo público permitido | Autor/papel correto | Proprietário avaliando a si; republicar oculto; outro tenant |
| Notificações | Apenas próprias | Marcar própria como lida | Ler/marcar de C-B/O-B; forjar INSERT direto |
| Push | Própria assinatura/preferência | Ativar/desativar própria | Endpoint de terceiro; job sem segredo; cruzar usuário |
| Importação | Papel/configuração A | Prévia/commit autorizados | Ler import de B; fórmula; arquivo acima do limite; commit alheio |
| Auditoria | Papel com capacidade em A/admin | Geração automática | Editar/apagar evento; ler B; snapshot com segredo |
| Suporte | Próprios tickets/admin | Criar/responder conforme papel | Ticket de terceiro |
| Conta/exclusão | Própria conta | Fluxo completo confirmado | Excluir terceiro; senha incorreta; último admin; dados residuais indevidos |

Resultado seguro de um negativo: `401`/`403`, lista vazia ou erro de permissão coerente com o contrato. Nunca aceite retorno parcial de dados de outro escopo.

## Teste de planos e entitlements

A fonte esperada deve ser o resolvedor canônico do banco/API. Use `docs/MATRIZ_PLANOS_1_9.md` como referência histórica e registre qualquer mudança deliberada na 1.11.

Para Gratuito, Essencial, Profissional e Elite:

- [ ] Ler resumo de entitlements e salvar versão sanitizada.
- [ ] No Gratuito, configurar dias/períodos, ativar a agenda e confirmar que o CTA público aparece; desativar e confirmar que o CTA e a inserção direta são recusados.
- [ ] Conferir menu, sheet, conta, painel e rota direta.
- [ ] Conferir limites de profissionais/publicações/destaques.
- [ ] Tentar uma operação permitida e uma proibida.
- [ ] Confirmar que permissão granular só reduz/intersecta; nunca cria entitlement.
- [ ] Pausar/expirar assinatura e confirmar que a agenda básica gratuita permanece disponível somente quando o barbeiro a ativou; recursos pagos devem permanecer bloqueados.
- [ ] Simular indisponibilidade do resolvedor e confirmar comportamento fail-closed.
- [ ] Fazer upgrade/downgrade e confirmar atualização sem dado incoerente.
- [ ] Confirmar que página/CTA “Planos” é exposta somente ao profissional conforme requisito 1.11.

## Autoagendamento

Execute com O-A e cada membro A que também possa ter perfil autenticado:

1. abra diretamente a página pública de A;
2. procure CTA no hero, serviços, sticky mobile, card do marketplace e deep link `?agendar=1`;
3. tente abrir o modal;
4. tente chamada direta de criação com estabelecimento A;
5. repita contra B para provar que agendamento externo permitido não foi quebrado;
6. repita como visitante e C-B para preservar o fluxo público.

Critério: o próprio negócio bloqueia com mensagem clara; negócio externo segue a regra normal.

## Notificações e realtime

- [ ] C-A não lista notificação de C-B.
- [ ] Marcar por ID alheio não altera linha.
- [ ] Marcar individual reduz resumo e todos os badges.
- [ ] Abrir link não perde a gravação por navegação.
- [ ] Marcar todas afeta apenas o usuário.
- [ ] Atualização em outra aba converge.
- [ ] Painel interno e central separada mostram estado coerente.

## Exclusão

- [ ] Cliente: Auth/perfil/Storage e dados definidos são removidos; histórico permitido fica anônimo.
- [ ] Proprietário: dependências do estabelecimento seguem política e não deixam dado identificável indevido.
- [ ] Admin não consegue excluir a si se for o último admin ativo.
- [ ] Continuação, rascunho operacional, sessão e preferência que identifica contexto são limpos.
- [ ] Restore não ressuscita exclusão sem processo de reaplicação.

## Evidência por caso

| Caso | Identidade | Plano | Camada | Esperado | Observado | Estado | Evidência |
|---|---|---|---|---|---|---|---|
| | | | UI/API/RLS | | | Não executado | |

## Saída

- [ ] Nenhum acesso cross-tenant foi bem-sucedido.
- [ ] Nenhum recurso foi liberado apenas por UI.
- [ ] Todos os bloqueios legítimos têm mensagem útil.
- [ ] Toda diferença entre papel, override e plano está explicada.
- [ ] Dados sintéticos foram limpos sem apagar evidência necessária.
