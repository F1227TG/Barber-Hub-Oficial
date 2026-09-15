# Advisors do Supabase — 11 de setembro de 2026

## Execução registrada

- Projeto verificado: `dhkqnfqrfqrpumrjjrcy`.
- Momento: depois das migrations `20260911132254_conclusao_pos31_1_10_1` e `20260911132328_barberhub_1_11_confiabilidade_privacidade`.
- Verificador: `sql/verificar_33_release_1_11.sql`, com todos os campos retornando `true`.
- Resultado geral: nenhum achado de nível `ERROR`. Os avisos abaixo precisam permanecer no registro de risco e não devem ser “corrigidos” em massa sem validar os fluxos que dependem deles.

## Security Advisor

| Regra | Nível | Quantidade | Classificação | Decisão |
|---|---:|---:|---|---|
| `rls_enabled_no_policy` | INFO | 3 | Intencional | `api_rate_limits`, `assinatura_eventos` e `fila_emails` são tabelas internas com RLS sem política permissiva e privilégios diretos revogados. O acesso ocorre apenas pelos caminhos de backend/RPC previstos. |
| `anon_security_definer_function_executable` | WARN | 9 | Superfície pública intencional | As funções listadas atendem consulta pública de marketplace, disponibilidade, horários, promoções e métricas. Elas retornam projeções públicas e não concedem escrita. Manter revisão sempre que o contrato de retorno mudar. |
| `authenticated_security_definer_function_executable` | WARN | 58 | RPCs transacionais intencionais | A aplicação usa funções transacionais expostas para aplicar autorização, locks e invariantes no banco. O linter detecta o privilégio, mas não interpreta as verificações internas de usuário, vínculo, papel e plano. Funções legadas perigosas foram fechadas pela migration 33; novas RPCs devem seguir `search_path` fixo, privilégios mínimos e testes negativos. |
| `auth_leaked_password_protection` | WARN | 1 | Configuração externa pendente | Ativar a proteção contra senhas vazadas no painel do Supabase Auth e testar cadastro/troca de senha. A validação de complexidade do frontend não substitui esse controle. |

Referências oficiais: [RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [funções SECURITY DEFINER anônimas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [funções SECURITY DEFINER autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) e [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Performance Advisor

O Advisor retornou `101` informações de índices ainda não utilizados e nenhum erro. Grande parte corresponde a módulos novos ou pouco exercitados após a migration. Índice “não utilizado” logo após criação não é prova de desperdício.

Decisão:

- não remover índices antes de obter telemetria de consultas reais por um período representativo;
- observar tamanho, gravações e `idx_scan` em produção;
- consolidar apenas índices comprovadamente redundantes, com plano de rollback e comparação de `EXPLAIN (ANALYZE, BUFFERS)` em ambiente seguro;
- repetir o Advisor após o piloto e depois de tráfego representativo.

Referência oficial: [índices não utilizados](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Próximas confirmações externas

- [ ] Ativar e testar proteção contra senhas vazadas.
- [ ] Confirmar Turnstile/CAPTCHA e URLs de redirecionamento.
- [ ] Executar a matriz RLS com contas separadas e dois estabelecimentos de teste.
- [ ] Confirmar backup recuperável e ensaiar restauração em ambiente isolado.
- [ ] Repetir Advisors depois do deployment candidato e após tráfego do piloto.

