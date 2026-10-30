"""Run checks by responsibility while retaining the historical regression suites."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable
GROUPS = {
    'mobile': [[PYTHON, 'scripts/sync_mobile_pages.py', '--check']],
    'routing': [['node', 'scripts/check-mobile-routing.js']],
    'css': [[PYTHON, 'scripts/build_css.py', '--check'], ['node', 'scripts/check-interface-responsiveness.js']],
    'frontend': [['node', 'scripts/check-project.js'], [PYTHON, 'scripts/validate_project.py'],
                 ['node', '--test', 'tests/frontend/api-client.test.js', 'tests/frontend/auth.test.js',
                  'tests/frontend/security.test.js', 'tests/frontend/google-login.test.js']],
    'legacy': [['node', f'scripts/check-release-{version}.js'] for version in ['1.9.3', '1.10', '1.10.1', '1.11']],
    'security': [[PYTHON, 'scripts/audit_security_1_8_2.py'], [PYTHON, 'scripts/audit_release_1_9.py']],
    'api': [[PYTHON, '-m', 'compileall', '-q', 'api', 'backend'],
            [PYTHON, '-m', 'unittest', 'discover', '-s', 'tests', '-v']],
    'database': [['node', '--test', 'tests/database/accounts.test.js']],
    'auth': [[PYTHON, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_accounts.py', '-v']],
    'contracts': [[PYTHON, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_contracts.py', '-v']],
}
DEFAULT = ['mobile', 'routing', 'css', 'frontend', 'legacy', 'security', 'api', 'database']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('group', choices=['all', *GROUPS], default='all', nargs='?')
    args = parser.parse_args()
    results = []
    output = ROOT / 'test-results/checks.json'
    output.parent.mkdir(exist_ok=True)
    for group in DEFAULT if args.group == 'all' else [args.group]:
        for command in GROUPS[group]:
            print(f'\n[{group}] {" ".join(command)}', flush=True)
            started = time.perf_counter()
            try:
                code = subprocess.run(command, cwd=ROOT).returncode
            except OSError as exc:
                print(f'Unable to run {command[0]}: {exc}', file=sys.stderr)
                code = 1
            results.append({'group': group, 'command': command, 'exit_code': code,
                            'seconds': round(time.perf_counter() - started, 3)})
            output.write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
            if code:
                return code
    print(f'\n{len(results)} checks passed. Report: {output.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
