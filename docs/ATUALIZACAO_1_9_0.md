# Barber Hub 1.9.0 — Operação & Crescimento

## Resultado

A 1.9.0 transforma o painel profissional em uma base de operação diária sem trocar a arquitetura ou a identidade visual do Barber Hub. A API própria passa à versão 1.4.0.

## Entregas

- Agenda profissional dia/semana com filtro por profissional;
- encaixes, bloqueios, reagendamento transacional, confirmação e no-show;
- histórico de eventos e snapshots do atendimento;
- CRM persistente por estabelecimento com segmentos, preferências e notas internas;
- receita prevista/realizada, ticket médio, ajustes e fechamento diário;
- comissão percentual ou fixa com snapshot no lançamento;
- papéis de proprietário, gerente, recepção e profissional;
- acesso individual da equipe limitado pelo plano;
- navegação mobile `Painel | Agenda | Clientes | Financeiro | Mais`;
- nova camada visual em `css/release-1.9.css`, responsiva e compatível com os temas atuais;
- estados de carregamento, vazio, erro e bloqueio por plano;
- migrations 18–23 e verificadores pós-aplicação;
- regras offline e regressões para agenda, CRM, financeiro e permissões.

## Segurança preservada

- o navegador usa a API autenticada para CRM e financeiro;
- RLS fica ativa em todas as nove tabelas operacionais novas;
- RPCs privilegiadas revogam acesso de `public` e `anon`;
- funções críticas fixam `search_path` vazio;
- papéis e entitlements são confirmados no PostgreSQL, não só na tela;
- senhas não são visíveis, reversíveis nem duplicadas nas tabelas públicas.

## Ordem de publicação

1. validar o pacote local;
2. fazer backup do banco;
3. confirmar que migrations 11–23 e os verificadores 17, 22 e 23 estão aprovados;
4. revisar Advisors de segurança e desempenho;
5. configurar as proteções externas em `docs/CONFIGURACAO_EXTERNA_1_9.md`;
6. publicar frontend/PWA 1.9.0 e API 1.4.0 juntos;
7. validar login, agenda, CRM, financeiro e papéis com contas de teste.

## Próxima versão

A antiga separação 1.9.1/1.9.2 foi consolidada na futura **1.9.3 — Retenção & Inteligência**, com lista de espera, recorrência, fidelidade, campanhas, oportunidades e insights.
