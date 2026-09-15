# Migrations gerenciadas do Supabase

Este diretório contém a parte da cadeia que passou a ser acompanhada pelo fluxo de migrations do projeto conectado.

## Estado da cadeia

- Os scripts históricos `01` a `31` permanecem em [`../sql`](../sql/README.md) porque foram aplicados antes da adoção deste diretório como fonte gerenciada.
- A migration `20260911132254_conclusao_pos31_1_10_1` representa o primeiro ponto importado para `supabase/migrations` sobre uma base de produção que já possuía os objetos anteriores.
- A migration `20260911132328_barberhub_1_11_confiabilidade_privacidade` depende de toda a cadeia histórica e conclui a release 1.11.0.
- As duas migrations foram registradas no histórico do projeto conectado em 11 de setembro de 2026; os nomes locais usam exatamente as versões remotas para evitar reaplicação acidental pela CLI.
- Os arquivos `verificar_*.sql` em [`../sql`](../sql) são verificadores pós-aplicação; não são migrations.

## Projeto existente

Antes de aplicar uma migration, compare `supabase_migrations.schema_migrations` com os arquivos locais. Um objeto existir no banco não significa que a migration correspondente esteja registrada no histórico. Quando uma migration antiga foi executada manualmente, a reconciliação deve ser documentada e feita por uma execução idempotente controlada ou pelo mecanismo oficial de reparo de histórico.

## Projeto novo

Não aplique apenas as migrations `32` e `33` em um banco vazio. Para recriar o Barber Hub do zero, execute e valide a base histórica `01` a `31` em um ambiente isolado, registre o baseline aprovado e somente depois continue pela cadeia gerenciada. Nunca use o projeto de produção como ambiente de ensaio.

## Regras

1. Não altere uma migration que já tenha sido aplicada em ambiente compartilhado; crie uma nova migration aditiva.
2. Faça backup recuperável e ensaio de restauração antes de mudanças de produção.
3. Use o executor oficial de migrations para DDL.
4. Execute o verificador correspondente e revise os Advisors após a aplicação.
5. Não inclua chaves, tokens, senhas ou dados pessoais em SQL versionado ou evidências.
