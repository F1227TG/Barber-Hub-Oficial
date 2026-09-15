# Credenciais e senhas — decisão de segurança

## Decisão

O Barber Hub **não cria uma coluna própria para guardar ou exibir senhas**. Nem o proprietário, nem a equipe, nem um administrador do sistema deve conseguir visualizar a senha de um usuário.

O Supabase Auth mantém a credencial em `auth.users.encrypted_password` como um hash não reversível. Esse valor serve somente para o provedor conferir uma tentativa de login; ele não permite recuperar a senha original e não deve ser copiado para tabelas públicas, retornado pela API ou mostrado no painel administrativo.

Essa escolha evita que uma falha no banco transforme todas as credenciais em senhas reutilizáveis e mantém a aplicação alinhada com o princípio de menor privilégio.

## O que o suporte pode fazer

- enviar um link de redefinição de senha;
- encerrar outras sessões depois de autenticação recente;
- verificar se o e-mail está confirmado e se a conta está ativa;
- orientar o usuário a criar uma nova senha forte;
- consultar auditoria sem acessar a credencial.

## O que nunca deve existir

- senha em texto puro;
- criptografia reversível de senha;
- senha ou hash em `public.perfis` ou outra tabela acessível pelo aplicativo;
- endpoint, exportação, log ou tela administrativa que revele `encrypted_password`;
- envio de senha atual por e-mail, WhatsApp ou suporte.

## Política de implementação

1. Cadastro, login e recuperação continuam exclusivamente pelo Supabase Auth.
2. A API usa apenas o token de sessão recebido e não recebe a senha do usuário nas rotas de negócio.
3. Operações críticas exigem uma autenticação forte recente.
4. Exportações LGPD excluem hashes, tokens e segredos.
5. A proteção contra senhas vazadas deve ser ativada no painel do provedor de autenticação.

## Resposta para revisão acadêmica

Se for necessário demonstrar que a credencial existe no banco, a evidência correta é a documentação e a configuração do Supabase Auth, não a exposição do valor. O campo interno contém somente um hash de autenticação e permanece isolado no esquema `auth`; o produto deliberadamente não oferece visualização da senha.
