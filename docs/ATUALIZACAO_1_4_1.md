# Barber Hub 1.4.1

Versão de correção visual e início oficial do backend próprio.

## Interface

- cartões de planos reorganizados para impedir colisão entre benefício e botão;
- recomendação de público separada da lista de recursos;
- menu desktop com agrupamento visual e alinhamento consistente;
- cabeçalho mobile com símbolo, título da tela e subtítulo alinhados à esquerda;
- métricas mobile em grade compacta, sem faixa excessivamente longa;
- cartões de planos empilhados no celular;
- espaçamentos, campos e botões refinados para toque.

## Suporte

- página redesenhada com hero, status da API e atalhos por assunto;
- formulário mais claro, dicas de segurança e contador de mensagem;
- histórico com protocolo, status e resposta;
- perguntas rápidas e estados vazios mais úteis;
- integração da abertura e listagem de tickets com a API própria.

## Backend

- API v1 na pasta `api/`;
- cliente em `js/backend-api.js`;
- métricas públicas, suporte, exclusão de conta e resumo administrativo;
- chave `service_role` mantida somente nas variáveis protegidas da Vercel;
- fallback local temporário para páginas abertas somente pelo Live Server;
- Service Worker impedido de armazenar respostas de `/api/`.

## Banco

Esta versão não cria tabelas nem altera colunas. Nenhuma migration SQL nova é
necessária. A migration 13 corrigida continua sendo a última migration do banco.
