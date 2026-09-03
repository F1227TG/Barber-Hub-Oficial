# Barber Hub 1.10.0

Marketplace de serviços e sistema de gestão para barbearias, desenvolvido por **The Gamers Tech**. O cliente encontra estabelecimentos, compara serviços e agenda. Profissionais e proprietários administram agenda, clientes, equipe, dinheiro e retenção em uma experiência web/PWA responsiva.

## Estado desta entrega

A versão 1.10.0 está em preparação local. O código e os testes acompanham as novas funções, mas ela **ainda não deve ser publicada**: as migrations 29–31 não foram aplicadas no ambiente de produção e a homologação externa permanece pendente.

Principais avanços:

- agenda com múltiplos períodos, encaixe/atendimento manual e continuidade depois do login;
- CRM e financeiro com busca, filtros e paginação;
- marketplace regional, localização consentida, mapa, rota e biblioteca de capas;
- importação orientada de dados, avisos no dispositivo, horário silencioso e fila Web Push;
- auditoria operacional append-only e feature flags com kill switch;
- administração com busca no servidor, carregamento progressivo e prontidão da release;
- suporte mais curto, mobile reforçado e Beauty Hub novamente apresentada como expansão ativa;
- segurança V01–V05 corrigida no código; V06 depende da ativação externa do CAPTCHA.

## Comece pela documentação

- [Guia completo do projeto](docs/GUIA_COMPLETO_DO_PROJETO.md)
- [Resumo da versão 1.10.0](docs/ATUALIZACAO_1_10_0.md)
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
                                               API FastAPI 1.6
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

A validação reúne paridade mobile, roteamento, referências, sintaxe, regressões 1.9.3/1.10, segurança V01–V06, compilação e testes Python.

## Banco e publicação

As migrations 01–28 formam o histórico existente. A 1.10 adiciona:

```text
29_operacao_real_horarios_atendimentos_1_10.sql
30_localizacao_biblioteca_marketplace_1_10.sql
31_push_importacoes_auditoria_flags_1_10.sql
verificar_31_release_1_10.sql
```

No ambiente atual, aplique somente **29 → 30 → 31 → verificador 31**, nessa ordem e depois de backup. Não execute isso automaticamente a partir do frontend nem altere migrations já aplicadas.

Também são externos ao Git: URLs autorizadas, CAPTCHA/Turnstile, proteção contra senhas vazadas quando disponível, origens da API, chaves VAPID/worker, Advisors e testes com contas reais por papel/plano.

## Senhas

O Barber Hub nunca exibe nem duplica a senha do usuário. O Supabase Auth guarda um hash não reversível; administradores só podem enviar um link de redefinição ao titular. Uma senha descriptografável em tabela aumentaria o risco de vazamento e não é necessária para autenticação.

## Repositórios

Web, PWA/mobile e API continuam juntos durante a finalização porque compartilham modelo, autenticação, release e testes. A separação será reavaliada quando existir aplicativo nativo, equipe ou deploy independentes. O **Beauty Hub permanece em repositório próprio**, sem compartilhar credenciais ou banco de produção.

Veja [a decisão completa](docs/DECISAO_REPOSITORIOS_1_10.md).
