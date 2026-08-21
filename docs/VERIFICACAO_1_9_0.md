# Barber Hub 1.9.0 — verificação local

Data: 21/08/2026

## Aprovado

- 50 páginas HTML sem IDs duplicados ou referências locais quebradas;
- 42 arquivos JavaScript aprovados na verificação de sintaxe;
- sincronização das 22 páginas mobile aprovada;
- roteamento web/mobile/file aprovado;
- validação estrutural sem erros ou avisos de acessibilidade;
- 27/27 controles diferenciais V01–V06 aprovados;
- 23/23 invariantes estáticos da 1.9.0 aprovados;
- 14/14 testes offline de domínio aprovados;
- compilação de `api/` e `backend/` aprovada;
- regressão do Service Worker/MutationObserver aprovada;
- `git diff --check` sem erros de whitespace;
- nenhuma chave secreta encontrada nos arquivos públicos auditados.

## Limites desta execução

Os testes HTTP em `tests/test_api.py` foram atualizados, mas não puderam ser executados nesta máquina porque o runtime temporário não contém FastAPI e a rede bloqueou a instalação das dependências do `requirements.txt`. Eles devem rodar no CI/deploy com as dependências Python instaladas.

As migrations 11–23 foram aplicadas ao Supabase. Os verificadores 17, 22 e 23 passaram; o Performance Advisor ficou sem warnings e mantém apenas informações de índices ainda não utilizados. Permanecem pendentes CAPTCHA, proteção contra senhas vazadas e testes autenticados com contas separadas. Consulte `docs/CONFIGURACAO_EXTERNA_1_9.md`.
