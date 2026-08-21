# Decisão técnica — repositórios mobile e API

## Decisão

Manter o Barber Hub em **um monorepositório nesta fase**, preservando fronteiras internas claras. Não separar agora a versão mobile nem a API em repositórios independentes.

## Motivos

- web e mobile compartilham autenticação, regras, API client, estilos e domínio;
- `/mobile` é gerado/sincronizado a partir de `/html`, o que impede diferença funcional entre as experiências;
- a API já possui uma fronteira própria em `/api` e `/backend`, podendo ser publicada independentemente sem mover o código;
- três repositórios agora exigiriam coordenação de versões, contratos e deploys antes de haver equipes/ciclos independentes;
- a separação aumentaria o risco de correções de segurança chegarem a um cliente e não ao outro.

## Preparação feita agora

`backend/domain` contém regras puras sem Supabase, FastAPI ou Vercel. Elas podem ser desenvolvidas/testadas offline e compartilhadas pelos serviços. `backend/supabase.py` permanece como gateway de infraestrutura.

```text
backend/domain     regras puras e testes offline
backend/services   casos de uso
backend/supabase   integração externa
api/index.py       transporte HTTP/FastAPI
```

O FastAPI Cloud pode ser avaliado como destino de deploy/observabilidade da API, mas não exige um repositório separado.

## Quando reavaliar

Separar passa a ajudar quando pelo menos uma destas condições ocorrer:

- aplicativo mobile tornar-se nativo/Capacitor/React Native e tiver ciclo de loja próprio;
- API tiver equipe, escala, SLA ou calendário de deploy independente;
- existir contrato OpenAPI estável e CI de compatibilidade entre clientes;
- o monorepo causar gargalo comprovado de build, permissões ou ownership.

Até lá, releases atômicas e testes conjuntos valem mais que a separação física.

