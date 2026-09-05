# Piloto e validação operacional

## Objetivo

Validar se o Barber Hub reduz esforço, melhora a organização e gera valor diário para clientes e barbearias de Jacinto/MG antes da expansão.

## Amostra mínima

- 5 a 10 estabelecimentos;
- combinação de profissional individual e equipe;
- Android de entrada/intermediário/recente e iPhones ainda usados pelo público;
- clientes novos e recorrentes;
- quatro a oito semanas de operação.

## Entrevista inicial com o profissional

1. Como registra horários e intervalos hoje?
2. Quanto atendimento chega por ordem de chegada, WhatsApp, telefone e agenda?
3. Como registra entradas, gastos e comissões?
4. Qual tarefa repete todos os dias?
5. Qual aparelho e conexão usa no trabalho?
6. O que faria abandonar o sistema?
7. Qual resultado justificaria pagar por ele?

## Cenários observados

- configurar períodos e intervalo;
- abrir agenda e registrar atendimento manual;
- registrar gasto e conferir resultado estimado;
- buscar cliente por telefone;
- reagendar, confirmar, marcar falta e usar lista de espera;
- importar clientes/serviços;
- usar mapa/rota e concluir agendamento como cliente;
- perder a conexão durante um formulário e retomar;
- receber notificação compatível com consentimento e preferência.

## Métricas

| Métrica | Antes | Durante | Critério proposto |
|---|---:|---:|---|
| tempo para registrar atendimento | medir | medir | redução perceptível |
| agendamentos iniciados/concluídos | medir | medir | acompanhar conversão |
| faltas por semana | medir | medir | tendência de queda |
| vagas preenchidas pela espera | 0 | medir | uso real do recurso |
| clientes que retornaram | medir | medir | tendência de aumento |
| erros/incidentes por 100 ações | medir | medir | queda após estabilização |
| profissionais ativos semanalmente | 0 | medir | uso recorrente |
| disposição de pagar | entrevistar | entrevistar | por plano e perfil |

## Registro de evidência

Para cada sessão, registrar data, papel, aparelho/navegador, tarefa, resultado, tempo, dificuldade observada, erro, sugestão e autorização para uso do relato. Não registrar senha, token ou dado pessoal desnecessário.

## Promoção de feature flag

Uma função passa de piloto para grupo maior quando não apresenta falha crítica, tem entendimento sem treinamento longo, não aumenta suporte de forma desproporcional e mostra uso ou resultado compatível com o problema proposto. Em incidente, usar o kill switch e preservar os dados para investigação.

## Expansão

Somente depois dos resultados de Jacinto: Vale do Jequitinhonha; depois outras cidades. Preço e limites finais dos planos devem usar evidência do piloto, não apenas comparação com concorrentes.
