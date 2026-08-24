# Barber Hub 1.9.3 — verificação da release

Data da execução: **24/08/2026**.

## Resultado

A release passou pelas verificações locais automatizadas e pela revisão visual possível sem credenciais. Nenhuma migration foi aplicada no Supabase e nenhum deploy, commit ou push foi realizado durante esta preparação.

## Verificações automatizadas aprovadas

| Verificação | Resultado |
|---|---:|
| Testes Python de API e domínio | **50/50** |
| Controles diferenciais V01–V06 | **27/27** |
| Invariantes da release 1.9.3 | **28/28** |
| Operações da aplicação presentes no OpenAPI | **74/74** |
| Páginas HTML sem IDs duplicados/links locais quebrados | **50/50** |
| Arquivos JavaScript com sintaxe válida | **42/42** |
| Páginas mobile sincronizadas | **22/22** |
| Casos de roteamento mobile | **42/42** |
| Segredos encontrados nos arquivos públicos auditados | **0** |

Também foram aprovados: compilação de `api/`, `backend/` e testes; validação estrutural do projeto; proteção do cache PWA `barberhub-v1.9.3-mobile-r3`; regressão de responsividade; e leitura válida do YAML OpenAPI.

## Revisão visual em navegador

Foi usado um servidor local sem conexão a dados reais. Para o Admin, uma prévia estritamente visual removeu JavaScript e autenticação apenas da cópia servida em memória; o código real continuou protegido e redirecionou corretamente uma sessão sem perfil administrativo para o login.

Resultados:

- suporte em 1280 × 720 e 390 × 844, sem overflow horizontal;
- suporte mobile reduzido de aproximadamente 4.100 para 3.100 px de altura inicial, com tickets e perguntas recolhidos;
- termos técnicos de infraestrutura ausentes da área visível de suporte/login;
- Admin em desktop sem sobreposição nos indicadores de saúde;
- Admin mobile com atalhos e indicadores em duas colunas;
- Assinaturas administrativas em desktop e mobile, sem overflow horizontal;
- tabelas administrativas preparadas para virar cards rotulados abaixo de 760 px, sem exigir arrastar lateralmente.

## Comandos de repetição

```text
npm run check
npm run check:release-1.9.3
```

O ambiente desta auditoria não tinha `npm` no PATH. Por isso, cada etapa do script oficial foi executada diretamente com os runtimes equivalentes; as dependências Python declaradas foram instaladas em `.venv` ignorada pelo Git. O resultado funcional é o mesmo da porta de qualidade do projeto.

## Cenários ainda obrigatórios em homologação

1. aplicar migrations 24 e 25 em projeto/branch de homologação;
2. executar `verificar_25_release_1_9_3.sql`;
3. testar RLS com cliente, profissional, recepção, gerente, proprietário, admin, usuário sem vínculo e conta de outro estabelecimento;
4. testar cupom concorrente, resgate concorrente e recorrência com conflito;
5. concluir atendimento e confirmar crédito único de fidelidade;
6. testar Cron para lembretes e notificações internas;
7. habilitar CAPTCHA e repetir cadastro, login e recuperação;
8. revisar recuperação/e-mail real, Storage, Realtime e URLs permitidas;
9. conferir o painel profissional autenticado em 320, 360, 390 e 430 px;
10. revisar Security Advisor e Performance Advisor depois das migrations.

## Limite da aprovação local

Os testes locais provam contratos, regras puras, proteção de rotas sem sessão, estrutura, sincronização e layout estático. Eles não aprovam dados de produção, entrega de e-mail/WhatsApp, CAPTCHA externo, execução do Cron ou isolamento RLS no banco remoto. Esses itens dependem da configuração e do ensaio descritos acima.
