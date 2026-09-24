# Decisões da atualização visual 1.12

Data: 24/09/2026  
Status: em homologação na branch `release/1.12-visual`

## Direção aprovada

- A identidade permanece escura com dourado, mas o dourado passou de amarelo
  intenso para um tom mais sóbrio. Ele fica reservado a chamadas, foco e
  estados relevantes; não é usado como preenchimento predominante.
- A interface prioriza a próxima tarefa antes de indicadores. Métricas seguem
  disponíveis, porém ocupam menos espaço na primeira dobra mobile.
- A mudança é somente visual e de navegação. Contratos de API, Supabase/RLS,
  permissões, URLs públicas e regras de plano não foram alterados.

## Navegação profissional no celular

- A dock possui quatro destinos: **Painel**, **Agenda**, **Clientes** e
  **Mais**.
- **Financeiro** saiu da dock e foi para o grupo Gestão em Mais. Continua
  sujeito à mesma permissão e ao mesmo plano do usuário; a alteração não cria
  acesso adicional.
- Toasts aparecem acima da dock, evitando concorrência com o cabeçalho ou
  botões de rotina.

## Descoberta e cliente

- A home desktop usa duas colunas equilibradas, sem uma área estrutural vazia
  ao lado do conteúdo principal.
- No portal, o card inteiro do estabelecimento abre o perfil. Botões como
  Agendar permanecem independentes e não são interceptados por essa ação.
- No mobile, busca e filtros rápidos ficam próximos do topo; filtros podem
  rolar horizontalmente sem comprimir o texto.
- A conta de cliente concentra a ação principal e agrupa seus resumos, sem
  remover histórico, avaliações ou favoritos.

## Administração e planos

- Administração, assinaturas e planos usam superfícies menos elevadas,
  bordas mais discretas e tamanhos de toque consistentes.
- As informações de assinatura, plano e recursos continuam completas; a
  redução é de ruído visual, não de dados ou capacidades administrativas.

## Limites desta etapa

- A branch ainda não foi publicada em produção. A promoção para `main` só
  ocorre depois da revisão do preview e da homologação final.
- Versão, cache do service worker, changelog de release e artefato final serão
  atualizados apenas no fechamento da release, para não invalidar o preview
  durante os commits incrementais.
