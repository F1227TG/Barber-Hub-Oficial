# Barber Hub 1.9.0 — relatório de segurança e dependências externas

## Estado herdado da auditoria V01–V06

| Achado | Estado no código 1.9.0 | Observação |
|---|---|---|
| V01 | Corrigido | autorização continua confirmada por sessão, RLS e regras do servidor |
| V02 | Corrigido | operações sensíveis passam pela API/RPC com validação e limites |
| V03 | Corrigido | políticas públicas inseguras permanecem removidas e as tabelas novas usam RLS |
| V04 | Corrigido | segredos administrativos não são enviados ao navegador |
| V05 | Corrigido no código | rate limiting cobre também os endpoints da 1.9; produção distribuída ainda depende da infraestrutura escolhida |
| V06 | Parcialmente corrigido | migrations e chave pública estão alinhadas; CAPTCHA, senhas vazadas e revisão do Auth dependem do painel do Supabase/Cloudflare |

## Proteções adicionadas na 1.9.0

- nove tabelas novas com RLS;
- autorização por estabelecimento e papel operacional;
- entitlements confirmados pelo PostgreSQL;
- bloqueio de agenda e limite de equipe protegidos por transação/advisory lock;
- reagendamento, encaixe, no-show, ajustes e fechamento em RPCs transacionais;
- trilha de eventos e snapshots para evitar alteração retroativa de histórico;
- unicidade real de regra de comissão mesmo com escopo opcional;
- cliente avulso com identidade técnica única e e-mail técnico ocultado no CRM;
- campos financeiros e notas internas não entram em páginas públicas;
- validação de payload, limites e rate limiting na API 1.4.0.

## Sobre senhas

Não foi criada coluna de senha em `perfis`, clientes, equipe ou qualquer tabela pública. Uma senha descriptografável seria uma vulnerabilidade crítica e contrariaria o funcionamento seguro do Supabase Auth. O provedor mantém um hash não reversível internamente; proprietário e administrador podem identificar a conta pelo e-mail, suspender acesso e iniciar recuperação, mas nunca visualizar a senha atual.

## Ainda depende de configuração externa

- CAPTCHA/Turnstile no Auth;
- proteção contra senhas vazadas;
- credencial privada e Site Key do Turnstile nos ambientes de deploy;
- URLs e templates de e-mail conferidos no Auth;
- backup, alertas e observabilidade;
- testes por papel com contas separadas.

## Antes do deploy

As migrations 11–23 foram aplicadas em 21/08/2026. Os verificadores 17, 22 e 23 passaram, e o Performance Advisor ficou sem warnings. Siga `docs/CONFIGURACAO_EXTERNA_1_9.md` e teste acesso cruzado entre estabelecimentos. A formulação correta agora é: **código e banco remoto alinhados; proteções de Auth e validação por contas ainda dependem de configuração externa**.
