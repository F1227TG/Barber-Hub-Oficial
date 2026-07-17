# Configuração do Supabase — Barber Hub

## Projeto novo

### 1. Criar o projeto

Crie um projeto no Supabase e guarde a senha do banco fora do código.

### 2. Executar as migrações

No SQL Editor, execute os arquivos nesta ordem:

```text
01_barberhub_supabase.sql
03_experiencia_seguranca_realtime.sql
04_corrigir_politicas_publicas.sql
05_menus_notificacoes_portfolio.sql
06_corrigir_contador_curtidas.sql
07_avaliacao_sem_nota_ficticia.sql
08_notificacoes_moderacao_portfolio.sql
09_ordenacao_midias_portfolio.sql
10_reforco_seguranca_performance.sql
```

O arquivo `02_promover_admin.sql` deve ser executado somente depois de criar a conta que será administradora.

### Atenção

`01_barberhub_supabase.sql` é um instalador da estrutura central e possui comandos de limpeza. Executá-lo novamente apaga dados das tabelas do Barber Hub. Para atualizar um projeto existente, execute apenas as migrações ainda não aplicadas.

## Configuração do front-end

Abra `js/supabase-config.js`:

```javascript
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_CHAVE_PUBLICA";
```

A chave `anon` ou `publishable` é pública por natureza. A segurança depende das políticas RLS.

Nunca use no navegador:

```text
service_role
secret key
senha do banco
uma URL de conexão direta com o PostgreSQL
```

## Autenticação

Configure em Authentication:

```text
Site URL: https://SEU-DOMINIO.vercel.app
Redirect URLs:
https://SEU-DOMINIO.vercel.app/**
http://127.0.0.1:5500/**
http://localhost:5500/**
```

A confirmação de cadastro usa:

```text
/html/login.html?confirmado=1
```

A recuperação de senha usa:

```text
/html/redefinir-senha.html
```

Para operação pública, mantenha confirmação de e-mail ativada e configure SMTP próprio.

## Administrador

1. Crie uma conta comum pelo site;
2. Confirme o e-mail;
3. Edite o e-mail dentro de `sql/02_promover_admin.sql`;
4. Execute o arquivo;
5. Confirme que `tipo = admin`.

Utilize uma senha forte e exclusiva. Não use credenciais fixas de documentação.

## Storage

O bucket público é:

```text
barberhub-public
```

As políticas permitem que cada usuário gerencie somente arquivos na própria pasta.

A galeria usa caminhos semelhantes a:

```text
ID_DO_USUARIO/portfolio/ID_DO_ESTABELECIMENTO/ID_DA_PUBLICACAO/ARQUIVO.webp
```

O navegador:

- aceita JPG, PNG e WebP;
- rejeita originais acima de 8 MB;
- reduz a maior dimensão para até 1600 px;
- converte para WebP;
- tenta manter cada arquivo final abaixo de aproximadamente 500 KB.

## Realtime

As tabelas usadas em tempo real incluem:

```text
agendamentos
tickets_suporte
notificacoes
portfolio_publicacoes
```

O Realtime atualiza a interface enquanto a página está conectada. Ele não substitui Web Push com o navegador fechado.

## Atualização de projeto existente

No projeto atual do Barber Hub, as migrações `04` a `09` devem ser aplicadas em ordem. Depois:

1. envie os arquivos atualizados ao GitHub;
2. aguarde o deploy do Vercel;
3. teste portal público em janela anônima;
4. teste notificações, galeria e moderação com contas separadas.
