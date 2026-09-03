# Checklist de homologação final — Barber Hub 1.10.0

## Porta de entrada

- [ ] página inicial, portal, planos, Beauty Hub, suporte, login e cadastro abrem sem erro;
- [ ] nenhum texto normal menciona banco, chave, migration ou provedor;
- [ ] links, voltar, menu, PWA e offline funcionam.

## Cliente

- [ ] pesquisa por nome/região e “Perto de mim”;
- [ ] estabelecimento mostra status, períodos, serviços, equipe, portfólio, avaliações, mapa e rota;
- [ ] agendamento mantém contexto após login/cadastro;
- [ ] confirmação, cancelamento, recorrência, lista de espera, fidelidade e cupom respeitam plano/regras;
- [ ] paginação não repete nem perde itens.

## Profissional e proprietário

- [ ] dock mobile abre “Mais” com opções permitidas;
- [ ] topo não corta nome, cargo ou navegação;
- [ ] Painel, Agenda, Clientes, Financeiro e Mais funcionam sem carregamento infinito;
- [ ] múltiplos períodos, cópia de dias e status manual;
- [ ] atendimento avulso cadastrado uma vez mesmo com toque repetido;
- [ ] gastos, períodos financeiros, resultado e comissões;
- [ ] busca de cliente por nome, telefone e e-mail;
- [ ] importação válida/invalidada/duplicada;
- [ ] avisos e horário silencioso;
- [ ] permissões por papel e substituições granulares.

## Administração

- [ ] acesso negado a não-admin;
- [ ] totais e prontidão 1.10;
- [ ] busca global paginada de usuários/negócios;
- [ ] paginação de agenda, avaliações, denúncias e suporte;
- [ ] moderação não pode ser desfeita pelo proprietário;
- [ ] redefinição envia link e nunca mostra senha.

## Responsividade e acessibilidade

- [ ] 320, 360, 390, 412, 430, 768, 1024 e 1440 px;
- [ ] sem rolagem horizontal involuntária;
- [ ] dock não cobre o último controle;
- [ ] foco por teclado, rótulos, contraste e zoom 200%;
- [ ] estados de carregamento, vazio, erro, offline e sucesso.

## Segurança/infraestrutura

- [ ] migrations 29 → 30 → 31;
- [ ] verificador 31;
- [ ] CAPTCHA, URLs, senhas vazadas, origens e VAPID;
- [ ] Advisors revisados;
- [ ] contas cliente/profissional/recepção/gerente/proprietário/admin/sem vínculo;
- [ ] planos Gratuito/Essencial/Profissional/Elite;
- [ ] backup e plano de rollback.

## Decisão de publicação

Só marque “aprovado” quando todos os bloqueadores estiverem resolvidos. Um item externo pendente precisa de responsável e data; não pode ser tratado como concluído apenas porque o código está pronto.

