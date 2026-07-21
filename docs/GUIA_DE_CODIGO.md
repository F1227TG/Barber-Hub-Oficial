# Guia de código — Barber Hub 1.4.0

Este documento explica onde cada parte do sistema deve ser alterada. O objetivo é evitar regras duplicadas e facilitar a manutenção.

## Ordem de carregamento dos estilos

1. `css/framework.css`: importa o Bootstrap local dentro de uma camada de fornecedor.
2. `css/global.css`: tokens de tema, reset, componentes compartilhados e responsividade global.
3. `css/index.css`: somente a página inicial.
4. `css/pages.css`: páginas internas e painéis.

As cores nunca devem ser escritas diretamente em componentes comuns. Use `var(--text)`, `var(--muted)`, `var(--surface)`, `var(--border)` e os demais tokens de `:root`. Isso mantém os temas escuro e claro consistentes.

## Organização do JavaScript

- `supabase-config.js` e `supabase-client.js`: conexão pública com o Supabase.
- `api.js`: única camada para consultas e alterações de dados.
- `auth.js`: sessão e proteção de páginas.
- `utils.js`, `toast.js`, `status.js` e `ui.js`: recursos compartilhados.
- Arquivos com nome de página, como `barbearia.js`, `painel.js` e `planos.js`: comportamento exclusivo daquela tela.

Evite consultas Supabase diretamente dentro de páginas novas. Adicione a operação em `api.js` e consuma a função na tela.

## Padrão de uma página

1. Estado local da página.
2. Funções puras de formatação e cálculo.
3. Funções de renderização.
4. Operações assíncronas.
5. Eventos.
6. Inicialização.

## Correção de contraste 1.3.2

O Bootstrap define variáveis próprias de cor. Elas agora apontam para os tokens do Barber Hub, e títulos/cartões recebem cor explícita. Dessa forma, títulos não ficam pretos no tema escuro e os dois temas continuam sincronizados.

## Cartões de planos

O cartão de plano atual possui espaçamento interno próprio, colunas flexíveis e estatísticas com altura mínima. Os cartões comerciais crescem conforme o conteúdo; não use alturas fixas para textos variáveis.

## Checklist antes do commit

- Executar `node --check` nos arquivos JavaScript.
- Abrir páginas em tema escuro e claro.
- Testar larguras de 390 px, 768 px e 1366 px.
- Confirmar que textos longos não saem dos cartões.
- Atualizar o nome do cache no `service-worker.js` quando arquivos estáticos mudarem.


## Experiência responsiva 1.4.0

- `css/mobile-app.css`: contém somente a camada de adaptação para tablet e celular.
- `js/mobile-app.js`: adiciona cabeçalho contextual, atalhos, filtros mobile e ações fixas.
- `js/ui.js`: cria menu por perfil, drawer, badges e dock inferior.
- `js/home.js`: carrega e anima os indicadores públicos da página inicial.

Ao corrigir um problema exclusivamente mobile, prefira alterar `mobile-app.css` ou `mobile-app.js`, evitando espalhar regras responsivas em vários arquivos.
