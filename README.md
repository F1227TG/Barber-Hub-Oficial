# Barber Hub

Plataforma web para divulgação, gestão e agendamento de barbearias, preparada também para a futura expansão **Beauty Hub**, voltada a salões de beleza e profissionais do público feminino.

A aplicação utiliza **HTML, CSS e JavaScript no front-end**, com **Supabase Auth, PostgreSQL, Row Level Security e Storage** para autenticação, banco de dados e imagens.

## Funcionalidades atuais

### Acesso e contas

- Cadastro real de cliente ou profissional;
- Login por e-mail e senha;
- Confirmação de e-mail configurável;
- Recuperação e redefinição de senha;
- Atualização de perfil, foto, e-mail, telefone e senha;
- Redirecionamento por tipo de conta;
- Administração sem credenciais fixas no código.

### Clientes

- Portal público de estabelecimentos;
- Busca por nome, cidade e bairro;
- Status aberto/fechado em tempo real;
- Página pública de cada estabelecimento;
- Escolha de serviço, profissional, data e horário;
- Bloqueio de conflitos de agenda;
- Histórico e cancelamento de agendamentos;
- Tickets de suporte vinculados à conta.

### Profissionais

- Cadastro detalhado do estabelecimento após o registro básico;
- Upload de logotipo, foto e capa;
- Configuração de endereço, contatos e horários;
- Status automático, aberto manualmente ou fechado manualmente;
- Bloqueio de feriados e datas especiais;
- Ativação ou desativação do agendamento online;
- Cadastro de serviços, duração e preços;
- Cadastro de profissionais da equipe;
- Confirmação, recusa, conclusão e cancelamento de atendimentos;
- Relatórios semanais e recomendações baseadas nos dados.

### Administração

- Resumo de usuários, estabelecimentos, agendamentos e tickets;
- Publicação ou ocultação de estabelecimentos;
- Atendimento de tickets de suporte;
- Conta administrativa criada no Supabase, sem senha exposta no front-end.

### Interface

- Tema escuro e tema claro revisado;
- Sombras douradas reduzidas no modo claro;
- Menu lateral pelas três barras;
- Acesso à conta, histórico, painel e suporte;
- Aumento e redução de fonte;
- Alto contraste;
- Redução de movimento;
- Layout responsivo.

## Estrutura principal

```text
Barber-Hub/
├── index.html
├── 404.html
├── README.md
├── vercel.json
├── css/
│   ├── global.css
│   ├── index.css
│   └── pages.css
├── html/
│   ├── login.html
│   ├── cadastro.html
│   ├── recuperar-senha.html
│   ├── redefinir-senha.html
│   ├── cadastro-barbearia.html
│   ├── portal.html
│   ├── barbearia.html
│   ├── agendamento.html
│   ├── cliente.html
│   ├── painel.html
│   ├── conta.html
│   ├── admin.html
│   ├── contato.html
│   └── beauty-hub.html
├── js/
│   ├── supabase-config.js
│   ├── supabase-client.js
│   ├── auth.js
│   ├── api.js
│   ├── status.js
│   ├── ia.js
│   ├── ui.js
│   └── scripts de cada página
├── sql/
│   ├── 01_barberhub_supabase.sql
│   └── 02_promover_admin.sql
└── docs/
    ├── CONFIGURACAO_SUPABASE.md
    └── TESTES_INTEGRACAO.md
```

## Instalação do Supabase

Siga o guia completo em:

```text
docs/CONFIGURACAO_SUPABASE.md
```

Resumo:

1. Crie um projeto vazio no Supabase;
2. Execute `sql/01_barberhub_supabase.sql` no SQL Editor;
3. Copie a Project URL e a chave pública anon/publishable;
4. Preencha `js/supabase-config.js`;
5. Configure as URLs de autenticação;
6. Crie sua conta administrativa e execute `sql/02_promover_admin.sql`;
7. Faça os testes de `docs/TESTES_INTEGRACAO.md`.

## Configuração pública

Arquivo:

```javascript
// js/supabase-config.js
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_CHAVE_PUBLICA";
```

Use apenas a chave pública. Nunca coloque `service_role`, secret key ou senha de banco no navegador.

## Conta administrativa inicial

Credenciais recomendadas para a primeira conta:

```text
E-mail: admin@barberhub.com
Senha: BarberHub@2026!
```

Essas credenciais **não ficam gravadas no código**. Crie a conta uma vez no Supabase ou pelo cadastro do site e, depois, execute `sql/02_promover_admin.sql`.

Troque a senha após o primeiro acesso caso o sistema seja publicado para uso real.

## Banco de dados

Tabelas principais:

- `perfis`
- `estabelecimentos`
- `horarios_funcionamento`
- `dias_bloqueados`
- `profissionais`
- `servicos`
- `profissional_servicos`
- `agendamentos`
- `promocoes`
- `favoritos`
- `tickets_suporte`

O campo `tipo_estabelecimento` já aceita:

```text
barbearia
salao
```

Isso permite construir a Beauty Hub sobre a mesma base de autenticação e gestão, mantendo identidades visuais diferentes.

## Segurança

- Senhas são gerenciadas pelo Supabase Auth;
- O navegador usa somente a chave pública;
- Todas as tabelas possuem Row Level Security;
- Clientes acessam apenas seus próprios dados privados;
- Proprietários gerenciam apenas o próprio estabelecimento;
- Administradores possuem acesso por perfil promovido no banco;
- Uploads são limitados à pasta do usuário autenticado;
- Conflitos de agenda também são bloqueados no banco.

## Deploy

O projeto está pronto para hospedagem estática no Vercel.

Depois de configurar o Supabase:

```bash
git add .
git commit -m "Integra Barber Hub ao Supabase"
git push
```

No Vercel, importe o repositório e publique sem comando de build.

Depois, adicione o domínio final nas configurações de URL do Supabase Auth.

## Funcionalidades futuras

- Pagamentos online liberados após confirmação;
- Notificações por WhatsApp e e-mail;
- Planos de assinatura;
- Avaliações verificadas;
- Várias unidades por proprietário;
- Profissionais com contas individuais;
- IA com modelos externos;
- Aplicativo móvel;
- Expansão completa Beauty Hub.


## Experiência 1.0

- Painel otimizado para celular e navegação inferior móvel.
- Validação global, feedback de loading e mensagens de erro mais claras.
- Estados vazios, animações com preferência de movimento reduzido e monitor de conexão.
- PWA com página offline e instalação no celular.
- SEO básico, sitemap, robots.txt, política de privacidade e termos de uso.
- Atualizações em tempo real para agenda e suporte.
- Fundos temáticos originais em SVG, sem dependência de imagens licenciadas.

Antes do lançamento comercial, revise os textos legais e configure SMTP próprio no Supabase.
