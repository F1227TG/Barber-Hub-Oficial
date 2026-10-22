# Etapa 2 — baseline visual e primeira extração do CSS

Trabalho local em 22/10/2026, continuando a Etapa 1. Encerramento solicitado ao usuário informar 16% de uso restante, para preservar margem de continuidade. O indicador da conta não é consultável por esta sessão.

## Entrega

- 50 capturas de referência das páginas **reais** de login, marketplace, conta e administração: larguras 360, 390, 412, 768 e 1440, temas claro/escuro, além de privacidade e filtros nas cinco larguras.
- HTML, CSS e scripts de produção são executados. Auth, consultas e respostas de API usam dados fictícios; recursos externos permitidos são servidos por fixtures locais. Chamadas inesperadas e erros JavaScript fazem o teste falhar. Asserções de conteúdo evitam capturar apenas telas de carregamento; há verificação de overflow horizontal da página.
- Fontes Inter e Bootstrap Icons armazenadas somente para testes, com origem, SHA256 e licenças em `tests/fixtures/fonts/`. O script `scripts/cache_visual_fonts.py` atualiza essas cópias de forma explícita; não é executado durante testes ou CI.
- Chromium fixado pelo Playwright instalado localmente. Configuração de CI de navegador mudou para Windows para usar a mesma plataforma da baseline. Snapshots faltantes não são aceitos automaticamente.
- Nove fontes CSS, organizadas por responsabilidade, geram o mesmo `css/releases/release-1.11.css`, preservando o endereço público, os links das páginas e a cascata. O trecho de 256 linhas que ainda mistura domínios está identificado em `css/legacy/workspace-overrides.css`.
- `build:css`, `check:visual` e `visual:update` adicionados. `check:css` e o pipeline agregado detectam bundle desatualizado, fonte ausente do manifesto e fonte duplicada.

## Evidências e limites

A baseline foi criada **antes** da extração. As 885 linhas foram preservadas, com normalização de finais de linha para LF. SHA256 do conteúdo antes e depois:

```text
276f8dcb6ed0709e5c3009f3a0ab9474d58dc2d179dbafa6e2ada229e472dd10
```

O mapa de origem dos módulos, versão do navegador e dimensões estão em [baseline-visual.json](baseline-visual.json). Imagens esperadas ficam em `tests/browser/visual.spec.js-snapshots/`; falhas geram imagens atual/esperada/diferença e traces em `test-results/`.

Apenas a latência variável exibida no cartão de saúde da API administrativa é mascarada nas imagens. A data é fixa e os dados são sintéticos. Os testes não comprovam Auth, CAPTCHA, RLS ou operações reais no Supabase; também não cobrem ainda agendamento completo, painel profissional, planos, assinaturas, todos os modais ou toda a acessibilidade. As consultas simuladas do SDK não reproduzem filtros/autorização do banco.

Snapshots são específicos de Windows e do Chromium fixado. O CI remoto ainda não foi executado; diferenças de rasterização do ambiente remoto devem ser investigadas antes de aceitar outra baseline. Linux/macOS exigem baseline própria ou execução no ambiente de referência. Não usar `PLAYWRIGHT_CHANNEL=chrome` para comparar estas imagens com um Chrome de versão variável.

Na inspeção apareceu um pequeno marcador vermelho sem texto nas capturas, inclusive no marketplace público; ele já estava presente antes da extração. A causa ainda precisa ser diagnosticada, sem escondê-lo no teste. Preservação visual não significa ausência de defeitos anteriores.

## Banco de dados

Não havia branch de homologação Supabase nem Docker/PostgreSQL local disponíveis. A tentativa de criar uma branch foi recusada pelo conector por exigir confirmação de custo. **Nenhuma branch foi criada e nenhuma migration remota foi aplicada.** Para prosseguir pela opção hospedada, consultar o preço da organização e obter confirmação explícita desse custo, exigida pelo próprio conector. Outra opção é preparar PostgreSQL/Supabase local isolado.

DB-001 permanece aberto: testes com schema completo, conexões concorrentes, Auth, Storage, Realtime e PostgREST são necessários. A API da Etapa 1 depende da migration 41: não publicar API/web isoladamente. Não houve commit, push ou deploy nesta etapa.

## Execução e retomada

```powershell
$env:PATH = "$pwd/.venv/Scripts;$pwd/.tools/node/node-v22.16.0-win-x64;C:/Program Files/Git/cmd;" + $env:PATH
$env:PYTHONUTF8 = '1'
Remove-Item Env:PLAYWRIGHT_CHANNEL -ErrorAction SilentlyContinue
npm.cmd run build:css
npm.cmd run check
npm.cmd run check:browser
npm.cmd run check:visual
```

Para preparar outro computador Windows: instalar dependências bloqueadas e executar `pnpm exec playwright install chromium`. `npm run visual:update` é reservado a mudanças visuais intencionais e revisadas; manter a execução normal sem essa opção.

Próximas ações:

1. Ler este relatório, a Etapa 1, o backlog e o diff local; preservar todo trabalho ainda não commitado.
2. Resolver DB-001 antes da publicação coordenada da migration/API/web.
3. Diagnosticar o marcador vermelho observado; adicionar cenário de comportamento se for um estado incorreto de componente.
4. Ampliar fixtures e capturas para cliente/agendamento, profissional, assinaturas, notificações e demais modais. Validar também contraste, foco, conteúdo interno rolável e alvos de toque; overflow da página não cobre esses casos.
5. Extrair o CSS legado restante por domínio com essa cobertura, depois migrar os releases anteriores. Evitar mudar ordem/especificidade e estrutura ao mesmo tempo.
6. Retomar auditoria de IDOR, repositories dos demais domínios, filas existentes e medições conforme o plano oficial.

## Resultado final local

- `npm run check`: **16 verificações aprovadas**, incluindo 157 testes Python, 4 testes JavaScript e 1 suíte transacional PGlite com múltiplos cenários. Resultado agregado em `test-results/checks.json`.
- `npm run check:visual`: **50 testes aprovados após a extração**, comparando com os snapshots anteriores, sem `--update-snapshots` (2,3 minutos).
- As 50 imagens de referência ocupam aproximadamente 9,81 MiB e ficam no repositório para revisão futura.
- `git diff --check`: nenhuma falha de whitespace. Avisos locais de conversão LF/CRLF não alteram a comparação textual normalizada do builder.
- Os 10 cenários de controle de acesso da Etapa 1 permanecem disponíveis em `check:browser`; não foram reexecutados nesta etapa, que não alterou seus scripts de produção.

Etapa encerrada com alterações locais preservadas e sem publicação. O plano completo continua em andamento; este relatório define o ponto de continuação.
