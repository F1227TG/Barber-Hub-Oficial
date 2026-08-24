# Decisão de repositórios — Barber Hub e Beauty Hub

## Decisão atual

O Barber Hub permanece em um monorepositório. Web, PWA mobile e API têm fronteiras claras, mas ainda compartilham autenticação, contrato, regras, testes e calendário de entrega. Separá-los agora aumentaria a chance de uma correção chegar a apenas uma parte do produto.

## Por que o mobile não vira outro repositório agora

`mobile/*.html` é derivado de `html/*.html` por `scripts/sync_mobile_pages.py`. A interface mobile tem CSS e shell próprios, mas usa os mesmos módulos de autenticação, API e negócio. Um repositório mobile separado duplicaria ou exigiria publicar pacotes compartilhados antes de existir um aplicativo nativo e um ciclo de loja independente.

## Por que a API não vira outro repositório agora

`api/` e `backend/` já formam uma fronteira interna testável e publicável. Repositório não é pré-requisito para deploy separado. A mudança passa a valer quando houver equipe, SLA, escala, permissões ou calendário realmente independentes, além de CI de compatibilidade para o contrato OpenAPI.

## Beauty Hub

Beauty Hub tem identidade, público ampliado e roadmap próprios. Por isso foi preparado um ZIP inicial separado. Ele contém visão, arquitetura proposta, roadmap e uma landing inicial, mas **não** copia `.env`, chaves, banco, dados de usuários nem migrations do Barber Hub.

O novo repositório só deve ser criado quando começar o desenvolvimento independente. Até lá, o ZIP é um kit de partida; a página pública atual continua dentro do Barber Hub e aponta para uma validação de interesse honesta.

## Gatilhos para separar no futuro

- aplicativo nativo com distribuição em lojas;
- equipe e permissões independentes;
- deploy e versionamento próprios;
- contrato de API estável com testes de compatibilidade;
- necessidade comprovada de escala/SLA isolado;
- Beauty Hub com piloto e backlog validados.

## Estrutura recomendada quando o crescimento justificar

```text
barber-hub-web        site, PWA e painel Barber Hub
barber-hub-api        API pública/privada com contrato versionado
beauty-hub            experiência e domínio Beauty Hub
```

Até esses gatilhos existirem, manter uma fonte de verdade reduz custo e risco.
