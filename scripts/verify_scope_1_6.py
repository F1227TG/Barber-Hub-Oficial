"""Independent scope review for the requirements agreed for Barber Hub 1.6.

Unlike audit_release_1_6.py (which protects technical release invariants), this
script follows the product request itself: marketplace, booking UX, dedicated
mobile, themes, panels, account safety, Python API and production protections.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def main() -> int:
    checks: list[tuple[str, bool]] = []

    def require(label: str, ok: bool) -> None:
        checks.append((label, bool(ok)))

    portal_html = read("html/portal.html")
    portal_js = read("js/portal.js")
    sql = read("sql/15_marketplace_fts_api_seguranca.sql").lower()
    booking = read("js/features/booking.js")
    api = read("api/index.py")
    backend_client = read("js/backend-api.js")
    css = read("css/release-1.6.css")
    prd = read("docs/PRD_BARBER_HUB.md")

    require("Explorar: pesquisa e filtro na mesma barra", "marketplace-searchbar" in portal_html and "marketplace-filter-button" in portal_html)
    require("Explorar: filtros rápidos e cards compactos", "marketplace-quick-filters" in portal_html and "marketplace-card" in portal_js and "slice(0, 2)" in portal_js)
    require("Explorar: paginação/Carregar mais", "carregarMaisMarketplace" in portal_js and "has_more" in portal_js)
    require("Explorar: FTS + GIN + ILIKE fallback", all(x in sql for x in ["websearch_to_tsquery", "using gin", " ilike "]))
    require("Explorar: ranking e destaques", "relevancia" in sql and "destaque" in sql and "/api/v1/marketplace/featured" in api)

    require("Agendamento: modal no estabelecimento", "bookingModal" in booking and "data-booking-open" in read("js/barbearia.js"))
    require("Agendamento: múltiplos serviços", "new Set" in booking and "servicosIds" in booking)
    require("Agendamento: profissional como opção radio", 'type="radio"' in booking and "booking-professional-choice" in booking)
    require("Agendamento: foto/identidade do profissional", "avatar_url" in booking and "especialidade" in booking)
    require("Agendamento: página antiga virou compatibilidade", "location.replace" in read("js/agendamento-legacy.js"))

    mobile_pages = list((ROOT / "mobile").glob("*.html"))
    require("Mobile: HTML dedicado", len(mobile_pages) >= 20 and (ROOT / "mobile/index.html").exists())
    require("Mobile: shell/app dock próprio", "mobile-app-dock" in read("js/mobile-shell-v1.6.js"))
    require("Mobile: PWA inicia em /mobile", '"start_url": "./mobile/index.html"' in read("manifest.webmanifest"))

    require("Tema escuro: paleta suavizada", "--bg:#0d0c0b" in css and "--gold:#d2ad45" in css)
    require("Tema claro: off-white/bege dedicado", "body.claro" in css and "--bg:#f5f1e9" in css and "--surface:#fffdf9" in css)

    require("Cliente: painel orientado à próxima ação", "clienteCommandCenter" in read("html/cliente.html"))
    require("Profissional: painel orientado à operação", "painelCommandCenter" in read("html/painel.html") and "data-status-quick" in read("html/painel.html"))
    require("Conta: exclusão por frase forte", all("EXCLUIR MINHA CONTA" in read(p) for p in ["html/conta.html", "js/conta.js", "backend/services/admin.py"]))

    require("API: busca/cancelamento/status", all(x in api for x in ["/api/v1/marketplace/search", "/api/v1/appointments/{appointment_id}/status", "@app.delete(\"/api/v1/appointments/{appointment_id}\")"]))
    require("API: gestão de estabelecimento/serviço/profissional", all(x in api for x in ["/api/v1/establishments/{establishment_id}", "/api/v1/services", "/api/v1/professionals"]))
    require("API: frontend consome gestão Python", all(x in backend_client for x in ["updateEstablishment", "createService", "createProfessional"]))
    require("API: painel admin mostra saúde", "/api/v1/admin/health" in api and "adminHealth" in backend_client)
    require("Segurança: rate limiting próprio", "consumir_api_rate_limit" in sql and "enforce_rate_limit" in api)
    require("Segurança: 429/503 amigáveis", all(x in read("backend/supabase.py") for x in ["UPSTREAM_RATE_LIMITED", "UPSTREAM_UNAVAILABLE"]))
    require("Segurança: e-mail confirmado", "email_confirmed_at" in read("backend/security.py") and "precisaConfirmarEmail" in read("js/auth.js"))
    require("Segurança: CAPTCHA preparado", "turnstile" in read("js/security.js").lower() and "captchaToken" in read("js/auth.js"))

    require("PRD: revisão 1.6 registrada", "## 29. Revisão pós-implementação — Barber Hub 1.6.0" in prd)
    require("PRD: marketplace/mobile/API refletidos", all(x in prd for x in ["Busca principal em PostgreSQL Full Text Search", "Interface mobile dedicada", "API Python 1.2"]))

    failed = [label for label, ok in checks if not ok]
    for label, ok in checks:
        print(f"{'PASS' if ok else 'FAIL'} | {label}")
    print(f"\nEscopo: {len(checks) - len(failed)}/{len(checks)} requisitos verificados.")
    if failed:
        print("Falhas:", file=sys.stderr)
        for label in failed:
            print(f"- {label}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
