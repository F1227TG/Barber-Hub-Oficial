# Relatório de validação — Barber Hub 1.10.1

Data: **5 de setembro de 2026**.

## Porta automatizada

Comando canônico: `npm run check` (executado pelo gerenciador instalado no ambiente).

Resultado: **aprovado**.

- 22 páginas mobile sincronizadas;
- 50 páginas HTML sem IDs duplicados ou links locais quebrados;
- 45 arquivos JavaScript com sintaxe válida;
- nenhuma chave secreta encontrada nos arquivos públicos auditados;
- regressões 1.9.3, 1.10.0 e 1.10.1 aprovadas;
- 27/27 controles V01–V06 aprovados;
- 32/32 invariantes da 1.9.3 aprovadas;
- 67 testes Python/API aprovados;
- compilação Python aprovada;
- `git diff --check` aprovado.

Há um aviso de depreciação da biblioteca de testes Starlette/HTTPX, sem falha funcional. Ele deve ser tratado quando a cadeia de dependências oficial fizer a migração correspondente, sem atualizar bibliotecas de produção às cegas perto do lançamento.

## Verificação visual local

Chrome instalado, páginas servidas localmente e conferidas em 360 px e 1440 px:

| Página | Mobile | Desktop | Observação |
|---|---|---|---|
| Início | aprovado | coberta pela validação estrutural | conteúdo e ações presentes |
| Marketplace | aprovado | aprovado | sem overflow; erro local esperado sem backend completo |
| Suporte | aprovado | coberta pela validação estrutural | conteúdo curto e orientado à ação |
| Beauty Hub | aprovado após correção | aprovado após correção | folha 1.10 carregada e conteúdo não fica oculto pela animação |

As páginas testadas ficaram sem rolagem horizontal involuntária, sem overlay de erro e sem exceção JavaScript de página.

## Guia Word

- arquivo DOCX válido e abre pela biblioteca de documentos;
- 559 parágrafos, 9 tabelas, 1 seção e 1 imagem;
- nenhuma tabela vazia;
- auditoria de acessibilidade: 0 achados altos, médios ou baixos;
- margens e orientação consistentes;
- todos os apêndices esperados incorporados.

A renderização DOCX → imagem não pôde ser executada porque não há Word/LibreOffice instalado neste computador. O arquivo recebeu inspeção estrutural completa; uma última abertura no Word/Google Docs do usuário é recomendada antes de distribuição pública.

## Ambiente Supabase

- objetos de 29–31 consultados e confirmados;
- aplicações manuais 29–31 não constam no histórico oficial;
- migration 32 preparada e ainda não aplicada;
- Advisors revisados antes da migration 32: 0 erros; avisos documentados.

## Estado de release

O código e os artefatos locais estão aprovados. O deploy não está autorizado até concluir migration 32/verificador, segredos VAPID/Cron, CAPTCHA/Auth, nova revisão dos Advisors, RLS por contas reais, backup/recuperação e aparelhos reais.
