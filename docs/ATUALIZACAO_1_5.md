# Barber Hub 1.5.0 — redesign, agenda múltipla e API Python

## Experiência

- página inicial mais direta e chamada de instalação do PWA em destaque;
- menus de visitante com Entrar e Criar conta;
- agendamento reduzido ao estabelecimento, serviços, profissional, data e hora;
- seleção de vários serviços com resumo de duração e preço;
- mapa visual do sistema em `html/mapa-sistema.html`;
- refinamentos responsivos para cards, formulários, suporte e painéis.

## Backend

- FastAPI na pasta `api/`;
- serviços separados em `backend/services/`;
- autenticação por Bearer token;
- validação Pydantic e erros padronizados;
- endpoint seguro de recuperação de senha;
- migration 14 para itens e RPC de múltiplos serviços.

## Antigravity

O contexto persistente está em `.agents/rules/`. A skill de entrega fica em
`.agents/skills/barberhub-release/`. Consulte `docs/ANTIGRAVITY.md` antes de
permitir mudanças amplas por agentes.

## Ordem de atualização

1. substituir os arquivos do projeto;
2. executar `npm run check`;
3. fazer commit e push;
4. configurar as variáveis da API na Vercel;
5. executar `sql/14_api_python_agendamento_multisservicos.sql`;
6. redeploy;
7. testar `/api/v1/health` e `/api/docs`;
8. executar os fluxos de cliente, profissional e admin.
