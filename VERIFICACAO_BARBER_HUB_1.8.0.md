# Barber Hub 1.8.0 — Verificação técnica

## Escopo verificado

A release 1.8 transforma planos em **entitlements funcionais e cumulativos**, com atribuição administrativa, aplicação imediata no painel e enforcement das capacidades críticas no PostgreSQL/API.

A verificação cobre:

- versão Frontend/PWA 1.8.0 e API 1.3.0;
- migration 16 de assinaturas/benefícios;
- herança cumulativa Gratuito → Essencial → Profissional → Elite;
- central administrativa de assinaturas desktop/mobile;
- agenda, profissionais, portfólio, destaques e promoções condicionados ao plano;
- promoções públicas ocultadas quando o benefício deixa de ser efetivo;
- CRM/Carteira de clientes;
- relatórios essenciais/avançados e exportação CSV;
- prioridade do plano no marketplace;
- Realtime de assinatura no painel;
- paridade das páginas funcionais desktop/mobile.

## Resultado do `npm run check`

Executado na árvore final da 1.8.0:

```text
Mobile sincronizado: 22 páginas refletem o desktop.
Roteamento mobile 1.8.0: 11 casos dinâmicos + 23 páginas + navegação JS aprovados.
Barber Hub 1.8.0: 38 arquivos centrais encontrados.
50 páginas HTML verificadas, sem IDs duplicados ou links locais quebrados.
39 arquivos JavaScript passaram por node --check.
Nenhuma chave secreta foi encontrada nos arquivos públicos auditados.
Validação estrutural concluída sem erros.
26/26 invariantes da release 1.8 aprovados.
14/14 testes Python/FastAPI aprovados.
```

## Invariantes funcionais da release

Os testes estáticos confirmam a presença e integração dos seguintes pontos:

1. resolvedor central `calcular_entitlements_estabelecimento`;
2. herança cumulativa por `ordenacao`;
3. RPC administrativa `admin_atribuir_plano`;
4. limite de profissionais no banco;
5. limite de portfólio/destaques no banco;
6. promoções condicionadas ao entitlement;
7. visibilidade pública de promoções condicionada à assinatura efetiva;
8. agenda condicionada ao entitlement, inclusive na experiência pública;
9. prioridade de marketplace por plano;
10. endpoints administrativos e do proprietário na API 1.3;
11. CRM, promoções, relatórios e CSV no painel;
12. atualização Realtime após upgrade/downgrade;
13. página administrativa de assinaturas em desktop e mobile;
14. Service Worker usando cache `barberhub-v1.8.0`.

## Limite desta verificação

A migration `sql/16_assinaturas_entitlements_beneficios.sql` foi auditada estruturalmente no código, mas **não foi executada por esta verificação em um banco Supabase de produção**. Portanto, antes de liberar a 1.8 no domínio principal, é obrigatório aplicar a migration 16 em um ambiente Supabase adequado e realizar testes reais de upgrade/downgrade.

## Roteiro mínimo de homologação no Supabase

1. aplicar migrations `01` → `16` em uma base de teste, ou somente a `16` se `01` → `15` já estiverem aplicadas;
2. selecionar um estabelecimento de teste no Admin → Assinaturas;
3. aplicar **Gratuito** e confirmar bloqueio de agenda, CRM, promoções e relatórios;
4. aplicar **Essencial** e confirmar liberação imediata de agenda, CRM, promoções e relatórios essenciais;
5. aplicar **Profissional** e confirmar até 3 profissionais, relatórios avançados, CSV e prioridade adicional;
6. aplicar **Elite** e confirmar limites 10/500/5 e prioridade máxima;
7. fazer downgrade e confirmar que dados históricos não são apagados, enquanto excessos ficam inativos/arquivados conforme a regra;
8. testar status `pausada`/`expirada` e confirmar retorno dos benefícios efetivos ao Perfil gratuito;
9. testar a mesma conta em desktop e `/mobile` sem novo login;
10. validar o marketplace e a página pública após cada alteração.
