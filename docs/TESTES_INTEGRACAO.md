# Testes de integração — Barber Hub

Marque cada item depois da configuração do Supabase.

## Banco

- [ ] SQL principal executou sem erro;
- [ ] As 11 tabelas aparecem no Table Editor;
- [ ] O bucket `barberhub-public` aparece no Storage;
- [ ] RLS está ativo nas tabelas públicas;
- [ ] `js/supabase-config.js` possui a Project URL sem `/rest/v1`;
- [ ] O console mostra `Barber Hub: Supabase inicializado.`.

## Autenticação

- [ ] Cadastro de cliente cria usuário em Authentication;
- [ ] Cadastro cria linha correspondente em `perfis`;
- [ ] Cadastro de profissional grava `tipo = barbeiro`;
- [ ] Login de cliente abre `cliente.html`;
- [ ] Login de profissional sem estabelecimento abre `cadastro-barbearia.html`;
- [ ] Login de profissional concluído abre `painel.html`;
- [ ] Recuperação de senha envia e-mail;
- [ ] Link de recuperação abre a redefinição;
- [ ] Alteração de senha funciona na página Minha conta;
- [ ] Logout encerra a sessão.

## Estabelecimento

- [ ] Onboarding cria estabelecimento;
- [ ] Horários são criados;
- [ ] Profissional principal é criado;
- [ ] Primeiro serviço é criado;
- [ ] Foto e capa aparecem no Storage;
- [ ] Estabelecimento aparece no portal;
- [ ] Página pública abre por ID/slug;
- [ ] Edição do painel atualiza a página pública;
- [ ] Status manual aberto/fechado funciona;
- [ ] Status automático respeita os horários;
- [ ] Data bloqueada impede agendamento.

## Agendamento

- [ ] Cliente precisa estar logado;
- [ ] Serviço e profissional são carregados do banco;
- [ ] Horários ocupados aparecem bloqueados;
- [ ] Agendamento cria linha em `agendamentos`;
- [ ] Dois clientes não conseguem reservar o mesmo profissional no mesmo intervalo;
- [ ] Profissional confirma ou recusa no painel;
- [ ] Cliente vê a atualização no histórico;
- [ ] Cliente cancela apenas agendamentos permitidos;
- [ ] Relatórios do painel usam dados reais.

## Suporte e administração

- [ ] Visitante consegue abrir ticket;
- [ ] Usuário logado consegue abrir e acompanhar ticket;
- [ ] Conta promovida acessa `admin.html`;
- [ ] Conta comum não acessa `admin.html`;
- [ ] Administrador visualiza tickets;
- [ ] Administrador responde e altera status;
- [ ] Administrador oculta/publica estabelecimento.

## Interface

- [ ] Tema claro tem contraste e sombras discretas;
- [ ] Tema escuro funciona;
- [ ] Menu lateral abre pelas três barras;
- [ ] Itens do menu mudam conforme a conta;
- [ ] Fonte maior e menor funciona;
- [ ] Alto contraste funciona;
- [ ] Redução de movimento funciona;
- [ ] Layout funciona no celular;
- [ ] Não há erro vermelho no console.

## Deploy

- [ ] GitHub recebeu todos os arquivos;
- [ ] Vercel está `Ready`;
- [ ] URLs do Vercel foram adicionadas no Supabase Auth;
- [ ] Cadastro funciona online;
- [ ] Login funciona online;
- [ ] Upload funciona online;
- [ ] Agendamento funciona online;
- [ ] Painel funciona online.
