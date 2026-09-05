# Barber Hub 1.10.1

Marketplace de serviços e sistema de gestão para barbearias, desenvolvido por **The Gamers Tech**. O cliente encontra estabelecimentos, compara serviços e agenda. Profissionais e proprietários administram agenda, clientes, equipe, dinheiro e retenção em uma experiência web/PWA responsiva.

## Estado desta entrega

A versão 1.10.1 conclui o escopo técnico do Planejamento Pós-31. No Supabase conectado, os objetos das migrations 29–31 foram confirmados, embora essas execuções manuais não constem no histórico oficial de migrations. A migration 32 e seu verificador são a etapa de banco ainda pendente; publicação também depende de configuração externa e homologação com contas reais.

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
- [Resumo da versão 1.10.1](docs/ATUALIZACAO_1_10_1.md)
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

A validação reúne paridade mobile, roteamento, referências, sintaxe, regressões 1.9.3/1.10/1.10.1, segurança V01–V06, compilação e testes Python.

## Banco e publicação

As migrations 01–28 formam o histórico registrado. A 1.10 adiciona:

```text
29_operacao_real_horarios_atendimentos_1_10.sql
30_localizacao_biblioteca_marketplace_1_10.sql
31_push_importacoes_auditoria_flags_1_10.sql
verificar_31_release_1_10.sql
20260904180741_32_conclusao_pos31_1_10_1.sql
verificar_32_conclusao_1_10_1.sql
```

No ambiente conectado, os objetos de 29–31 foram verificados como presentes. Não reaplique esses arquivos às cegas. Depois de backup, aplique a **migration 32** pelo fluxo oficial de migrations e execute o **verificador 32**. Isso preserva rastreabilidade a partir desta versão sem fingir que execuções manuais antigas constam no histórico.

Também são externos ao Git: URLs autorizadas, CAPTCHA/Turnstile, proteção contra senhas vazadas quando disponível, origens da API, chaves VAPID/worker, Advisors e testes com contas reais por papel/plano.

## Senhas

O Barber Hub nunca exibe nem duplica a senha do usuário. O Supabase Auth guarda um hash não reversível; administradores só podem enviar um link de redefinição ao titular. Uma senha descriptografável em tabela aumentaria o risco de vazamento e não é necessária para autenticação.

## Repositórios

Web, PWA/mobile e API continuam juntos durante a finalização porque compartilham modelo, autenticação, release e testes. A separação será reavaliada quando existir aplicativo nativo, equipe ou deploy independentes. O **Beauty Hub permanece em repositório próprio**, sem compartilhar credenciais ou banco de produção.

Veja [a decisão completa](docs/DECISAO_REPOSITORIOS_1_10.md).
