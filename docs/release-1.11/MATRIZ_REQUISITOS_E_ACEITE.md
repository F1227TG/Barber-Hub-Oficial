# Matriz de requisitos e critérios de aceite — Barber Hub 1.11

## Como usar

`P0` bloqueia publicação; `P1` representa fluxo principal ou risco relevante; `P2` representa acabamento importante. A coluna de estado começa como **Não executado**. O executor deve substituí-la somente após anexar evidência conforme o [índice operacional](README.md).

## Requisitos transversais

| ID | Pri. | Requisito | Critério de aceite objetivo | Evidência mínima | Estado |
|---|---:|---|---|---|---|
| R01 | P1 | Conta de cliente e profissional redesenhada em desktop e mobile | Cada perfil vê apenas ações pertinentes; perfil, segurança, privacidade e exclusão funcionam em 320–430 px, 768 px e desktop, sem corte, flash de conteúdo indevido ou link quebrado | Capturas por perfil e viewport; roteiro funcional | Não executado |
| R02 | P1 | Drawers, sheets e modais consistentes | Abertura move foco para o componente; Tab/Shift+Tab não escapam; Escape e backdrop fecham quando permitido; foco retorna ao disparador; fundo fica indisponível à tecnologia assistiva; sem travar scroll ao voltar | Teste teclado + leitor de tela em ao menos um desktop e um mobile | Não executado |
| R03 | P0 | Persistência de estado segura | Somente o mínimo necessário é persistido; nada sensível vai para URL/log; rascunhos têm escopo, TTL e limpeza em sucesso, logout e exclusão; falha de storage é tratada; continuidade não aceita destino externo | Inspeção de storage/URL/log e testes de expiração/limpeza | Não executado |
| R04 | P1 | Planos exclusivos do profissional | Visitante, cliente e admin não recebem navegação, CTA ou conteúdo de contratação destinado ao profissional; acesso direto tem resposta coerente; profissional mantém acesso ao plano e benefícios | Matriz de rotas/menus por perfil | Não executado |
| R05 | P1 | Visibilidade de CTAs por contexto | Home, Sobre, Explorar, estabelecimento, conta e painel não exibem ações impossíveis, redundantes ou incompatíveis com perfil, propriedade, estado e entitlement | Capturas e tabela perfil × CTA | Não executado |
| R06 | P0 | Impedir autoagendamento no próprio estabelecimento | Proprietário e membro vinculado não conseguem iniciar nem concluir agendamento como cliente no próprio estabelecimento; a UI explica o bloqueio; API/RLS também recusam tentativa direta | UI desktop/mobile e chamada direta autenticada | Não executado |
| R07 | P0 | Preservar agendamento público antes do login | Visitante pesquisa, abre o local e escolhe serviço, profissional, data e horário sem autenticação; login/cadastro é exigido apenas para confirmar; retorno restaura contexto válido sem expor observação na URL | E2E visitante → login/cadastro → confirmação | Não executado |
| R08 | P0 | Termos, privacidade e consentimento | Cadastro apresenta links acessíveis, aceite explícito, versão e data; nenhum checkbox vem marcado; recusa impede cadastro; o aceite gravado é auditável; textos têm aprovação jurídica e correspondem ao tratamento real | Capturas, registro de consentimento e aprovação jurídica | Não executado |
| R09 | P1 | Notificações dentro do painel | Painel mostra lista/resumo acionável e contador atualizado; abrir ou marcar uma notificação altera item, resumo e badges sem reload; paginação/filtros mantêm consistência | E2E com notificação real para cliente e profissional | Não executado |
| R10 | P2 | Cross-link Beauty Hub | Link aparece nas superfícies definidas para visitante e perfis autenticados, abre o destino oficial correto e não implica compartilhamento de credenciais/banco inexistente | Verificação de links desktop/mobile e revisão de copy | Não executado |
| R11 | P1 | Regras de entitlement fail-closed | Recursos pagos são bloqueados em UI e servidor; indisponibilidade do resolvedor não libera agenda ou recurso; downgrade/expiração refletem sem depender de nova edição do estabelecimento | Teste por plano + falha simulada do resolvedor | Não executado |
| R12 | P2 | Visual premium responsivo | Paleta escura/quente/dourada, tipografia, espaçamento, foco, contraste e hierarquia são consistentes; nenhum overflow involuntário; 200% de zoom continua utilizável | Capturas comparativas, axe/leitor de tela e matriz de viewports | Não executado |

## Correções E01–E17

| ID | Pri. | Área | Critério de aceite objetivo | Regressões obrigatórias | Estado |
|---|---:|---|---|---|---|
| E01 | P2 | Hero / barber pole | O elemento decorativo aparece nas páginas e viewports definidos pelo design, sem cobrir texto/CTA, sem leitura redundante por leitor de tela e sem impacto perceptível indevido no carregamento | Home, Explorar e estabelecimento; tema claro/escuro; 320 e 1440 px | Não executado |
| E02 | P1 | Mapa e rota | “Como chegar” funciona quando há coordenadas, endereço ou ambos; coordenadas válidas não são descartadas por endereço vazio; links são codificados, externos e seguros | Desktop/mobile; endereço incompleto; latitude/longitude limite | Não executado |
| E03 | P1 | Avaliações | Média e total usam agregado correto, não apenas página carregada; paginação não repete/perde itens; origem verificada/comunidade é correta; estrelas são operáveis por teclado e anunciadas | 0, 1, >1 página; criar/editar; proprietário não avalia a si mesmo | Não executado |
| E04 | P0 | Erro `.filter` | Respostas nulas, ausentes ou malformadas são normalizadas na fronteira; nenhuma tela lança “filter is not a function”; estado de erro é útil e permite tentar novamente | Marketplace, estabelecimento, cliente, painel e admin com arrays vazios/nulos | Não executado |
| E05 | P1 | Home do cliente | Cliente autenticado recebe início orientado a tarefas, próximo horário/estado vazio e atalhos pertinentes; CTAs profissionais desaparecem; visitante continua vendo a home pública | Cliente com/sem agenda, visitante e profissional; desktop/mobile | Não executado |
| E06 | P2 | Excesso de cards | Conteúdo secundário usa lista, agrupamento ou progressive disclosure; card dentro de card e duplicações são removidos; tarefa principal fica visível sem rolagem excessiva | Home, conta, painel e cliente em 390 e 1440 px | Não executado |
| E07 | P1 | Espera e recorrência | Lista de espera só aparece quando aplicável e autorizado; entrada/saída atualiza estado; recorrências podem ser vistas e geridas; conflitos, paginação e plano são tratados no servidor e na UI | Visitante→login, cliente, profissional; plano permitido/bloqueado | Não executado |
| E08 | P0 | Termos | Documento final tem versão, vigência, escopo, regras da conta/uso, planos/cancelamentos quando aplicáveis, conteúdo, responsabilidades, contato e mudança de termos; não contém aviso de “revisão futura” na versão publicada | Aprovação jurídica e links em cadastro/drawer/rodapé | Não executado |
| E09 | P0 | Privacidade | Documento final identifica agentes/canais, finalidades, bases legais, categorias, compartilhamentos, transferências, retenção, direitos, cookies/storage/push/geolocalização, segurança e alterações | Aprovação de privacidade e confronto com inventário de dados | Não executado |
| E10 | P1 | Explorar | Busca, destaques, paginação, vazio, erro e retry funcionam; estado importante pode ser restaurado/compartilhado quando definido; resultado corresponde ao filtro exibido | Pesquisa, limpar, voltar, reload, sem resultados e falha de rede | Não executado |
| E11 | P0 | Filtros | Tipo, status, agenda, cidade, bairro, UF, raio, serviço, preço e avaliação são combináveis sem serem silenciosamente ignorados; contador e URL/estado refletem filtros reais | Barbearia/salão, aberta/fechada, regional e combinações | Não executado |
| E12 | P1 | CTAs da página Sobre | CTAs mudam conforme visitante, cliente, profissional e admin; “Planos” só aparece ao profissional; “Cadastrar negócio” não aparece a quem já possui contexto incompatível | Desktop/mobile e acesso autenticado | Não executado |
| E13 | P1 | Avisos no dispositivo | UI mostra suporte, permissão e assinatura atuais; permite ativar e desativar; negação tem orientação; horário silencioso é respeitado; notificações internas seguem disponíveis | Chrome/Android e um navegador sem suporte/negado | Não executado |
| E14 | P0 | Agenda online / entitlement | CTA público e configuração profissional usam o entitlement efetivo; Gratuito, assinatura pausada/expirada e falha de validação não anunciam agenda; upgrade habilita conforme fonte canônica | Quatro planos e estados de assinatura; falha de RPC/API | Não executado |
| E15 | P1 | Marcar notificações | Marcar individual/todas é idempotente; item, resumo e todos os badges atualizam; abrir link aguarda ou garante a gravação sem corrida; só o dono altera a própria notificação | Com/sem URL; duplo clique; duas abas; RLS cruzado | Não executado |
| E16 | P2 | Planos densos | Página usa comparação progressiva, destaca diferenças e reduz duplicação; copy e benefícios vêm de fonte coerente; mobile não repete tabela e cards longos | 320–430 px, 768 e 1440 px; quatro planos | Não executado |
| E17 | P0 | Exclusão de conta | Exige reautenticação, frase e confirmação; protege último admin; remove/anonimiza conforme política; limpa sessão, continuação e rascunhos locais; retorna à home sem dados residuais | Cliente, profissional e admin; cancelamento; senha incorreta; duas abas | Não executado |

## Critérios gerais de encerramento

- [ ] Cada linha P0 e P1 possui evidência e responsável.
- [ ] Não há divergência entre desktop, `html/` e páginas geradas em `mobile/`.
- [ ] Testes negativos cobrem acesso por URL/API, não apenas botão escondido.
- [ ] Termos, privacidade e retenção foram aprovados pelos responsáveis competentes.
- [ ] A lista final de migrations e o deployment candidato foram congelados.
- [ ] Exceções P2 possuem risco, responsável e data.
