# Auditoria de senhas — Barber Hub e Beauty Hub

## Decisão

Nenhuma das aplicações deve ter uma coluna própria contendo senha em texto, senha reversível ou cópia do hash. A credencial fica exclusivamente no provedor de autenticação.

## Barber Hub

- cadastro usa Supabase Auth;
- login usa validação do Auth;
- recuperação envia link ao titular;
- alteração de senha usa sessão/token de recuperação;
- tabelas públicas guardam perfil e papel, não credencial;
- Admin pode iniciar recuperação, mas não visualizar senha.

O Supabase mantém o campo interno `auth.users.encrypted_password`. Apesar do nome, ele armazena um hash bcrypt não reversível com salt. A existência desse hash satisfaz a necessidade técnica de autenticação; não significa que professor, administrador ou suporte possa recuperar a senha original.

## Beauty Hub

Foi revisada a cópia local disponível em:

```text
C:\Users\fabri\Documents\Codex\2026-08-18\referenced-chatgpt-conversation-this-is-an\work\beauty-hub-official
```

Ela usa `signUp`, `signInWithPassword`, recuperação e atualização de senha do Supabase. Não foi encontrada autenticação própria nem coluna de senha na aplicação. O repositório remoto informado não estava acessível durante a revisão; portanto a conclusão vale para a cópia local, e a sincronização com o remoto deve ser confirmada no próprio projeto Beauty.

## Ajuste recomendado para o Beauty Hub

Alinhar a interface de nova senha ao checklist do Barber Hub e configurar no Auth a mesma política mínima, CAPTCHA, URLs autorizadas e proteção contra senhas vazadas. Isso pertence ao repositório Beauty e não foi misturado nesta entrega do Barber Hub.

## Proibição operacional

- nunca registrar senha em log, ticket, importação ou auditoria;
- nunca enviar senha por e-mail/WhatsApp;
- nunca criar criptografia reversível para “visualização administrativa”;
- nunca copiar `encrypted_password` para tabela pública;
- em suspeita de comprometimento, revogar sessão e enviar redefinição.

Referência oficial: <https://supabase.com/docs/guides/auth/password-security>
