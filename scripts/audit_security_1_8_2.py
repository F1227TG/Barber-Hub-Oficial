"""Regressao estatica dos controles V01-V06 da release de seguranca 1.8.2."""

from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
MIGRATION = (ROOT / "sql/17_correcao_auditoria_seguranca.sql").read_text(encoding="utf-8")
ADMIN = (ROOT / "js/admin.js").read_text(encoding="utf-8")
API_JS = (ROOT / "js/api.js").read_text(encoding="utf-8")
PYTHON_API = (ROOT / "api/index.py").read_text(encoding="utf-8")
SECURITY_JS = (ROOT / "js/security.js").read_text(encoding="utf-8")
SUPABASE_CONFIG = (ROOT / "js/supabase-config.js").read_text(encoding="utf-8")

checks: list[tuple[str, bool]] = []


def check(label: str, condition: bool) -> None:
    checks.append((label, bool(condition)))


check("V01 has a distinct moderation suspension flag", "suspenso_pela_moderacao" in MIGRATION)
check("V01 locks moderation columns", all(field in MIGRATION for field in [
    "new.verificado := old.verificado",
    "new.destaque := old.destaque",
    "new.suspenso_motivo := old.suspenso_motivo",
    "new.avaliacao := old.avaliacao",
]))
check("V01 suspended pages cannot become visible", "estabelecimentos_suspensao_consistente" in MIGRATION)
check("V01 keeps aggregate rating recalculation", "v_recalculo_avaliacao" in MIGRATION and "pg_trigger_depth() > 1" in MIGRATION)
check("V01 public RLS excludes moderation suspensions", "and suspenso_pela_moderacao = false" in MIGRATION)
check("V01 admin client uses the moderation flag", "suspenso_pela_moderacao" in ADMIN and "suspenso_pela_moderacao" in API_JS)

check("V02 transition trigger exists", "agendamentos_validar_transicao_status" in MIGRATION)
check("V02 pending transitions are explicit", "old.status = 'pendente'" in MIGRATION and "'confirmado', 'recusado', 'cancelado'" in MIGRATION)
check("V02 confirmed transitions are explicit", "old.status = 'confirmado'" in MIGRATION and "'concluido', 'cancelado'" in MIGRATION)
check("V02 invalid transitions fail closed", "errcode = '23514'" in MIGRATION)

check("V03 professional limit is serialized", "pg_advisory_xact_lock" in MIGRATION and "validar_profissional_limite_plano" in MIGRATION)
check("V03 archived portfolio cannot bypass limits", "old.status = 'arquivada' and new.status <> 'arquivada'" in MIGRATION)
check("V03 direct appointments verify plan", "agendamentos_validar_plano" in MIGRATION and "permite_agenda" in MIGRATION)
check("V03 suspended establishments cannot receive appointments", "v_est.suspenso_pela_moderacao" in MIGRATION)

check("V04 inserts always start with zero likes", "new.curtidas_count := 0" in MIGRATION)
check("V04 direct updates recalculate likes", "select count(*) into new.curtidas_count" in MIGRATION)
check("V04 internal like trigger path remains valid", "pg_trigger_depth() > 1" in MIGRATION and "to_jsonb(new) - 'curtidas_count'" in MIGRATION)
check("V04 repairs legacy counters", "Corrige imediatamente qualquer contador legado adulterado" in MIGRATION)

for scope in ["support-list", "admin-overview", "admin-health", "admin-navigation-audit"]:
    check(f"V05 rate limit scope {scope}", f'"{scope}"' in PYTHON_API)
check("V05 also covers subscriptions added after the audit", '"admin-subscriptions"' in PYTHON_API)
check("V05 covers entitlement reads added after the audit", '"establishment-entitlements"' in PYTHON_API)

check("V06 exposes browser-safe runtime config", '/api/v1/public-config' in PYTHON_API and "turnstile_site_key" in PYTHON_API)
check("V06 fetches the public site key at runtime", '/api/v1/public-config' in SECURITY_JS and "resolveSiteKey" in SECURITY_JS)
check("V06 does not hardcode a production key", 'const BH_TURNSTILE_SITE_KEY = ""' not in SUPABASE_CONFIG)

failed = [label for label, ok in checks if not ok]
for label, ok in checks:
    print(f"{'PASS' if ok else 'FAIL'} - {label}")

if failed:
    print(f"\n{len(failed)}/{len(checks)} controles falharam.", file=sys.stderr)
    raise SystemExit(1)

print(f"\n{len(checks)}/{len(checks)} controles V01-V06 aprovados.")
