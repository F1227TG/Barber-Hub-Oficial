# Organização dos estilos

O primeiro lote da modernização extraiu `releases/release-1.11.css`. O arquivo público continua existindo como **bundle gerado de compatibilidade**. Edite as fontes abaixo e execute `npm run build:css`; não edite o bundle diretamente.

| Diretório | Responsabilidade |
| --- | --- |
| `core/` | Base de layout, movimento reduzido e contraste forçado |
| `components/` | Controles e estrutura compartilhada dos drawers de atividade |
| `pages/` | Área de conta |
| `features/` | Cards do marketplace e orientação do onboarding |
| `mobile/` | Adaptações responsivas dos workspaces; mantém breakpoints existentes |
| `legacy/` | Regras ainda misturadas de planos, cliente, profissional, admin e páginas públicas |

`bundles.json` define a ordem exata da cascata. O builder concatena as fontes sem minificar, ordenar seletores, criar imports ou reescrever URLs. Caminhos relativos em `url()` continuam relativos ao arquivo **público** em `releases/`. Novas fontes precisam constar no manifesto; o verificador rejeita arquivos esquecidos e duplicados.

`npm run check:css` verifica sincronização do bundle e as verificações responsivas anteriores. `npm run check:visual` compara as páginas completas com a baseline Windows/Chromium. Atualização de snapshots exige revisão das imagens; nunca atualizar apenas para eliminar uma falha.

`vizu.html` é uma página institucional autônoma para apresentar o ecossistema. Ela carrega `vizu.css` diretamente e não entra no bundle de compatibilidade Barber Hub; manter essa fronteira evita herdar a cascata e as classes legadas do produto.

O redesign autorizado em 26/10 acrescenta `core/editorial.css` e `pages/editorial-public.css` ao final do bundle: tokens e componentes compartilhados, apresentação pública e adaptações mobile. Diferentemente da extração inicial, esta etapa muda intencionalmente o visual. Consulte [o registro do redesign](../docs/REDESIGN-BARBER-HUB-2026-10-26.md).

Os demais CSS antigos continuam ativos. Não remover links HTML, arquivos de release ou regras do bloco legado sem mapear consumidores e ampliar a cobertura visual. A extração inicial preservou as 885 linhas, incluindo comentários e ordem, com normalização apenas de CRLF para LF. Veja [Etapa 2](../docs/modernizacao/ETAPA_2.md).
