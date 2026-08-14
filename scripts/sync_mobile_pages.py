"""Gera/valida as páginas /mobile a partir das páginas em /html.

O conteúdo funcional tem uma única fonte de verdade. O mobile recebe somente
classes/metadados/shell específicos, evitando que novas features fiquem presas
no desktop ou que links divirjam com o tempo.
"""
from __future__ import annotations

from pathlib import Path
import argparse
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML_DIR = ROOT / "html"
MOBILE_DIR = ROOT / "mobile"
SHELL = '<script src="../js/mobile-shell-v1.7.js"></script>'


def add_mobile_class(html: str) -> str:
    match = re.search(r'<body(?: class="([^"]*)")?>', html)
    if not match:
        return html
    classes = (match.group(1) or "").split()
    if "mobile-native" not in classes:
        classes.append("mobile-native")
    replacement = f'<body class="{" ".join(classes)}">'
    return html[: match.start()] + replacement + html[match.end() :]


def transform(source: Path) -> str:
    html = source.read_text(encoding="utf-8")
    html = html.replace('<script src="../js/device-router.js"></script>', "")
    html = add_mobile_class(html)

    # Links estáticos visíveis também permanecem dentro de /mobile. Isso evita
    # uma ida desnecessária a /html seguida de novo redirecionamento e elimina
    # uma segunda classe de regressões de caminho relativo.
    html = html.replace('href="../html/', 'href="')
    html = html.replace("href='../html/", "href='")
    html = html.replace('href="../index.html"', 'href="index.html"')
    html = html.replace("href='../index.html'", "href='index.html'")

    canonical = f'https://barberhuboficial.vercel.app/html/{source.stem}'
    mobile_meta = f'<meta content="noindex,follow" name="robots"/><link href="{canonical}" rel="canonical"/>'
    html = re.sub(r'<meta content="noindex,follow" name="robots"/><link href="https://barberhuboficial\.vercel\.app/html/[^"]+" rel="canonical"/>', "", html)
    html = html.replace("</head>", mobile_meta + "</head>", 1)

    html = re.sub(r'<script src="\.\./js/mobile-shell-v1\.[0-9]+\.js"></script>', "", html)
    html = html.replace("</body>", SHELL + "</body>", 1)
    return html


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="não grava; falha se houver divergência")
    args = parser.parse_args()

    mismatches: list[str] = []
    for source in sorted(HTML_DIR.glob("*.html")):
        target = MOBILE_DIR / source.name
        expected = transform(source)
        if args.check:
            if not target.exists() or target.read_text(encoding="utf-8") != expected:
                mismatches.append(source.name)
        else:
            target.write_text(expected, encoding="utf-8")

    if mismatches:
        print("Páginas mobile fora de sincronia:", ", ".join(mismatches), file=sys.stderr)
        print("Execute: npm run mobile:sync", file=sys.stderr)
        return 1
    if args.check:
        print(f"Mobile sincronizado: {len(list(HTML_DIR.glob('*.html')))} páginas refletem o desktop.")
    else:
        print(f"Mobile atualizado: {len(list(HTML_DIR.glob('*.html')))} páginas geradas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
