# Diagnóstico comercial de assinaturas — setembro de 2026

Este documento é uma recomendação de produto, não uma alteração de preço. Fontes consultadas em 17/09/2026; preços e condições podem mudar e devem ser reconferidos antes de uma campanha.

## Situação atual do Barber Hub

| Plano | Mensal | Semanal no banco | Escopo declarado |
|---|---:|---:|---|
| Gratuito | R$ 0 | R$ 0 | Perfil público; sem agenda online, relatórios ou equipe |
| Essencial | R$ 49 | R$ 15 | 1 profissional, agenda, CRM, financeiro e relatórios básicos |
| Profissional | R$ 89 | R$ 29 | Até 3 profissionais, equipe e comissões |
| Elite | R$ 129 | R$ 45 | Até 10 profissionais; anuncia múltiplas unidades, estoque e automações |

Os valores e limites são os atualmente cadastrados em `sql/11_planos_assinaturas.sql`. A ativação é manual pelo administrador e já possui API protegida, auditoria e idempotência; não há checkout, renovação ou cobrança automática.

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

## Recomendação

1. Manter **R$ 49 Essencial** e **R$ 89 Profissional** como preços de piloto/entrada, sem aumento agora.
2. Manter a ativação manual pelo admin, com data final e observação obrigatória no processo operacional.
3. Suspender novas ativações comerciais do **Elite** até entregar e homologar as funcionalidades que o plano anuncia. Não desativar clientes já existentes sem plano de migração.
4. Depois da homologação e de 60–90 dias de uso pago, medir conversão, churn, chamados, agenda criada, uso por profissional e custo de suporte. Só então reavaliar R$ 59/99 como tabela regular ou uma faixa maior compatível com o valor comprovado.
5. Antes de uma nova tabela, alinhar a copy pública: “preço de piloto”, itens realmente ativos, ausência de checkout e canal de suporte.

## Decisão pendente

É necessária aprovação do responsável de negócio para (a) congelar o Elite para novas vendas, (b) manter ou revisar R$ 49/R$ 89 no piloto e (c) decidir se os valores semanais deixam de existir no cadastro. A implementação só deve alterar os preços, a disponibilidade ou a comunicação pública depois dessa aprovação.
