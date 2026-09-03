# Barber Hub 1.10.0 — migrations e deploy seguro

## Estado real

As migrations 11–28 já pertencem ao histórico aplicado da 1.9.3. A 1.10.0 adiciona três migrations novas, ainda pendentes no ambiente de produção:

1. `29_operacao_real_horarios_atendimentos_1_10.sql`;
2. `30_localizacao_biblioteca_marketplace_1_10.sql`;
3. `31_push_importacoes_auditoria_flags_1_10.sql`.

Depois delas, execute `verificar_31_release_1_10.sql`. Não pule a ordem e não edite uma migration depois que ela for aplicada; uma correção posterior recebe outro número.

## O que é uma migration

Migration é uma alteração versionada do banco. Ela cria ou ajusta tabelas, índices, regras de acesso, funções e gatilhos para que o banco acompanhe o código. O número representa a sequência obrigatória. O Git guarda o arquivo; o Supabase executa o SQL.

## Antes de aplicar

1. confirme que o projeto selecionado é o correto;
2. gere ou confirme um backup recuperável;
3. confira se 28 é a última migration já aplicada;
4. não publique o frontend 1.10 antes do banco;
5. reserve uma janela sem alterações administrativas simultâneas;
6. execute os testes locais e mantenha o commit anterior disponível para rollback do código.

## Aplicação pelo SQL Editor

Para cada arquivo, abra o SQL Editor do Supabase, crie uma consulta, cole o conteúdo completo e execute. Aguarde sucesso antes de seguir ao próximo número.

Ordem:

```text
29 → 30 → 31 → verificar_31_release_1_10.sql
```

O verificador deve terminar sem exceção. Ele confirma objetos, RLS, privilégios anônimos, RPCs sensíveis, flags, biblioteca, auditoria e anonimização.

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

Web Push exige um worker autenticado que processe `push_entregas`, respeite horário silencioso, marque sucesso/falha e repita com limite. E-mail/WhatsApp exigem provedor próprio e consentimento; a fila interna não significa que o envio externo esteja concluído.

## Rollback

O rollback preferencial do código é promover o commit anterior. Banco com dados reais não deve receber `DROP` improvisado. Se uma migration falhar, interrompa o deploy, preserve o erro completo e crie uma migration corretiva depois de avaliar dados e dependências.

