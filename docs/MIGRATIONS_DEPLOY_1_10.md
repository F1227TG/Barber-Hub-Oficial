# Barber Hub 1.10.1 — migrations e deploy seguro

## Estado real

As migrations até 28 aparecem no histórico registrado. No projeto Supabase conectado, os objetos e funções esperados das migrations 29–31 foram consultados e estão presentes. Porém, como esses arquivos foram executados manualmente no SQL Editor, seus números não aparecem no histórico oficial de migrations.

1. `29_operacao_real_horarios_atendimentos_1_10.sql`;
2. `30_localizacao_biblioteca_marketplace_1_10.sql`;
3. `31_push_importacoes_auditoria_flags_1_10.sql`.

Não reaplique 29–31 sem uma análise de estado. A etapa nova desta versão é:

1. `supabase/migrations/20260904180741_32_conclusao_pos31_1_10_1.sql`;
2. `sql/verificar_32_conclusao_1_10_1.sql`.

Não edite uma migration depois que ela for aplicada; uma correção posterior recebe outro timestamp/número.

## O que é uma migration

Migration é uma alteração versionada do banco. Ela cria ou ajusta tabelas, índices, regras de acesso, funções e gatilhos para que o banco acompanhe o código. O número representa a sequência obrigatória. O Git guarda o arquivo; o Supabase executa o SQL.

## Antes de aplicar

1. confirme que o projeto selecionado é o correto;
2. gere ou confirme um backup recuperável;
3. confirme que os objetos 29–31 estão presentes;
4. não publique o frontend 1.10.1 antes da migration 32;
5. reserve uma janela sem alterações administrativas simultâneas;
6. execute os testes locais e mantenha o commit anterior disponível para rollback do código.

## Aplicação

Prefira aplicar a migration 32 pelo fluxo oficial do Supabase CLI/MCP para que ela apareça no histórico. Se o SQL Editor for a única opção, registre manualmente a data, o responsável e o resultado.

Ordem desta conclusão:

```text
migration 32 → verificar_32_conclusao_1_10_1.sql
```

O verificador é somente leitura e deve terminar sem exceção. Ele confirma funções, gatilhos, privilégios, flags, plano, índice e auditoria.

## Depois das migrations

1. abra Security Advisor e Performance Advisor;
2. registre cada alerta, sem apagar avisos artificialmente;
3. teste cliente, profissional, recepção, gerente, proprietário, admin e usuário sem vínculo;
4. teste plano Gratuito, Essencial, Profissional e Elite;
5. valide horários com intervalo e período noturno;
6. teste atendimento manual duas vezes com a mesma chave;
7. teste importação com arquivo válido, duplicado, fórmula e linha inválida;
8. teste exclusão em ambiente de homologação para confirmar anonimização do histórico;
9. configure os itens externos abaixo;
10. publique API e frontend/PWA juntos.

## Configuração externa obrigatória

### Supabase Auth

- adicione as URLs exatas de produção e homologação em Site URL/Redirect URLs;
- mantenha somente domínios autorizados para recuperação de senha;
- habilite CAPTCHA/Turnstile e guarde a chave secreta somente no servidor;
- habilite proteção contra senhas vazadas quando disponível no plano;
- mantenha confirmação de e-mail conforme a política comercial.

### API e deploy

- `SUPABASE_URL`: servidor;
- chave pública/anon: frontend, se o projeto mantiver o acesso direto permitido;
- `SUPABASE_SERVICE_ROLE_KEY`: somente servidor, nunca HTML/JS;
- `ALLOWED_ORIGINS`: domínios exatos, sem `*` em produção;
- `PASSWORD_REDIRECT_URL`: tela oficial de redefinição;
- `TURNSTILE_SECRET_KEY`: servidor;
- `TURNSTILE_SITE_KEY`: valor público entregue pela configuração segura;
- chaves VAPID pública/privada e identificação do remetente: servidor/deploy.

### Tarefas agendadas

Web Push usa `GET /api/v1/jobs/push/deliver` e aceita o segredo somente por `Authorization: Bearer`. Configure `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no deploy. A migration 32 fornece a reivindicação atômica de `push_entregas`; o worker respeita horário silencioso, marca sucesso/falha e repete no máximo cinco vezes. E-mail/WhatsApp continuam exigindo provedor e consentimento próprios.

## Rollback

O rollback preferencial do código é promover o commit anterior. Banco com dados reais não deve receber `DROP` improvisado. Se uma migration falhar, interrompa o deploy, preserve o erro completo e crie uma migration corretiva depois de avaliar dados e dependências.
