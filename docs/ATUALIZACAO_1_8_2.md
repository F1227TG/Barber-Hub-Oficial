# Barber Hub 1.8.2 — Segurança diferencial

Release de segurança baseada nos achados V01–V06, sem mudança de direção visual.

## Entregas

- migration 17 para moderação, máquina de estados, limites concorrentes e contador derivado de curtidas;
- rate limiting nas rotas restantes da auditoria;
- configuração pública de Turnstile em runtime, sem expor secret;
- API 1.3.1;
- domínio de agendamentos/planos testável offline;
- 27 controles estáticos e 26 testes Python/FastAPI;
- decisão documentada de manter monorepo por enquanto;
- roadmap 1.9 para Agenda 2.0, CRM 2.0 e Financeiro/Comissões.

## Publicação

1. Em homologação, aplicar migrations 11–17 em ordem se o ambiente estiver, como produção, somente até a 10.
2. Executar `sql/verificar_17_correcao_auditoria.sql`.
3. Configurar Turnstile e Auth conforme `docs/RELATORIO_SEGURANCA_1_8_2.md`.
4. Executar `npm run check`.
5. Publicar frontend/PWA 1.8.2 e API 1.3.1 juntos.
6. Validar os fluxos V01–V06 em homologação e só então promover para produção.
