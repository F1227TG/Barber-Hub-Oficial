# Diagnóstico inicial para a Feira de Tecnologia

Data da auditoria: **26/10/2026**  
Repositório: **Barber Hub Oficial** (`F1227TG/Barber-Hub-Oficial`)  
Branch/commit examinados: `main` / `d905529c4b352d830a7424a99d3c55b9d1a60deb`

## Estado atual

O repositório aberto contém o Barber Hub, uma aplicação web/PWA com API própria. Não é o repositório do Beauty Hub nem há um repositório Vizu nesta pasta. Há uma página-ponte do Beauty Hub em `html/beauty-hub.html`, mas ela não substitui a auditoria do código e do deployment próprios do produto.

Antes desta entrega, o estado do Git estava limpo, sincronizado com `origin/main`. O último commit tem status **Vercel: sucesso** no GitHub. O conector GitHub não retornou um resultado do job Actions de navegador para esse commit. O site publicado não pôde ser aberto pelo navegador de auditoria; isso limita a confirmação externa e não prova indisponibilidade do site. As alterações Vizu listadas neste relatório estão agora no workspace, ainda sem commit, push ou publicação.

O produto usa HTML, CSS e JavaScript sem framework de SPA; Python 3.13, FastAPI e Pydantic na API; Supabase para Auth, PostgreSQL/RLS, Storage e Realtime; e Vercel para frontend, API e cron. A auditoria inicial contou 50 páginas HTML; com a nova Vizu, o validador atual encontra 51. A sincronização mobile cobre 22 páginas funcionais. A API está organizada em routers por domínio e camadas de domínio, serviços, schemas e integrações.

## Páginas e fluxos importantes

- Entrada e apresentação do Barber Hub: `index.html`.
- Descoberta e estabelecimento: `html/portal.html` e `html/barbearia.html`.
- Agendamento: `html/agendamento.html`, com continuação após login; agenda do cliente em `html/cliente.html`.
- Operação profissional: cadastro do estabelecimento, `html/painel.html`, equipe, agenda, CRM e financeiro.
- Administração e conta: `html/admin.html`, assinaturas, notificações, privacidade, recuperação e exclusão de conta.
- Produtos relacionados: `html/beauty-hub.html` faz a ponte para o Beauty Hub. Os recursos realmente operacionais do Beauty Hub e sua versão publicada não foram verificados neste repositório.

Fluxos prioritários para a demonstração: visitante explora o marketplace; cliente abre um perfil e inicia agendamento; profissional mostra a configuração de agenda e o painel; a apresentação institucional explica como as duas plataformas se relacionam sob a Vizu sem fundir as marcas.

## Testes executados nesta auditoria

| Verificação | Resultado observado |
| --- | --- |
| `npm run check` | **16 verificações aprovadas**; inclui sincronização mobile, roteamento, CSS, referências, sintaxe, regressões e segurança. |
| Suíte Python dentro do check | **157 testes aprovados**. |
| Testes JavaScript do cliente da API | **4 aprovados**. |
| Teste PostgreSQL em memória (PGlite) | **1 suíte aprovada**, cobrindo permissões, exclusão lógica, auditoria, rollback e proteção do último administrador. |
| Auditoria estática V01–V06 | **27/27 controles aprovados**; isso não é teste de Auth/RLS remoto. |
| `npm run check:browser` | **15/15 cenários aprovados**: 10 cenários de acesso por papel e 5 da página Vizu, incluindo 360, 768 e 1440 px, menu móvel, links e preferência por movimento reduzido. |
| `npm run check:visual` | **50/50 snapshots aprovados** em Windows com Chromium fixado pelo Playwright, sem atualizar a baseline. |

O teste Python emite um aviso de depreciação do `TestClient` do Starlette, sem falha. Os testes de banco usam PGlite em memória; os testes de navegador simulam identidade e rede. Nenhum deles comprova o comportamento da conta Supabase de produção.

### Verificação do job de navegador que falhou

O registro local em `docs/modernizacao/ETAPA_2.md` descreve a falha do job `browser` no commit `cdc175c`: os 10 testes funcionais passaram, mas os 50 screenshots excederam a comparação entre Windows desktop e Windows Server, com diferenças de rasterização de 1–3% e até 5 px de altura. A configuração atual permite até 4% de diferença. Nesta auditoria, os 50 snapshots voltaram a passar com o Chromium fixado pelo Playwright, ambiente compatível com a configuração do job. O resultado do job Actions para o commit atual ainda precisa ser conferido diretamente no GitHub; o único check remoto retornado nesta consulta foi o sucesso do deployment Vercel.

## Problemas, riscos e prioridade

| Prioridade | Item e evidência | Impacto / ação |
| --- | --- | --- |
| **Bloqueio antes de operar com contas reais** | A migration `supabase/migrations/20261022155131_modernizacao_contas_administrativas.sql` ainda está descrita como pendente de homologação e aplicação em `docs/modernizacao/ETAPA_1.md` e `ARCHITECTURE.md`. | Não publicar a API/web dessa etapa isoladamente. Ensaiar a migration em ambiente isolado, validar sessões, RLS, concorrência, onboarding e recuperação; depois aplicar e testar em conjunto conforme o processo de release. |
| **Alta — segurança externa** | V06 permanece parcial até configurar e testar Turnstile/CAPTCHA e domínios autorizados. Testes por perfis reais, Storage, Realtime e RLS também continuam pendentes nos documentos de release. | Para demonstração, usar apenas ambiente e contas de teste. Não declarar o fluxo autenticado pronto para uso comercial com base nos testes locais. |
| **Alta — demonstração pública** | Não foi possível verificar visualmente o deployment ou completar uma jornada no domínio publicado nesta sessão. O check Vercel do commit atual está verde, mas não substitui smoke test no browser. | Fazer ensaio no domínio final, em celular e desktop, com contas de teste e plano de retorno para falha de rede/login. |
| **Alta — Beauty Hub** | O checkout do repositório aberto não inclui o repositório independente do Beauty Hub, e a URL publicada também não pôde ser aberta pelo navegador de auditoria. | Conferir o repositório/deployment do Beauty Hub separadamente e apresentar apenas recursos observados funcionando. |
| **Média — cobertura visual** | A baseline cobre login, portal, conta, administração, privacidade e filtros; ainda não abrange o agendamento completo, painel profissional, planos, assinaturas, todos os modais ou acessibilidade integral. | Priorizar esses fluxos no ensaio manual da feira; ampliar snapshots após a demonstração. |
| **Média — segurança no frontend** | `docs/modernizacao/BACKLOG.md` registra leituras/escritas diretas no navegador ainda não migradas integralmente para a API e auditoria IDOR por concluir. | Não ampliar o escopo da refatoração nesta preparação; manter operações sensíveis fora da demonstração se não estiverem homologadas. |
| **Depois da feira** | CSS antigo ainda é carregado em camadas por release; repositories de domínio, carga/resiliência, eventos, filas e tracing ainda não foram concluídos. | Manter no backlog da modernização. Não fazer extração ampla agora. |

## Plano de quatro dias

1. **Dia 1 — apresentação Vizu:** concluída localmente como página independente `vizu.html` neste checkout do Barber Hub, com identidade inspirada no moodboard, áreas equilibradas para as duas plataformas, links e suporte a movimento reduzido. Os testes locais passaram; a rota ainda precisa ser publicada e conferida no domínio final.
2. **Dia 2 — Barber Hub:** ensaiar marketplace → estabelecimento → início de agendamento e painel profissional → agenda, com dados e contas de demonstração. Corrigir apenas falhas reproduzíveis que afetem o percurso.
3. **Dia 3 — Beauty Hub:** auditar separadamente o repositório e o deployment publicados, registrar o que realmente funciona e ajustar o texto demonstrativo para refletir isso.
4. **Dia 4 — ensaio e congelamento:** validar URLs/QRs, desktop, celular, rede instável e dados demonstrativos; conferir o Actions remoto, registrar o deployment final e congelar mudanças antes da feira.

## Correção prioritária executada

Foi criada a rota institucional `vizu.html` sem substituir a home do Barber Hub nem as identidades dos produtos. Ela usa SVG próprio inspirado no moodboard, apresentação curta, dois painéis equilibrados, navegação responsiva, animações com fallback de movimento reduzido e links para os sites indicados no briefing. A página e seus recursos foram incluídos no pré-cache do PWA; a home desktop, a página institucional e a entrada mobile agora apontam para Vizu. O repositório disponível é o Barber Hub, então essa rota serve à demonstração deste checkout; ela não significa que um site/repositório Vizu independente já exista.

Próxima ação: conferir o check `browser` no GitHub depois de publicar este conjunto de alterações e ensaiar os fluxos Barber/Beauty nos ambientes e contas de demonstração.

## Limites do diagnóstico

Esta auditoria foi local e somente leitura quanto a dados de produto: não consultou nem alterou o Supabase, não executou operações com contas reais, não aplicou migrations, não fez deploy e não verificou a disponibilidade HTTP do domínio. O resultado Vercel vem do status associado ao commit; os checks de segurança e a suíte visual são evidências locais, não aprovação de produção.
