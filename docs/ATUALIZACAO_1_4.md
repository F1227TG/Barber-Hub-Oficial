# Barber Hub 1.4.0 — redesign responsivo e experiência de aplicativo

A versão 1.4.0 reorganiza a experiência mobile sem alterar as regras do banco de dados. O objetivo é deixar o Barber Hub mais prático, menos poluído e mais próximo de um aplicativo de serviços.

## Principais mudanças

- nova faixa de indicadores da página inicial, com cartões, ícones e atualização animada;
- cabeçalho mobile compacto e contextual para cada página;
- dock inferior com cinco acessos e ação principal destacada;
- menu lateral transformado em folha inferior no celular;
- filtros do portal transformados em modal inferior, com contador e atalhos rápidos;
- cartões de estabelecimentos compactos no celular;
- página pública reorganizada, com serviços antes das informações secundárias;
- botão de agendamento fixo na página do estabelecimento;
- métricas do cliente, profissional e administrador em carrosséis de leitura rápida;
- painel profissional com status rápido e navegação horizontal compacta;
- painel administrativo com indicadores e filtros adaptados para toque;
- planos em carrossel mobile e cartão do plano atual mais legível;
- formulários, modais, tabelas, estados vazios e botões ajustados para telas pequenas;
- suporte a áreas seguras de aparelhos com notch;
- manifesto PWA ampliado com atalhos de Explorar e Agendar;
- cache do Service Worker atualizado para `barberhub-v1.4.0`.

## Arquivos principais

- `css/mobile-app.css`: toda a camada responsiva da versão 1.4;
- `js/mobile-app.js`: cabeçalho contextual, filtros mobile, atalhos e barra fixa;
- `js/ui.js`: dock inferior por perfil e integração da interface;
- `js/home.js`: animação dos indicadores públicos;
- `manifest.webmanifest`: opções adicionais do PWA;
- `service-worker.js`: cache da versão 1.4.

## Banco de dados

Esta atualização é de interface e PWA. Não existe migration SQL nova para a versão 1.4.0.

## Testes recomendados após o deploy

1. Atualize usando `Ctrl + Shift + R` no computador.
2. Feche e abra novamente o PWA instalado.
3. Teste nas larguras 360 px, 390 px, 412 px, 768 px e desktop.
4. Valide portal, filtros, página pública, agendamento, cliente, painel e administração.
5. Confirme que o teclado não cobre os botões de formulários.
6. Confirme que o dock não cobre conteúdo nem modais.
