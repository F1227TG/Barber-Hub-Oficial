"""Protect the HTTP surface while domain implementation moves."""
import json
from pathlib import Path
from unittest import TestCase

from api.index import app


class ContractTests(TestCase):
    def test_existing_http_contracts_are_preserved(self):
        baseline = json.loads((Path(__file__).parent / 'contracts/openapi-baseline.json').read_text(encoding='utf-8'))
        current = app.openapi()
        for path, operations in baseline['paths'].items():
            with self.subTest(path=path):
                self.assertIn(path, current['paths'])
                for method, contract in operations.items():
                    self.assertEqual(current['paths'][path][method], contract)
        for name, schema in baseline['components']['schemas'].items():
            with self.subTest(schema=name):
                self.assertEqual(current['components']['schemas'][name], schema)

    def test_no_duplicate_method_path_registration(self):
        registered = set()
        for route in app.routes:
            for method in getattr(route, 'methods', set()):
                key = (method, route.path)
                self.assertNotIn(key, registered)
                registered.add(key)
