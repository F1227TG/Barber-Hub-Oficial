/** Regressões da versão 1.11.0 — continuidade, privacidade e acabamento. */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const exists = relative => fs.existsSync(path.join(root, relative));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

const migration = read("supabase/migrations/20260911132328_barberhub_1_11_confiabilidade_privacidade.sql").toLowerCase();
const verifier = read("sql/verificar_33_release_1_11.sql").toLowerCase();
const api = read("api/index.py");
const models = read("backend/models.py");
const gateway = read("backend/supabase.py");
const adminService = read("backend/services/admin.py");
const maintenance = read("backend/services/maintenance.py");
const catalogService = read("backend/services/catalog.py");
const account = read("html/conta.html") + read("js/conta.js");
const booking = read("js/features/booking.js") + read("js/barbearia.js");
const client = read("html/cliente.html") + read("js/cliente.js");
const portal = read("html/portal.html") + read("js/portal.js");
const notifications = read("js/notificacoes.js") + read("js/notification-center.js");
const plans = read("html/planos.html") + read("js/planos.js");
const onboarding = read("html/cadastro-barbearia.html") + read("js/onboarding.js");
const registration = read("html/cadastro.html") + read("js/cadastro.js") + read("js/auth.js") + read("js/api.js");
const privacy = read("html/privacidade.html");
const legal = read("html/termos.html") + privacy + registration;
const adminSubscriptions = read("html/admin-assinaturas.html") + read("js/admin-assinaturas.js") + read("js/api.js") + read("js/backend-api.js");
const professionalPanel = read("html/painel.html") + read("js/painel.js") + read("js/features/operation-real-1.10.js");
const css = read("css/releases/release-1.11.css");
const sw = read("service-worker.js");
const utils = read("js/utils.js");
const accessService = read("backend/services/access.py");
const retentionService = read("backend/services/retention.py");

for (const file of [
  "api/routers/account.py", "api/routers/catalog.py", "api/routers/system.py",
  "backend/schemas/account.py", "backend/services/account.py",
  "backend/services/email_delivery.py", "backend/services/system.py",
  "backend/domain/identity.py", "js/core/view-state.js", "js/notification-center.js"
]) check(exists(file), `estrutura 1.11 ausente: ${file}`);

for (const marker of [
  "consentimentos_usuario", "solicitacoes_exclusao_conta", "fila_emails",
  "politicas_retencao_dados", "criar_agendamento_idempotente_111",
  "bloquear_autoagendamento_111", "buscar_marketplace_regional_111",
  "listar_meus_estabelecimentos_operados_111",
  "cancelar_recorrencia_agendamento_111",
  "admin_atribuir_plano_111", "assinatura_eventos_admin_idempotencia_111_idx",
  "reservar_exclusoes_conta_111", "listar_arquivos_conta_exclusao_111",
  "anonimizar_conta_exclusao_111", "executar_retencao_tecnica_111"
]) check(migration.includes(marker), `migration 33 não contém ${marker}`);
check(migration.includes("idempotency_key_reused") && migration.includes("requisicao_hash"), "atribuição administrativa precisa vincular a chave ao payload");
check(!migration.includes("delete from storage.objects") && !migration.includes("delete from auth.users"), "exclusão não pode apagar Storage/Auth diretamente por SQL");
check(
  migration.includes("private.validar_estabelecimento_agenda_plano_111")
    && migration.includes("before insert or update of aceita_agendamento")
    && migration.includes("p_complemento,false"),
  "banco precisa iniciar todo estabelecimento sem agenda e validar ativações futuras"
);
check(migration.includes("drop function if exists public.excluir_minha_conta()"), "RPC antiga de exclusão imediata precisa ser removida");
check(migration.includes("alter function public.admin_atribuir_plano(uuid,text,text,date,text) set search_path = ''"), "RPC administrativa legada precisa de search_path seguro");
check(migration.includes("revoke execute on function public.admin_atribuir_plano(uuid,text,text,date,text) from authenticated"), "RPC administrativa legada precisa ficar fechada para o navegador");
check(verifier.includes("assinatura_admin_rpc_ok") && verifier.includes("assinatura_admin_idempotencia_indice_ok"), "verificador 33 precisa cobrir a atribuição administrativa");
check(verifier.includes("onboarding_agenda_entitlement_ok"), "verificador 33 precisa cobrir a proteção da agenda no onboarding");

check(api.includes('Idempotency-Key') && api.includes("choose_idempotency_key"), "API precisa validar chaves de idempotência");
check(api.includes('@app.patch("/api/v1/admin/establishments/{establishment_id}/subscription")'), "rota administrativa de assinatura ausente");
check(models.includes("class AdminSubscriptionUpdate") && models.includes("validate_effective_period"), "schema de assinatura precisa validar período efetivo");
check(adminService.includes('"admin_atribuir_plano_111"') && adminService.includes('"p_chave_idempotencia"'), "serviço administrativo precisa usar RPC idempotente");
check(gateway.includes("httpx.AsyncClient") && gateway.includes("_safe_error"), "gateway precisa reutilizar conexão e sanitizar erros");
check(gateway.includes("storage_remove") && gateway.includes("admin_delete_user"), "gateway precisa usar Storage API e Auth Admin API na exclusão");
check(accessService.includes("def rows_payload") && accessService.includes("UPSTREAM_RESPONSE_INVALID"), "fronteira da API precisa normalizar listas do provedor sem esconder formatos inválidos");
check(retentionService.includes("rows_payload(") && retentionService.includes("Não foi possível carregar a lista de espera agora."), "lista de espera e recorrências precisam evitar carregamento infinito em respostas envelopadas");
check(maintenance.includes("listar_arquivos_conta_exclusao_111") && maintenance.includes("process_account_deletions"), "worker de manutenção precisa concluir exclusões com segurança");
check(api.includes('/api/v1/jobs/maintenance/run'), "API precisa expor o worker de manutenção autenticado");
check(catalogService.includes('"buscar_marketplace_regional_111"'), "marketplace precisa aplicar filtros combinados no servidor");

check(account.includes("account-hub-layout111") && account.includes("account-sheet-close"), "conta contextual responsiva ausente");
check(account.includes("accountSessions") && account.includes("accountExport") && account.includes("scheduleAccountDeletion"), "conta precisa oferecer sessões, exportação e exclusão programada");
check(account.includes("EXCLUIR MINHA CONTA") && account.includes("bhContaReautenticar"), "exclusão precisa de frase e reautenticação");
check(account.includes("perfil.tipo === \"barbeiro\"") || account.includes("perfil?.tipo === \"barbeiro\""), "conta precisa diferenciar profissional de cliente");
check(account.includes("accountDeletionImpact111") && account.includes("Horários futuros ativos serão cancelados"), "exclusão precisa explicar o impacto específico para profissionais e clientes");
check(read("js/core/view-state.js").includes("ownerReady") && read("js/core/view-state.js").includes("if (!ownerReady) return fallback"), "continuidade visual não pode restaurar dados antes de validar o dono da sessão");

check(booking.includes("preserveBooking") && booking.includes("continuationDestination"), "agendamento visitante precisa preservar o contexto");
check(booking.includes("SELF_BOOKING") || booking.includes("ownEstablishment") || booking.includes("isOwnEstablishment"), "interface precisa tratar autoagendamento");
check(portal.includes("operatedIds") && portal.includes("Ver agenda") && portal.includes("bhListarMeusEstabelecimentosOperados"), "Explorar não pode oferecer autoagendamento para proprietários ou membros da equipe");
check(migration.includes("own_establishment_booking_forbidden"), "banco precisa bloquear agendamento no próprio estabelecimento");
check(client.includes("Lista de espera") && client.includes("Recorrências"), "cliente precisa distinguir esperas de recorrências");
check(client.includes("bhClienteItens") && client.includes("Array.isArray") && client.includes("Seus dados permanecem preservados"), "listas do cliente precisam normalizar dados e usar erro amigável");
check(client.includes("data-cancelar-recorrencia") && read("js/backend-api.js").includes("cancelRecurrence"), "cliente precisa conseguir encerrar uma recorrência ativa");
check(client.includes("clienteRecomendacoesLocais") && client.includes("data-client-location") && client.includes("bhBuscarMarketplaceRegional"), "home do cliente precisa oferecer recomendações locais reais e localização sob comando");
check(client.includes("data-retry-client-relation") && client.includes("bhClienteRelacionamentoErros"), "espera, recorrência e fidelidade precisam distinguir falha de lista vazia");
check(booking.includes("waitlistJoined") && booking.includes("if (joined)"), "entrada na lista de espera não pode reabilitar o botão após sucesso");

check(portal.includes("marketplace-card-primary") && portal.includes("&agendar=1") && css.includes("marketplace-card-primary::after"), "cards do Explorar precisam abrir vitrine e agendamento");
check(portal.includes("URLSearchParams") && portal.includes("bhBuscarMarketplaceRegional"), "Explorar precisa persistir filtros e usar busca regional");
check(portal.includes("bhMarketplaceState.items.filter(item => item?.destaque)") && !portal.includes("bhMarketplaceCarregarDestaques"), "destaques precisam respeitar o resultado regional atual");
check(booking.includes("openstreetmap.org") || read("js/barbearia.js").includes("openstreetmap.org"), "vitrine precisa oferecer mapa/rota");
check(read("js/barbearia.js").includes("data-reviews-drawer-more") && read("js/barbearia.js").includes("reviews-drawer111"), "avaliações públicas precisam paginar em drawer");

check(notifications.includes("data-notification-read-all") && (notifications.includes("snapshot") || notifications.includes("previous")), "notificações precisam suportar leitura e reversão segura");
check(notifications.includes("aria-modal=\"true\"") && notifications.includes("inert"), "central de notificações precisa ser contextual e acessível");
check(notifications.includes("groupedItems") && notifications.includes("bhAgruparNotificacoes") && notifications.includes("Hoje") && notifications.includes("Ontem"), "notificações precisam ser agrupadas por data no drawer e no histórico");
check(notifications.includes("safeNotificationUrl") && notifications.includes("bhNotificacaoUrlSegura"), "destinos de notificações precisam aceitar somente navegação interna segura");
check(plans.includes("Para profissionais") && plans.includes("is-current-plan111") && plans.includes("slice(0, 5)") && plans.includes("periodo_atual_fim"), "página de planos precisa ser profissional, compacta e informar situação/validade do plano atual");
check(onboarding.includes("cnpj") && models.includes("cnpj"), "cadastro profissional precisa aceitar CNPJ como texto");
check(
  onboarding.includes('data-agenda-entitlement="unavailable"')
    && onboarding.includes("BH_ONBOARDING_ACEITA_AGENDAMENTO = false")
    && !onboarding.includes('id="aceitaAgendamento"'),
  "onboarding precisa explicar o próximo passo sem oferecer agenda no plano inicial"
);
check(professionalPanel.includes("data-agenda-setting") && professionalPanel.includes("agendaSetting.hidden = !agendaLiberada"), "painel não pode exibir o controle de agenda sem entitlement");
check(professionalPanel.includes("push-device-status111") && professionalPanel.includes("Notification.permission") && professionalPanel.includes("Status neste dispositivo"), "avisos do dispositivo precisam informar suporte e permissão com clareza");
check(legal.includes("termos.html") && legal.includes("privacidade.html") && legal.includes("marketing"), "cadastro precisa separar e linkar consentimentos");
check(migration.includes("create or replace function public.handle_new_user()") && migration.includes("public.consentimentos_usuario") && migration.includes("marketing_aceito"), "cadastro precisa registrar consentimentos mesmo sem sessão imediata");
check(!registration.includes('.from("consentimentos_usuario").insert') && registration.includes("2026-09-11"), "navegador não pode gravar consentimentos diretamente nem usar versão inválida");
check(privacy.includes("Localização:") && privacy.includes("transferências internacionais"), "privacidade deve explicar geolocalização e transferências internacionais");

check(adminSubscriptions.includes("assinaturaEstabelecimento") && adminSubscriptions.includes("subscription-current-summary"), "admin precisa permitir seleção direta e revisão do impacto");
check(adminSubscriptions.includes("subscription-mobile-list") && css.includes("subscription-account-card"), "assinaturas precisam de cartões próprios no mobile");
check(adminSubscriptions.includes("chave_idempotencia") && adminSubscriptions.includes("admin_atribuir_plano_111"), "todos os caminhos administrativos precisam preservar idempotência");

check(css.includes("overflow-x: clip") && css.includes("@media (max-width: 840px)"), "acabamento 1.11 precisa impedir corte lateral e responder no mobile");
check(css.includes("body.mobile-native.page-conta.account-sheet-open111") && css.includes("display: block !important"), "folha da conta mobile precisa vencer as regras antigas de painel ativo");
check(css.includes("body.mobile-native.page-painel .dashboard > .sidebar") && css.includes("body.mobile-native.page-planos .pricing-grid"), "painel e planos mobile não podem depender de barras horizontais antigas");
for (const name of fs.readdirSync(path.join(root, "mobile")).filter(name => name.endsWith(".html"))) {
  const page = read(`mobile/${name}`);
  const redesignIndex = page.indexOf("mobile-redesign-1.8.css");
  const release193Index = page.indexOf("release-1.9.3.css");
  const release111Index = page.indexOf("releases/release-1.11.css");
  const robotsMetas = page.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/gi) || [];
  check(redesignIndex >= 0 && release193Index > redesignIndex && release111Index > release193Index, `${name}: CSS 1.11 precisa ser a última camada mobile`);
  check(robotsMetas.length === 1, `${name}: página mobile precisa ter exatamente uma diretiva robots`);
}
check(sw.includes("barberhub-v1.11.0-mobile-r2") && sw.includes("release-1.11.css"), "PWA precisa publicar os recursos da versão 1.11");
check(utils.includes("pareceTecnico") && utils.includes("pareceOrientacao") && utils.includes("return texto.length <= 220"), "mensagens desconhecidas não podem expor detalhes técnicos");
check(read("html/beauty-hub.html").includes("beautyhuboficial.vercel.app"), "ponte institucional para Beauty Hub ausente");
check(read("html/sobre.html").includes("release-1.11.css") && css.includes("about-cta-shell"), "Sobre precisa carregar a correção de sobreposição");
check(!read("sitemap.xml").includes("mapa-sistema"), "mapa interno não pode ser anunciado no sitemap público");
check(read("404.html").includes('href="/css/brand-assets-1.8.css"'), "página 404 precisa usar recursos absolutos em rotas aninhadas");
check(read("html/painel.html").includes('target="_blank" rel="noopener noreferrer"'), "link externo do painel precisa isolar a nova aba");
for (const file of [
  "admin.html", "admin-assinaturas.html", "painel.html", "cliente.html", "conta.html",
  "notificacoes.html", "cadastro-barbearia.html", "mapa-sistema.html",
  "recuperar-senha.html", "redefinir-senha.html"
]) check(read(`html/${file}`).includes('name="robots"'), `${file}: página privada ou sensível precisa usar noindex`);

for (const file of [
  "README.md", "MATRIZ_REQUISITOS_E_ACEITE.md", "CHECKLIST_PRE_RELEASE.md",
  "BACKUP_E_RESTAURACAO.md", "ROLLBACK_DEPLOY_E_MIGRATIONS.md",
  "MONITORAMENTO_E_ALERTAS.md", "INCIDENTES_E_RETENCAO_LGPD.md",
  "TESTES_DE_PERFIS_E_RLS.md", "CONFIGURACAO_EXTERNA.md",
  "TESTES_NAVEGADOR_DISPOSITIVO_E_CARGA.md", "CREDENCIAIS_E_SENHAS.md"
]) check(exists(`docs/release-1.11/${file}`), `documentação operacional ausente: ${file}`);
check(exists("docs/GUIA_COMPLETO_BARBER_HUB_1_11_0.docx"), "guia Word final da versão 1.11 ausente");
check(read("README.md").startsWith("# Barber Hub 1.11.0"), "README principal precisa identificar a versão atual");
check(read("docs/README.md").includes("versão **1.11.0**"), "índice de documentação precisa apontar para a versão atual");
check(read("CHANGELOG.md").includes("## 1.11.0"), "histórico de versões precisa registrar a 1.11.0");

if (errors.length) {
  console.error(`Regressões 1.11 reprovadas:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("Regressões Barber Hub 1.11.0 aprovadas.");
