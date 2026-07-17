# Barber Hub

Plataforma web para descoberta, divulgação, gestão e agendamento de barbearias. O projeto também está preparado para a futura expansão **Beauty Hub**.

Tecnologias principais:

- HTML, CSS e JavaScript;
- Supabase Auth e PostgreSQL;
- Row Level Security;
- Supabase Storage;
- Supabase Realtime por WebSocket;
- PWA e hospedagem estática no Vercel.

## Funcionalidades atuais

### Contas e acesso

- Cadastro de cliente ou profissional;
- Login, recuperação e redefinição de senha;
- Redirecionamento conforme o tipo da conta;
- Proteção das áreas de cliente, profissional e administrador;
- Menus desktop, menu lateral e navegação mobile personalizados por perfil;
- Tema claro/escuro e preferências de acessibilidade.

### Clientes

- Portal público com busca e filtros;
- Página pública de cada estabelecimento;
- Visualização de serviços, profissionais, horários e status;
- Agendamento com proteção contra conflito de horário;
- Histórico e cancelamento de agendamentos;
- Central persistente de notificações;
- Curtidas em trabalhos da galeria para contas com mais de sete dias;
- Denúncia de conteúdo da galeria.

### Profissionais

- Cadastro e configuração do estabelecimento;
- Horários de funcionamento, feriados e status manual;
- Ativação ou desativação da agenda online;
- Cadastro de serviços e equipe;
- Agenda com contador de solicitações pendentes;
- Confirmação, recusa, conclusão e cancelamento de atendimentos;
- Relatórios básicos;
- Página pública;
- Galeria de trabalhos com:
  - até cinco imagens por publicação;
  - compressão automática para WebP;
  - categorias e até cinco tags;
  - serviço relacionado opcional;
  - modo antes e depois opcional;
  - até três trabalhos em destaque;
  - ordenação das imagens e escolha da capa;
  - rascunho, publicação e arquivamento;
  - confirmação de autorização de imagem;
  - confirmação específica para menores de idade;
  - limite inicial de 50 publicações.

### Notificações internas

- Notificações salvas no banco;
- Contadores no menu e na navegação mobile;
- Atualização em tempo real por Supabase Realtime;
- Avisos de novo agendamento, alteração de status, suporte e moderação;
- Marcar uma ou todas como lidas.

> Esta versão possui notificações **dentro do Barber Hub** enquanto o navegador está conectado. Web Push do sistema operacional, capaz de avisar com o site fechado, permanece como uma etapa separada.

### Administração

- Resumo de usuários, estabelecimentos, agendamentos e tickets;
- Publicação ou ocultação de estabelecimentos;
- Atendimento de tickets;
- Central de moderação da galeria;
- Ocultação de publicação denunciada;
- Notificações para administradores, autores das denúncias e proprietários afetados.

## Correções importantes desta versão

- Corrigida a mensagem falsa de erro ao adicionar um serviço: a inserção não depende mais de uma leitura posterior para ser considerada concluída;
- Separadas as políticas públicas e autenticadas do Supabase, evitando erro `permission denied for function is_admin` para visitantes;
- Removida a avaliação inicial fictícia de 5,0; estabelecimentos sem avaliações exibem “Ainda sem avaliações”;
- Impedido que o proprietário republique conteúdo ocultado pela moderação;
- Corrigido o contador de curtidas para funcionar sem conceder permissão indevida ao cliente;
- Adicionada limpeza de arquivos quando um upload da galeria falha parcialmente.

## Estrutura principal

```text
Barber-Hub/
├── index.html
├── 404.html
├── manifest.webmanifest
├── service-worker.js
├── vercel.json
├── css/
├── html/
│   ├── portal.html
│   ├── barbearia.html
│   ├── agendamento.html
│   ├── cliente.html
│   ├── painel.html
│   ├── notificacoes.html
│   ├── conta.html
│   └── admin.html
├── js/
├── sql/
│   ├── 01_barberhub_supabase.sql
│   ├── 02_promover_admin.sql
│   ├── 03_experiencia_seguranca_realtime.sql
│   ├── 04_corrigir_politicas_publicas.sql
│   ├── 05_menus_notificacoes_portfolio.sql
│   ├── 06_corrigir_contador_curtidas.sql
│   ├── 07_avaliacao_sem_nota_ficticia.sql
│   ├── 08_notificacoes_moderacao_portfolio.sql
│   ├── 09_ordenacao_midias_portfolio.sql
│   └── 10_reforco_seguranca_performance.sql
└── docs/
    ├── CONFIGURACAO_SUPABASE.md
    ├── TESTES_INTEGRACAO.md
    └── ATUALIZACAO_1_1.md
```

## Configuração do Supabase

Leia `docs/CONFIGURACAO_SUPABASE.md`.

Para um projeto novo, execute os arquivos SQL na ordem numérica. O arquivo `01_barberhub_supabase.sql` recria a estrutura central e apaga os dados correspondentes; não o execute novamente em produção apenas para atualizar o sistema.

Configuração pública do navegador:

```javascript
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_CHAVE_PUBLICA";
```

Nunca coloque no front-end:

- `service_role`;
- secret key;
- senha do banco;
- URL de conexão PostgreSQL.

## Conta administrativa

Crie uma conta com uma senha forte e exclusiva. Depois, ajuste o e-mail em `sql/02_promover_admin.sql` e execute o arquivo.

Não utilize senhas de exemplo ou uma senha compartilhada em produção. Ative autenticação em dois fatores nas contas do GitHub, Supabase e Vercel.

## Testes

Use o roteiro:

```text
docs/TESTES_INTEGRACAO.md
```

Teste pelo menos:

- uma conta cliente;
- uma conta profissional com estabelecimento;
- uma conta administrativa;
- computador e celular;
- janela anônima para validar o acesso público.

## Deploy

O projeto não exige comando de build.

```bash
git add .
git commit -m "Atualiza menus, notificações e galeria"
git push
```

O Vercel conectado ao branch de produção publicará a alteração automaticamente.

## Próximas etapas planejadas

- Avaliações verificadas ligadas a atendimentos concluídos;
- Web Push com o site fechado;
- MFA obrigatório para administradores;
- SMTP próprio;
- Planos e pagamentos;
- Exportação e exclusão completa de conta;
- Aplicativo móvel;
- Expansão Beauty Hub.
