# Modernização — primeira etapa

Data: **22/10/2026**. Direção: [plano oficial](../PLANO_MODERNIZACAO_BARBER_HUB.md).

Estado: **implementação local para revisão e continuidade**. Não houve commit, push, aplicação de migration remota ou deploy. O encerramento por etapa foi solicitado pelo responsável para permitir continuidade posterior; isso não conclui o plano geral.

## Entregas

- Inventário estático inicial: [inventario-inicial.json](inventario-inicial.json), com 249 arquivos de código/configuração, 110 declarações de rotas, referências de assets e ocorrências de acesso direto a dados no navegador. Candidatos sem referência não foram removidos. Prefixos de routers e referências dinâmicas ainda exigem análise humana.
- Baseline Python anterior à refatoração: **143 testes aprovados**. Snapshot do OpenAPI anterior: **90 paths**, em `tests/contracts/openapi-baseline.json`.
- Extração de **95 handlers em 18 routers por domínio**. Routers de conta, catálogo e health já existentes foram preservados. `api/index.py` passou de 1.352 linhas para 5, delegando a composição a `backend/application.py`.
- Extração de **52 modelos** antes concentrados em `backend/models.py` para 15 arquivos de schemas por domínio; o modelo de exclusão de conta já ficava em `backend/schemas/account.py`. `backend/models.py` permanece como fachada de compatibilidade, sem duplicar implementações.
- O OpenAPI completo foi comparado imediatamente antes/depois da extração e permaneceu idêntico. Novos endpoints foram adicionados depois; testes continuam comparando cada contrato anterior.
- Ports de contas e identidade em `backend/ports/`, adapters em `backend/integrations/` e composição em `backend/core/dependencies.py`. Os demais serviços ainda têm dependência direta do gateway e serão migrados por domínio.
- Perfil autenticado e alterações administrativas de conta passam pela API. Conta ativa, papel e sessão são verificados no servidor. Admin não pode alterar a própria conta nessa operação.
- Interface administrativa oferece suspensão, exclusão lógica e restauração, preservando a confirmação por modal compartilhado. Nenhuma dessas ações tem fallback para escrita direta no banco.
- Middleware valida o formato do request ID e inclui o identificador também em erros inesperados. CORS aceita PUT e expõe o request ID ao cliente.
- Cliente JavaScript aceita `window.BARBER_HUB_API_BASE_URL` antes de sua carga; padrão `/api/v1`. A configuração de origens permitidas da API precisa acompanhar uma futura separação de domínios.
- Novos comandos por responsabilidade, com suíte histórica mantida como `check:legacy`. CI configurado para instalar dependências bloqueadas, executar os testes locais e os testes de navegador.

## Migration preparada, não aplicada

Fonte: `supabase/migrations/20261022155131_modernizacao_contas_administrativas.sql`, criada pela CLI Supabase. Cópia numerada para a convenção local: `sql/41_modernizacao_contas_administrativas.sql`. **Não aplicar ambas**: representam a mesma migration. Verificador somente leitura: `sql/verificar_41_modernizacao_contas.sql`.

A migration:

1. adiciona estados de conta e data de exclusão lógica, preservando o campo `ativo`;
2. remove a edição direta de papel/status pelo navegador e preserva campos pessoais autorizados;
3. cria uma RPC exclusiva da service role que revalida o administrador, bloqueia autoalteração, serializa alterações, atualiza o alvo e grava auditoria na mesma transação;
4. protege o último administrador ativo também por trigger;
5. revoga sessões do alvo em alterações efetivas, sem apagar usuários ou dados de negócio;
6. valida sessões revogadas e expiradas, inclusive após restauração da conta;
7. adiciona políticas restritivas de conta/sessão ativa às tabelas públicas com RLS;
8. configura um hook de pre-request do PostgREST para bloquear contas/sessões inválidas também em RPCs SECURITY DEFINER. Se já existir outro hook, interrompe a aplicação para exigir composição explícita.

O conector Supabase foi usado **somente para leituras** de estrutura, triggers, políticas e configuração no projeto Barber Hub. A coluna `auth.sessions.not_after` e a ausência de hook pre-request existente foram confirmadas. Nenhuma senha, chave privada ou conta real foi usada nos testes.

As políticas restritivas afetam todo acesso autenticado a tabelas públicas com RLS. Antes da aplicação remota, é obrigatório testar usuários reais de homologação, Auth, Storage, Realtime, RPCs, onboarding e privacidade. Novas tabelas públicas com RLS deverão incluir a política correspondente. A API desta etapa depende das novas funções de sessão: **não publicar o código isoladamente antes da migration**.

## Evidências e limites

- Resultado local final: **157 testes Python, 4 testes JavaScript, 1 suíte transacional PostgreSQL com múltiplos cenários e 10 testes de navegador aprovados**. O comando agregado concluiu 15 verificações; o teste adicional de igualdade entre as cópias da migration foi validado na execução Python final.
- `npm run check`: executa sincronização mobile em modo de verificação, roteamento, análise responsiva estática, referências/sintaxe, suítes históricas, auditorias, compilação, testes Python, JavaScript e PostgreSQL em memória.
- Testes Python: autorização administrativa, estados inativos, sessão revogada, proteção da própria conta, contratos HTTP anteriores e saneamento do request ID, além das regressões anteriores.
- JavaScript: URL base configurável, token e request ID, rejeição sem sessão, ausência de retry em mutação ambígua e ausência de fallback administrativo ao banco.
- PostgreSQL em memória (PGlite): aplicação repetida da migration, privilégios, exclusão/restauração, preservação de registros, revogação de sessão, RLS, pre-request, último administrador e rollback diante de falha na auditoria. **Não é homologação do projeto Supabase completo nem teste de concorrência entre conexões independentes.**
- Navegador: 10 cenários com os scripts reais de autenticação/cliente e identidades/rede simuladas, incluindo larguras 360, 390, 412, 768 e 1440. **Não são snapshots visuais das páginas completas nem testes com Auth remoto.**
- A execução de CI foi configurada, mas não enviada ao GitHub. Resultado local não equivale a CI remoto executado.

Os relatórios locais ficam em `.tools/` e `test-results/`, ignorados pelo Git. O inventário inicial e o contrato anterior foram versionados como evidência reproduzível.

## Como executar

Ambiente padrão:

```text
uv sync --locked
pnpm install --frozen-lockfile
uv run npm run check
pnpm exec playwright install chromium
npm run check:browser
```

Neste computador foram instaladas ferramentas portáteis em `.tools/` e o ambiente Python em `.venv/`. No PowerShell:

```powershell
$env:PATH = "$pwd/.venv/Scripts;$pwd/.tools/node/node-v22.16.0-win-x64;C:/Program Files/Git/cmd;" + $env:PATH
$env:PYTHONUTF8 = '1'
npm.cmd run check
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm.cmd run check:browser
```

O Node precisou de execução fora do sandbox neste ambiente devido a `EPERM` ao resolver o diretório do usuário. Isso é uma limitação local, não uma dependência funcional do projeto.

Comandos específicos: `check:auth`, `check:admin`, `check:api`, `check:contracts`, `check:database`, `check:frontend`, `check:security`, `check:routing`, `check:mobile`, `check:css`, `check:legacy`, `check:browser` e `inventory`.

## Ponto de retomada

1. Ler este relatório, [BACKLOG.md](BACKLOG.md), o plano e o diff local. Preservar as alterações já realizadas; não reiniciar a refatoração.
2. Homologar a migration em um ambiente isolado com schema completo e múltiplas conexões. Verificar especialmente locks concorrentes, hook do PostgREST, estados de sessão, onboarding e fluxos de exclusão por privacidade.
3. Registrar capturas reproduzíveis das páginas completas em desktop, tablet e mobile, incluindo estados de modais e dados determinísticos. Os testes de navegador atuais cobrem controle de acesso, não a baseline visual.
4. Migrar CSS por responsabilidade em pequenos lotes, preservando cascata, temas e cache PWA. Nenhum CSS foi movido nesta etapa.
5. Continuar a auditoria de IDOR e a migração de operações do navegador para a API; extrair repositories dos serviços restantes por domínio.
6. Auditar e evoluir as filas existentes de e-mail/push/manutenção antes de criar novas; depois estabelecer contratos de eventos, recuperação e testes de resiliência.
7. Medir carga e latência, completar observabilidade e preparar a separação física da API somente quando os contratos e dependências estiverem independentes.

Para futura publicação, aplicar migration uma única vez, executar seu verificador, homologar por papel e publicar API/web/PWA coordenadamente. Rollback da aplicação precisa preservar compatibilidade com as novas restrições de banco; não remover proteções nem restaurar escrita administrativa do navegador como atalho.
