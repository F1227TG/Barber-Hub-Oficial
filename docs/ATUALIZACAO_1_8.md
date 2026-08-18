# Barber Hub 1.8.0 — Assinaturas funcionais

## Objetivo

Transformar os planos em benefícios reais e cumulativos, aplicados imediatamente quando um administrador altera a assinatura do estabelecimento.

## Principais entregas

- migration 16 com resolver de entitlements e enforcement no PostgreSQL;
- API FastAPI 1.3;
- central administrativa de assinaturas em desktop/mobile;
- Carteira de clientes, Promoções, Relatórios e Exportação condicionados por plano;
- limites reais de profissionais, portfólio e destaques;
- agenda e promoções públicas condicionadas ao plano efetivo, inclusive após expiração/pausa;
- prioridade comercial controlada no ranking do marketplace;
- Realtime para refletir upgrade/downgrade sem novo login.

## Publicação

1. Executar `sql/16_assinaturas_entitlements_beneficios.sql` no Supabase de produção.
2. Publicar o código 1.8.0/API 1.3.0.
3. Testar uma conta em cada plano e depois testar downgrade.
4. Confirmar que `/api/v1/health` informa `1.3.0`.

A cobrança automática ainda não faz parte desta release; o plano é atribuído administrativamente.
