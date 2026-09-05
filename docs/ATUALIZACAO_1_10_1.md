# Barber Hub 1.10.1 — conclusão do Planejamento Pós-31

## Resultado

A 1.10.1 conclui no código o escopo técnico do Planejamento Pós-31 sem alterar a direção visual premium escura, quente e dourada. A atualização reforça operação mobile, confiabilidade, escala, controle de liberação e preparação para um piloto local.

## O que foi concluído

### Operação e continuidade

- rascunho persistente para atendimento manual e despesa;
- chave idempotente estável durante falhas incertas, evitando duplicidade ao tentar novamente;
- desbloqueio do rascunho em erros conclusivos para permitir correção dos dados;
- continuidade após autenticação para agendamento, favoritos e avaliações;
- formulários preservados durante perda temporária de conexão.

### Agenda, CRM e retenção

- agenda do dia/semana paginada separadamente para atendimentos e bloqueios;
- lista de espera, recorrências, cupons, campanhas e fila com carregamento progressivo;
- busca de clientes por nome, telefone ou e-mail;
- tarefas essenciais no mobile sem depender de carrossel horizontal;
- cards e controles adaptados para telas estreitas.

### Marketplace e cadastro

- busca regional no servidor por serviço, preço, avaliação, região, disponibilidade e distância;
- paginação e ranking no banco, sem baixar grandes volumes para filtrar no navegador;
- filtros avançados não retornam resultados genéricos silenciosamente quando a API não está disponível;
- coordenadas ausentes ou inválidas não são tratadas como ponto geográfico real;
- biblioteca oficial de capas disponível no cadastro, além do envio de imagem própria.

### Push, auditoria e liberação controlada

- job autenticado para Web Push, compatível com Vercel Cron;
- fila reivindicada atomicamente com `FOR UPDATE SKIP LOCKED`;
- horário silencioso, repetição limitada e desativação de assinaturas expiradas;
- categorias de preferência de notificação;
- feature flags efetivas por público, plano, estabelecimento e período, com kill switch;
- bloqueio de ações no banco quando a flag efetiva está desativada;
- auditoria ampliada para comissão, permissões, metas, campanhas e configuração do negócio.

### Organização e qualidade

- módulos de agendamento, operação profissional e retenção movidos para `js/features/`;
- infraestrutura de rascunho/repetição em `js/core/`;
- referências, páginas mobile e cache PWA atualizados;
- nova regressão automatizada 1.10.1;
- versão web/PWA 1.10.1 e API 1.6.1.
- Beauty Hub passa a carregar a folha da release atual e mantém todo o conteúdo visível no mobile/desktop mesmo sem animação de rolagem.

## Banco desta entrega

O Supabase conectado possui os objetos previstos nas migrations 29–31, mas as execuções feitas manualmente não aparecem no histórico oficial. A 1.10.1 adiciona:

```text
supabase/migrations/20260904180741_32_conclusao_pos31_1_10_1.sql
sql/verificar_32_conclusao_1_10_1.sql
```

A migration 32 é aditiva e idempotente. Ela consolida os controles finais sem reaplicar migrations antigas às cegas.

## Dependências externas antes de publicar

- backup recuperável;
- migration 32 e verificador 32;
- `CRON_SECRET`, VAPID pública/privada e remetente VAPID;
- CAPTCHA/Turnstile, URLs autorizadas e proteção contra senhas vazadas;
- revisão dos Advisors depois da migration;
- teste de RLS com contas separadas por papel e plano;
- teste em aparelhos reais e piloto com barbeiros de Jacinto.

Esses itens não podem ser considerados concluídos por um teste local, porque dependem do ambiente, de credenciais ou de pessoas reais.
