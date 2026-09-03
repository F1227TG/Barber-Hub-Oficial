# Barber Hub 1.9.3 — relatório de segurança consolidado

Auditoria diferencial executada em **24/08/2026**, usando `AUDITORIA_SEGURANCA_BARBER_HUB.docx` como referência e comparando os achados com o código atual, migrations locais e estado remoto. As migrations 24–28 foram aplicadas e verificadas no Supabase.

## Resultado diferencial V01–V06

| Achado | Estado na 1.9.3 | Como está protegido | Dependência externa |
|---|---|---|---|
| V01 — campos administrativos do estabelecimento | **Corrigido** | trigger, separação de suspensão administrativa, RLS e API autorizada | testar cada papel no projeto de homologação |
| V02 — transições livres de agendamento | **Corrigido** | máquina de estados no domínio e no PostgreSQL; RPCs transacionais | testar fluxo completo com contas separadas |
| V03 — limites de plano contornáveis | **Corrigido** | entitlements centrais, locks e triggers; UI apenas reflete o resultado | confirmar assinatura real e concorrência em homologação |
| V04 — contador de curtidas editável | **Corrigido** | contador derivado da relação de curtidas e reparo de divergências | nenhuma nova configuração |
| V05 — rotas sem rate limit | **Corrigido no código** | cobertura dos endpoints e RPC distribuída | revisar capacidade/limites antes de múltiplas instâncias da API |
| V06 — CAPTCHA desativado | **Corrigido** | Turnstile ativo no Supabase Auth; frontend envia token e só recebe a site key pública | manter a secret fora do frontend e confirmar a variável pública em cada deploy |

Nenhum achado V01–V06 permanece classificado como “ainda vulnerável”. V05 está corrigido na aplicação atual, mas a capacidade deve ser medida novamente se a API passar a usar múltiplas instâncias ou volume maior. V06 foi confirmado no provedor; a secret continua corretamente fora do Git.

## Estado remoto observado

O projeto remoto está saudável e com histórico aplicado até a migration 28. Depois da 1.9.3, o Security Advisor retornou 50 apontamentos informativos/de revisão:

- 1 informação: `api_rate_limits` com RLS e sem policy pública, desenho intencional porque a tabela é fechada ao `service_role`;
- 2 avisos: extensões legadas `unaccent` e `btree_gist` no schema `public`;
- 6 funções públicas intencionais `SECURITY DEFINER` executáveis por `anon` e 40 RPCs autenticadas com autorização interna;
- 1 aviso: proteção contra senhas vazadas desativada.

Esses avisos não foram apagados artificialmente. Nenhuma RPC 1.9.3 é executável por `anon`; todas usam `search_path` fixo e autorização interna. A migration 28 também removeu privilégios anônimos herdados das quinze tabelas internas. O Performance Advisor ficou sem warnings após índices de FK e separação das políticas duplicadas. Mover extensões existentes exige migration separada e ensaio de dependências.

## Novas regressões da 1.9.3

- política de senha única entre cadastro, redefinição e conta;
- nenhuma credencial privada adicionada ao navegador;
- menu profissional filtra itens comerciais pela resposta de entitlements;
- mudança de seção dispara carregamento explícito e tem estado de erro recuperável;
- proteção contra respostas antigas na busca do CRM;
- páginas mobile continuam sincronizadas com suas fontes desktop;
- cache PWA atualizado para evitar interface antiga após o deploy.
- quinze novas tabelas protegidas por RLS e funções transacionais com `search_path` fixo;
- cupons, resgates, recorrências e avisos protegidos contra duplicação/concorrência;
- permissões da equipe validadas no frontend, API e PostgreSQL, não apenas ocultadas por CSS;
- campanhas respeitam consentimento separado de WhatsApp e e-mail, e mantêm fila/auditoria separada do envio;
- o processador interno limita lote, usa `SKIP LOCKED`, registra tentativas e isola falhas por mensagem;
- programas/recompensas de fidelidade só ficam visíveis ao estabelecimento ou a clientes que realmente têm relacionamento por agendamento;
- clientes visualizam somente as próprias carteiras e resgates de fidelidade.

## Senhas: o requisito correto

O Barber Hub não adiciona uma coluna `senha` em `public.perfis`, clientes ou equipe. O Supabase Auth já mantém `auth.users.encrypted_password`, que apesar do nome contém um **hash bcrypt com salt**, não uma senha criptografada que possa ser revelada. A tabela `auth.users` pertence ao provedor de autenticação e não é exposta pela API pública.

Isso atende a necessidade de persistir credenciais sem permitir leitura. Copiar a senha ou o hash para uma tabela pública não ajuda login, suporte ou auditoria e aumenta o impacto de um vazamento. A operação administrativa correta é redefinir senha, revogar sessões ou suspender acesso; ninguém, nem proprietário nem administrador, deve visualizar a senha atual.

Referências oficiais: [segurança de senhas no Supabase](https://supabase.com/docs/guides/auth/password-security) e [gerenciamento de usuários](https://supabase.com/docs/guides/auth/managing-user-data).

## Supabase antes do deploy

Há migrations obrigatórias na 1.9.3. Confirme:

1. migrations 11–28 presentes no histórico remoto — confirmado;
2. migrations 24 e 25 aplicadas na ordem — confirmado;
3. `verificar_25_release_1_9_3.sql` sem exceção e com zero linhas no resultado final — confirmado;
4. manter também os verificadores 17, 22 e 23 aprovados no ambiente alvo;
5. CAPTCHA ativado em Authentication > Bot and Abuse Protection — confirmado;
6. política de senha com 8 ou mais caracteres, maiúscula, minúscula, número e símbolo;
7. proteção contra senhas vazadas quando o plano do Supabase permitir — pendente no Free;
8. URLs de site e de recuperação conferidas — confirmado;
9. Supabase Cron configurado para as duas rotinas internas, sem expor `service_role` — confirmado;
10. Security Advisor e Performance Advisor revisados — confirmado;
11. consentimentos de e-mail e WhatsApp testados separadamente;
12. RLS testado com cliente, profissional, recepção, gerente, proprietário, admin, usuário sem vínculo e usuário de outro estabelecimento.

## Variáveis e segredos

Frontend pode receber somente URL do projeto, chave publicável e site key do CAPTCHA. `SUPABASE_SECRET_KEY`, secret do Turnstile e outras credenciais privadas pertencem exclusivamente ao Supabase ou ao backend/deploy. Nenhuma delas deve entrar no Git ou em um ZIP.

## Conclusão

V01–V06 estão corrigidos no ambiente conectado. As migrations 24–28, o verificador, o Cron, o CAPTCHA, as URLs, os Advisors e a matriz de autorização foram concluídos. Permanecem externos: proteção contra senhas vazadas após upgrade para Pro, confirmação das variáveis do deploy e testes completos de interface com contas reais.
