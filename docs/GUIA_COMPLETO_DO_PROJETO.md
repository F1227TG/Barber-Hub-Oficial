# Guia completo do Barber Hub

Versão de referência: **1.10.0**

API: **1.6.0**

Situação: **código local em homologação; migrations 29–31 e configuração externa pendentes**.

## 1. O projeto em uma frase

O Barber Hub reúne descoberta, agendamento e gestão de barbearias em uma plataforma web/PWA que funciona para clientes, profissionais, equipes, proprietários e administradores.

## 2. Problema real e proposta

O cliente normalmente precisa descobrir estabelecimentos por redes sociais ou indicação, perguntar preço e horário em uma conversa e repetir dados. A barbearia distribui a operação entre agenda de papel, mensagens, memória da equipe e planilhas, o que dificulta enxergar faltas, retorno, comissão, caixa e horários ociosos.

O Barber Hub conecta quatro pilares:

```text
Agenda → Cliente → Dinheiro → Retenção
```

- **Agenda:** horários, períodos, bloqueios, encaixes, confirmação, falta e recorrência;
- **Cliente:** histórico, preferências, notas, gasto, busca e relacionamento;
- **Dinheiro:** receita, despesa, comissão, ticket médio, fechamento e meta;
- **Retenção:** espera, fidelidade, cupom, campanha, avaliação e oportunidade.

O marketplace dá ao cliente uma entrada simples; o painel transforma o cadastro público em operação diária.

## 3. Evidências e limite da validação

O IBGE registrou ampla posse de celular e acesso domiciliar à internet em 2024; a PNAD TIC mostra o celular como principal equipamento de acesso. As estatísticas de MEI do IBGE demonstram a escala histórica da atividade de cabelo e beleza. Sebrae inclui cadastro, agendamento, serviços e pagamentos na organização de barbearias. Banco Central e ABIHPEC ajudam a compreender a relevância da economia da beleza, especialmente para profissionais mulheres.

Essas fontes validam o contexto, não a aderência produto-mercado. A prova final deve vir de um piloto medindo uso, conversão, faltas, retorno, ocupação, tempo economizado e disposição de pagar. Evidências, fontes e roteiro estão em `PESQUISA_VALIDACAO_BARBER_BEAUTY_HUB.md`.

## 4. Públicos e valor entregue

### Cliente

Pesquisa por nome, serviço e região; vê status, horários, equipe, portfólio, reputação, mapa e preços; agenda, acompanha, reage e mantém favoritos/fidelidade.

### Profissional

Enxerga a agenda individual, próximo cliente, ficha, preferências e ações rápidas. Registra atendimento manual, bloqueio, falta e confirmação sem atravessar um painel complexo.

### Proprietário e gerente

Configuram negócio, horários, equipe, permissões, serviços, comissões, finanças, retenção e oportunidades. Os dados do painel são escopados ao estabelecimento.

### Recepção

Pode operar agenda e cliente conforme o papel e as permissões concedidas, sem receber automaticamente acesso financeiro ou administrativo.

### Administrador da plataforma

Modera, acompanha saúde/prontidão, gerencia planos e encontra registros com busca e paginação. Pode enviar recuperação de senha, mas nunca vê a senha atual.

## 5. O que a versão 1.10.0 entrega

### Operação real

- vários períodos de funcionamento no mesmo dia;
- períodos que terminam no dia seguinte e cópia entre dias;
- status público correto antes, durante e no intervalo;
- atendimento manual por balcão, telefone, WhatsApp ou outro canal;
- serviço avulso privado com nome e duração;
- prevenção de duplicidade no atendimento e no financeiro;
- continuidade do agendamento depois de autenticar.

### Clientes e dinheiro

- CRM paginado e busca por nome, telefone e e-mail;
- cursor estável mesmo sem visita anterior;
- gastos reais e resultado realizado/estimado;
- filtros Hoje, Semana, Mês e Personalizado;
- ticket médio e paginação dos lançamentos.

### Marketplace

- cidade, bairro, UF, raio e distância;
- “Perto de mim” com consentimento;
- mapa OpenStreetMap e abertura de rota;
- biblioteca de capas WebP organizada;
- avaliações e portfólio com carregamento progressivo;
- todos os períodos na página pública.

### Dados e continuidade

- importação CSV/XLSX com prévia, validação, deduplicação e relatório;
- rejeição de fórmulas e limites contra arquivos abusivos;
- histórico de importação e confirmação idempotente;
- aviso de conexão e repetição segura de leituras;
- formulários preservados quando uma falha não permite concluir.

### Comunicação e controle

- preferências de avisos e horário silencioso;
- fallback para central interna de notificações;
- assinatura e fila Web Push preparadas;
- auditoria operacional append-only;
- feature flags por público/plano/usuário com kill switch;
- painel administrativo paginado e indicador de prontidão.

### Experiência

- prioridade responsiva para 320, 360, 390, 412, 430 e 768 px;
- dock profissional com “Mais” filtrado pelo acesso efetivo;
- cards/controles sem carrossel obrigatório para tarefas essenciais;
- suporte reduzido e orientado à ação;
- mensagens comerciais sem expor nomes internos de infraestrutura;
- Beauty Hub apresentada como produto irmão em desenvolvimento.

## 6. Funções herdadas da série 1.9

A 1.10 mantém Agenda 2.0, CRM, financeiro, comissão, fechamento, equipe, lista de espera, recorrência, fidelidade, recompensas, cupons, campanhas, lembretes internos, Central de Oportunidades, insights, metas e permissões granulares. E-mail/WhatsApp automáticos só se tornam entrega externa após configurar provedor e worker.

## 7. Arquitetura

```text
HTML desktop ─┐
              ├─ JS/CSS compartilhados ── API FastAPI ── Supabase
HTML mobile ──┘                              │             ├─ Auth
                                            │             ├─ PostgreSQL/RLS/RPC
                                      regras offline      ├─ Storage
                                      backend/domain      └─ Realtime
```

O frontend melhora a experiência; a API valida o contrato e a identidade; o banco aplica a integridade final. Nenhuma autorização importante depende apenas de um botão escondido.

## 8. Pastas

| Pasta/arquivo | Responsabilidade |
|---|---|
| `api/index.py` | entrada e rotas FastAPI |
| `backend/domain/` | regras puras que funcionam sem rede |
| `backend/services/` | casos de uso e integração |
| `backend/models.py` | validação de entrada/saída |
| `html/` | páginas canônicas desktop |
| `mobile/` | páginas móveis sincronizadas |
| `js/core/` | conexão, repetição e infraestrutura web |
| `js/features/` | módulos funcionais da release |
| `css/releases/` | refinamentos visuais versionados |
| `sql/` | migrations e verificadores |
| `tests/` | regressões Python/API |
| `scripts/` | sincronização, auditoria e qualidade |
| `img/branding/` | identidade oficial |
| `img/library/` | imagens de conteúdo reutilizáveis |
| `docs/` | guias, decisões e histórico |
| `service-worker.js` | cache PWA, offline e Push |
| `vercel.json` | rotas, cabeçalhos e cron/deploy |

## 9. Desktop, mobile e PWA

O desktop oferece densidade maior. O mobile reorganiza as mesmas capacidades ao redor das tarefas mais frequentes. `scripts/sync_mobile_pages.py` impede que correções funcionais fiquem apenas em uma das versões.

O Service Worker mantém o shell essencial, atualiza cache por versão, oferece fallback offline e recebe eventos de Web Push. Ele não substitui o backend e não deve armazenar dados sensíveis de conta.

## 10. Direção visual

A identidade usa superfícies escuras/quentes, dourado como destaque, bordas discretas, tipografia legível e movimento contido. Novos recursos devem reutilizar tokens e componentes existentes. Beauty Hub recebe identidade relacionada, porém distinta, sem virar uma página extravagante ou anunciar uma operação inexistente.

## 11. API FastAPI 1.6

As rotas ficam sob `/api/v1`. A API usa autenticação Bearer, limites por escopo, validação Pydantic, mensagens padronizadas e `X-Request-ID`. Swagger fica em `/api/docs`; `/api/openapi.json` é o contrato executável.

Categorias de rota:

- catálogo/marketplace/capas;
- agendamentos, agenda, períodos e serviço manual;
- CRM, financeiro e equipe;
- retenção e crescimento;
- negócio, catálogo e promoções;
- suporte, importação, Push, preferências e auditoria;
- administração, planos, saúde e recuperação.

`docs/API_BARBER_HUB_V1.md` detalha o contrato.

## 12. Supabase explicado

### Auth

Cria a identidade, confirma e-mail, emite sessão e guarda o hash da senha. A tabela pública de perfil complementa a conta, mas não copia credenciais.

### PostgreSQL

Guarda estabelecimentos, serviços, horários, agendamentos, relações, finanças e controles. Constraints impedem estados estruturalmente inválidos.

### RLS

Row Level Security é a regra que decide quais linhas cada usuário pode ler ou alterar. Ela protege o banco mesmo se alguém chamar a API de dados manualmente.

### RPC

Remote Procedure Call é uma função do PostgreSQL acionada como operação única. É usada quando várias escritas precisam acontecer juntas, como atendimento + lançamento financeiro.

### Storage

Guarda fotos e arquivos autorizados. Bucket, formato, tamanho e política precisam ser limitados.

### Realtime

Propaga alterações relevantes, como agenda e assinatura, sem exigir recarregamento completo. Realtime não substitui RLS.

## 13. Migrations

Migration é um arquivo SQL versionado que altera a estrutura ou as regras do banco. O número define a ordem. O Git guarda a receita; o Supabase executa a alteração.

Regras:

1. aplicar em ordem;
2. fazer backup antes de mudanças importantes;
3. não editar migration já aplicada;
4. criar um número novo para corrigir algo posterior;
5. executar o verificador correspondente;
6. só publicar o código compatível depois do banco.

Migrations 01–28 são histórico. A 1.10 adiciona:

```text
29_operacao_real_horarios_atendimentos_1_10.sql
30_localizacao_biblioteca_marketplace_1_10.sql
31_push_importacoes_auditoria_flags_1_10.sql
verificar_31_release_1_10.sql
```

No projeto atual, 29–31 ainda estão pendentes.

## 14. Como aplicar 29–31

1. abra o projeto correto no Supabase;
2. confirme backup e que 28 é a última migration aplicada;
3. no SQL Editor, execute o conteúdo completo da 29 e aguarde sucesso;
4. repita com 30;
5. repita com 31;
6. execute `verificar_31_release_1_10.sql`;
7. não prossiga se qualquer etapa lançar exceção;
8. revise Security Advisor e Performance Advisor;
9. faça a homologação por papel/plano;
10. publique API e frontend/PWA juntos.

Detalhes e rollback estão em `MIGRATIONS_DEPLOY_1_10.md`.

## 15. Segurança por camadas

| Camada | Controle principal |
|---|---|
| navegador | mensagens seguras, CAPTCHA, sem segredo privado |
| API | autenticação, Pydantic, rate limit, request id |
| banco | RLS, RPC, constraints, transação e locks |
| arquivos | tipo/tamanho, bucket e políticas |
| operação | auditoria, flags, backup, Advisors e resposta a incidente |

Na auditoria diferencial, V01–V04 estão corrigidos, V05 está corrigido no código e depende de armazenamento distribuído adequado, e V06 está preparado mas só fica completo quando CAPTCHA/Turnstile é ativado no ambiente.

## 16. Senhas

A senha não deve ser visualizável, nem mesmo pelo administrador. O Supabase Auth guarda `encrypted_password` como hash não reversível. O nome pode sugerir criptografia, mas o objetivo é verificar uma tentativa, não recuperar o texto original.

Fluxo correto:

1. usuário solicita recuperação ou admin envia o link;
2. o titular recebe o e-mail no endereço cadastrado;
3. o link abre a página oficial permitida;
4. o usuário cria uma nova senha;
5. sessões/políticas seguem a configuração de Auth.

O formulário mostra abaixo do campo os requisitos: mínimo de caracteres, minúscula, maiúscula, número e símbolo. A política do Supabase deve ser compatível com a tela.

## 17. Planos e autorização

- **Gratuito:** esteja no Barber Hub;
- **Essencial:** organize sua operação;
- **Profissional:** gerencie equipe, relacionamento e resultados;
- **Elite:** use dados, automação e controles avançados para crescer.

Entitlements são capacidades calculadas a partir do plano/estado/validade. O frontend adapta o menu; a API e o banco bloqueiam a operação. Downgrade preserva histórico e restringe novas ações acima do limite.

## 18. Fluxos operacionais

### Horários e status

Cada dia pode ter mais de um período. Entre dois períodos, o estabelecimento aparece fechado e informa quando reabre. Período noturno pode terminar no dia seguinte. O modo manual aberto/fechado prevalece conforme a regra configurada.

### Atendimento manual

Equipe autorizada escolhe cliente/profissional, serviço existente ou avulso, duração, origem, pagamento e valor. A API normaliza os termos e a RPC registra a operação uma vez.

### CRM

A busca ocorre no servidor, aceita nome/telefone/e-mail e carrega páginas. A ficha reúne histórico, gasto, preferências, profissional preferido, falta e notas internas conforme permissão.

### Financeiro

O resumo diferencia valores realizados e estimados. Despesas e ajustes exigem justificativa/categoria. Regras de comissão podem ser fixas ou percentuais. Fechamento consolida o dia sem transformar previsão em contabilidade oficial.

### Retenção

Lista de espera aproveita vagas; recorrência cria uma série controlada; fidelidade soma saldo e resgata recompensa; cupom valida código/regras; campanha segmenta e cria fila; oportunidade transforma um sinal em ação acompanhável.

## 19. Importação de dados

O usuário baixa/segue o modelo, seleciona CSV/XLSX, confere a prévia e confirma. O servidor limita linhas/tamanho, normaliza campos, bloqueia fórmula, calcula hash e devolve relatório. Um erro não deve sumir nem deixar o usuário sem saber quais linhas falharam.

## 20. Administração e suporte

O Admin usa recursos permitidos explicitamente, busca no servidor, limite e botão para carregar mais. A prontidão da release mostra dependências sem fingir que configuração externa está concluída. Moderação continua separada da edição normal do estabelecimento.

Suporte prioriza pesquisar ajuda, abrir chamado e acompanhar protocolo. Informações de arquitetura, banco e fornecedor pertencem à documentação interna, não à tela comercial do usuário.

## 21. Desenvolvimento local

Requisitos: Node 20+ e Python 3.13.

```bash
vercel dev
```

API isolada:

```bash
fastapi dev api/index.py
```

Depois de alterar `html/`:

```bash
npm run mobile:sync
```

Variáveis ficam no ambiente autorizado, nunca no Git. Use exemplos sem valores reais para documentação.

## 22. Testes e porta de qualidade

```bash
npm run check
```

O comando verifica:

- paridade desktop/mobile e roteamento;
- páginas, links e referências locais;
- sintaxe JavaScript e compilação Python;
- regressões 1.9.3 e 1.10;
- auditoria V01–V06;
- regras de domínio sem rede;
- endpoints FastAPI e autorização básica.

Automação local não prova CAPTCHA, entrega de e-mail/Push, RLS real, dados de produção ou todos os navegadores. Esses itens ficam no checklist manual.

## 23. Configuração externa passo a passo

### Auth

1. abra Authentication no Supabase;
2. confirme Site URL e adicione somente Redirect URLs oficiais de produção/homologação;
3. habilite confirmação de e-mail conforme a política do produto;
4. ative Turnstile/CAPTCHA e cadastre a chave secreta no provedor;
5. entregue ao frontend somente a site key pública;
6. habilite proteção contra senhas vazadas quando disponível no plano;
7. teste cadastro, confirmação e recuperação em domínio real.

### Deploy/API

Configure `SUPABASE_URL`, chave pública apropriada, chave privada/service role apenas no servidor, origens exatas, URL oficial de recuperação e chaves VAPID. Nunca use `*` para origem de produção quando cookies/tokens estão envolvidos.

### Push e tarefas

Configure um worker autenticado e agendado para processar a fila, respeitar horário silencioso, registrar sucesso/falha e limitar tentativas. Sem isso, existe fila e fallback interno, mas não entrega Push garantida.

### Homologação

Teste contas separadas: cliente, profissional, recepção, gerente, proprietário, admin e sem vínculo; depois repita cenários críticos em Gratuito, Essencial, Profissional e Elite.

## 24. Deploy

1. concluir testes locais;
2. confirmar backup;
3. aplicar 29, 30, 31 e o verificador;
4. configurar Auth, API, VAPID e worker;
5. revisar Advisors;
6. homologar papéis, planos, desktop e mobile;
7. criar commit identificável;
8. enviar ao remoto e aguardar o build;
9. testar o domínio publicado;
10. monitorar erros e manter o commit anterior disponível.

## 25. Organização e descarte

Arquivos só são removidos após confirmar ausência de referência e existência de substituto/histórico quando necessário. Caches, arquivos temporários, cópias de build, imagens redundantes e código morto não entram na versão. Imagens de capa oficiais usam WebP em `img/library/`.

## 26. Beauty Hub

Beauty Hub leva a proposta a cabeleireiras, manicures, pedicures, maquiadoras, profissionais autônomas, estúdios e salões. A página do Barber Hub apresenta a expansão e aponta para `beautyhuboficial.vercel.app`, sem misturar contas, banco ou prometer recursos ainda não homologados.

O Beauty Hub deve validar regras próprias, como recursos físicos, atendimentos simultâneos, durações variáveis, combos, sinais e categorias. Ele permanece em repositório separado para ter marca, descoberta e evolução próprias.

## 27. Decisão sobre repositórios

Separar a API e o mobile agora adicionaria coordenação e risco perto da finalização. Eles permanecem no monorepo enquanto compartilham lançamento, autenticação e equipe. Reavaliar quando existir aplicativo nativo, outro consumidor da API, equipe independente ou necessidade comprovada de deploy separado.

## 28. Glossário

- **API:** porta organizada para a interface solicitar ações;
- **Auth:** cadastro, sessão e identidade;
- **entitlement:** capacidade liberada pelo plano efetivo;
- **feature flag:** chave de ativação controlada de um recurso;
- **migration:** alteração numerada do banco;
- **PWA:** site instalável com comportamento de aplicativo;
- **RLS:** regra de acesso por linha no banco;
- **RPC:** função transacional do PostgreSQL;
- **Web Push:** aviso do navegador/dispositivo com consentimento.

## 29. Documentos de apoio

- `ATUALIZACAO_1_10_0.md` — escopo entregue;
- `RELATORIO_SEGURANCA_1_10.md` — V01–V06 e pendências;
- `MIGRATIONS_DEPLOY_1_10.md` — banco e publicação;
- `HOMOLOGACAO_FINAL_1_10.md` — aprovação manual;
- `PESQUISA_VALIDACAO_BARBER_BEAUTY_HUB.md` — pesquisa e piloto;
- `DECISAO_REPOSITORIOS_1_10.md` — organização futura;
- `API_BARBER_HUB_V1.md` — API;
- `../ARCHITECTURE.md` — arquitetura técnica.
