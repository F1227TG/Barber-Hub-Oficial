"""Reproducible source inventory; absence of static references is not deletion approval."""

import ast
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.git', '.tools', '.venv', 'node_modules', '__pycache__', '.pytest_cache',
            'test-results', 'playwright-report', 'dist', 'build'}
EXTENSIONS = {'.py', '.js', '.css', '.html', '.sql', '.json', '.yml', '.yaml', '.toml'}


def inventory():
    files = sorted(p for p in ROOT.rglob('*') if p.is_file()
                   and not EXCLUDED.intersection(p.relative_to(ROOT).parts)
                   and not any(part.endswith('.egg-info') for part in p.parts)
                   and p.suffix in EXTENSIONS and not p.name.startswith('.env'))
    sources = {p.relative_to(ROOT).as_posix(): p.read_text(encoding='utf-8-sig') for p in files}
    records = []
    routes = []
    for name, content in sources.items():
        records.append({'path': name, 'lines': len(content.splitlines()),
                        'sha256': hashlib.sha256(content.encode()).hexdigest()})
        if name.startswith(('api/', 'backend/')) and name.endswith('.py'):
            for node in ast.walk(ast.parse(content)):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    for decorator in node.decorator_list:
                        if (isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute)
                                and decorator.func.attr in {'get', 'post', 'put', 'patch', 'delete'}
                                and decorator.args and isinstance(decorator.args[0], ast.Constant)):
                            routes.append({'source': name, 'handler': node.name,
                                           'method': decorator.func.attr.upper(),
                                           'declared_path': decorator.args[0].value})
    assets = {}
    for name in sources:
        if name.startswith(('css/', 'js/')):
            assets[name] = sorted(other for other, text in sources.items()
                                  if other != name and (name in text or Path(name).name in text))
    return {'note': 'Static candidates only; dynamic references and router prefixes require review.',
            'counts': dict(Counter(Path(name).suffix for name in sources)),
            'files': records, 'routes': routes, 'asset_references': assets,
            'browser_data_access': {name: content.count('.from(') + content.count('.rpc(')
                                    for name, content in sources.items()
                                    if name.startswith('js/') and ('.from(' in content or '.rpc(' in content)}}


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='test-results/inventory.json')
    args = parser.parse_args()
    target = ROOT / args.output
    target.parent.mkdir(parents=True, exist_ok=True)
    data = inventory()
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(data["files"])} source files, {len(data["routes"])} route declarations: {target}')
