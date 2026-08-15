"""Complementary Python audit for the Barber Hub repository."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.references: list[str] = []
        self.labels_for: set[str] = set()
        self.controls: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = dict(attrs)
        if data.get("id"):
            self.ids.append(data["id"] or "")
        for key in ("href", "src"):
            if data.get(key):
                self.references.append(data[key] or "")
        if tag == "label" and data.get("for"):
            self.labels_for.add(data["for"] or "")
        if tag in {"input", "select", "textarea"} and data.get("id"):
            self.controls.append((tag, data["id"] or ""))


def local_target(source: Path, reference: str) -> Path | None:
    value = reference.strip()
    if not value or value.startswith("#"):
        return None
    if re.match(r"^(https?:|mailto:|tel:|data:|javascript:)", value, re.I):
        return None
    clean = re.split(r"[?#]", value, maxsplit=1)[0]
    if not clean:
        return None
    if clean.startswith("/"):
        return (ROOT / clean.lstrip("/")).resolve()
    return (source.parent / clean).resolve()


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    pages = sorted(ROOT.rglob("*.html"))

    for page in pages:
        if any(part in {".git", ".venv", "node_modules"} for part in page.parts):
            continue
        parser = PageParser()
        content = page.read_text(encoding="utf-8")
        parser.feed(content)
        relative = page.relative_to(ROOT)

        duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
        if duplicates:
            errors.append(f"{relative}: IDs duplicados: {', '.join(duplicates)}")

        for reference in parser.references:
            target = local_target(page, reference)
            if target and not target.exists():
                errors.append(f"{relative}: referência ausente: {reference}")

        for tag, control_id in parser.controls:
            # Inputs hidden and controls with an accessible name may legitimately
            # skip a visible label. This audit reports only likely omissions.
            fragment = re.search(
                rf"<{tag}[^>]*\bid=[\"']{re.escape(control_id)}[\"'][^>]*>",
                content,
                re.I,
            )
            markup = fragment.group(0) if fragment else ""
            if control_id not in parser.labels_for and not re.search(r"aria-label|type=[\"']hidden", markup, re.I):
                warnings.append(f"{relative}: confira o rótulo do controle #{control_id}")

    sw = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    if "barberhub-v1.7.2" not in sw:
        errors.append("service-worker.js não usa o cache barberhub-v1.7.2")
    if "cache.put(event.request, response.clone())" in sw:
        errors.append("service-worker.js voltou a clonar a Response de forma assíncrona/tardia")
    if "const cacheCopy = response.clone()" not in sw:
        errors.append("service-worker.js não cria a cópia da Response antes do cache runtime")

    for migration_name in ["14_api_python_agendamento_multisservicos.sql", "15_marketplace_fts_api_seguranca.sql"]:
        if not (ROOT / "sql" / migration_name).exists():
            errors.append(f"migration ausente: {migration_name}")

    manifest = (ROOT / "manifest.webmanifest").read_text(encoding="utf-8")
    if '"start_url": "./mobile/index.html"' not in manifest:
        errors.append("manifest não inicia na interface mobile dedicada")

    print(f"Páginas analisadas: {len(pages)}")
    if warnings:
        print(f"Avisos de acessibilidade: {len(warnings)}")
        for warning in warnings[:25]:
            print(f"  - {warning}")
        if len(warnings) > 25:
            print(f"  - ... e mais {len(warnings) - 25}")

    if errors:
        print(f"Erros: {len(errors)}", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("Validação estrutural concluída sem erros.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
