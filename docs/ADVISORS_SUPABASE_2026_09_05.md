# Advisors do Supabase — fotografia de 5 de setembro de 2026

Esta fotografia foi obtida antes da aplicação da migration 32.

## Resultado resumido

| Advisor | Erros | Avisos | Informações |
|---|---:|---:|---:|
| Segurança | 0 | 58 | 1 |
| Desempenho | 0 | 1 | 92 |

## Segurança

- `unaccent` e `btree_gist` estão no schema `public`;
- funções `SECURITY DEFINER` públicas ou autenticadas são sinalizadas pelo linter;
- as RPCs públicas de catálogo/agenda são intencionais e retornam dados públicos;
- RPCs autenticadas permanecem autorizadas somente quando validam identidade, vínculo, papel e escopo internamente;
- `buscar_marketplace_regional_110` ainda aparece acessível no ambiente atual; a migration 32 revoga `anon`/`authenticated` dessa versão antiga e publica a variante segura usada pela API.

Não foi feita revogação em massa: isso quebraria fluxos legítimos e não provaria segurança. Cada função precisa ser julgada pelo contrato e pelas verificações internas.

Referência: <https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable>

## Desempenho

O único aviso é a existência de duas políticas permissivas de leitura em `biblioteca_capas` para `authenticated`: uma pública e outra administrativa. O resultado é compatível com a intenção, mas pode ser simplificado numa migration futura se a medição indicar necessidade.

As 92 informações são principalmente índices ainda não utilizados. Eles não foram removidos antes do piloto porque um banco com pouco tráfego não produz evidência suficiente de inutilidade. A decisão correta é medir consultas e planos de execução com uso real.

Referência: <https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies>

## Ação obrigatória

Depois de aplicar a migration 32 e executar o verificador, abra novamente os dois Advisors. Compare esta fotografia, confirme que a RPC antiga saiu da superfície pública e registre qualquer aviso novo antes do deploy.
