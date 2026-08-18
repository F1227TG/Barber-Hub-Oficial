# Assets oficiais do Barber Hub 1.8.0

Este projeto usa a identidade **Proposta 01 — Clássica Premium** e o poste **Versão 01 — Realista Premium**.

## Organização

- `img/branding/`: logo principal, símbolo B, wordmark, horizontal e compacta, com versões para fundo escuro e claro.
- `img/branding/variacoes/`: versões monocromáticas branca/preta, compactas, wordmarks e símbolos auxiliares.
- `img/branding/icones/`: ícones de 16 a 512 px e favicon.
- `img/backgrounds/`: imagens editoriais por contexto de página.
- `img/placeholders/`: capas padrão para estabelecimentos sem foto.
- `img/decor/`: poste realista, tesoura, navalha e texturas transparentes.

## Aplicação no sistema

| Ponto | Asset aplicado |
| --- | --- |
| Cabeçalhos, rodapés, autenticação e PWA | compacta oficial / símbolo B |
| Home — hero | `barber-home-hero.webp` |
| Home — contexto institucional | `home-institucional.webp` |
| Home — assinatura de marca | `home-assinatura.webp` + logo horizontal |
| Portal — hero | `portal-hero.webp` + poste separado |
| Página pública da barbearia | capa cadastrada ou `barbearia-hero-default.webp` + poste separado |
| Sobre — manifesto | `sobre-craft.webp` + wordmark + símbolo B |
| Cards sem capa | placeholders `barbearia-01/02/03.webp` |
| Painel, agenda, métricas e administração | interface SaaS sem fotografia decorativa |

As regras visuais estão centralizadas em `css/brand-assets-1.8.css`, carregado por todas as páginas. O Service Worker inclui os arquivos essenciais para o modo instalável e usa uma chave de cache própria desta integração.
