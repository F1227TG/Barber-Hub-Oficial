# Testes de navegador, dispositivo, rede, PWA e carga — Barber Hub 1.11

## Regras

- Resultados começam como **Não executado**.
- Registre versão exata do navegador/SO/dispositivo; “Chrome atual” não é evidência suficiente depois da execução.
- Emulação ajuda no layout, mas pelo menos um Android e um iOS físicos são necessários se ambos fizerem parte do público suportado.
- Carga e testes destrutivos só em ambiente autorizado, com dados sintéticos, limites definidos e plano de parada.
- Não desative CAPTCHA, RLS ou rate limit para obter um resultado “verde”; documente o perfil real do teste.

## Matriz de cobertura

| Plataforma | Navegador/modo | Versão/dispositivo | Ambiente | Estado |
|---|---|---|---|---|
| Windows | Chrome | A registrar | | Não executado |
| Windows | Edge | A registrar | | Não executado |
| Windows/macOS/Linux | Firefox, se suportado | A registrar | | Não executado |
| iOS/iPadOS | Safari | A registrar | | Não executado |
| Android | Chrome | A registrar | | Não executado |
| Desktop | PWA instalada | A registrar | | Não executado |
| Android/iOS | PWA instalada/adicionada à tela | A registrar | | Não executado |

Qualquer plataforma removida exige decisão de suporte e comunicação.

## Viewports e zoom

Teste pelo menos:

- 320 × 568;
- 360 × 800;
- 390 × 844;
- 412 × 915;
- 430 × 932;
- 768 × 1024;
- 1024 × 768;
- 1440 × 900;
- zoom de navegador a 200%;
- fonte ampliada do sistema quando disponível;
- orientação retrato/paisagem em mobile.

Critérios comuns:

- [ ] Sem rolagem horizontal involuntária.
- [ ] Dock/teclado virtual não cobre CTA/campo.
- [ ] Texto não é truncado sem alternativa.
- [ ] Alvo de toque e espaçamento evitam acionamento acidental.
- [ ] Foco é visível.
- [ ] Contraste permanece suficiente nos temas suportados.
- [ ] Movimento reduzido é respeitado.

## Roteiro por superfície

### Home e Sobre

- [ ] Visitante vê proposta e CTAs públicos coerentes.
- [ ] Cliente vê home orientada a tarefas e não vê CTA profissional.
- [ ] Profissional/admin recebem CTAs compatíveis.
- [ ] Barber pole é decorativo, responsivo e não bloqueia conteúdo.
- [ ] Link Beauty Hub abre o destino correto.

### Explorar

- [ ] Busca, limpar, destaques, paginação, vazio, erro e retry.
- [ ] Tipo, status, agenda, cidade, bairro, UF, raio, serviço, preço e avaliação combinam corretamente.
- [ ] Contador e estado/URL correspondem aos filtros aplicados.
- [ ] Voltar/reload não produz estado enganoso.
- [ ] Geolocalização aceita, negada, indisponível e expirada.

### Estabelecimento e agendamento

- [ ] Mapa/rota com endereço completo, incompleto e somente coordenadas.
- [ ] Serviços, equipe, portfólio e avaliações paginam sem duplicação.
- [ ] Visitante escolhe antes de autenticar e recupera contexto.
- [ ] Modal/sheet é navegável por teclado e leitor de tela.
- [ ] Proprietário/membro não agenda no próprio estabelecimento.
- [ ] Duplo toque e reconexão não criam agendamento duplicado.

### Conta e legal

- [ ] Cliente e profissional usam Perfil, Segurança e Privacidade.
- [ ] Links internos/hashes e links Termos/Privacidade funcionam.
- [ ] Consentimento de cadastro não vem marcado e guarda versão/data.
- [ ] Exclusão cancela com segurança e, quando confirmada em homologação, limpa estado local.

### Cliente e painel

- [ ] Próximo horário/estado vazio, espera, recorrência e notificações.
- [ ] Notificações dentro do painel e central separada convergem.
- [ ] Marcar individual/todas atualiza item, resumo e badge.
- [ ] Profissional vê recursos apenas de papel/plano.
- [ ] Planos aparecem apenas ao profissional.
- [ ] Avisos do dispositivo exibem suporte/permissão/assinatura e permitem desativar.

## Teclado e tecnologia assistiva

- [ ] Ordem de foco segue a ordem visual.
- [ ] Skip link chega ao conteúdo.
- [ ] Drawer/sheet/modal prende foco e restaura disparador.
- [ ] Escape fecha apenas quando seguro.
- [ ] Background fica inerte durante diálogo modal.
- [ ] Campos têm label, descrição de erro e estado anunciado.
- [ ] Tabs/chips/radiogroups usam papel, seleção e setas esperados.
- [ ] Estrelas de avaliação funcionam sem mouse.
- [ ] Ícones decorativos não geram ruído.
- [ ] Toast/erro/sucesso é anunciado sem roubar foco.

## Perfis de rede

Registre latência, banda e perda reais do perfil usado.

| Perfil | Cenários | Critério | Estado |
|---|---|---|---|
| Normal | Roteiro crítico completo | Sem erro inesperado | Não executado |
| Rede lenta | Home, Explorar, login, agenda, painel | Loading claro; controles não duplicam; timeout útil | Não executado |
| Queda durante leitura | Marketplace/painel | Erro preserva tela e retry recupera | Não executado |
| Queda durante escrita | Agendamento, gasto, importação | Rascunho/idempotência evita perda/duplicação | Não executado |
| Reconexão | Voltar online com aba aberta | Estado converge sem reload destrutivo | Não executado |
| Offline | Shell/PWA | Página offline ou cache conhecido; ação online não finge sucesso | Não executado |

Inspecione URL, localStorage, sessionStorage, IndexedDB, Cache Storage e logs para garantir que notas, tokens ou respostas de API não foram persistidos indevidamente.

## PWA

### Instalação

- [ ] Manifest, nome, ícones, start URL, display e theme color estão corretos.
- [ ] Instalação não é oferecida de modo repetitivo/enganoso.
- [ ] Deep links abrem a rota correspondente.

### Cache e offline

- [ ] Service Worker instala sem falha silenciosa relevante.
- [ ] Navegação usa a estratégia documentada.
- [ ] `/api/` nunca entra no cache estático.
- [ ] Offline não exibe dado privado stale de outro usuário.
- [ ] Logout/exclusão e troca de conta não deixam conteúdo privado recuperável pelo Back/cache.

### Upgrade e rollback

Teste as sequências:

1. versão anterior aberta → publicar 1.11 → navegar sem fechar;
2. versão anterior instalada → fechar/reabrir após publicar;
3. 1.11 controlada → rollback de hosting → navegar;
4. offline durante publicação → reconectar.

Critério: não misturar HTML/JS incompatíveis, não entrar em loop e oferecer recuperação compreensível.

## Plano de carga

### Antes

| Parâmetro | Valor aprovado |
|---|---|
| Ambiente | A definir |
| Janela | A definir |
| RPS/concurrency inicial e máximo | A definir após baseline |
| Duração por etapa | A definir |
| P95/P99 aceitável | A definir |
| Taxa de erro aceitável | A definir |
| Limite de banco/CPU/conexões | A definir |
| Critério de parada | A definir |
| Responsável e observador | A definir |

Não execute enquanto esta tabela estiver incompleta.

### Cenários

- leitura de `/api/v1/health` separada do teste de negócio;
- marketplace search/regional com paginação e filtros variados;
- detalhes públicos do estabelecimento;
- horários disponíveis;
- criação de agendamento em baixa taxa, com dados únicos e idempotência;
- painel: agenda/CRM/financeiro paginados com contas sintéticas;
- marcar notificações;
- job Push em lote controlado;
- tentativas acima do rate limit para confirmar resposta segura, sem causar negação de serviço.

Evite carga de login/cadastro real sem coordenação com Supabase/Turnstile e limites do plano. Nunca use dados ou tráfego de produção para “encher” resultados.

### Observações

Colete:

- throughput e concorrência;
- p50/p95/p99;
- códigos 2xx/4xx/429/5xx;
- timeout e retry;
- CPU/memória da função quando disponível;
- conexões, locks e queries lentas do banco;
- crescimento de fila;
- duplicidade/integridade de agendamentos;
- custo estimado/limites do fornecedor.

### Critérios

- [ ] Metas aprovadas foram atingidas.
- [ ] Rate limit protege sem derrubar tráfego normal medido.
- [ ] Nenhuma duplicação/corrupção ocorreu.
- [ ] RLS continuou efetiva sob concorrência.
- [ ] Backlog voltou ao normal depois do teste.
- [ ] Dados sintéticos foram removidos.

## Pagamentos — condicional

Enquanto não houver provedor, registre N/A justificado. Com provedor:

- teste apenas sandbox/homologação;
- use eventos e cartões de teste oficiais do fornecedor;
- cubra webhook duplicado/fora de ordem, timeout, retry, cancelamento, reembolso e reconciliação;
- não execute carga de checkout sem autorização do provedor;
- monitore divergência entre pagamento, assinatura e entitlement.

## Registro de execução

| Caso | Plataforma/rede | Ambiente/versão | Esperado | Observado | Estado | Evidência/defeito |
|---|---|---|---|---|---|---|
| | | | | | Não executado | |
