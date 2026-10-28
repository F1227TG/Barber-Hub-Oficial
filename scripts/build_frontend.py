"""Build a static frontend distribution with a same-origin proxy to the independent API.

Does not change the running deployment. Run after confirming the API deployment URL.
"""
import argparse
import json
from pathlib import Path
import shutil
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIRS = ('html', 'mobile', 'css', 'js', 'vendor', 'img', 'assets')
PUBLIC_FILES = ('index.html', '404.html', 'vizu.html', 'offline.html', 'cadastro.html', 'listagem.html', 'manifest.webmanifest',
                'service-worker.js', 'robots.txt', 'sitemap.xml')


def build(destination, api_origin):
    origin = urlsplit(api_origin)
    if (origin.scheme != 'https' or not origin.hostname or origin.username or origin.password
            or origin.path not in ('', '/') or origin.query or origin.fragment):
        raise ValueError('Provide an HTTPS API origin only, without credentials, path or parameters.')
    api_origin = api_origin.rstrip('/')
    destination = Path(destination).resolve()
    if destination.exists():
        raise ValueError('Output directory already exists; select a new empty destination.')
    destination.mkdir(parents=True)
    for folder in PUBLIC_DIRS:
        if (ROOT / folder).exists():
            shutil.copytree(ROOT / folder, destination / folder,
                            ignore=shutil.ignore_patterns('.env*', '*.map', 'node_modules', '.git', '__pycache__'))
    for name in PUBLIC_FILES:
        if (ROOT / name).exists():
            shutil.copyfile(ROOT / name, destination / name)
    config = json.loads((ROOT / 'vercel.json').read_text(encoding='utf-8'))
    config.pop('crons', None)
    for route in config['rewrites']:
        if route['source'].startswith('/api/'):
            route['destination'] = api_origin + route['source']
    (destination / 'vercel.json').write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
    return destination


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-origin', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    print(build(args.output, args.api_origin))
