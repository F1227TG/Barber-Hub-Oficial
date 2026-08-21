# Barber Hub 1.9 — Operação & Crescimento

> O escopo de engenharia, critérios de aceite, migrations propostas e pacote de publicação estão detalhados em `docs/PLANO_RELEASE_1_9.md`.

## Direção

Depois do deploy seguro da 1.8.2, a próxima fase deve transformar o Barber Hub em sistema diário de operação: **Agenda → Cliente → Dinheiro → Retenção**. A direção visual premium escura/quente e dourada permanece inalterada; mobile continua orientado a poucas ações de alto valor.

## 1.9.0 — base operacional

1. **Agenda profissional 2.0**: dia/semana, encaixes, bloqueios, intervalos, reagendamento, confirmação e no-show.
2. **CRM 2.0**: ficha, histórico, gastos, preferências, profissional favorito, notas internas e clientes inativos.
3. **Financeiro e comissões**: receita, ticket médio, previsão, percentual/fixo por profissional e fechamento do dia.
4. **Equipe operacional**: vínculo seguro de conta, papéis básicos e agenda individual.

Esses módulos devem compartilhar eventos e snapshots de atendimento para não calcular histórico a partir de dados mutáveis.

## 1.9.3 — Retenção & Inteligência

A antiga divisão entre 1.9.1 e 1.9.2 foi consolidada na **1.9.3**, conforme a decisão de produto. Ela será uma atualização única, construída sobre a base operacional estabilizada da 1.9.0.

### Retorno e relacionamento

- lista de espera e aviso de vaga;
- agendamento recorrente;
- fidelidade e recompensas;
- cupons e campanhas;
- lembretes automáticos via provedor externo, consentimento e fila de entrega;
- solicitação de avaliação verificada após conclusão.

### Crescimento orientado a ação

- retenção, recorrência e ocupação;
- metas e desempenho da equipe;
- Central de Oportunidades;
- insights automáticos com explicação e ação sugerida;
- recuperação segmentada de clientes inativos;
- permissões granulares de equipe.

## Ordem de implementação

Cada fase começa pelo modelo de dados/RLS, segue para domínio Python testável offline, API versionada e só então telas desktop/mobile. Nenhuma funcionalidade de plano deve depender exclusivamente do frontend.

