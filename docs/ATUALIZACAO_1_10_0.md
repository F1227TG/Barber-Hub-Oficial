# Barber Hub 1.10.0 — operação real e preparação de lançamento

## Resultado da versão

A 1.10.0 consolida o Barber Hub como marketplace e sistema operacional para barbearias. Ela preserva a identidade premium escura, quente e dourada e amplia a experiência sem criar uma linguagem visual paralela.

O código está preparado localmente. As migrations 29, 30 e 31 **ainda não foram aplicadas no Supabase de produção** e a release não deve ser publicada antes da homologação descrita em `HOMOLOGACAO_FINAL_1_10.md`.

## O que foi implementado

### Operação e agenda

- múltiplos períodos de funcionamento no mesmo dia, inclusive fechamento no dia seguinte;
- cópia dos períodos de um dia para vários outros;
- status público correto antes, durante e entre períodos;
- registro rápido de atendimento presencial, telefone, WhatsApp ou outro canal;
- serviço avulso com nome e duração, criado de modo privado no catálogo;
- idempotência no atendimento e no lançamento financeiro;
- continuidade do agendamento depois de login/cadastro, sem colocar dados sensíveis na URL.

### Financeiro e clientes

- registro de gastos reais;
- resultado realizado e estimado, com linguagem que não promete lucro contábil;
- períodos Hoje, Semana, Mês e Personalizado;
- ticket médio no resumo;
- paginação progressiva de lançamentos e CRM;
- busca de clientes por nome, telefone e e-mail, com cursor estável para clientes sem visita.

### Marketplace e página pública

- busca por cidade, bairro, estado, raio e distância;
- ação “Perto de mim” com consentimento de localização;
- mapa OpenStreetMap e rota no Google Maps;
- biblioteca oficial de capas WebP;
- paginação de portfólio e avaliações;
- exibição de todos os períodos de funcionamento.

### Dados, comunicação e controle

- importação CSV/XLSX com prévia, validação, relatório, proteção contra fórmulas e reexecução;
- preferências de avisos no dispositivo, horário silencioso e fallback para notificações internas;
- fila Web Push com consentimento;
- auditoria operacional append-only, sem segredos e com anonimização de vínculos excluídos;
- feature flags com kill switch e alvos controlados;
- painel administrativo com prontidão da release, busca no servidor e carregamento progressivo;
- feedback de conexão, tentativa automática segura em leituras e formulários que preservam dados após falha.

### Mobile, suporte e marca

- layouts previstos para 320, 360, 390, 412, 430 e 768 px;
- ações operacionais priorizadas e redução de rolagem horizontal;
- suporte mais curto e orientado à tarefa;
- no mobile, o formulário de suporte só abre quando solicitado, evitando uma página longa e estados invisíveis de animação;
- remoção de termos internos como provedor/banco da comunicação normal com clientes e profissionais;
- Beauty Hub apresentada como expansão em desenvolvimento, com ligação para o projeto oficial.
- cache PWA `barberhub-v1.10-mobile-r2`, garantindo a distribuição dos últimos ajustes de interface.

## Planos e proposta de valor

- Gratuito: esteja no Barber Hub;
- Essencial: organize a operação individual;
- Profissional: gerencie equipe, relacionamento e resultados;
- Elite: use dados, automação e controles avançados para crescer.

O frontend comunica o benefício, mas a autorização real continua na API e no PostgreSQL.

## Verificação automatizada

A porta de qualidade cobre sincronização mobile, rotas, links, sintaxe JavaScript, compilação Python, regras de domínio, V01–V06, invariantes 1.9.3 e regressões 1.10. O teste automatizado não substitui CAPTCHA, e-mail, Web Push, RLS ou papéis reais no ambiente alvo.

## Dependências externas

- migrations 29 → 30 → 31 e verificador 31;
- VAPID e worker agendado para Web Push;
- CAPTCHA/Turnstile e proteção contra senhas vazadas no Auth;
- URLs autorizadas de login e recuperação;
- origens permitidas da API;
- revisão dos Advisors;
- homologação com contas separadas por papel e plano.
