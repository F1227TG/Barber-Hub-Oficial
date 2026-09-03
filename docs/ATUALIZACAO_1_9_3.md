# Barber Hub 1.9.3 — Retenção & Inteligência

## Resultado

A versão 1.9.3 entrega, em uma única release, os escopos planejados como 1.9.1 e 1.9.2. Ela parte da Agenda/CRM/Financeiro da 1.9.0 e adiciona recursos operacionais reais, API 1.5.0, migrations 24–28, regressões e interfaces responsivas sem mudar a direção premium escura, quente e dourada.

## Escopo 1.9.1 implementado

- lista de espera com preferência de serviço, profissional, período e aviso de vaga;
- agendamento recorrente semanal, quinzenal ou mensal, com limite e detecção de conflito;
- fidelidade com programa, pontuação após atendimento concluído, saldos, recompensas e resgate transacional;
- cupons percentuais/fixos com validade, mínimo, limite total/cliente e desconto transacional;
- campanhas por segmento, consentimento, aniversário opcional no CRM e fila auditável;
- lembretes internos de 24h/2h e solicitação de avaliação preparados por rotina agendada.

## Escopo 1.9.2 implementado

- Central de Oportunidades com sinais de clientes inativos, lista de espera, avaliações e ocupação;
- insights de receita, ticket, retenção, ocupação, clientes e rankings;
- metas por período para receita, atendimentos, ticket, clientes novos e ocupação;
- permissões granulares no Elite, aplicadas na interface, API, RPC e RLS sobre os padrões seguros dos papéis.

## Experiência

- o botão `Mais` do profissional abre uma folha de opções filtrada por plano e permissão;
- Retenção e Crescimento entram no painel desktop e mobile compartilhado;
- cliente acompanha lista de espera e recorrências na própria área;
- cliente acompanha saldo, recompensas e resgate da própria carteira de fidelidade;
- agenda oferece criação de recorrência a partir de atendimento futuro;
- agendamento público aceita cupom e oferece lista de espera quando não há vaga;
- cards, filtros e indicadores quebram em grade/coluna no mobile, sem rolagem lateral obrigatória;
- CRM mantém busca aprimorada e ganhou aniversário opcional para campanhas autorizadas;
- checklist de senha, estados de carregamento, status do estabelecimento e cabeçalho mobile permanecem corrigidos;
- Beauty Hub recebeu conteúdo atual e responsivo, sem prometer um produto ainda inexistente.
- suporte foi encurtado, com histórico/perguntas recolhidos e mensagens sem jargão de infraestrutura;
- Admin ganhou atalhos, indicadores sem sobreposição e tabelas em cards no mobile;
- telas de cliente/profissional falam em ações e disponibilidade, enquanto Supabase, migrations e deploy ficam restritos à documentação técnica/Admin apropriado.

## Banco e Supabase

Esta release altera o banco. A ordem reproduzível é:

1. `sql/24_retencao_relacionamento_1_9_3.sql`;
2. `sql/25_inteligencia_permissoes_1_9_3.sql`;
3. `sql/26_cron_automacoes_1_9_3.sql`;
4. `sql/27_advisors_release_1_9_3.sql`;
5. `sql/28_hardening_objetos_1_9_3.sql`;
6. `sql/verificar_25_release_1_9_3.sql`.

As cinco migrations já foram aplicadas no projeto conectado. O verificador é somente leitura e foi aprovado sem exceção e sem listar funções `SECURITY DEFINER` sem `search_path` protegido.

## Configuração externa

- os dois jobs do Supabase Cron estão ativos e tiveram execução bem-sucedida;
- conectar um worker/provedor para e-mail e WhatsApp antes de usar esses canais;
- CAPTCHA e URLs de Auth foram confirmados; a proteção contra senhas vazadas exige plano Pro;
- Security/Performance Advisor e a matriz de papéis foram revisados após as migrations.

## Matriz resumida

| Recurso | Gratuito | Essencial | Profissional | Elite |
|---|---:|---:|---:|---:|
| Cupons | — | ✓ | ✓ | ✓ |
| Lista de espera/recorrência/fidelidade/lembretes | — | — | ✓ | ✓ |
| Metas | — | — | ✓ | ✓ |
| Campanhas/oportunidades/insights/permissões granulares | — | — | — | ✓ |

## Versões

- produto/PWA: **1.9.3**;
- API: **1.5.0**;
- migrations: **01–28**;
- cache PWA: `barberhub-v1.9.3-mobile-r3`.
