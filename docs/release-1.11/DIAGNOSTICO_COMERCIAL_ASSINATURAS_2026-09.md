# Diagnóstico comercial de assinaturas — setembro de 2026

Este documento é uma recomendação de produto, não uma alteração de preço. Fontes consultadas em 17/09/2026; preços e condições podem mudar e devem ser reconferidos antes de uma campanha.

## Situação atual do Barber Hub

| Plano | Mensal | Semanal no banco | Escopo declarado |
|---|---:|---:|---|
| Gratuito | R$ 0 | R$ 0 | Perfil público e agenda online básica configurável |
| Essencial | R$ 49 | R$ 15 | 1 profissional, agenda, CRM, financeiro e relatórios básicos |
| Profissional | R$ 89 | R$ 29 | Até 3 profissionais, equipe e comissões |
| Elite | R$ 129 | R$ 45 | Até 10 profissionais; anuncia múltiplas unidades, estoque e automações |

Os valores e limites históricos permanecem no banco como referência interna, mas não são oferta pública. A partir da migration 40, todos os planos carregam `estado_comercial = desenvolvimento`; a ativação é manual pelo administrador e serve apenas à homologação, com API protegida, auditoria e idempotência. Não há checkout, renovação ou cobrança automática.

## Referências de mercado

| Produto | Faixa mensal anunciada | Leitura comparável |
|---|---:|---|
| [AppBarber](https://appbarber.com.br/?lang=pt) | R$ 79,90 (1 profissional), R$ 109,90 (2–5), R$ 164,50 (6–15) | Agenda, financeiro, estoque, comissões, fila de espera e mensagens são apresentados como recursos do produto |
| [Trinks](https://sistema.trinks.com/fale-conosco-comercial-whytrinks) | R$ 110 (1–2), R$ 158 (3–4), R$ 291 (5–10) | Oferta inclui agenda 24/7, site e treinamento; preço varia conforme período contratado |

O Essencial está cerca de 39% abaixo da referência individual mensal do AppBarber; o Profissional está cerca de 19% abaixo da faixa AppBarber para 2–5 profissionais e 44% abaixo da faixa Trinks para 3–4. Isso é aceitável como preço de entrada, mas não justifica prometer capacidade que ainda não foi homologada.

## Diagnóstico de valor entregue

- Essencial e Profissional têm uma proposta coerente com agenda, CRM, financeiro e equipe/comissões já presentes no projeto, desde que sejam homologados antes da venda ampla.
- O piloto atual usa somente notificações internas e não tem gateway de pagamento. Isso reduz o valor operacional percebido frente aos concorrentes que anunciam comunicação e infraestrutura de cobrança já em operação.
- O Elite é o ponto crítico: a própria seed o chama de “plano futuro”, mas a página e o banco anunciam múltiplas unidades, estoque e automações. Não é seguro precificar ou vender essas promessas como disponíveis.
- A cobrança semanal registrada no banco não aparece como fluxo de cobrança real e é desproporcional ao mensal. Enquanto a ativação é manual, ela deve permanecer como dado interno não anunciado.

## Decisão adotada

1. Todos os planos permanecem **em desenvolvimento** até que suas funcionalidades estejam 100% funcionais e validadas.
2. A página pública não anuncia preço, cobrança ou ativação comercial dos planos pagos.
3. A **Agenda Online básica** é parte do plano Gratuito para qualquer barbearia: ativação voluntária do barbeiro, dias de atendimento, períodos/horários, intervalo entre slots, antecedência e dias bloqueados.
4. Agenda Profissional 2.0, CRM, financeiro, equipe e os demais recursos continuam separados pelos entitlements existentes; não foram prometidos como gratuitos.
5. O administrador continua podendo atribuir qualquer plano manualmente para teste controlado, com status e observações, sem gateway de cobrança.

## Próxima decisão comercial

1. Homologar o conjunto de recursos declarado para cada nível sem tratar a página comercial como promessa de entrega.
2. Medir, em uso de piloto, agenda criada, conversão, chamados, churn, uso por profissional e custo de suporte.
3. Depois da validação e de 60–90 dias de dados reais, definir uma faixa de preço e a política de ativação comercial.
4. Antes de publicar valores, revisar a copy, termos, suporte, cobrança e o que realmente está ativo em cada plano.

## Decisão pendente

Quando a homologação terminar, será necessária aprovação do responsável de negócio para a tabela final, a conversão de `estado_comercial` para `ativo`, a regra de cobrança e eventual remoção dos valores semanais históricos.
