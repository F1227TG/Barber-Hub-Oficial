# Decisão de repositórios — Barber Hub 1.10.0

## Decisão atual

Web, PWA/mobile e API continuam no mesmo repositório nesta fase final. O Beauty Hub permanece em repositório próprio.

## Por que não separar Barber Hub agora

- web e mobile compartilham autenticação, modelos, regras, assets e ciclo de release;
- `/mobile` é uma apresentação específica, não um aplicativo nativo independente;
- separar imediatamente duplicaria versionamento, testes, configuração e coordenação;
- a equipe atual ganha mais com uma porta de qualidade única;
- uma mudança estrutural perto do lançamento elevaria o risco sem benefício operacional comprovado.

## Organização interna adotada

```text
api/                 entrada FastAPI
backend/domain/      regras puras e testáveis offline
backend/services/    casos de uso e integração
css/releases/        estilos novos por release
docs/                documentação e decisões
html/                páginas desktop/canônicas
img/branding/        identidade oficial
img/library/         biblioteca de conteúdo reutilizável
js/core/             infraestrutura do navegador
js/features/         funcionalidades novas isoladas
mobile/              páginas mobile sincronizadas
scripts/             qualidade e manutenção
sql/                 migrations/verificadores
tests/               regressões Python
```

## Quando separar API e mobile

Reavaliar apenas se existir pelo menos um destes sinais:

- aplicativo nativo com lojas, versão e equipe próprias;
- API usada por mais de um produto com deploy independente;
- permissões/repositórios diferentes por equipe;
- releases frequentes de uma camada bloqueadas pela outra;
- necessidade real de pacote compartilhado versionado.

Se isso acontecer, primeiro extraia contratos e CI, depois mova a API. Nunca copie segredos ou bancos. O mobile consome uma API versionada e mantém autenticação compatível.

## Beauty Hub

Beauty Hub é produto irmão com público, categorias, linguagem e evolução próprios. Compartilhar ideias e padrões é adequado; compartilhar credenciais, tabelas de produção ou copiar código sem versionamento não é. A integração futura deve ocorrer por contratos documentados ou pacotes comuns deliberados.

