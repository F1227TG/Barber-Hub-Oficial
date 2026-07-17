# Testes de integração — Barber Hub 1.1

## Banco e segurança

- [ ] Migrações `01` e `03` a `09` executam sem erro em um projeto novo;
- [ ] RLS está ativo nas tabelas;
- [ ] Visitante abre o portal sem erro `permission denied for function is_admin`;
- [ ] Cliente não consegue ler notificações de outro usuário;
- [ ] Cliente não consegue alterar uma publicação;
- [ ] Proprietário não consegue alterar estabelecimento de outra conta;
- [ ] Proprietário não consegue republicar conteúdo ocultado pela moderação;
- [ ] Conta comum não acessa a área administrativa;
- [ ] Nenhuma chave secreta está no front-end.

## Menus por perfil

### Visitante

- [ ] Menu mostra Início, Portal, Agendar, Beauty Hub e Suporte;

### Cliente

- [ ] Menu mostra Explorar, Agendar, Meus horários, Notificações e Conta;
- [ ] Badge de horários mostra agendamentos futuros ativos;

### Profissional

- [ ] Menu mostra Dashboard, Agenda, Serviços, Relatórios, Minha página e Notificações;
- [ ] Quando a agenda está desativada, aparece “Ativar agenda”;
- [ ] Badge da Agenda conta apenas solicitações pendentes;
- [ ] Menu “Mais” do celular abre o menu lateral;
- [ ] Menu lateral oferece Equipe, Galeria e Configurações;

### Administrador

- [ ] Menu mostra Visão geral, Estabelecimentos, Usuários, Moderação, Tickets e Notificações;
- [ ] Badges de moderação e tickets exibem pendências.

## Serviços

- [ ] Adicionar serviço mostra sucesso;
- [ ] Serviço aparece imediatamente na lista;
- [ ] Não aparece mensagem de erro quando a inserção foi concluída;
- [ ] Em uma falha apenas de recarregamento, aparece aviso para atualizar a página;
- [ ] Ativar, inativar e excluir serviço funciona conforme as regras do banco.

## Agendamento e notificações

- [ ] Novo agendamento cria aviso para o proprietário;
- [ ] Cliente recebe confirmação de que a solicitação foi registrada;
- [ ] Alteração de status cria aviso para o cliente;
- [ ] Cancelamento cria aviso para o proprietário;
- [ ] Badge de notificações atualiza pelo Realtime;
- [ ] Central filtra por tipo;
- [ ] Marcar uma notificação como lida funciona;
- [ ] Marcar todas como lidas funciona;
- [ ] Atualização de ticket cria aviso para o usuário.

## Galeria do profissional

- [ ] Dono cria publicação com uma a cinco fotos;
- [ ] JPG, PNG e WebP são aceitos;
- [ ] Original acima de 8 MB é rejeitado;
- [ ] Imagem é convertida para WebP antes do envio;
- [ ] Serviço relacionado pode ficar vazio;
- [ ] Profissional responsável é obrigatório;
- [ ] Rascunho pode ser salvo sem confirmar autorização;
- [ ] Publicação exige autorização de imagem;
- [ ] Publicação com menor exige autorização do responsável;
- [ ] Antes e depois exige pelo menos duas fotos;
- [ ] Máximo de cinco tags é respeitado;
- [ ] Máximo de três destaques é respeitado;
- [ ] Reordenar as imagens mantém uma sequência válida;
- [ ] Escolher uma nova capa atualiza a galeria pública;
- [ ] Máximo de 50 publicações é respeitado;
- [ ] Arquivar remove o trabalho da página pública;
- [ ] Excluir remove registros e tenta remover arquivos do Storage;
- [ ] Falha parcial de upload faz limpeza dos arquivos enviados.

## Galeria pública

- [ ] Galeria aparece na página do estabelecimento;
- [ ] Filtros por categoria, profissional, serviço e formato funcionam;
- [ ] Ordenação por recentes e curtidos funciona;
- [ ] Lightbox abre e navega entre fotos;
- [ ] Antes e depois aparece lado a lado;
- [ ] Visitante vê a galeria sem login;

## Curtidas e denúncias

- [ ] Visitante não curte;
- [ ] Conta com menos de sete dias não curte;
- [ ] Proprietário não curte trabalho do próprio estabelecimento;
- [ ] Uma conta não cria duas curtidas na mesma publicação;
- [ ] Descurtir reduz o contador;
- [ ] Usuário autenticado denuncia uma publicação;
- [ ] A mesma conta não envia denúncia duplicada;
- [ ] Administrador recebe aviso de nova denúncia;
- [ ] Administrador marca denúncia em análise;
- [ ] Administrador rejeita denúncia;
- [ ] Administrador oculta publicação;
- [ ] Proprietário recebe aviso quando o conteúdo é ocultado;
- [ ] Autor da denúncia recebe o resultado da análise.

## Avaliação exibida

- [ ] Estabelecimento sem avaliações mostra “Ainda sem avaliações”;
- [ ] Portal não exibe nota fictícia 5,0.

## Responsividade e PWA

- [ ] Layout funciona em celular e computador;
- [ ] Barra inferior não cobre botões ou conteúdo;
- [ ] Menu lateral abre e fecha;
- [ ] Página offline abre quando aplicável;
- [ ] Service Worker usa a versão de cache mais recente;
- [ ] Não há erro vermelho no console.

## Deploy

- [ ] GitHub recebeu os arquivos;
- [ ] Vercel está `Ready`;
- [ ] Site online usa o commit mais recente;
- [ ] Cadastro, login, upload, agenda, notificações e galeria funcionam online.
