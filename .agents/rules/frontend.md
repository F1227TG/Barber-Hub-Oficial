# Regra de frontend

Aplicar ao editar HTML, CSS ou JavaScript do navegador.

- Preserve a identidade preta/dourada e as variáveis de `css/global.css`.
- Mobile não é apenas desktop reduzido: priorize uma tarefa, use navegação inferior, bottom sheets e cards compactos.
- Evite criar cards para todo conteúdo; use espaço, hierarquia e agrupamento.
- Botões de toque devem ter pelo menos 44 px de altura.
- Campos precisam de `<label>`, mensagem de erro e tipo de teclado apropriado.
- Funções de dados ficam em `js/api.js`; chamadas à API Python ficam em `js/backend-api.js`.
- Use `escapeHTML` ao renderizar dados externos.
- Não use `alert`, `confirm` ou `prompt`; use os modais compartilhados.
- Adicione comentários por seção e explique regras de negócio, não linhas óbvias.
- Teste em 360, 390, 412, 768 e desktop.
