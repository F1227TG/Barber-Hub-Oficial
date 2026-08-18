"""Auditoria estática dos invariantes de planos/benefícios da release 1.8."""
from __future__ import annotations
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
checks: list[tuple[str, bool]] = []

def check(label: str, condition: bool) -> None:
    checks.append((label, bool(condition)))

migration = (ROOT / "sql/16_assinaturas_entitlements_beneficios.sql").read_text(encoding="utf-8")
panel = (ROOT / "js/painel.js").read_text(encoding="utf-8")
admin = (ROOT / "js/admin-assinaturas.js").read_text(encoding="utf-8")
api = (ROOT / "api/index.py").read_text(encoding="utf-8")
backend_api = (ROOT / "js/backend-api.js").read_text(encoding="utf-8")
plans = (ROOT / "html/planos.html").read_text(encoding="utf-8")
package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))

check("frontend version 1.8.0", package.get("version") == "1.8.0")
check("API version 1.3.0", 'API_VERSION = "1.3.0"' in api)
check("migration 16 exists", bool(migration))
check("central entitlement resolver", "calcular_entitlements_estabelecimento" in migration)
check("cumulative inheritance by ordering", "p.ordenacao <= v_ordem" in migration and "bool_or" in migration and "max(p.limite_profissionais)" in migration)
check("admin assignment RPC", "admin_atribuir_plano" in migration)
check("professional limit enforcement", "profissionais_validar_plano" in migration)
check("portfolio limit enforcement", "limite_publicacoes" in migration and "limite_destaques_portfolio" in migration)
check("promotion entitlement enforcement", "promocoes_validar_plano" in migration)
check("promotion public visibility follows effective subscription", "promocoes_publicas_disponiveis" in migration and "promocoes_select_owner_admin" in migration)
check("agenda entitlement enforcement", "agendamentos_validar_plano" in migration and "agenda_online_disponivel" in migration)
check("marketplace plan priority", "prioridade_marketplace" in migration)
check("admin subscriptions API", '/api/v1/admin/subscriptions' in api and '/subscription"' in api)
check("owner entitlement API", '/entitlements"' in api)
check("promotion API", '/api/v1/promotions' in api)
check("frontend API bindings", all(name in backend_api for name in ["getEntitlements", "adminSubscriptions", "adminAssignSubscription", "createPromotion"]))
check("panel CRM section", "bhRenderClientesPainel" in panel and 'permite_clientes' in panel)
check("panel promotions section", "bhRenderPromocoesPainel" in panel and 'permite_promocoes' in panel)
check("advanced reports and CSV", "bhExportarRelatorioCsv" in panel and 'permite_relatorios_avancados' in panel)
check("subscription realtime refresh", "table:'assinaturas'" in panel)
check("admin workspace JS", "bhAdminAtribuirPlano" in admin)
check("paid plans no longer development placeholders", "Tudo do Essencial" in plans and "Tudo do Profissional" in plans and "Em desenvolvimento" not in plans)
check("desktop admin subscriptions page", (ROOT / "html/admin-assinaturas.html").exists())
check("mobile admin subscriptions page", (ROOT / "mobile/admin-assinaturas.html").exists())
check("release 1.8 CSS", (ROOT / "css/release-1.8.css").exists())
check("service worker cache 1.8", "barberhub-v1.8.0" in (ROOT / "service-worker.js").read_text(encoding="utf-8"))

failed = [label for label, ok in checks if not ok]
for label, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'} - {label}")
if failed:
    print(f"\n{len(failed)}/{len(checks)} invariantes falharam.", file=sys.stderr)
    return_code = 1
else:
    print(f"\n{len(checks)}/{len(checks)} invariantes da release 1.8 aprovados.")
    return_code = 0
sys.exit(return_code)
