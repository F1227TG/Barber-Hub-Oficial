# Barber Hub 1.3.0 — Comunidade, controle e experiência mobile

## O que foi adicionado

- Avaliações verificadas ligadas a atendimentos concluídos.
- Resposta pública do estabelecimento e moderação administrativa.
- Favoritos e opção de agendar novamente.
- Instagram e TikTok no cadastro e na página pública do estabelecimento.
- Exclusão de conta com reautenticação, confirmação escrita e proteção do último administrador.
- Selo de estabelecimento verificado e destaque no portal.
- Nova página **Sobre**, com objetivo, público e relação com a The Gamers Tech.
- Página inicial redesenhada com menos cards e uma narrativa mais visual.
- Página de planos mensal e novo Programa Fundadores.
- Painel administrativo ampliado para usuários, estabelecimentos, agendamentos, avaliações, moderação e tickets.
- Navegação web compacta com menu **Mais**.
- Navegação mobile em formato de aplicativo, com barra inferior e tabelas adaptadas para cards.
- Identidade institucional padronizada como **“Uma plataforma de The Gamers Tech”**.

## Banco de dados

Execute a migration abaixo no Supabase antes de testar avaliações, selo, TikTok e exclusão de conta:

```text
sql/12_comunidade_conta_admin_mobile.sql
```

A migration deve ser aplicada depois das anteriores, na ordem numérica. Faça um backup antes de executar em produção.

## Testes prioritários

1. Cliente conclui agendamento e publica avaliação.
2. Estabelecimento responde à avaliação.
3. Administrador publica, analisa ou oculta avaliação.
4. Cliente favorita um estabelecimento e usa “Agendar novamente”.
5. Profissional salva Instagram e TikTok e confere a página pública.
6. Cliente exclui a própria conta após confirmar senha e digitar `EXCLUIR`.
7. Último administrador tenta excluir a conta e recebe bloqueio.
8. Menu desktop agrupa opções excedentes em “Mais”.
9. Menu mobile exibe os acessos principais conforme o perfil.

## Observação sobre exclusão de conta

Os dados pessoais da conta são removidos pelo Supabase Auth. Registros de atendimento podem ser mantidos de forma anonimizada quando forem necessários para integridade histórica, segurança e prestação de contas, conforme os Termos e a Política de Privacidade.
