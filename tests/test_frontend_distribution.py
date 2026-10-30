import json
from pathlib import Path
import tempfile
from unittest import TestCase
from scripts.build_frontend import build


class FrontendDistributionTests(TestCase):
    def test_proxy_preserves_routes_and_excludes_backend_and_secrets(self):
        with tempfile.TemporaryDirectory() as temp:
            output = build(Path(temp) / 'web', 'https://api.example.test')
            config = json.loads((output / 'vercel.json').read_text())
            self.assertNotIn('crons', config)
            for route in config['rewrites']:
                if route['source'].startswith('/api/'):
                    self.assertEqual(route['destination'], 'https://api.example.test' + route['source'])
            for name in ['api', 'backend', 'sql', 'supabase', '.env', '.env.example', 'requirements.txt', 'pyproject.toml']:
                self.assertFalse((output / name).exists(), name)
            self.assertTrue((output / 'html/login.html').is_file())
            self.assertTrue((output / 'mobile/login.html').is_file())

    def test_invalid_origins_are_rejected_before_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            for origin in ['http://api.test', 'https://user:secret@api.test', 'https://api.test/path', 'https://api.test?x=1']:
                with self.subTest(origin=origin), self.assertRaises(ValueError):
                    build(Path(temp) / 'web', origin)
