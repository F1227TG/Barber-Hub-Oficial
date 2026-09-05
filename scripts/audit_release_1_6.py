"""Release acceptance audit for Barber Hub 1.6.

This is intentionally independent from the generic repository validators. It
checks the concrete product decisions agreed for the 1.6 release so a later
refactor cannot silently remove one of them.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def contains(path: str, *needles: str) -> bool:
    content = text(path)
    return all(needle in content for needle in needles)


def main() -> int:
    checks: list[tuple[str, bool, str]] = []

    def check(name: str, condition: bool, detail: str) -> None:
        checks.append((name, bool(condition), detail))

    # 1. Themes
    css = text("css/release-1.6.css")
    check("Tema escuro suavizado", all(x in css for x in ["--bg:#0d0c0b", "--surface:#181614", "--gold:#d2ad45"]), "tokens escuros 1.6")
    check("Tema claro redesenhado", all(x in css for x in ["body.claro", "--bg:#f5f1e9", "--surface:#fffdf9", "--text:#27231e"]), "off-white/bege + contraste próprio")

    # 2. Marketplace / FTS / scale
    sql = text("sql/15_marketplace_fts_api_seguranca.sql").lower()
    check("FTS PostgreSQL", all(x in sql for x in ["search_vector", "websearch_to_tsquery", "using gin", "buscar_marketplace"]), "tsvector + GIN + RPC")
    check("Fallback ILIKE", " ilike " in sql and "fallback" in sql, "fallback preservado")
    check("Paginação SQL", "p_offset" in sql and "p_limit" in sql and "offset" in sql and "limit" in sql, "offset/limit server-side")
    portal = text("js/portal.js")
    check("Carregar mais", "carregarMaisMarketplace" in portal and "BH_MARKETPLACE_PAGE_SIZE" in portal, "12 mobile / 24 desktop")
    check("Cards compactos", contains("html/portal.html", "marketplace-searchbar", "marketplace-filter-button", "marketplace-featured-grid"), "busca+filtro+destaques")
    check("Ranking/destaques", all(x in sql for x in ["e.destaque", "relevancia", "e.avaliacao"]), "ranking inicial documentado")

    # 3. Booking modal
    booking = text("js/features/booking.js")
    check("Agendamento em modal", all(x in booking for x in ["bookingModal", "booking-service-choice", "booking-professional-choice", "data-booking-panel"]), "4 etapas")
    check("Múltiplos serviços", "new Set" in booking and "servicosIds: [...state.services]" in booking, "seleção combinável")
    check("Profissional radio + foto", all(x in booking for x in ["type=\"radio\"", "avatar_url", "booking-radio-dot"]), "cartões de profissional")
    check("Profissional compatível com serviços", "selectedIds.every(id => skills.includes(id))" in booking, "vínculo profissional↔serviço")
    check("Login preserva escolhas do agendamento", all(x in booking for x in ['params.set("servicos"', 'params.set("profissional"', 'login.html?next=']), "serviços/profissional retomados após login")
    legacy = text("js/agendamento-legacy.js")
    check("Página Agendar removida da navegação", all(x in legacy for x in ['next.set("agendar", "1")', "barbearia.html?", "location.replace"]), "rota antiga apenas redireciona")
    forbidden_nav_refs = []
    for path in list((ROOT / "html").glob("*.html")) + [ROOT / "index.html", ROOT / "404.html"]:
        if path.name == "agendamento.html":
            continue
        content = path.read_text(encoding="utf-8")
        if 'href="agendamento.html"' in content or 'href="../html/agendamento.html"' in content or 'href="./html/agendamento.html"' in content:
            forbidden_nav_refs.append(str(path.relative_to(ROOT)))
    check("Sem link principal para página Agendar", not forbidden_nav_refs, f"refs={forbidden_nav_refs or 'nenhuma'}")

    # 4. Dedicated mobile
    mobile_pages = sorted((ROOT / "mobile").glob("*.html"))
    check("HTML mobile dedicado", len(mobile_pages) >= 20 and (ROOT / "mobile/index.html").exists(), f"{len(mobile_pages)} páginas")
    check("Mobile shell", contains("js/mobile-shell-v1.6.js", "mobile-app-header", "mobile-app-dock", "prepareResponsiveTables"), "header+dock+tabelas-card")
    check("Roteador de dispositivo", contains("js/device-router.js", "/mobile/", "display-mode: standalone"), "web→mobile")
    manifest = json.loads(text("manifest.webmanifest"))
    check("PWA inicia no app mobile", manifest.get("start_url") == "./mobile/index.html", str(manifest.get("start_url")))
    noindex_ok = all('content="noindex,follow"' in p.read_text(encoding="utf-8") for p in mobile_pages)
    check("SEO sem duplicidade mobile", noindex_ok, "noindex,follow em páginas /mobile")
    check("Perfil mobile simplificado", all(x in css for x in ["mobile-business-summary", "mobile-business-sticky", "mobile-business-details"]), "página pública app-like")

    # 5. Panels/account
    check("Painel cliente orientado à próxima ação", contains("html/cliente.html", "clienteCommandCenter", "clienteProximoTitulo"), "command center")
    check("Painel profissional orientado à operação", contains("html/painel.html", "painelCommandCenter", "quickStatusCard", "data-status-quick=\"automatico\""), "próximo atendimento + status")
    check("Foto de profissional no painel", contains("html/painel.html", "barbAvatar") and "bhUploadImagem" in text("js/painel.js") and "avatar_url" in text("js/painel.js"), "upload e persistência")
    phrase = "EXCLUIR MINHA CONTA"
    check("Exclusão com frase forte", all(phrase in text(p) for p in ["html/conta.html", "js/conta.js", "backend/services/admin.py"]), "UI + JS + Python")

    # 6. Python API and operations
    api = text("api/index.py")
    check("API 1.2", 'API_VERSION = "1.2.0"' in api, "FastAPI")
    check("Marketplace na API", all(x in api for x in ["/api/v1/marketplace/search", "/api/v1/marketplace/featured"]), "search/featured")
    check("Status/cancelamento na API", all(x in api for x in ["@app.patch(\"/api/v1/appointments/{appointment_id}/status\")", "@app.delete(\"/api/v1/appointments/{appointment_id}\")"]), "fluxo pós-criação")
    management = text("backend/services/management.py")
    check("Gestão validada na API", all(x in api for x in ["/api/v1/establishments/{establishment_id}", "/api/v1/services", "/api/v1/professionals"]) and all(x in text("js/backend-api.js") for x in ["updateEstablishment", "createService", "createProfessional"]) and "token=auth.token" in management and "admin=True" not in management, "Pydantic + token do usuário + RLS")
    check("Health admin", all(x in api for x in ["/api/v1/admin/health"]) and "adminHealth" in text("js/backend-api.js") and all(x in text("html/admin.html") for x in ["adminHealthServices", "adminHealthMarketplace"]) and "buscar_marketplace" in text("backend/services/admin.py"), "API/DB/Auth/FTS no painel")
    check("Admin overview consumido", "adminOverview" in text("js/admin.js") and "/api/v1/admin/overview" in api, "totais globais via Python")
    check("Navigation audit consumido", "navigationAudit" in text("js/mapa-sistema.js"), "mapa técnico online")
    catalog_py = text("backend/services/catalog.py")
    professional_projection = catalog_py.split('"profissionais(', 1)[1].split('"profissional_servicos', 1)[0] if '"profissionais(' in catalog_py else ""
    check("API pública não expõe contato privado da equipe", all(x not in professional_projection for x in ["user_id", "email", "telefone"]), "projeção pública explícita")
    api_js = text("js/api.js")
    check("Produção não contorna a API Python", all(x in api_js for x in ['const local = ["localhost"', "if (!local) return false"]), "fallback restrito ao desenvolvimento local")

    # 7. Rate limiting / observability / errors
    check("Rate limiting distribuído", all(x in sql for x in ["api_rate_limits", "consumir_api_rate_limit"]) and "enforce_rate_limit" in api, "PostgreSQL + API")
    check("Logs estruturados", all(x in api for x in ["request_id", '"duration_ms"', '"http_request"']), "JSON por request")
    supa = text("backend/supabase.py")
    check("Tratamento 429/503", all(x in supa for x in ["UPSTREAM_RATE_LIMITED", "UPSTREAM_UNAVAILABLE", "Retry-After"]), "mensagens seguras")
    check("Auditoria admin", "auditoria_admin" in sql and "audit_action" in text("backend/services/admin.py"), "tabela + writer")

    # 8. Email and CAPTCHA
    auth = text("js/auth.js")
    security = text("js/security.js")
    check("Fluxo de confirmação de e-mail", "precisaConfirmarEmail" in auth and "emailRedirectTo" in auth and "email_confirmed_at" in text("backend/security.py"), "front + backend")
    check("CAPTCHA preparado", "turnstile" in security.lower() and "captchaToken" in auth and "BH_TURNSTILE_SITE_KEY" in text("js/supabase-config.js"), "ativação por config")
    check("CSP permite Turnstile", "challenges.cloudflare.com" in text("vercel.json"), "script/frame/connect")

    # 9. Documentation / PRD
    prd = text("docs/PRD_BARBER_HUB.md")
    check("PRD revisado pós-implementação", "## 29. Revisão pós-implementação — Barber Hub 1.6.0" in prd and "Front-end/PWA **1.6.0**" in prd, "release refletida no PRD")
    map_doc = text("docs/MAPA_DE_NAVEGACAO.md")
    check("Mapa atualizado", all(x in map_doc for x in ["modal de agendamento", "/mobile/", "Marketplace FTS/paginado"]), "web + app")

    # 10. PWA cache assets exist
    sw = text("service-worker.js")
    core_match = re.search(r"const CORE = \[(.*?)\];", sw, re.S)
    missing_assets: list[str] = []
    if core_match:
        for raw in re.findall(r"['\"]([^'\"]+)['\"]", core_match.group(1)):
            if raw in {"./", "./index.html"}:
                continue
            candidate = ROOT / raw.removeprefix("./")
            if not candidate.exists():
                missing_assets.append(raw)
    else:
        missing_assets.append("CORE-not-found")
    check("Service Worker íntegro", "barberhub-v1.6.0" in sw and not missing_assets, f"missing={missing_assets or 'nenhum'}")

    failed = [item for item in checks if not item[1]]
    for name, ok, detail in checks:
        print(f"{'PASS' if ok else 'FAIL'} | {name} | {detail}")
    print(f"\nResumo: {len(checks)-len(failed)}/{len(checks)} verificações aprovadas.")
    if failed:
        print("Falhas:", file=sys.stderr)
        for name, _, detail in failed:
            print(f"- {name}: {detail}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
