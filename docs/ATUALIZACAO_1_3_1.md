# Barber Hub 1.3.1 — modais, status rápido e reputação

Esta atualização estabiliza a experiência de avaliações e melhora o uso do painel no celular.

## Alterações principais

- Corrigidas as duas últimas seções da página `html/sobre.html`;
- Bootstrap 5.3.6 incluído localmente em `vendor/`, sem substituir a identidade visual do projeto;
- Avaliação verificada aberta em modal, sem ocupar espaço abaixo da página do cliente;
- Avaliação da comunidade para clientes que conheceram o estabelecimento fora da agenda online;
- Avaliação opcional de cada publicação do portfólio;
- Selo visual separando avaliação verificada e avaliação da comunidade;
- Denúncia de publicação em modal;
- Modal global de confirmação para exclusões, cancelamentos e ações administrativas;
- Botões rápidos `Automático`, `Aberto` e `Fechado` no painel e na lateral;
- Textos públicos `Aberto antecipadamente` e `Fechado mais cedo` quando o status manual antecipa os horários;
- Botões para ativar ou desativar agendamento online;
- Badge de notificação completamente oculto quando a quantidade é zero;
- Service Worker atualizado para o cache `barberhub-v1.3.1`.

## Migration necessária

Execute depois da migration 12:

```text
sql/13_modais_status_avaliacoes_comunidade.sql
```

A migration adiciona às avaliações:

- `origem`: `agendamento` ou `comunidade`;
- `verificada`: identifica avaliações ligadas a atendimento concluído;
- `publicacao_id`: permite avaliar um trabalho do portfólio;
- limites de uma avaliação comunitária por cliente/estabelecimento e por cliente/publicação;
- validações para impedir que o proprietário avalie o próprio negócio;
- notificações diferentes para avaliações verificadas e comunitárias.

## Ordem de atualização

1. Publique os arquivos da versão 1.3.1;
2. Confirme que a migration 12 já foi executada;
3. Execute a migration 13 no SQL Editor do Supabase;
4. Saia e entre novamente nas contas de teste;
5. Teste os fluxos de cliente, profissional e administrador.

## Decisão sobre login

O login continua como página completa. Recuperação de senha, redirecionamento após autenticação, gerenciadores de senha e links diretos ficam mais previsíveis assim. Modais foram aplicados às ações contextuais, como avaliações, denúncias e confirmações.
