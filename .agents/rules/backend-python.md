# Regra da API Python

Aplicar em `api/**/*.py` e `backend/**/*.py`.

- FastAPI é o ponto de entrada; rotas públicas começam com `/api/v1`.
- Use modelos Pydantic para validar entradas.
- Use I/O assíncrono para chamadas ao Supabase.
- Operações administrativas exigem sessão válida e perfil `admin` ativo.
- Não retorne stack traces, chaves, tokens ou dados desnecessários.
- Padronize respostas em `{ success, data }` ou `{ success, error }`.
- Regras transacionais críticas devem permanecer no PostgreSQL/RPC.
- Documente endpoints novos no OpenAPI e em `docs/API_BARBER_HUB_V1.md`.
- Inclua testes ou ao menos validações de importação/sintaxe.
