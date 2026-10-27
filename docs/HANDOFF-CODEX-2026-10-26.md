# Passagem de contexto para continuidade no Codex

Atualizado em 26/10/2026. Este documento registra o estado do trabalho local para que outra conta do Codex possa continuar sem descartar alterações nem depender do histórico anterior.

## Pedido e direção do projeto

### Continuação: apresentação VIZU ampliada em 26/10/2026

O usuário pediu uma apresentação mais completa, moderna, animada e responsiva, e forneceu o manual de identidade e o kit Web/PWA da VIZU. A página local agora inclui imagens das duas propostas, jornada interativa Barber/Beauty, princípios do ecossistema, perguntas frequentes e chamadas finais. Foram integrados SVGs e Montserrat do kit em `img/branding/vizu/`, com origem e licença registradas nessa pasta. A referência de marca passou a ser o kit fornecido; a marca desenhada anteriormente não é mais usada pela página.

Há animações de entrada, elementos orbitais, cartões flutuantes, transição de jornada, conexão animada e progresso de leitura. O rodapé permite pausar movimentos; a preferência de movimento reduzido do dispositivo é respeitada. A marca não é deformada nem rotacionada. A página também mantém conteúdo e navegação sem JavaScript. O cache PWA foi atualizado para incluir os novos recursos.

Validação desta continuação: 10 cenários VIZU aprovados (320/360/390/768/1440 px, menu, teclado, jornadas, FAQ, pausa, ausência de JavaScript e movimento reduzido); validadores de frontend, CSS, rotas e sincronização mobile executados. Capturas de revisão em `test-results/vizu-new-1440.png` e `test-results/vizu-new-390.png`. As suítes completas de API/banco e os 50 snapshots legados não foram repetidos nesta alteração visual isolada. Tudo permanece local, sem commit ou publicação.

Os registros seguintes descrevem a primeira implementação e devem ser lidos junto desta atualização.

O usuário está preparando uma apresentação para uma feira de tecnologia sobre a VIZU e suas co-plataformas Barber Hub e Beauty Hub. O pedido direto foi criar uma nova página VIZU, premium, moderna e animada, com uma apresentação curta e divisão equilibrada entre Barber Hub e Beauty Hub. A referência visual anexada usa carvão/preto, marfim e dourado discreto, marca angular VIZU com seta ascendente, tesoura/pente e a assinatura “BELEZA • ESTILO • BEM-ESTAR”.

O texto de missão foi fornecido em `C:\Users\fabri\.codex\attachments\bcaa4df7-bd59-4c91-9c7a-33bd8ce38948\Texto colado.txt`. Ele orienta a diagnosticar antes de alterar, registrar evidências, separar fatos de afirmações, priorizar demonstração estável e evitar uma refatoração ampla sem necessidade para a feira. A implementação realizada foi restrita à página e aos ajustes necessários para integrá-la ao Barber Hub.

Há também um pedido anterior, ainda relevante para o trabalho da modernização: quando o usuário informar que restam 10–14% de uso, concluir uma etapa segura, documentar o ponto de parada e deixar a continuação preparada. O agente não tem acesso ao indicador de uso da conta; deve reagir quando o usuário informar esse percentual, sem alegar que consegue monitorá-lo.

## Diagnóstico do repositório

Este repositório é do Barber Hub. Não é o repositório do Beauty Hub nem um repositório VIZU independente. Foi encontrada uma página de ponte existente em `html/beauty-hub.html`; isso não comprova o estado funcional do produto Beauty Hub. O outro repositório e seu deploy ainda precisam ser inspecionados antes de afirmar que o Beauty Hub está operacional.

O diagnóstico da feira está em [DIAGNOSTICO-FEIRA.md](DIAGNOSTICO-FEIRA.md). Ele reúne o inventário feito, evidências, riscos, prioridades e uma proposta de trabalho em quatro dias. `docs/README.md` aponta para esse documento. Não foi feita alteração de banco, Supabase, autenticação real, deploy ou dados de produção.

O briefing mais amplo de modernização do Barber Hub continua sendo direção arquitetural de longo prazo. A missão da feira recomenda manter o escopo imediato controlado; não iniciar agora uma migração ampla de CSS/API, separação de repositórios ou microsserviços sem necessidade demonstrável para a apresentação.

## Trabalho implementado, ainda local

A página VIZU foi criada em `vizu.html`, com estilos próprios em `css/vizu.css`, interações em `js/vizu.js` e marca vetorial original em `img/branding/vizu-mark.svg` (inspirada na referência fornecida; não havia arquivo oficial da marca no diretório de branding). A página tem introdução curta, duas áreas de plataforma em proporção equivalente, links externos, navegação responsiva e animações com suporte a `prefers-reduced-motion`. Evita carregar os estilos legados do site para manter o visual isolado.

Foram feitos os ajustes de integração: links para VIZU nas páginas raiz/mobile e no rodapé de sobre, URL `/vizu` no sitemap, mapa de navegação, documentação de CSS, precache no service worker e reconhecimento da página standalone no validador do projeto. O espelho mobile foi regenerado pelo script oficial.

Foi adicionada a suíte `tests/browser/vizu.spec.js`, cobrindo estrutura e links, ausência de overflow em 360/768/1440 px, menu mobile/tecla Escape e movimento reduzido. O job `check:browser` inclui esses casos.

## Validação local já concluída

As verificações abaixo passaram depois das alterações:

- `npm run check`: 16 verificações; inclui 157 testes Python, 4 JavaScript, suíte transacional de banco com PGlite e validações estáticas. Relatório indicou 51 páginas HTML, 48 scripts JavaScript, referências locais/IDs/segredos, 27 controles estáticos de segurança V01–V06 e sincronização de 22 páginas mobile.
- `npm run check:browser`: 15/15 passaram (10 testes de limites de acesso existentes + 5 testes VIZU).
- `npm run check:visual`: 50/50 snapshots passaram, sem atualizar snapshots.
- `git diff --check`: sem erros de whitespace. Git apenas avisou sobre conversão normal LF→CRLF em `css/README.md`.

Os testes de Playwright foram executados com o Chromium fixado pelo projeto. Não definir `PLAYWRIGHT_CHANNEL=chrome`, pois a versão instalada do Chrome pode variar. Screenshots de inspeção visual foram geradas em `test-results/vizu-hero-desktop.png` e `test-results/vizu-platforms-desktop.png`; essa pasta é ignorada pelo Git e pode não estar presente em outra máquina.

Ambiente observado: Python portátil em `.venv/Scripts/python.exe` (3.13.17), Node em `.tools/node/node-v22.16.0-win-x64/node.exe` (22.16.0), npm no mesmo diretório e uv em `.tools/uv/uv.exe` (0.13.5). Em uma execução anterior, chamar Node/npm pelo sandbox padrão resultou em `EPERM` ao resolver `C:\Users\fabri`; a execução com elevação foi autorizada e os testes locais passaram. Isso não significa que os testes devam ser repetidos sem motivo.

Há um aviso não bloqueante de depreciação de `Starlette TestClient` nos testes FastAPI.

## CI, commit e publicação

Todas as alterações descritas estão **somente na cópia local e sem commit**. No começo desta passagem, `HEAD` é `d905529c4b352d830a7424a99d3c55b9d1a60deb`, branch `main`, alinhada com `origin/main`; as mudanças listadas abaixo são o trabalho pendente. Não houve push nem deploy. Não use reset/checkout destrutivo para “limpar” a árvore.

Em uma captura anterior do GitHub para o commit `cdc175c`, `Qualidade e segurança / validate (push)` e Vercel passaram, mas `Qualidade e segurança / browser (push)` falhou após cerca de três minutos. `docs/modernizacao/ETAPA_2.md` registra que os dez casos funcionais passaram e as 50 comparações visuais falharam entre Windows local e Windows Server por diferenças de rasterização de aproximadamente 1–3% e altura de até 5 px; a tolerância de 4% já existe e as 50 comparações passaram localmente com Chromium fixado. Isso é o histórico do commit anterior, não uma execução remota das alterações VIZU.

Não foi possível obter uma execução atual do GitHub Actions através das ferramentas conectadas. Para validar remotamente as alterações novas, será necessário primeiro revisar e então commitar/enviar conforme a autorização do usuário, e acompanhar o workflow do push. Não afirmar que o job remoto está corrigido antes desse resultado. Após deploy autorizado, confirmar que `/vizu` abre no domínio público e revisar o site em desktop e celular.

## Estado de Git capturado nesta passagem

Modificados:

```text
css/README.md
docs/MAPA_DE_NAVEGACAO.md
docs/README.md
html/sobre.html
index.html
mobile/index.html
mobile/sobre.html
package.json
scripts/check-project.js
service-worker.js
sitemap.xml
```

Novos:

```text
css/vizu.css
docs/DIAGNOSTICO-FEIRA.md
img/branding/vizu-mark.svg
js/vizu.js
tests/browser/vizu.spec.js
vizu.html
```

Este handoff também é um novo arquivo. Confirme `git status --short --branch` antes de qualquer ação para considerar alterações feitas depois desta captura.

## Pontos pendentes e sequência sugerida

1. Reabrir este arquivo e `docs/DIAGNOSTICO-FEIRA.md`; conferir o `git status` antes de editar. Preservar todas as mudanças locais.
2. Fazer uma revisão visual/funcional final da página e uma revisão do diff, corrigindo somente problemas observados.
3. Se o usuário pedir publicação/commit, executar novamente os checks necessários, commitar o conjunto aprovado e acompanhar o workflow remoto; até lá, não alegar deploy.
4. Confirmar URLs públicas e estado real das plataformas. A extração de Beauty Hub exige acesso ao repositório/deploy correspondente; a página de ponte do Barber Hub não basta como prova.
5. Preparar ensaio da feira com dados de demonstração: marketplace → estabelecimento → agendamento e painel profissional/agenda no Barber Hub; validar fluxos reais de Beauty Hub apenas após inspecionar seu projeto.
6. No dia anterior, testar desktop/celular, links/QR, conexão e plano alternativo de rede; congelar alterações não essenciais.

Gates já identificados no diagnóstico: a migration `supabase/migrations/20261022155131_modernizacao_contas_administrativas.sql` permanece sem homologação/aplicação; V06/Turnstile, Auth/RLS com contas de teste reais, Storage/Realtime e backups precisam de validação própria. Não aplicar migration nem usar dados reais como parte de uma demonstração sem validação e autorização correspondentes.

## Comandos úteis de validação

No PowerShell, da raiz do repositório:

```powershell
$env:PYTHONUTF8 = '1'
$env:PATH = "$(Resolve-Path '.venv/Scripts');$(Resolve-Path '.tools/node/node-v22.16.0-win-x64');$env:PATH"
npm run check
npm run check:browser
npm run check:visual
git diff --check
git status --short --branch
```

Rode apenas a validação necessária para o próximo passo; os três grupos de testes passaram na cópia local no momento deste registro. Para qualquer tarefa que envolva Supabase, leia as instruções de `C:\Users\fabri\.codex\plugins\cache\openai-curated-remote\supabase\1.0.0\skills\supabase\SKILL.md` e confira a documentação atual antes de alterar implementação ou infraestrutura.

## Proteção de contexto e segurança

### Atualização posterior: redesign do Barber Hub

O usuário ampliou o escopo para modernizar o visual de todo o Barber Hub, reduzindo imagens genéricas e incluindo animações e responsividade. Implementação e limites estão em [REDESIGN-BARBER-HUB-2026-10-26.md](REDESIGN-BARBER-HUB-2026-10-26.md). Preservar também as alterações anteriores de Vizu, Beauty Hub e arquitetura; este trabalho não autoriza publicar nem aplicar a migração pendente.

Não há credenciais ou tokens neste handoff. Não copiar valores de `.env`, não expor chaves privilegiadas e não usar contas/dados reais nos testes de feira. Nenhuma extensão/plugin foi necessária para a implementação local. O trabalho deve continuar no repositório e na branch já existentes; não recriar o projeto nem substituir arquivos locais por uma cópia remota.
