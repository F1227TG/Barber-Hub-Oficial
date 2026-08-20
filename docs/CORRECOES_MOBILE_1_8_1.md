# Barber Hub 1.8.1 — QA e correções mobile

Correções feitas após teste visual em dispositivo/DevTools:

- conta mobile reorganizada; foto/avatar volta a respeitar dimensões; navegação Perfil/Segurança/Privacidade corrigida;
- zona de exclusão em uma coluna, sem títulos esmagados;
- botão Voltar no header de todas as páginas mobile, exceto Início, com fallback seguro;
- página pública do estabelecimento recebe espaço inferior suficiente para dock + CTA e não corta o final;
- filtro do marketplace passa a ficar acima da dock, com rolagem interna e ações sempre acessíveis;
- comparação de planos no mobile substitui a tabela responsiva por blocos “o que muda em cada plano”;
- respostas de tickets ficam recolhidas e expandem sob demanda;
- drawer mobile volta a ocupar a tela inteira e corrige foco antes de aria-hidden/inert;
- linhas vazias/colspan em tabelas mobile não exibem mais rótulos comprimidos (ex.: “LOCAL”);
- instalação PWA não é interceptada em `/mobile`, eliminando o aviso beforeinstallprompt desnecessário;
- meta `mobile-web-app-capable=yes` adicionada às páginas mobile;
- Live Server (127.0.0.1:5500/5501/5502) não tenta mais chamar `/api/v1` inexistente antes do fallback Supabase;
- espaçamento final do Portal reduzido e fundos harmonizados para evitar sensação de bloco vazio.

A versão mobile continua objetiva e orientada à ação; o desktop mantém a apresentação mais informativa.
