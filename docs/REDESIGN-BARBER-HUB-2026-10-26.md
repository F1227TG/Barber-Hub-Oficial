# Redesign visual do Barber Hub — 26/10/2026

Implementação local solicitada após os trabalhos de Vizu e Beauty Hub. Esta mudança amplia expressamente o escopo anterior de apresentação para a interface compartilhada do Barber Hub. Não é uma publicação nem uma migração de banco.

## Direção visual

Carvão com leve tom verde, dourado fosco, superfícies mais simples e melhor hierarquia. O tema claro acompanha a mesma linguagem. Fundos fotográficos genéricos da home, marketplace, apresentação institucional e ponte Beauty dão lugar ao conteúdo. As fotos e portfólios cadastrados pelos estabelecimentos continuam sendo usados.

- Home desktop e mobile com apresentação interativa dos caminhos de cliente e profissional, links reais e indicação de conteúdo ilustrativo.
- Cartões do marketplace com altura flexível para acomodar informações sem sobreposição.
- Componentes compartilhados de navegação, formulários, conta, indicadores, administração e painel profissional atualizados.
- Capa padrão vetorial original em `img/placeholders/barber-editorial.svg`, sem fotografia gerada. Capas escolhidas pelo estabelecimento, inclusive da biblioteca existente, são preservadas.
- Animações curtas de entrada e interação. Conteúdo permanece visível antes da rolagem. Preferências de movimento reduzido do sistema e do aplicativo são respeitadas.

## Manutenção

As fontes são `css/core/editorial.css` e `css/pages/editorial-public.css`, acrescentadas ao final de `css/bundles.json`. O bundle de compatibilidade continua em `css/releases/release-1.11.css`; gerar com `python scripts/build_css.py`. Não editar o arquivo compilado.

`js/core/experience.js` controla a prévia e entradas progressivas. `js/ui.js` deixa de ocultar conteúdo aguardando o observador de rolagem. Não há dependências adicionais de animação.

As 22 páginas em `mobile/` são geradas de `html/` por `python scripts/sync_mobile_pages.py`. A home mobile é independente e recebeu o mesmo conteúdo interativo. O cache PWA foi identificado com o sufixo `editorial-r1`.

## Verificação e limites

Executar `python scripts/check.py` para contratos, estrutura, sincronização, segurança e testes locais. A suíte `tests/browser/editorial.spec.js` cobre os caminhos da home, teclado, movimento reduzido e ausência de overflow em 360, 390, 412, 768 e 1440 pixels, nos dois temas. As referências de `visual.spec.js` foram atualizadas para a mudança intencional de design, após revisão de capturas representativas.

Os testes de navegador usam identidades e respostas sintéticas, sem acesso a serviços reais. A cobertura visual automatizada de áreas autenticadas inclui conta e administração; não equivale à homologação operacional de todos os estados da agenda e do financeiro profissional. Backend, permissões e regras de negócio permanecem fora desta mudança. Não houve commit, deploy ou aplicação da migração administrativa pendente.

Resultado local: 16 checks gerais aprovados (incluindo 157 testes Python, contratos frontend e banco efêmero). Os 98 cenários de navegador foram aprovados entre a execução principal e reexecuções dirigidas: 50 visuais, 10 de acesso, 10 de Vizu, 10 da home e 18 de páginas públicas. As últimas seis reexecuções ajustam a expectativa de navegação para páginas legais e recuperação de senha, que têm cabeçalho simplificado.

A inspeção visual também corrigiu o espaço de rolagem criado pelo painel de filtros mobile fechado e ocultou o indicador de conexão quando inativo. Os arquivos antigos de imagens permanecem disponíveis por compatibilidade, embora os fundos decorativos e padrões substituídos deixem de ser apresentados.
