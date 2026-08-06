# Guia de código — Barber Hub 1.5.0

## Princípio central

Cada regra deve existir na camada adequada:

- **HTML:** estrutura e semântica;
- **CSS:** aparência e responsividade;
- **JavaScript da página:** interação e renderização;
- **`js/api.js`:** consultas públicas/autorizadas ao Supabase;
- **`js/backend-api.js`:** consumo da API própria;
- **Python:** validações e operações sensíveis;
- **SQL/RPC:** consistência transacional e políticas de dados.

## Estilos

Ordem atual:

1. `vendor/bootstrap.min.css` / `css/framework.css`: fornecedor;
2. `css/global.css`: tokens, componentes e temas;
3. `css/index.css` ou `css/pages.css`: telas existentes;
4. `css/mobile-app.css`: navegação e experiência mobile;
5. `css/release-1.4.1.css`: correções preservadas da versão anterior;
6. `css/product-redesign.css`: camada de produto 1.5 e ajustes finais.

Use tokens como `var(--text)`, `var(--muted)`, `var(--surface)` e `var(--gold)`.
Evite alturas fixas em cards com conteúdo variável.

## JavaScript

- `supabase-config.js` e `supabase-client.js`: cliente público;
- `api.js`: operações de dados e compatibilidade;
- `backend-api.js`: requisições para `/api/v1`;
- `auth.js`: sessão e proteção de páginas;
- `ui.js`: menu, drawer, dock, tema e acessibilidade;
- `mobile-app.js`: comportamento específico de telas pequenas;
- `product-redesign.js`: instalação do PWA e utilidades do redesign;
- arquivos com nome de página: estado e eventos daquela tela.

Organização recomendada dentro de cada arquivo:

1. estado;
2. seletores e constantes;
3. formatadores puros;
4. renderização;
5. operações assíncronas;
6. eventos;
7. inicialização.

## API Python

- `api/index.py`: rotas, middlewares e erros HTTP;
- `backend/models.py`: entradas validadas;
- `backend/security.py`: autenticação/autorização;
- `backend/supabase.py`: único gateway HTTP do backend;
- `backend/services/`: regras por domínio.

Nenhum módulo fora de `backend/config.py` deve ler variáveis de ambiente.
Nenhuma rota deve retornar stack trace, segredo ou hash de senha.

## Agendamento múltiplo

A interface mantém os serviços selecionados em um `Set`. A API envia uma lista
de UUIDs para a RPC `criar_agendamento_multisservico`. A RPC calcula duração,
preço e conflito numa transação e grava snapshots em `agendamento_servicos`.

`agendamentos.servico_id` continua guardando o primeiro serviço para manter
compatibilidade com partes antigas durante a transição.

## Comentários

Comente intenção, decisões e regras de negócio. Não comente cada linha óbvia.
Cabeçalhos de seção devem facilitar navegação sem duplicar o que o código já
diz claramente.

## Checklist

```bash
npm run check
```

Depois:

- tema escuro e claro;
- 360 px, 390 px, 412 px, tablet e desktop;
- cliente, profissional e administrador;
- Service Worker atualizado;
- nenhuma secret key no Git;
- migration correspondente documentada.
