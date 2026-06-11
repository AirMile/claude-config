#!/usr/bin/env python3
"""Regression tests voor detect-mode.py classificatie-heuristieken.

Run: python3 -m unittest skills/core-setup/scripts/test_detect_mode.py
"""

import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
_spec = importlib.util.spec_from_file_location("detect_mode", SCRIPTS_DIR / "detect-mode.py")
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
classify = _mod.classify
count_dependencies = _mod.count_dependencies


class TestCountDependencies(unittest.TestCase):
    def setUp(self):
        import tempfile

        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        import shutil

        shutil.rmtree(self.tmp)

    def test_package_json(self):
        (self.tmp / "package.json").write_text(
            '{"dependencies":{"a":1,"b":1},"devDependencies":{"c":1}}'
        )
        self.assertEqual(count_dependencies(self.tmp), 3)

    def test_pyproject_pep621(self):
        (self.tmp / "pyproject.toml").write_text(
            "[project]\ndependencies = [\n  \"httpx\",\n  \"fastapi\",\n  \"pydantic\",\n  \"uvicorn\",\n  \"sqlalchemy\",\n]\n"
        )
        self.assertEqual(count_dependencies(self.tmp), 5)

    def test_pyproject_poetry(self):
        (self.tmp / "pyproject.toml").write_text(
            "[tool.poetry.dependencies]\npython = \"^3.11\"\nhttpx = \"*\"\nfastapi = \"*\"\npydantic = \"*\"\n"
        )
        self.assertGreaterEqual(count_dependencies(self.tmp), 3)

    def test_go_mod(self):
        (self.tmp / "go.mod").write_text(
            "module example.com/app\n\ngo 1.21\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.0\n\tgithub.com/jmoiron/sqlx v1.3.5\n\tgolang.org/x/crypto v0.14.0\n\tgithub.com/joho/godotenv v1.5.1\n\tgithub.com/stretchr/testify v1.8.4\n)\n"
        )
        self.assertEqual(count_dependencies(self.tmp), 5)

    def test_gemfile(self):
        (self.tmp / "Gemfile").write_text(
            'source "https://rubygems.org"\ngem "rails", "~> 7.1"\ngem "pg"\ngem "puma"\ngem "redis"\n'
        )
        self.assertEqual(count_dependencies(self.tmp), 4)

    def test_empty_dir(self):
        self.assertEqual(count_dependencies(self.tmp), 0)


class TestClassify(unittest.TestCase):
    def setUp(self):
        import tempfile

        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        import shutil

        shutil.rmtree(self.tmp)

    def _make_files(self, ext, count):
        for i in range(count):
            (self.tmp / f"file{i}{ext}").write_text("")

    def test_vue_project_mature(self):
        self._make_files(".vue", 25)
        (self.tmp / "package.json").write_text(
            '{"dependencies":{"vue":1,"vue-router":1,"pinia":1,"axios":1,"vite":1}}'
        )
        self.assertEqual(classify(self.tmp), "mature")

    def test_kotlin_project_mature(self):
        self._make_files(".kt", 22)
        (self.tmp / "README.md").write_text("x" * 200)
        self.assertEqual(classify(self.tmp), "mature")

    def test_ruby_project_mature(self):
        self._make_files(".rb", 25)
        (self.tmp / "Gemfile").write_text(
            'gem "rails"\ngem "pg"\ngem "puma"\ngem "redis"\n'
        )
        self.assertEqual(classify(self.tmp), "mature")

    def test_greenfield_empty(self):
        self.assertEqual(classify(self.tmp), "greenfield")

    def test_greenfield_readme_only(self):
        # README without any source files → greenfield (zero-source hard
        # signal wins; previously ambiguous).
        (self.tmp / "README.md").write_text("x" * 200)
        self.assertEqual(classify(self.tmp), "greenfield")

    def test_greenfield_on_deps_and_readme_without_source(self):
        # Zero source files = nothing to scan → greenfield, even with
        # README + deps (scaffolds, docs-only repos).
        (self.tmp / "README.md").write_text("x" * 200)
        (self.tmp / "pyproject.toml").write_text(
            "[project]\ndependencies = [\n  \"httpx\",\n  \"fastapi\",\n  \"pydantic\",\n]\n"
        )
        self.assertEqual(classify(self.tmp), "greenfield")

    def test_mature_on_deps_readme_and_some_source(self):
        # Same soft signals plus actual source files → mature via signal count.
        self._make_files(".py", 5)
        (self.tmp / "README.md").write_text("x" * 200)
        (self.tmp / "pyproject.toml").write_text(
            "[project]\ndependencies = [\n  \"httpx\",\n  \"fastapi\",\n  \"pydantic\",\n]\n"
        )
        self.assertEqual(classify(self.tmp), "mature")

    def test_mature_on_source_count_alone(self):
        # Hard signal: 30+ source files → mature with no other signals
        # (e.g. Godot project: .gd files, no manifest, no README).
        self._make_files(".gd", 30)
        self.assertEqual(classify(self.tmp), "mature")

    def test_ambiguous_small_source_only(self):
        # 1-20 source files with no other signals stays ambiguous-free:
        # zero soft signals → greenfield.
        self._make_files(".py", 10)
        self.assertEqual(classify(self.tmp), "greenfield")

    def test_ambiguous_small_source_plus_readme(self):
        # One soft signal (readme) with a small codebase → ambiguous.
        self._make_files(".py", 10)
        (self.tmp / "README.md").write_text("x" * 200)
        self.assertEqual(classify(self.tmp), "ambiguous")


if __name__ == "__main__":
    unittest.main()
