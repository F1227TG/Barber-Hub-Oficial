# Uso do Google Antigravity no Barber Hub

O repositório já contém regras em `.agents/rules/` e uma skill de release em `.agents/skills/barberhub-release/`.

## Configuração recomendada

1. Abra a pasta raiz como Project no Antigravity.
2. Mantenha acesso fora do workspace desativado.
3. Deixe comandos destrutivos e acesso web como **Ask**.
4. Autorize automaticamente apenas comandos de validação conhecidos, como:
   - `npm run check`
   - `python scripts/validate_project.py`
   - `git diff`
5. Nunca cole chaves da Vercel/Supabase no chat do agente ou em arquivos rastreados.

## Exemplos de tarefas

- "Revise o fluxo de agendamento sem alterar o schema."
- "Crie testes para os endpoints FastAPI e rode os validadores."
- "Audite a versão mobile em 360 px e corrija apenas problemas de usabilidade."
- "Atualize o mapa de navegação após criar uma nova página."
