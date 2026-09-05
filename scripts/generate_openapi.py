"""Regenerate the static OpenAPI snapshot from the executable FastAPI app."""

from pathlib import Path

import yaml

from api.index import app


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "barberhub-api-v1.openapi.yaml"


def main() -> None:
    content = yaml.safe_dump(
        app.openapi(),
        allow_unicode=True,
        sort_keys=False,
        width=110,
    )
    OUTPUT.write_text(content, encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
