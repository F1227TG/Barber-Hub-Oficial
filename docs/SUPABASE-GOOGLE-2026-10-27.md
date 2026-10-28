# Supabase e acesso Google — preparação em 27/10/2026

## Estado

O controlador OAuth está preparado nos dois projetos, com testes locais de retorno interno, expiração, cancelamento e validação da sessão. Os botões permanecem ocultos por configuração até a ativação dos provedores. Não houve alteração nos painéis Supabase/Google nem publicação deste código.

O trabalho funcional da Beauty Hub foi interrompido a pedido do proprietário para priorizar a infraestrutura. A branch `feat/operacao-real`, na cópia `.tools/beauty-hub-functional`, contém um bootstrap de banco validado em PostgreSQL local. Ele **não deve ser aplicado a um banco existente sem comparação do esquema**. A migração se recusa a prosseguir se encontrar `profiles` ou `beauty_spaces`. As telas operacionais ainda não foram conectadas a esse novo contrato.

## Projetos independentes

| Configuração | Barber Hub | Beauty Hub |
| --- | --- | --- |
| Site de referência | `https://www.barberhuboficial.com.br` | `https://beautyhuboficial.vercel.app` |
| Supabase registrado no código | `dhkqnfqrfqrpumrjjrcy` | `wcorgltszfvhvkpfozwm` |
| Retorno web | `/html/login.html?oauth=google` | `/login.html?oauth=google` |
| Retorno mobile | `/mobile/login.html?oauth=google` | Mesmo retorno web, layout responsivo |
| Ativação no frontend | `window.BH_GOOGLE_LOGIN_ENABLED` em `js/supabase-config.js` | `googleLoginEnabled` em `js/runtime-config.js` |

A URL Supabase registrada para Beauty Hub não resolveu no DNS durante a inspeção. Isso não comprova remoção; verificar existência/status pelo painel conectado antes de reutilizá-la. Se houver um projeto novo, atualizar URL e chave **publishable** na configuração Beauty Hub e substituir seu callback na configuração Google.

## Google Cloud

O proprietário confirmou que ainda não existe projeto Google Cloud para essa integração. Criar um projeto com nome de exibição **Vizu**, sob a conta responsável pelo ecossistema. O ID técnico deve ser único e será definido no painel; não reutilizar um ID presumido. Dentro dele, os dois clientes OAuth devem se chamar **Barber Hub Web** e **Beauty Hub Web**.

1. Selecionar o projeto Google Cloud do proprietário e configurar a tela de consentimento Google Auth Platform: nome, suporte, público, domínio e links reais de privacidade/termos.
2. Criar dois clientes OAuth do tipo **Aplicativo da Web**, identificados por plataforma.
3. No cliente Barber Hub, cadastrar como URI de redirecionamento autorizada:
   `https://dhkqnfqrfqrpumrjjrcy.supabase.co/auth/v1/callback`.
4. No cliente Beauty Hub, usar o callback exibido no painel do projeto confirmado. Se o projeto registrado ainda existir:
   `https://wcorgltszfvhvkpfozwm.supabase.co/auth/v1/callback`.
5. Solicitar somente identificação básica: `openid`, `email` e `profile`. Não há necessidade de acesso ao Gmail, contatos ou agenda para entrar.
6. Durante testes, cadastrar os usuários de teste conforme o público definido. Preparar a publicação da tela de consentimento para o público desejado.

O fluxo utiliza redirecionamento via Supabase, não o widget Google One Tap. O callback Google é o endereço Supabase acima; ele não é a página de login do site. Client Secret fica exclusivamente no painel de autenticação Supabase, nunca no frontend, no Git ou em mensagens.

## Supabase Auth

1. Em cada projeto, habilitar o provedor Google com seu próprio Client ID e Client Secret.
2. Em URL Configuration, definir a Site URL e os retornos exatos permitidos:
   - Barber: `https://www.barberhuboficial.com.br/html/login.html?oauth=google` e `https://www.barberhuboficial.com.br/mobile/login.html?oauth=google`.
   - Beauty: `https://beautyhuboficial.vercel.app/login.html?oauth=google`.
3. Preservar os retornos existentes de confirmação e recuperação de senha. Adicionar variantes somente para domínios realmente utilizados, sem liberar curingas amplos de produção.
4. Conferir a criação do perfil no primeiro login. Barber usa seu trigger e serviço de contas existentes; Beauty precisa do esquema confirmado. Google não atribui papel administrativo. O primeiro perfil Google na base proposta da Beauty é cliente; onboarding profissional continua sendo trabalho pendente.
5. Ativar a flag correspondente no código, executar os testes e então publicar o frontend.

## Validação real antes de ativar para o público

- Entrada de conta Google existente e primeira entrada com criação de perfil.
- Cancelamento do consentimento e falha de rede sem falso sucesso.
- Retorno após login para a plataforma e o contexto corretos.
- Saída e nova entrada sem mistura de sessões entre os dois produtos.
- Rejeição de conta suspensa e de destinos externos; permissões mantidas no backend.
- Desktop, navegador mobile e PWA Barber. Não testar consentimento em navegador embutido incompatível.
- Consentimentos legais e onboarding devem ser registrados pelo fluxo próprio; login Google não deve fabricar aceite de termos.

## Referências

- [Google no Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [URLs de redirecionamento](https://supabase.com/docs/guides/auth/redirect-urls)
- [Proteção dos dados com RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Funções de banco e privilégios](https://supabase.com/docs/guides/database/functions)
