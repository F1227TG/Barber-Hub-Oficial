"""Regressions for installing the API from the mixed web/Python repository."""

from pathlib import Path
import tomllib
from unittest import TestCase


ROOT = Path(__file__).resolve().parents[1]


class PackagingTests(TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with (ROOT / "pyproject.toml").open("rb") as source:
            cls.project = tomllib.load(source)

    def test_build_backend_is_explicit(self) -> None:
        build = self.project["build-system"]
        self.assertEqual(build["build-backend"], "setuptools.build_meta")
        self.assertIn("setuptools>=68", build["requires"])

    def test_only_api_packages_are_discovered(self) -> None:
        config = self.project["tool"]["setuptools"]
        discovery = config["packages"]["find"]
        self.assertEqual(discovery["where"], ["."])
        self.assertEqual(
            set(discovery["include"]), {"api", "api.*", "backend", "backend.*"}
        )
        self.assertFalse(config["include-package-data"])

    def test_api_namespace_is_included(self) -> None:
        discovery = self.project["tool"]["setuptools"]["packages"]["find"]
        self.assertTrue(discovery["namespaces"])
        self.assertTrue((ROOT / "api" / "index.py").is_file())
        self.assertTrue((ROOT / "backend" / "__init__.py").is_file())

    def test_uv_lock_describes_the_installable_api_version(self) -> None:
        with (ROOT / "uv.lock").open("rb") as source:
            lock = tomllib.load(source)
        api = next(
            package for package in lock["package"]
            if package["name"] == self.project["project"]["name"]
        )
        self.assertEqual(api["version"], self.project["project"]["version"])
        self.assertEqual(api["source"], {"editable": "."})
