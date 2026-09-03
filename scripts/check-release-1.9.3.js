/** Regressões funcionais e responsivas adicionadas na release 1.9.3. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

const utils = read("js/utils.js");
const passwordPolicy = read("js/password-policy.js");
const panel = read("js/painel.js");
const operations = read("js/painel-operacao-1.9.js");
const retention = read("js/painel-retencao-1.9.3.js");
const backendApi = read("js/backend-api.js");
const mobileShell = read("js/mobile-shell-v1.7.js");
const mobileCss = read("css/release-1.9.3.css");
const beauty = read("html/beauty-hub.html");
const mobilePanel = read("mobile/painel.html");

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${utils}\nglobalThis.__analisarSenha = bhAnalisarSenha;`, sandbox);
check(sandbox.__analisarSenha("Barber#19").valida, "senha completa deveria ser aceita");
check(!sandbox.__analisarSenha("barberhub").valida, "senha sem maiúscula, número e especial não pode ser aceita");
check(!sandbox.__analisarSenha("Barber190").valida, "senha sem caractere especial não pode ser aceita");
check(passwordPolicy.includes("data-password-rule") && passwordPolicy.includes("setCustomValidity"), "checklist de senha precisa atualizar regras e validação nativa");

check(panel.includes("bh:painel-section-change") && panel.includes("bh:painel-context-ready"), "painel precisa publicar mudanças de seção e contexto");
check(operations.includes('document.addEventListener("bh:painel-section-change"') && operations.includes("refreshSection(event.detail?.id)"), "módulo operacional precisa reagir à navegação por hash");
check(operations.includes("state.crmRequest") && operations.includes("limparBuscaCliente19"), "busca do CRM precisa evitar respostas antigas e permitir limpeza rápida");
check(operations.includes("formRecurrence193") && operations.includes("createRecurrence"), "agenda precisa criar recorrências pelo contrato protegido");
check(retention.includes("listWaitlist") && retention.includes("loyaltyOverview") && retention.includes("listCoupons") && retention.includes("listCampaigns"), "módulo 1.9.1 precisa carregar espera, fidelidade, cupons e campanhas");
check(retention.includes("growthInsights") && retention.includes("growthOpportunities") && retention.includes("growthGoals") && retention.includes("updateTeamPermissions"), "módulo 1.9.2 precisa carregar insights, oportunidades, metas e permissões");
check(["listWaitlist","createRecurrence","loyaltyOverview","clientLoyalty","redeemLoyaltyReward","createCoupon","createCampaign","growthInsights","growthOpportunities","growthGoals","updateTeamPermissions"].every(name => backendApi.includes(name)), "cliente da API precisa expor os contratos completos da 1.9.3");
check(read("js/cliente.js").includes("clienteFidelidade193") && read("js/cliente.js").includes("data-resgatar-recompensa"), "cliente precisa visualizar pontos e resgatar recompensas");
check(operations.includes("permite_email_marketing") && read("sql/24_retencao_relacionamento_1_9_3.sql").includes("permite_email_marketing"), "campanhas por e-mail precisam respeitar consentimento explícito do CRM");
check(retention.includes('$("#teamComposer19")') && retention.includes('"secBarbeiros"'), "permissões granulares precisam abrir dentro da seção Equipe");

check(mobileShell.includes("mobileProfessionalMoreSheet") && mobileShell.includes("professionalMoreItems"), "dock profissional precisa abrir o menu Mais");
check(mobileShell.includes('can("permite_promocoes")') && mobileShell.includes('can("permite_relatorios")'), "menu Mais precisa respeitar recursos do plano");
check(mobileShell.includes('painel.html#relacionamento') && mobileShell.includes('painel.html#crescimento'), "menu Mais precisa oferecer Retenção e Crescimento conforme o plano");
check(mobileCss.includes(".dashboard > .sidebar { display:none!important; }") && mobileCss.includes("grid-template-columns:repeat(2,minmax(0,1fr))"), "painel mobile precisa remover a barra lateral e evitar carrossel obrigatório de KPIs");
check(mobileCss.includes(".config-status-segment") && mobileCss.includes("grid-template-columns:1fr!important"), "status do estabelecimento precisa empilhar opções legíveis");
check(mobileCss.includes(".retention-grid") && mobileCss.includes(".growth-layout") && mobileCss.includes(".client-retention-grid"), "novos módulos precisam ter layouts responsivos sem rolagem lateral obrigatória");
check(mobilePanel.indexOf("mobile-redesign-1.8.css") < mobilePanel.indexOf("release-1.9.3.css"), "CSS 1.9.3 deve carregar depois do redesign mobile");

check(beauty.includes("Beauty Hub") && beauty.includes("beautyhuboficial.vercel.app"), "Beauty Hub precisa mostrar estado atual e acesso à primeira versão");
check(read("mobile/index.html").includes('href="/mobile/beauty-hub.html"'), "home mobile precisa manter o acesso ao Beauty Hub");
check(/"version": "1\.(?:9\.3|[1-9][0-9]\.)/.test(read("package.json")), "package não pode regredir para antes da versão 1.9.3");
check(read("service-worker.js").includes("barberhub-v1."), "cache do PWA precisa declarar uma versão Barber Hub");

if (errors.length) {
  console.error(`Regressões 1.9.3 reprovadas:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log("Regressões Barber Hub 1.9.3 aprovadas.");
