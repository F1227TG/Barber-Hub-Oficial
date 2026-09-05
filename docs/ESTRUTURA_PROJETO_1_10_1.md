# Estrutura do projeto — Barber Hub 1.10.1

## Mapa

```text
Barber-Hub-Oficial/
├─ api/                    entrada FastAPI/Vercel
├─ backend/
│  ├─ domain/              regras puras, testáveis sem internet
│  └─ services/            casos de uso e acesso externo
├─ html/                   páginas canônicas
├─ mobile/                 páginas geradas com shell mobile
├─ js/
│  ├─ core/                conexão, rascunho e infraestrutura
│  └─ features/            módulos funcionais isolados
├─ css/
│  └─ releases/            refinamentos versionados
├─ img/
│  ├─ branding/            marca
│  └─ library/             conteúdo reutilizável
├─ supabase/migrations/    migrations novas gerenciadas
├─ sql/                    histórico SQL e verificadores
├─ tests/                  testes Python/API
├─ scripts/                qualidade, sincronização e documentos
├─ docs/                   documentação atual e histórica
├─ service-worker.js       PWA/offline/Push
└─ vercel.json             deploy, cabeçalhos e Cron
```

## Organização aplicada

- `booking-modal.js` tornou-se `js/features/booking.js`;
- `painel-operacao-1.9.js` tornou-se `js/features/professional-operation.js`;
- `painel-retencao-1.9.3.js` tornou-se `js/features/retention-growth.js`;
- repetição idempotente e rascunho operacional ficaram em `js/core/operation-draft.js`;
- todas as referências de runtime, sincronização mobile, verificadores e cache foram atualizadas.

Arquivos históricos de documentação podem citar nomes antigos para explicar versões anteriores; eles não são carregados pelo produto. As páginas públicas não foram movidas para subpastas profundas porque isso quebraria URLs existentes perto do lançamento.

## Regra para novos arquivos

1. regra de negócio pura: `backend/domain/`;
2. integração/caso de uso: `backend/services/`;
3. infraestrutura compartilhada do navegador: `js/core/`;
4. recurso de interface: `js/features/`;
5. estilo da versão: `css/releases/`;
6. mudança de banco: `supabase/migrations/`;
7. verificação manual SQL: `sql/`;
8. documentação: `docs/`;
9. temporário, cache, ambiente local e segredo: nunca no Git ou ZIP.

## Decisão de repositórios

Web, PWA/mobile e API do Barber Hub permanecem juntos enquanto compartilham autenticação, schema, versão e ciclo de lançamento. Beauty Hub continua separado. Uma divisão futura só deve ocorrer quando houver aplicativo nativo, consumidor externo da API, equipe independente ou deploy realmente autônomo.
