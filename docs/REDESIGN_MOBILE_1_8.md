# Barber Hub 1.8 — Redesign Mobile

## Direção

A interface `/mobile` deixa de ser apenas uma redução do desktop e passa a priorizar rapidez, ação e leitura curta. O desktop continua mais institucional e explicativo; o mobile mostra primeiro o que o usuário precisa fazer.

## Mudanças principais

- removida a ação visual de instalar aplicativo em todas as 23 páginas mobile;
- shell mobile refinado com logo compacta oficial, header menor, dock flutuante e espaçamento por safe area;
- bloco de visitante/usuário do drawer agora é clicável e leva ao login ou à conta;
- footer institucional ocultado no mobile para reduzir ruído e comprimento das páginas;
- heroes, textos e seções mobile reduzidos para uma leitura mais objetiva;
- Home usa o barber pole oficial como elemento visual em vez das listras simuladas em CSS;
- Portal passa a priorizar busca e filtros logo no topo;
- filtro do marketplace redesenhado como bottom sheet de e-commerce, com opções grandes, footer fixo e gesto para fechar;
- página pública da barbearia reforça capa, status, preço/serviços e CTA sticky de agendamento;
- agendamento recebe tratamento mais próximo de app, com progresso e ações fixas;
- painel profissional recebe navegação horizontal compacta e melhor organização dos KPIs/seções;
- Sobre reduz conteúdo redundante no mobile e recebeu correções de espaçamento compartilhadas com desktop;
- Planos usam cards horizontais com scroll/snap no mobile;
- Beauty Hub fica resumido como teaser, sem roadmap extenso no celular;
- páginas técnicas e institucionais foram compactadas sem remover conteúdo obrigatório de Termos/Privacidade;
- Conta foi transformada em um hub interativo para cliente, profissional e admin, com áreas de Perfil, Segurança e Privacidade;
- profissionais recebem atalhos para Meu negócio e Plano; clientes recebem Minha agenda e Explorar;
- novo editor de imagens reutilizável com crop, zoom, arraste e rotação;
- editor aplicado a avatar, foto de profissional, foto/capa do estabelecimento, onboarding e novas imagens de portfólio;
- portfólio permite escolher proporção Original, 1:1, 4:5 ou 16:9 antes do upload;
- capa usa enquadramento central ajustável para preservar o foco em diferentes cortes.

## Arquivos principais adicionados

- `css/mobile-redesign-1.8.css`
- `css/image-editor.css`
- `js/mobile-redesign-1.8.js`
- `js/image-editor.js`

## Arquivos principais alterados

- `js/ui.js`
- `js/mobile-shell-v1.7.js`
- `js/conta.js`
- `js/painel.js`
- `js/onboarding.js`
- `css/release-1.8.css`
- `scripts/sync_mobile_pages.py`
- `service-worker.js`
- `mobile/index.html`
- `html/conta.html`
- `html/painel.html`
- `html/cadastro-barbearia.html`
- `html/mapa-sistema.html`

## Validação

O projeto continua respeitando a sincronização `/html` → `/mobile`. O script de sincronização injeta automaticamente a camada mobile exclusiva nas páginas geradas.

`npm run check` foi executado após as alterações e todos os testes/invariantes da versão 1.8 passaram.

## Teste manual recomendado antes de produção

Testar fisicamente em 360×800, 390×844 e 430×932, incluindo:

- visitante, cliente, profissional e admin;
- teclado aberto em formulários;
- filtro do Portal;
- bottom sheets/modais;
- upload e edição de fotos;
- portfólio com múltiplas fotos;
- dock + CTA sticky da página da barbearia;
- modo claro/escuro;
- Android Chrome e Safari iOS quando possível.
