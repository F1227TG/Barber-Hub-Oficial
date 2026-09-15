# Checklist de pré-release — Barber Hub 1.11

Nenhum item está presumido como concluído. Use este documento como registro de go/no-go e anexe evidências segundo [README](README.md).

## 1. Identificação da candidata

- [ ] Commit candidato:
- [ ] Deployment de homologação:
- [ ] Deployment anterior conhecido como estável:
- [ ] Projeto Supabase de homologação:
- [ ] Projeto Supabase de produção:
- [ ] Lista e ordem exatas das migrations 1.11:
- [ ] Verificador pós-migration:
- [ ] Janela de publicação e fuso:
- [ ] Responsável pela execução:
- [ ] Responsável pelo go/no-go:
- [ ] Canal de comunicação e incidente:

Se qualquer campo acima estiver vazio no momento da publicação, a decisão é **no-go**.

## 2. Escopo e rastreabilidade

- [ ] Todas as linhas P0/P1 da [matriz](MATRIZ_REQUISITOS_E_ACEITE.md) têm implementação, teste e evidência.
- [ ] Alterações fora do escopo estão registradas e avaliadas.
- [ ] Não há P0 aberto.
- [ ] Cada P1 aberto possui exceção formal, mitigação, responsável e prazo.
- [ ] Textos de Termos e Privacidade receberam aprovação apropriada; revisão técnica não é aprovação jurídica.
- [ ] Rotas, menus e CTAs foram confrontados com cada perfil.
- [ ] Planos continuam restritos ao público profissional conforme o requisito da 1.11.
- [ ] O fluxo público de agendamento antes do login foi preservado.
- [ ] O bloqueio de autoagendamento foi testado na UI e no servidor.

## 3. Qualidade do repositório

- [ ] A fonte `html/` e as páginas `mobile/` estão sincronizadas pelo fluxo oficial do projeto.
- [ ] A porta canônica `npm run check` terminou com código zero no commit candidato.
- [ ] O log completo da execução foi guardado, com dados sensíveis removidos.
- [ ] Sintaxe JavaScript, compilação Python, testes unitários/API e auditores de release passaram.
- [ ] Links e IDs duplicados foram verificados.
- [ ] Nenhum segredo, token, senha, chave privada VAPID ou secret do Turnstile entrou em arquivo público.
- [ ] Dependências e alertas de segurança foram revisados sem atualização oportunista durante a janela.
- [ ] Mudanças concorrentes foram congeladas durante a homologação final.

## 4. Banco e migrations

- [ ] O estado real do histórico remoto foi comparado com a árvore local.
- [ ] Não se presumiu que uma migration manual anterior conste no histórico oficial.
- [ ] A lista final da 1.11 é aditiva e não altera arquivo já aplicado.
- [ ] O impacto em tabelas, funções, triggers, índices, grants e policies foi revisado.
- [ ] Compatibilidade entre banco novo e deployment anterior foi documentada.
- [ ] Backup recuperável foi concluído e identificado.
- [ ] Restauração foi ensaiada em ambiente isolado conforme [runbook](BACKUP_E_RESTAURACAO.md).
- [ ] Migration foi ensaiada em cópia representativa e o tempo observado foi registrado.
- [ ] Verificador pós-migration passou em homologação.
- [ ] Security Advisor e Performance Advisor foram capturados antes e depois.
- [ ] Plano de forward-fix/restore está aprovado; nenhum `DROP` improvisado é o rollback padrão.

## 5. Configuração externa

- [ ] Todas as variáveis foram conferidas por presença, escopo e ambiente conforme [configuração externa](CONFIGURACAO_EXTERNA.md).
- [ ] `SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_ROLE_KEY` não está no navegador.
- [ ] Origens CORS são exatas e não usam `*` em produção.
- [ ] Site URL e Redirect URLs de Auth correspondem a desktop, mobile e domínio canônico.
- [ ] Turnstile está ativo e foi testado nos fluxos que o consomem.
- [ ] Proteção contra senhas vazadas está ativa ou registrada como bloqueio/risco condicionado ao plano.
- [ ] VAPID pública, privada e subject formam o mesmo par e estão no ambiente correto.
- [ ] `CRON_SECRET` ou `BARBER_HUB_JOBS_SECRET` está presente e não foi exposto.
- [ ] O Cron publicado aponta para o domínio e rota corretos.
- [ ] Execução autorizada e tentativa sem segredo do job foram testadas.
- [ ] Advisors foram revisados; cada alerta novo tem decisão e responsável.

## 6. Perfis, RLS e planos

- [ ] A [matriz de perfis e RLS](TESTES_DE_PERFIS_E_RLS.md) foi executada com contas separadas.
- [ ] Existem dois estabelecimentos de teste independentes para tentativa cross-tenant.
- [ ] Visitante, cliente, profissional, recepção, gerente, proprietário, admin, autenticado sem vínculo e usuário do outro estabelecimento foram cobertos.
- [ ] Operações permitidas funcionam.
- [ ] Operações proibidas falham por acesso direto à API/banco, não apenas por ausência de botão.
- [ ] Notificações, avaliações, agenda, CRM, financeiro, equipe, retenção, importações, Push e auditoria não vazam dados entre usuários/estabelecimentos.
- [ ] Gratuito, Essencial, Profissional e Elite foram confrontados com a fonte canônica de entitlements.
- [ ] Falha do resolvedor de entitlement mantém recursos pagos fechados.
- [ ] Pausa, expiração, downgrade e upgrade foram observados.

## 7. Experiência, acessibilidade e PWA

- [ ] O [plano de navegador/dispositivo](TESTES_NAVEGADOR_DISPOSITIVO_E_CARGA.md) foi executado.
- [ ] Desktop e mobile foram testados nos breakpoints definidos.
- [ ] Não existe overflow horizontal involuntário, CTA coberto pelo dock ou foco invisível.
- [ ] Zoom de 200%, teclado e leitor de tela cobrem conta, filtros, agendamento, modais e notificações.
- [ ] Drawers, sheets e modais prendem foco, restauram foco e liberam scroll.
- [ ] Tema escuro/claro, alto contraste e movimento reduzido permanecem utilizáveis.
- [ ] Rede lenta, perda/reconexão, timeout e duplo envio não causam duplicação.
- [ ] PWA instala, atualiza, abre offline e não armazena respostas de `/api/`.
- [ ] Rollback de PWA foi testado em sessão já controlada por Service Worker.
- [ ] Console e rede não mostram erro inesperado no roteiro crítico.

## 8. Fluxos críticos

- [ ] Visitante explora e inicia agendamento; após login/cadastro, o contexto válido retorna.
- [ ] Proprietário/membro não agenda no próprio estabelecimento.
- [ ] Cliente visualiza início, agenda, espera, recorrências e notificações.
- [ ] Profissional configura negócio, serviços, equipe e agenda conforme plano/papel.
- [ ] Filtros combinados do Explorar correspondem exatamente aos resultados.
- [ ] Mapa e rota funcionam com endereço e/ou coordenadas.
- [ ] Avaliações usam total/média corretos e paginação consistente.
- [ ] Marcar notificação individual/todas atualiza contador e badges.
- [ ] Exclusão de conta limpa sessão/estado local e preserva apenas histórico legitimamente anonimizado.
- [ ] Links de Termos, Privacidade e Beauty Hub funcionam nas superfícies definidas.

## 9. Operação, privacidade e suporte

- [ ] Dashboards, consultas e alertas do [plano de monitoramento](MONITORAMENTO_E_ALERTAS.md) estão ativos.
- [ ] Cada alerta possui responsável e canal de escalonamento.
- [ ] Logs podem ser correlacionados por `request_id` sem conter conteúdo sensível.
- [ ] O [runbook de incidentes](INCIDENTES_E_RETENCAO_LGPD.md) possui contatos e substitutos.
- [ ] RPO e RTO foram definidos e aprovados; não permanecem “a definir”.
- [ ] Registro de tratamento e tabela de retenção foram aprovados.
- [ ] Solicitação de titular e exclusão foram ensaiadas.
- [ ] Atendimento possui mensagem de status e caminho de escalonamento.
- [ ] O rollback pode ser iniciado sem depender de uma única pessoa.

## 10. Pagamentos — gate condicional

Situação de referência: a documentação anterior informa que não há gateway integrado. Marque a primeira opção e mantenha as demais como N/A justificado enquanto isso continuar verdadeiro.

- [ ] Confirmado que a 1.11 **não** promete, cobra, renova ou estorna pagamento real; CTAs/copy não simulam checkout.
- [ ] N/A justificado registrado para testes de provedor, webhook, conciliação, reembolso e chargeback.

Se um provedor for integrado antes da publicação:

- [ ] O fornecedor, contrato, credenciais, ambientes e responsáveis estão documentados.
- [ ] Checkout, webhook assinado, idempotência, renovação, falha, cancelamento, reembolso e reconciliação passaram.
- [ ] Alertas de webhook/fila/conciliação estão ativos.
- [ ] Termos, Privacidade, suporte, tributação e retenção foram reavaliados.

Qualquer integração real de pagamento sem concluir este bloco muda a decisão para **no-go**.

## 11. Publicação e observação

- [ ] Go/no-go foi registrado antes da mudança.
- [ ] Banco foi migrado na ordem aprovada e o verificador passou.
- [ ] API e frontend/PWA compatíveis foram publicados.
- [ ] Smoke tests públicos e autenticados passaram no domínio final.
- [ ] Monitoramento reforçado pós-deploy foi iniciado.
- [ ] Nenhum alerta bloqueador surgiu.
- [ ] Responsável permaneceu disponível durante a janela acordada.
- [ ] Registro final contém deployment, commit, migrations, horários e decisão.

## Registro de decisão

| Campo | Valor |
|---|---|
| Decisão | Aguardando |
| Data/hora/fuso | |
| Commit/deployment | |
| Banco/migrations | |
| Aprovadores | |
| Exceções aceitas | |
| Evidências | |
| Próxima revisão | |
