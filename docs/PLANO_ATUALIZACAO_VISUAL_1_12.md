# Plano de atualização visual 1.12

## Objetivo

Evoluir a interface web e PWA do Barber Hub para uma experiência mais clara,
menos fragmentada em cartões e orientada à próxima ação. A mudança preserva
contratos de API, regras de autorização, URLs e a sincronização entre `html/`
e `mobile/`.

## Diagnóstico inicial

- O portal público em desktop usa uma composição mobile expandida: conteúdo
  concentrado à esquerda, grande área vazia e CTA excessivamente largo.
- O painel profissional mistura três níveis de navegação (topo, lateral e
  dock mobile) e, no celular, mostra filtros e quatro indicadores antes da
  agenda e da próxima ação.
- Avisos em tempo real podem competir com o cabeçalho no viewport de celular.
- Cliente e profissional têm muitos cartões de resumo; métricas que apenas
  informam devem ser agrupadas e a ação principal deve ganhar precedência.
- As camadas de CSS acumuladas por release exigem uma camada visual nova e
  localizada, sem reescrever nem alterar camadas históricas aplicadas.

## Direção proposta

1. **Ação antes de indicador:** a primeira dobra mostra a tarefa que o usuário
   pode concluir agora; KPIs entram como resumo compacto e expansível.
2. **Um papel por superfície:** cards existem para iniciar uma tarefa, resumir
   uma entidade ou mostrar estado; não para cada texto curto.
3. **Navegação contextual:** desktop usa um único eixo primário e grupos
   claros; mobile fixa apenas as cinco ações do dia a dia e desloca o restante
   para `Mais`.
4. **Mesmo sistema, adaptação real:** desktop reorganiza em colunas e contexto;
   mobile usa páginas/sheets e áreas de toque de pelo menos 44 px, em vez de
   apenas encolher a versão web.
5. **Identidade preservada:** manter escuro, dourado e linguagem Barber Hub,
   com menos decoração concorrendo com a leitura.

## Etapas commitáveis

### 1. Fundação visual e responsiva

- Criar uma camada visual 1.12 isolada, com tokens de espaçamento, elevação,
  densidade, estados de foco e barra segura para avisos.
- Padronizar cabeçalho, toast, botões de ação e hierarquia de seções.
- Corrigir o portal desktop que mantém composição de viewport estreito após a
  mudança de largura.

### 2. Portal público e descoberta

- Compactar hero desktop, limitar largura de CTA e converter atalhos em uma
  grade de intenção com menos ruído visual.
- Priorizar busca, filtros e disponibilidade em mobile; preservar a página
  pública acessível a visitantes.

### 3. Área do cliente

- Transformar o centro de comandos em "próximo atendimento" com uma ação
  principal e ações secundárias discretas.
- Agrupar atividade, favoritos, avaliações e histórico em resumos progressivos
  em vez de vários cartões concorrentes.

### 4. Área profissional

- Reorganizar o painel por operação diária: próximo cliente, agenda, encaixe,
  financeiro rápido e alertas.
- No celular, colocar agenda/ação principal antes de filtros e KPIs; manter
  dock em Painel, Agenda, Clientes, Financeiro e Mais.
- No desktop, reduzir duplicação entre topo, lateral e ações da seção.

### 5. Administração, estados vazios e detalhes

- Aplicar os mesmos padrões a administração, planos, avaliações, configurações
  e estados de carregamento/erro/vazio.
- Revisar overflow, contraste, foco por teclado e textos longos em 360, 390,
  768, 1024 e 1440 px.

### 6. Homologação e release

- Sincronizar as 22 páginas mobile geradas.
- Executar testes, validação estrutural, checagem de links/PWA e cenários de
  cliente, profissional, visitante e administrador.
- Atualizar versão, cache do service worker, changelog, mapa e evidências da
  release somente ao fechar o conjunto visual.

## Critérios de aceite

- Não há sobreposição entre cabeçalho, toast, dock, botões ou conteúdo em
  360/390 px.
- A primeira dobra mobile traz uma tarefa utilizável, não uma parede de KPIs.
- Nenhuma ação fica exclusivamente em ícone sem rótulo/contexto acessível.
- Desktop não apresenta espaços estruturais vazios, CTA desproporcional ou
  navegação duplicada para a mesma ação.
- Visitantes continuam explorando estabelecimentos; regras de API, RLS e
  permissões por papel não mudam nesta atualização.
- `mobile/` permanece gerado e sincronizado com `html/`.

## Decisões ainda necessárias

- Confirmar se a identidade deve ser uma evolução do tema escuro/dourado atual
  ou uma mudança visual ampla.
- Definir a prioridade inicial entre cliente/descoberta e operação do barbeiro.
- Definir se os commits visuais seguem diretamente para `main` (publicação a
  cada etapa) ou se devem ser agrupados em branch de homologação e publicados
  somente após a aprovação final.
