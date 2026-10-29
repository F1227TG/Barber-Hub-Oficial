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

Sem migração de banco ou nova variável de ambiente. Google e CAPTCHA da Beauty continuam dependendo da ativação externa registrada anteriormente. Esta entrega não altera a autenticação nem a arquitetura da API do Barber.

## Validação

- Barber: pipeline `npm run check` com 16 verificações; testes de Explorar em cinco larguras e dois temas.
- Beauty: testes de preços, 28 verificações de interação e 192 cenários de responsividade; nova navegação inferior, filtros, favoritos, cadastro, agendamento e gestão com dados controlados.
- VIZU: 18 cenários de navegador abrangendo apresentação existente e Explorar.
- Consulta pública real da Beauty com serviços/profissionais e foto de capa; saúde das APIs Barber. Testes de interface usam dados controlados e não criam reservas reais.

Publicação e hashes devem ser conferidos no histórico Git e nos deployments; a passagem de testes locais não equivale à confirmação da versão publicada.
