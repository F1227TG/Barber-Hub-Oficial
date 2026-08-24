"""Auditoria offline dos invariantes funcionais e de segurança da release 1.9.3."""
from __future__ import annotations

import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
checks: list[tuple[str, bool]] = []


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def check(label: str, condition: bool) -> None:
    checks.append((label, bool(condition)))


package = json.loads(read("package.json"))
api = read("api/index.py")
client = read("js/backend-api.js")
panel_html = read("html/painel.html")
panel_js = read("js/painel-operacao-1.9.js")
retention_js = read("js/painel-retencao-1.9.3.js")
panel_css = read("css/release-1.9.css") + read("css/release-1.9.3.css")
mobile_shell = read("js/mobile-shell-v1.7.js")
migrations = {number: read(f"sql/{name}") for number, name in {
    18: "18_agenda_equipe_operacional_1_9.sql",
    19: "19_crm_operacional_1_9.sql",
    20: "20_financeiro_comissoes_1_9.sql",
    21: "21_entitlements_operacionais_1_9.sql",
    22: "22_encaixes_hardening_operacional_1_9.sql",
    23: "23_advisors_pos_deploy_1_9.sql",
    24: "24_retencao_relacionamento_1_9_3.sql",
    25: "25_inteligencia_permissoes_1_9_3.sql",
}.items()}

check("frontend version 1.9.3", package.get("version") == "1.9.3")
check("API version 1.5.0", 'API_VERSION = "1.5.0"' in api)
check("all operational migrations exist", all(migrations.values()))
check("agenda entities have RLS", all(token in migrations[18] for token in [
    "agenda_bloqueios enable row level security",
    "agenda_intervalos_recorrentes enable row level security",
    "agendamento_eventos enable row level security",
]))
check("CRM entities have RLS", all(token in migrations[19] for token in [
    "clientes_estabelecimento enable row level security",
    "cliente_notas enable row level security",
]))
check("finance entities have RLS", all(token in migrations[20] for token in [
    "regras_comissao enable row level security",
    "lancamentos_financeiros enable row level security",
    "fechamentos_diarios enable row level security",
]))
check("operational RPCs revoke public access", all("revoke all on function" in migrations[number] for number in migrations))
check("plan entitlements cover 1.9 modules", all(token in migrations[21] for token in [
    "permite_agenda_avancada", "permite_crm", "permite_financeiro",
    "permite_comissoes", "permite_equipe_acesso", "limite_membros_equipe",
]))
check("walk-ins use unique technical identity", "avulso+" in migrations[22] and "v_id := gen_random_uuid()" in migrations[22])
check("commission scope handles nulls", "regras_comissao_escopo_unico_idx" in migrations[20])
check("blocks and team updates are transactional RPCs", all(token in migrations[22] for token in [
    "criar_bloqueio_agenda_19", "atualizar_membro_estabelecimento_19", "pg_advisory_xact_lock",
]))
check("post-deploy advisor hardening is tracked", all(token in migrations[23] for token in [
    "promocoes_select_visitante_23", "agenda_bloqueios_criado_por_idx",
    "revoke all on function public.validar_promocao_plano",
]))
check("retention entities have RLS", all(token in migrations[24] for token in [
    "lista_espera enable row level security", "agendamentos_recorrencias enable row level security",
    "fidelidade_programas enable row level security", "cupons enable row level security",
    "campanhas enable row level security", "automacoes_mensagens enable row level security",
]))
check("1.9.1 domains are implemented", all(token in migrations[24] for token in [
    "entrar_lista_espera_193", "criar_recorrencia_agendamento_193", "resgatar_recompensa_193",
    "aplicar_cupom_agendamento_193", "criar_campanha_193", "preparar_lembretes_193",
]))
check("1.9.2 domains are implemented", all(token in migrations[25] for token in [
    "membro_permissoes", "metas_crescimento", "oportunidades_crescimento",
    "resumo_crescimento_193", "recalcular_oportunidades_193",
]))
check("cross-tenant catalog references are rejected", "validar_catalogo_agendamento_operacional_19" in migrations[18])
check("API exposes all 1.9 modules", all(route in api for route in [
    '"/api/v1/schedule/range"', '"/api/v1/crm/clients"',
    '"/api/v1/finance/summary"', '"/api/v1/team/members"',
    '"/api/v1/retention/waitlist"', '"/api/v1/retention/campaigns"',
    '"/api/v1/growth/insights"', '"/api/v1/growth/opportunities"',
]))
check("browser client binds all 1.9 modules", all(name in client for name in [
    "scheduleRange", "createWalkIn", "listCrmClients", "financeSummary", "teamMembers",
    "listWaitlist", "createRecurrence", "loyaltyOverview", "listCoupons", "listCampaigns",
    "growthInsights", "growthOpportunities", "growthGoals", "updateTeamPermissions",
]))
check("professional panel exposes 1.9 sections", all(token in panel_html for token in [
    'id="secAgenda"', 'id="secClientes"', 'id="secFinanceiro"', 'id="teamAcessos19"',
    'id="secRelacionamento"', 'id="secCrescimento"',
]))
check("panel uses API instead of direct finance/CRM writes", all(token in panel_js for token in [
    "api().scheduleRange", "api().listCrmClients", "api().financeSummary", "api().teamMembers",
]))
check("retention and growth UI uses the API", all(token in retention_js for token in [
    "api().listWaitlist", "api().listRecurrences", "api().loyaltyOverview", "api().listCoupons",
    "api().listCampaigns", "api().growthInsights", "api().growthOpportunities", "api().growthGoals",
]))
check("release stylesheet includes responsive operation layouts", all(token in panel_css for token in [
    ".schedule-workspace", ".crm-workspace", ".finance-workspace", ".mobile-more-sheet",
    ".retention-grid", ".growth-layout", ".client-retention-grid",
]))
check("professional mobile dock prioritizes operations", all(label in mobile_shell for label in [
    '"Painel"', '"Agenda"', '"Clientes"', '"Financeiro"', "moreButton(moreActive)",
]))
check("SQL verifier covers operational release", (ROOT / "sql/verificar_22_operacao_1_9.sql").exists())
check("SQL verifier covers post-deploy advisors", (ROOT / "sql/verificar_23_advisors_pos_deploy_1_9.sql").exists())
check("SQL verifier covers complete 1.9.3", (ROOT / "sql/verificar_25_release_1_9_3.sql").exists())
check("release verification report exists", (ROOT / "docs/VERIFICACAO_1_9_0.md").exists())
check("service worker cache is 1.9.3", "barberhub-v1.9.3" in read("service-worker.js"))

failed = [label for label, ok in checks if not ok]
for label, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'} - {label}")
if failed:
    print(f"\n{len(failed)}/{len(checks)} invariantes falharam.", file=sys.stderr)
    sys.exit(1)
print(f"\n{len(checks)}/{len(checks)} invariantes da release 1.9.3 aprovados.")
