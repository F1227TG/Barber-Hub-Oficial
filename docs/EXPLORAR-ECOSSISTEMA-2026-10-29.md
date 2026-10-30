# Explorar compartilhado — 29/10/2026

Barber 1.11.2, Beauty 1.2.1 e VIZU 1.1.0 mantêm repositórios independentes. O padrão de busca, categorias, filtros removíveis, cartões e descoberta local é compartilhado; cada produto mantém sua identidade e seus contratos de dados.

## Funcionalidades

- Barber: busca por serviço/cidade, categorias, filtros existentes, paginação da API e links de agendamento preservados. Hero e composição responsivos com imagens WebP fornecidas.
- Beauty: busca por negócio, serviço ou profissional, cidade, categoria, modalidade, orçamento/preço fixo, faixa de preço, avaliação, ordenação, favoritos persistidos e carregamento adicional em lotes de 24.
- Os filtros Beauty trabalham sobre os lotes carregados e informam essa limitação enquanto houver mais resultados. Preços sob orçamento não viram ofertas de R$ 0; taxas de deslocamento não entram no filtro por serviço.
- VIZU: página independente `explorar.html`, especialidades ilustrativas claramente identificadas e encaminhamento de cidade/serviço para as duas plataformas. Não é um catálogo unificado de negócios reais.

## Experiência Beauty em celular e tablet

As 24 páginas incluem navegação inferior. Clientes acessam Explorar, Agenda, Favoritos e Conta; profissionais acessam Resumo, Agenda, Serviços e Mais. O painel Mais inclui orçamentos, equipe, clientes, negócio e preferências.

Os filtros abrem em diálogo nativo abaixo de 1024px, com foco contido, Escape, fechamento e retorno ao botão de origem. Os controles permanecem no formulário. No tablet a navegação fica centralizada; campos têm texto de 16px para evitar zoom involuntário. A barra considera a área segura e é ocultada quando o teclado reduz o viewport. Animações respeitam movimento reduzido e a preferência já existente.

## Dados, imagens e operação

As imagens fornecidas nos ZIPs são ilustrativas e usadas nas seções editoriais. Cartões de negócios usam sua própria foto pública ou monograma; não recebem avaliações, preços ou fotos fictícias. Fotografias WebP reduzem o peso em relação aos PNGs anteriores.

A parte visual não exige nova variável de ambiente. Google e CAPTCHA da Beauty continuam dependendo da ativação externa registrada anteriormente. A arquitetura da API do Barber foi preservada.

Durante a verificação pública foi identificado um erro no hook `validar_acesso_conta`: a expressão SQL com `AND` resolvia a referência ao schema privado mesmo para visitantes. A migração corretiva `public_account_hook` separa o retorno anônimo em outro comando, sem conceder acesso ao schema privado nem alterar a validação de contas autenticadas. Foi aplicada após teste PGlite com verificação de privilégios, contas inativas e idempotência. A busca pública voltou a responder HTTP 200.

A API independente `barberhubapi.vercel.app` ainda respondeu `BACKEND_NOT_CONFIGURED` na rota de catálogo; o frontend publicado continua usando a API do próprio domínio. Não houve troca de tráfego para essa API nesta entrega.

## Validação

- Barber: pipeline `npm run check` com 16 verificações; testes de Explorar em cinco larguras e dois temas.
- Beauty: testes de preços, 28 verificações de interação e 192 cenários de responsividade; nova navegação inferior, filtros, favoritos, cadastro, agendamento e gestão com dados controlados.
- VIZU: 18 cenários de navegador abrangendo apresentação existente e Explorar.
- Consulta pública real da Beauty com serviços/profissionais e foto de capa; saúde das APIs Barber. Testes de interface usam dados controlados e não criam reservas reais.

## Publicação

- Beauty: commit `a56df20`, deployment `dpl_3tgQVQL5ZPgLugsx2wr2A8xXt6ki`, promovido em `https://beautyhuboficial.vercel.app`. Catálogo real, imagens, menu e filtros conferidos no navegador em 390, 768, 1024 e 1440px. PR 2 aberta para revisão.
- Barber: commit `f715e66`, deployment `dpl_JAaMXEw6PyYM2UCsVyYTtadddLdo`, promovido no projeto existente. API `/api/v1/health` respondeu pronta antes da promoção. PR 1 permanece em revisão.
- VIZU: commit `5a4f207`, deployment `dpl_3pww5DCxN3uU7vZqmweZCgMDbrPo`, promovido em `https://vizu-oficial.vercel.app`. PR 1 criada em rascunho.

O endereço `vizu-oficial.vercel.app` foi associado novamente ao projeto como domínio público. VIZU e Barber foram conferidos no navegador público em 390 e 1440px. Uma correção adicional de carregamento enfileira a última busca do Barber quando a cidade muda durante uma requisição; o teste reproduz duas cidades em sequência.

O deployment final do Barber, incluindo essa correção, é `dpl_3ELypysGuGMVWrxU6ymnu2TAmu2P`. A migração aplicada foi registrada no Supabase como `20261029213446_public_account_hook`. O pipeline completo foi repetido após a correção e manteve os 16 checks aprovados.

Nenhuma PR foi mesclada nesta entrega. O ZIP local `.tools/releases/Barber-Hub-Oficial-1.11.2.zip` preserva a pasta raiz e contém somente a distribuição pública e o backend necessário, sem credenciais ou ferramentas locais.
