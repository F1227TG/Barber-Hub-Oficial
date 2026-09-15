# Barber Hub 1.11.0

Marketplace de serviços e sistema de gestão para barbearias, desenvolvido por **The Gamers Tech**. O cliente encontra estabelecimentos, compara serviços e agenda. Profissionais e proprietários administram agenda, clientes, equipe, dinheiro e retenção em uma experiência web/PWA responsiva.

## Estado desta entrega

A versão 1.11.0 reúne a conclusão do Planejamento Pós-31, o acabamento da operação diária e as correções finais de continuidade, conta, mobile, administração e privacidade. As duas migrations gerenciadas desta candidata já foram aplicadas no projeto Supabase conectado e o verificador 33 retornou todos os controles como verdadeiros. A publicação comercial ainda depende das configurações externas e da homologação com contas reais.

Principais avanços:

- conta e privacidade reorganizadas, sessões protegidas, exportação e exclusão com prazo de cancelamento;
- agenda com múltiplos períodos, encaixe/atendimento manual, recorrência e continuidade depois do login;
- CRM e financeiro com busca, filtros e paginação;
- marketplace regional, localização consentida, mapa, rota e biblioteca de capas;
- importação orientada de dados, avisos no dispositivo, horário silencioso e fila Web Push;
- auditoria operacional append-only e feature flags com kill switch;
- administração com busca, carregamento progressivo, prontidão e atribuição idempotente de assinaturas;
- suporte mais curto, mobile reforçado e Beauty Hub novamente apresentada como expansão ativa;
- respostas externas normalizadas para impedir carregamento infinito em listas;
- segurança V01–V05 corrigida; V06 permanece parcial até a ativação e o teste externo do CAPTCHA.

## Comece pela documentação

- [Histórico de versões](CHANGELOG.md)
- [Guia completo do projeto](docs/GUIA_COMPLETO_DO_PROJETO.md)
- [Relatório final da versão 1.11.0](docs/release-1.11/RELATORIO_FINAL_1_11_0.md)
- [Checklist operacional da versão 1.11](docs/release-1.11/README.md)
- [Histórico da versão 1.10.1](docs/ATUALIZACAO_1_10_1.md)
- [Conferência final do Planejamento Pós-31](docs/RELATORIO_CONCLUSAO_PLANEJAMENTO_POS31_1_10_1.md)
- [Migrations e deploy seguro](docs/MIGRATIONS_DEPLOY_1_10.md)
- [Relatório de segurança](docs/RELATORIO_SEGURANCA_1_10.md)
- [Homologação final](docs/HOMOLOGACAO_FINAL_1_10.md)
- [Pesquisa e validação](docs/PESQUISA_VALIDACAO_BARBER_BEAUTY_HUB.md)
- [Central de documentação](docs/README.md)

## Arquitetura resumida

```text
Desktop (/html) ─┐
                 ├─ JavaScript e CSS compartilhados ─┐
Mobile (/mobile) ┘                                    │
                                                      ▼
                                               API FastAPI 1.7
                                                      │
                       ┌──────────────────────────────┼──────────────┐
                       ▼                              ▼              ▼
                Supabase Auth                 PostgreSQL/RPC     Storage
                                                 + RLS          + Realtime
```

`html/` é a fonte das páginas sincronizadas em `mobile/`. O mobile tem shell e prioridades próprios, mas não duplica regras de negócio. A API está dividida entre regras puras em `backend/domain/` e integrações/casos de uso em `backend/services/`.

Consulte [ARCHITECTURE.md](ARCHITECTURE.md) para as fronteiras completas.

## Tecnologias

- HTML, CSS e JavaScript vanilla;
- PWA com Service Worker;
- Python 3.13, FastAPI, Pydantic e HTTPX;
- Supabase Auth, PostgreSQL, RLS, RPC, Storage e Realtime;
- Vercel para frontend e função Python.

## Desenvolvimento

Requisitos: Node.js 20+ e Python 3.13.

```bash
vercel dev
```

API local:

```bash
fastapi dev api/index.py
```

Depois de alterar um arquivo em `html/`, sincronize as páginas móveis:

```bash
npm run mobile:sync
```

Antes de qualquer commit ou deploy:

```bash
npm run check
```

A validação reúne paridade mobile, roteamento, referências, sintaxe, regressões 1.9.3/1.10/1.10.1/1.11, segurança V01–V06, compilação e testes Python.

## Banco e publicação

Os arquivos gerenciados que fecham esta candidata são:

```text
20260911132254_conclusao_pos31_1_10_1.sql
20260911132328_barberhub_1_11_confiabilidade_privacidade.sql
sql/verificar_33_release_1_11.sql
```

No projeto Supabase conectado, as migrations foram aplicadas nessa ordem e o verificador 33 foi aprovado. Não edite nem reaplique migrations já registradas. Antes do deploy, confirme o histórico remoto, mantenha backup recuperável, execute novamente o verificador somente leitura e revise os Advisors.

Também são externos ao Git: URLs autorizadas, CAPTCHA/Turnstile, proteção contra senhas vazadas quando disponível, origens da API, chaves VAPID/worker, Advisors e testes com contas reais por papel/plano.

## Senhas

O Barber Hub nunca exibe nem duplica a senha do usuário. O Supabase Auth guarda um hash não reversível; administradores só podem enviar um link de redefinição ao titular. Uma senha descriptografável em tabela aumentaria o risco de vazamento e não é necessária para autenticação.

## Repositórios

Web, PWA/mobile e API continuam juntos durante a finalização porque compartilham modelo, autenticação, release e testes. A separação será reavaliada quando existir aplicativo nativo, equipe ou deploy independentes. O **Beauty Hub permanece em repositório próprio**, sem compartilhar credenciais ou banco de produção.

Veja [a decisão completa](docs/DECISAO_REPOSITORIOS_1_10.md).
