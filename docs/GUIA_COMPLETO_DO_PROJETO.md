# Guia completo do Barber Hub

Versão de referência: **1.9.3**  
Marca: uma plataforma de **The Gamers Tech**  
Leitores: produto, design, desenvolvimento, segurança, operação e avaliadores acadêmicos.

## 1. O projeto em uma frase

O Barber Hub reúne descoberta de barbearias, confiança pública, agendamento e gestão operacional em uma experiência única para cliente, profissional, proprietário e administrador.

## 2. Problema real e proposta

O cliente precisa descobrir um estabelecimento confiável, entender serviços/preços, encontrar disponibilidade e agendar sem depender do horário em que alguém responde mensagens. A barbearia precisa transformar pedidos dispersos em agenda, histórico de clientes, visão financeira e ações de retenção sem perder a simplicidade do dia a dia.

O Barber Hub resolve essas duas jornadas no mesmo fluxo:

```text
descoberta → perfil confiável → serviço/profissional → horário → confirmação
                                                        ↓
                         agenda → CRM → financeiro → retenção/crescimento
```

Para o cliente, o valor principal é conveniência e segurança de escolha. Para a barbearia, é reduzir trabalho manual, organizar capacidade, conhecer recorrência e tomar decisões a partir de dados operacionais.

## 3. Validação da oportunidade

### 3.1 Evidência brasileira

- A classificação oficial do IBGE coloca barbearias, cabeleireiros, manicure/pedicure, estética e outros cuidados de beleza no mesmo conjunto econômico CNAE 96.02-5. Isso sustenta uma base técnica comum para Barber Hub e a futura expansão Beauty Hub, embora os fluxos de cada especialidade precisem ser validados separadamente. Fonte: [IBGE/CONCLA](https://concla.ibge.gov.br/busca-online-cnae?classe=96025&tipo=cnae&versao=9&view=classe).
- Estudo publicado no repositório do Ipea registra que as subclasses de cabeleireiros/manicure/pedicure e estética/cuidados de beleza passaram de 4,47 mil MEIs ativos em 2009 para 1,23 milhão em 2021. É uma evidência de grande base de pequenos operadores, não uma estimativa direta do mercado endereçável do Barber Hub. Fonte: [Ipea](https://repositorio.ipea.gov.br/bitstreams/fbdf1878-c384-41dc-8994-80b181723b0d/download).
- O Ministério do Empreendedorismo informou 16,8 milhões de MEIs no país em 2025 e reconhece dificuldades de gestão e acesso a ferramentas digitais. Isso valida o contexto de microempreendedores que precisam de soluções operacionais acessíveis, mas inclui muitos setores além de beleza. Fonte: [MEMP — MEI em Ação](https://www.gov.br/memp/pt-br/assuntos/noticias/governo-federal-lanca-pacote-201cmei-em-acao201d-com-novo-app-rede-integrada-e-solucoes-digitais-para-fortalecer-16-milhoes-de-microempreendedores).
- O Banco Central encontrou 355 mil observações na atividade de cabeleireiros, manicure e pedicure e participação feminina de 96,6% em estética e outros cuidados de beleza. Isso reforça que a expansão Beauty Hub precisa ser construída com pesquisa inclusiva e não como simples troca de nome/cores. Fonte: [Banco Central do Brasil](https://www.bcb.gov.br/noticiablogbc/26/noticia).
- A ABIHPEC estima cerca de R$ 200 bilhões no setor brasileiro de produtos de Beleza e Cuidados Pessoais em 2025, com aproximadamente 7 milhões de oportunidades de trabalho na cadeia. O dado mostra força do ecossistema, mas cobre produtos e cadeia ampliada; não deve ser apresentado como faturamento de salões/barbearias. Fonte: [ABIHPEC](https://abihpec.org.br/tamanho-mercado-cosmeticos-brasil-2026/).

### 3.2 Evidência de comportamento digital

- O Google orienta negócios locais a publicar horários, serviços, fotos, avaliações e links de agendamento para ajudar clientes a encontrar e confiar no estabelecimento. Isso valida a combinação de marketplace, reputação e ação de agendar. Fontes: [Perfil da Empresa](https://support.google.com/business/answer/7039811?hl=pt-BR) e [links de agendamento](https://support.google.com/business/answer/6218037?hl=pt-BR).
- O Reservar com o Google inclui beleza como categoria e permite selecionar serviço, horário e, quando disponível, profissional. Isso confirma que agendar beleza digitalmente é um comportamento de plataforma já estabelecido. Fontes: [Reservar com o Google](https://www.google.com/maps/reserve?hl=pt-br) e [fluxo oficial de agendamento](https://support.google.com/reserve/answer/9172842?hl=pt-BR).
- O guia de negócio do Sebrae para barbearias recomenda presença digital, Google Perfil da Empresa e WhatsApp Business para agendamento/atendimento. É orientação setorial, não medição de resultado, mas reforça que descoberta e relacionamento digital já fazem parte da operação esperada. Fonte: [Sebrae — Ideia de negócio: barbearia](https://bibliotecas.sebrae.com.br/chronus/ARQUIVOS_CHRONUS/IDEIAS_DE_NEGOCIO/PDFS/ideia-de-negocio_barbearia.pdf).
- Como sinal internacional — não como prova do mercado brasileiro — o benchmark 2025 da Zenoti analisa mais de 30 mil negócios na América do Norte. O recorte publicado registra 4% de no-show e 2% de cancelamento para barbearias, e 3%/8% para salões. Esses dados sustentam testar lembretes, confirmação e lista de espera; não autorizam projetar a mesma taxa no Brasil. Fontes: [benchmark 2025](https://www.zenoti.com/resources/beauty-and-wellness-benchmark-report-2025) e [métricas publicadas](https://www.zenoti.com/thecheckin/beauty-wellness-industry-statistics-2025).

### 3.3 O que está validado e o que ainda é hipótese

Validado por fontes: setor amplo e numeroso, presença de muitos pequenos operadores, relevância da gestão, uso de descoberta local e links de agendamento. Validado pelo código/produto: é tecnicamente possível integrar catálogo, agenda, CRM, finanças e RLS.

Ainda precisa de entrevistas/piloto brasileiro: disposição a pagar por plano, taxa real de no-show, canal preferido de lembrete, valor percebido da Central de Oportunidades, regras específicas de salão/estética e integração com pagamento.

## 4. Públicos e valor entregue

### Cliente

Pesquisa estabelecimentos, compara serviços, equipe, portfólio e avaliações, agenda, acompanha status, salva favoritos e gerencia conta/privacidade.

### Profissional e proprietário

Controla presença pública, serviços, equipe, agenda do dia/semana, bloqueios, encaixes, clientes, notas internas, receita, comissões e fechamento. O plano efetivo define capacidades sem apagar histórico em downgrade.

### Equipe

Recepção, profissional e gerente acessam apenas o necessário ao papel e estabelecimento vinculados. A interface pode ocultar opções, mas a autorização verdadeira continua na API e no PostgreSQL/RLS.

### Administrador

Modera estabelecimentos, acompanha integridade operacional, atribui planos e executa ações administrativas auditáveis sem conhecer senhas de usuários.

## 5. Estado funcional da versão 1.9.3

Implementado: marketplace, perfis públicos, agendamento multi-serviço, autenticação/recuperação, PWA, painel por perfil, planos/entitlements, Agenda 2.0, CRM persistente, financeiro, comissões, fechamento, papéis de equipe, moderação, avaliações, portfólio e suporte.

Implementado na 1.9.3: lista de espera, recorrência, fidelidade, carteira/recompensas do cliente, cupons, campanhas com fila, lembretes internos, oportunidades, insights, metas e permissões granulares. E-mail/WhatsApp automáticos permanecem parciais porque dependem de um provedor/worker externo. Cobrança automática, integrações de calendário/pagamento e Beauty Hub independente continuam no roadmap.

Não prometer como pronto: automação completa de marketing, IA de crescimento, aplicativo nativo de loja e integração oficial com Reservar com o Google.

## 6. Arquitetura

```text
Desktop (/html) ─┐
                 ├─ módulos JS compartilhados ─┬─ API FastAPI (/api + /backend)
Mobile (/mobile) ┘                             │
                                              └─ Supabase
                                                 ├─ Auth
                                                 ├─ PostgreSQL + RLS/RPC
                                                 ├─ Storage
                                                 └─ Realtime
```

O navegador cuida de apresentação e validação imediata. A API valida payload, sessão, papel e rate limit. O PostgreSQL garante integridade, isolamento de linhas e transações. Nenhuma regra crítica deve existir apenas em CSS ou JavaScript.

## 7. Mapa das pastas

```text
api/         entrada FastAPI publicada
backend/     domínio, serviços, segurança e gateway Supabase
css/         base visual e camadas de release
docs/        produto, segurança, banco, release e operação
html/        fonte das páginas funcionais desktop
img/         branding oficial, fundos e placeholders usados
js/          módulos de interface, autenticação e clientes de API
mobile/      páginas sincronizadas com tratamento de app
scripts/     sincronização e verificações automatizadas
sql/         migrations numeradas e verificadores pós-aplicação
tests/       testes Python da API e regras puras
vendor/      dependências frontend mantidas localmente
```

Arquivos de raiz são somente entradas públicas/configuração do projeto: `index.html`, `manifest.webmanifest`, `service-worker.js`, `vercel.json`, `package.json`, `pyproject.toml`, `README.md`, `ARCHITECTURE.md` e arquivos equivalentes.

## 8. Frontend desktop e mobile

As páginas de `html/` são a fonte funcional. `scripts/sync_mobile_pages.py` gera os equivalentes em `mobile/`, ajustando caminhos e adicionando as camadas mobile. Não edite uma página gerada sem atualizar a fonte, exceto `mobile/index.html`, que é a home específica do aplicativo.

Depois de alterar HTML:

```text
npm run mobile:sync
```

O mobile não é apenas o desktop apertado. Ele usa cabeçalho compacto, dock por perfil, bottom sheets, uma coluna para operações e ações rápidas. Na 1.9.3, o botão `Mais` do profissional abre opções filtradas por plano.

## 9. CSS e direção visual

`global.css`, `framework.css`, `pages.css` e `product-redesign.css` formam a base. Camadas `release-*` preservam compatibilidade histórica; `release-1.9.3.css` contém o refino atual de senha, painel, mobile, Admin, suporte e Beauty Hub.

A direção visual continua premium escura/quente, dourada, com superfícies legíveis. Beauty Hub recebe identidade própria moderada, sem quebrar a família da marca nem anunciar um produto completo antes da validação.

## 10. PWA e Service Worker

`manifest.webmanifest` descreve o aplicativo instalável. `service-worker.js` pré-carrega rotas/arquivos essenciais, oferece fallback offline e usa um nome de cache versionado. Ao mudar interface ou asset pré-carregado, atualize o cache; isso impede que um aparelho continue mostrando a release anterior.

## 11. API FastAPI

`api/index.py` declara rotas e middleware. `backend/domain/` contém regras puras que podem ser testadas sem internet. `backend/services/` organiza casos de uso. `backend/security.py` valida autenticação/autorização e `backend/supabase.py` concentra acesso externo.

Fluxo típico:

```text
interface → js/backend-api.js → /api/v1/... → service → regra de domínio → Supabase/RPC
```

A API passa à versão 1.5.0 na release 1.9.3. O contrato está em `barberhub-api-v1.openapi.yaml` e a especificação executável permanece em `/api/openapi.json`.

O endpoint `/api/v1/client/loyalty` entrega somente as carteiras do cliente autenticado, com saldo e recompensas visíveis. As rotas de gestão continuam separadas em `/api/v1/retention/loyalty`.

## 12. Supabase explicado

### Auth

Gerencia cadastro, login, confirmação, recuperação e sessões. Senhas são guardadas como hash bcrypt em `auth.users.encrypted_password`; não são descriptografáveis nem copiadas para tabelas públicas.

### PostgreSQL

É o banco relacional. Tabelas representam estabelecimentos, serviços, profissionais, agenda, CRM, finanças e demais entidades. Constraints e triggers impedem estados impossíveis mesmo quando a escrita não passa pela tela esperada.

### RLS

Row Level Security é a camada que decide quais linhas cada sessão pode ler ou alterar. Uma conta autenticada não recebe acesso global: a policy também precisa confirmar dono, vínculo, papel ou identidade do cliente.

### RPC

Funções PostgreSQL expostas de forma controlada para operações transacionais, como encaixe, reagendamento ou fechamento. Permissões de execução e validações internas são parte da segurança.

### Storage

Armazena imagens de portfólio e perfis. Policies do Storage devem seguir o mesmo isolamento por usuário/estabelecimento.

### Realtime

Notifica o navegador quando dados selecionados mudam, por exemplo assinatura/entitlements. Não substitui autorização; a tabela continua protegida por RLS.

## 13. O que são migrations

Migration é um arquivo SQL versionado que transforma o banco de um estado conhecido para o próximo. Ela funciona como histórico reproduzível da estrutura e das regras.

Exemplo conceitual:

```text
17 segurança → 18 agenda → 19 CRM → 20 financeiro → 21 planos → 22 hardening → 23 advisors → 24 retenção → 25 inteligência/permissões
```

Migrations não são dados de demonstração e não devem ser editadas depois de aplicadas. Uma mudança futura cria um novo número. Em banco novo, execute 01–25 em ordem. No projeto atual, 11–23 já foram aplicadas e verificadas; 24/25 aguardam aplicação antes do deploy da 1.9.3.

## 14. Como aplicar migrations com segurança

1. confirme projeto e ambiente alvo;
2. gere backup recuperável;
3. ensaie em homologação;
4. confira o histórico para não reaplicar arquivo já executado;
5. aplique na ordem numérica;
6. pare na primeira falha e investigue, sem pular;
7. execute os verificadores fornecidos;
8. revise Security Advisor e Performance Advisor;
9. teste RLS com contas separadas;
10. só então publique a interface/API.

As instruções exatas da série 1.9 estão em `MIGRATIONS_DEPLOY_1_9.md`. A documentação atual do conceito está em [Database Migrations — Supabase](https://supabase.com/docs/guides/deployment/database-migrations).

## 15. Segurança por camadas

- navegador: feedback, acessibilidade e prevenção de erro comum;
- API: validação, sessão, papel, limites e rate limiting;
- banco: RLS, constraints, triggers, locks e RPCs;
- Auth: senha, confirmação, recuperação, CAPTCHA e sessões;
- deploy: segredos, HTTPS, CSP, logs e observabilidade.

V01–V04 estão corrigidos; V05 está coberto no código e exige revisão de capacidade em escala; V06 continua dependente da ativação do CAPTCHA no Supabase/Cloudflare. Veja `RELATORIO_SEGURANCA_1_9_3.md`.

## 16. Senhas e suporte

Nunca exiba, envie por e-mail, registre em log ou copie uma senha. Nem mesmo o administrador precisa conhecê-la. O suporte identifica a conta, confirma identidade pelo processo definido e inicia recuperação. Se houver suspeita de comprometimento, revogue sessões e force redefinição.

A política visual da 1.9.3 ajuda o usuário a cumprir 8+ caracteres, minúscula, maiúscula, número e símbolo. Configure o mesmo requisito no Supabase para evitar diferença entre tela e servidor. A proteção de senhas vazadas é recomendada e depende do plano/provedor.

## 17. Planos e entitlements

- Gratuito: presença básica no ecossistema;
- Essencial: organização, agenda, CRM, financeiro e cupons;
- Profissional: equipe, lista de espera, recorrência, fidelidade, lembretes e metas;
- Elite: campanhas, oportunidades, insights e permissões granulares.

O plano efetivo é resolvido centralmente. Frontend usa a resposta para explicar/ocultar recursos; API e banco confirmam antes de alterar dados. Downgrade preserva histórico e desativa capacidades excedentes.

## 18. Agenda, CRM e financeiro

Agenda: dia/semana, profissional, bloqueios, encaixes, confirmação, reagendamento, recorrência, estados e no-show. CRM: cliente por estabelecimento, busca, histórico, preferências/notas, aniversário opcional e indicadores. Financeiro: receitas, ajustes, comissão, resumo e fechamento. Retenção: espera, fidelidade, cupons, campanhas e lembretes. Crescimento: metas, oportunidades e insights acionáveis.

O painel escuta explicitamente a troca de seção e dispara a carga necessária. Se o contexto não chegar, a tela mostra erro recuperável; ela não deve girar indefinidamente.

### Como funcionam os módulos da 1.9.3

`lista_espera` registra a intenção do cliente. Quando um horário elegível é cancelado, o trigger procura a demanda compatível, muda o item para `avisado` e cria uma notificação com expiração. Isso não reserva o horário automaticamente: evita tomar uma decisão pelo cliente.

`agendamentos_recorrencias` guarda a série; os atendimentos continuam sendo linhas normais em `agendamentos`, ligadas por `recorrencia_id` e sequência. A RPC cria tudo em uma transação: se uma data conflitar, a série inteira falha sem deixar metade dos horários.

Fidelidade separa programa, recompensas, saldo e movimentos. O saldo é uma projeção; `fidelidade_movimentos` é a trilha auditável. Um índice impede pontuar duas vezes o mesmo atendimento e o resgate bloqueia saldo/estoque durante a transação.

Cupons separam definição e usos. O cliente envia somente o código; o PostgreSQL procura a regra válida, bloqueia o cupom/agendamento, confere limites e grava subtotal, desconto e total. O navegador não escolhe o valor final.

Campanhas geram destinatários e itens de fila. Segmentação usa o CRM; WhatsApp respeita `permite_whatsapp` e e-mail respeita `permite_email_marketing`. O canal interno pode ser processado no Supabase; e-mail/WhatsApp exigem worker e provedor externos.

Oportunidades são sinais recalculáveis com `fingerprint`, o que evita duplicar o mesmo alerta. Insights são agregados de dados operacionais; metas guardam objetivo/período e calculam progresso sob permissão. Não há LLM tomando decisões nem dado fictício.

Permissões granulares não substituem papéis: começam com os padrões de proprietário, gerente, recepção e profissional. No Elite, o proprietário pode remover/conceder capacidades aos membros; proprietário/admin permanecem com acesso necessário para recuperar a configuração. Frontend esconde opções, API valida capacidade e PostgreSQL/RLS confirma novamente.

## 19. Desenvolvimento local

Requisitos: Node 20+, Python compatível e variáveis de ambiente. Nunca use a secret do Supabase no frontend.

Passos usuais:

```text
1. obter o repositório
2. copiar .env.example para um arquivo local ignorado
3. configurar apenas credenciais do ambiente de desenvolvimento
4. iniciar com vercel dev
5. abrir /mobile/ para a experiência PWA
6. executar npm run check antes de commit
```

Para trabalhar apenas nas regras sem serviços online:

```text
npm run check:offline
```

## 20. Testes e qualidade

`npm run check` é a porta de qualidade. Ele verifica sincronização mobile, rotas, referências, sintaxe, segurança, release, migrations, compilação e testes Python. Na revisão de 24/08/2026 passaram 50 testes, 27 controles V01–V06, 28 invariantes da 1.9.3, 74 operações OpenAPI, 50 páginas e 42 arquivos JavaScript. Teste automatizado não substitui cenários reais de e-mail, CAPTCHA, Storage, RLS e múltiplos papéis.

A revisão visual confirmou suporte, Admin e assinaturas administrativas em 390 × 844 e 1280 × 720 sem overflow horizontal. O Admin exige conta autorizada; a revisão de CSS usou uma prévia local sem scripts/dados, enquanto a rota real redirecionou corretamente a sessão sem permissão.

Antes do deploy, faça também revisão visual em 320/360/390/430 px e desktop, com atenção a cabeçalho, dock, teclado, áreas seguras, carregamento, erro, vazio e texto longo.

## 21. Deploy

1. confirme `git status` e revisão das mudanças;
2. execute `npm run check`;
3. confirme variáveis do ambiente;
4. valide URLs de Auth e e-mail;
5. confirme migration history e Advisors;
6. publique preview;
7. execute smoke test por perfil;
8. promova produção;
9. monitore logs, falhas de Auth, API e banco;
10. mantenha rollback de código e backup do banco.

## 22. Configuração externa que o Git não resolve

- Turnstile/hCaptcha e sua secret no Supabase Auth;
- proteção contra senhas vazadas;
- SMTP/templates e URLs permitidas;
- secrets da API no host;
- domínio, HTTPS e observabilidade;
- capacidade de rate limit distribuído;
- contas de teste e revisão dos Advisors.

Esses itens estão detalhados em `CONFIGURACAO_EXTERNA_1_9.md`.

## 23. Organização e descarte

Arquivos só são removidos quando não têm referência e existe substituto ou histórico no Git. Na 1.9.3 foram eliminados dois módulos e oito assets sem uso. Variantes oficiais em `img/branding` foram mantidas porque formam um kit organizado, mesmo quando uma variante não aparece na interface atual.

Não inclua em release: `.git`, `.env*` reais, `node_modules`, `.venv`, `__pycache__`, logs, screenshots temporários, caches e credenciais.

## 24. Beauty Hub

Beauty Hub é a expansão para salões e outros serviços de beleza. A base compartilhável é forte — catálogo, agenda, profissional, CRM, reputação e financeiro — mas serviços, durações, recursos, termos, imagens, papéis e expectativas não devem ser presumidos.

Próximo caminho:

1. entrevistas com profissionais e clientes;
2. definição das especialidades do primeiro piloto;
3. mapa de jornada e diferenças para barbearia;
4. protótipo simples;
5. piloto controlado;
6. somente depois, backend/schema independente ou compartilhado por contrato.

A página atual comunica esse estágio. O ZIP separado é uma preparação de repositório, não uma promessa de produto pronto.

## 25. Decisão sobre repositórios

Web, mobile e API do Barber Hub continuam juntos porque compartilham release e regras. A API já tem fronteira interna e pode ser publicada separadamente sem mover o código. Beauty Hub foi preparado em pacote próprio por ter identidade e descoberta de produto distintas. Veja `DECISAO_REPOSITORIOS_1_9_3.md`.

## 26. Glossário rápido

- API: contrato usado pela interface para pedir operações ao servidor.
- Auth: cadastro, login e sessão.
- Hash: transformação não reversível usada para verificar senha.
- Migration: alteração SQL versionada do banco.
- PWA: site instalável com experiência de aplicativo.
- RLS: política de acesso por linha no PostgreSQL.
- RPC: função do banco chamada de modo controlado.
- Service Worker: processo do navegador responsável por cache/offline.
- Supabase: Auth, banco, Storage e Realtime usados pelo projeto.
- Entitlement: capacidade liberada pelo plano efetivo.
- No-show: cliente que não comparece ao atendimento.

## 27. Fontes e limites da pesquisa

As fontes brasileiras oficiais/associativas sustentam o tamanho do ecossistema e o problema de gestão. Google sustenta o padrão de descoberta/agendamento local. Zenoti é fonte comercial internacional e serve somente como sinal para hipóteses. Nenhuma dessas fontes substitui pesquisa primária com o público-alvo brasileiro nem autoriza afirmar retorno financeiro garantido.

Data da revisão das fontes: 24/08/2026.
