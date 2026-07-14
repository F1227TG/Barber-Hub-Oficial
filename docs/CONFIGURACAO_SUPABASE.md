# Configuração do Supabase — Barber Hub

Este guia deve ser seguido na ordem.

## 1. Criar o projeto

Crie um projeto novo no Supabase e aguarde a inicialização do banco.

Guarde com segurança a senha do banco. Ela não será colocada no código do site.

## 2. Instalar as tabelas, funções e políticas

No painel do Supabase:

```text
SQL Editor → New query
```

Abra o arquivo:

```text
sql/01_barberhub_supabase.sql
```

Copie todo o conteúdo, execute e confirme que não houve erro.

O arquivo recria a estrutura durante o desenvolvimento. Portanto, executar novamente apaga os dados existentes dessas tabelas.

## 3. Copiar URL e chave pública

No painel do projeto, procure a Project URL e a chave pública `anon` ou `publishable`.

Abra:

```text
js/supabase-config.js
```

Preencha:

```javascript
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_CHAVE_PUBLICA";
```

Não acrescente `/rest/v1` ao final da URL.

Nunca use no navegador:

```text
service_role
secret key
senha do banco
```

## 4. Configurar autenticação e redirecionamentos

Em Authentication, configure a URL principal do site.

Durante desenvolvimento local, adicione URLs compatíveis com o servidor usado, por exemplo:

```text
http://127.0.0.1:5500/**
http://localhost:5500/**
```

Depois do deploy, adicione também:

```text
https://SEU-DOMINIO.vercel.app/**
```

A confirmação de cadastro direciona para:

```text
/html/login.html?confirmado=1
```

A recuperação de senha direciona para:

```text
/html/redefinir-senha.html
```

## 5. Decidir sobre confirmação de e-mail

Para teste rápido, a confirmação de e-mail pode ser desativada temporariamente no painel de Auth.

Para uso público real, mantenha a confirmação ativada e configure um provedor SMTP adequado antes de depender do envio de e-mails em produção.

## 6. Criar a conta administrativa

A conta administrativa não pode ser criada com segurança pelo JavaScript público.

Credenciais iniciais recomendadas:

```text
E-mail: admin@barberhub.com
Senha: BarberHub@2026!
```

Crie essa conta de uma destas formas:

### Opção A — Pelo site

1. Abra `html/cadastro.html`;
2. Cadastre como cliente;
3. Confirme o e-mail, caso exigido.

### Opção B — Pelo painel

Crie o usuário em Authentication → Users.

Se o usuário for criado diretamente pelo painel e o perfil não aparecer automaticamente, faça um login pelo site e confira os logs. O trigger `handle_new_user` deve criar a linha em `perfis`.

Depois, abra:

```text
sql/02_promover_admin.sql
```

Confirme o e-mail no arquivo e execute no SQL Editor.

O resultado precisa mostrar:

```text
tipo = admin
onboarding_concluido = true
```

## 7. Testar o Storage

No cadastro profissional, envie uma imagem JPG, PNG ou WebP com até 5 MB.

O SQL cria automaticamente o bucket:

```text
barberhub-public
```

Os arquivos são organizados por usuário:

```text
ID_DO_USUARIO/estabelecimento/foto/arquivo.jpg
ID_DO_USUARIO/estabelecimento/capa/arquivo.jpg
ID_DO_USUARIO/perfil/arquivo.jpg
```

## 8. Testar os tipos de conta

### Cliente

- cria conta;
- entra na área do cliente;
- agenda horário;
- visualiza histórico;
- cancela agendamento permitido;
- atualiza a conta;
- abre e acompanha tickets.

### Profissional

- cria conta como profissional;
- completa as quatro etapas do estabelecimento;
- entra no painel;
- edita a página pública;
- cadastra serviços e equipe;
- configura horários e dias bloqueados;
- recebe e atualiza agendamentos;
- visualiza relatórios.

### Administrador

- abre `html/admin.html`;
- visualiza os totais;
- publica ou oculta estabelecimentos;
- responde tickets.

## 9. Publicar no Vercel

Faça commit e push no GitHub. Importe o repositório no Vercel como projeto estático.

Depois que o domínio estiver ativo:

1. volte ao Supabase;
2. atualize a Site URL;
3. adicione o domínio nas Redirect URLs;
4. teste cadastro, confirmação de e-mail e recuperação de senha pelo site online.
