"""Source readers for legacy static audits during the modular transition."""

from pathlib import Path


def read_api_source(root: Path) -> str:
    paths = [root / 'api/index.py', root / 'backend/application.py']
    paths += sorted((root / 'api/routers').glob('*.py'))
    paths += sorted((root / 'backend/core').glob('*.py'))
    return '\n'.join(path.read_text(encoding='utf-8') for path in paths if path.exists())
