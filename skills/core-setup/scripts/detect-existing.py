#!/usr/bin/env python3
"""
Detect existing project files and configurations.
Scans a directory for common project files and reports what already exists.

Usage:
    python detect-existing.py [--path /some/directory]
"""

import sys
import json
import argparse
from pathlib import Path


def detect_existing_files(target_dir: Path) -> dict:
    """Check for existing project files and configurations."""

    findings = {
        "has_existing_files": False,
        "project_type": None,
        "detected_files": [],
        "config_files": [],
        "package_managers": [],
    }

    # Package manager files
    package_files = {
        "package.json": "node",
        "composer.json": "php",
        "requirements.txt": "python",
        "pyproject.toml": "python",
        "Cargo.toml": "rust",
        "go.mod": "go",
        "Gemfile": "ruby",
        "pom.xml": "java",
        "build.gradle": "java",
    }

    for file, lang in package_files.items():
        if (target_dir / file).exists():
            findings["has_existing_files"] = True
            findings["detected_files"].append(file)
            findings["package_managers"].append(lang)

    # Framework-specific files (file -> framework name)
    framework_indicators = {
        "next.config.js": "nextjs",
        "next.config.ts": "nextjs",
        "next.config.mjs": "nextjs",
        "nuxt.config.js": "nuxt",
        "nuxt.config.ts": "nuxt",
        "angular.json": "angular",
        "vue.config.js": "vue",
        "vue.config.ts": "vue",
        "vite.config.js": "vite",
        "vite.config.ts": "vite",
        "vite.config.mts": "vite",
        "svelte.config.js": "svelte",
        "astro.config.mjs": "astro",
        "webpack.config.js": "webpack",
        "artisan": "laravel",
        "manage.py": "django",
        "Rakefile": "rails",
    }

    for file, framework in framework_indicators.items():
        if (target_dir / file).exists():
            findings["detected_files"].append(file)
            findings["has_existing_files"] = True
            if not findings["project_type"]:
                findings["project_type"] = framework

    # Config files
    config_files = [
        ".env",
        ".env.example",
        ".gitignore",
        "tsconfig.json",
        "jsconfig.json",
        ".eslintrc.js",
        ".eslintrc.cjs",
        "eslint.config.js",
        "eslint.config.mjs",
        ".prettierrc",
        ".prettierrc.json",
        "biome.json",
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
    ]

    for file in config_files:
        if (target_dir / file).exists():
            findings["config_files"].append(file)
            findings["has_existing_files"] = True

    # Game engine files
    game_files = {
        "project.godot": "godot",
        "ProjectSettings/ProjectSettings.asset": "unity",
    }

    for file, engine in game_files.items():
        if (target_dir / file).exists():
            findings["project_type"] = engine
            findings["detected_files"].append(file)
            findings["has_existing_files"] = True

    # Unreal: *.uproject files (glob needed)
    uproject_files = list(target_dir.glob("*.uproject"))
    if uproject_files:
        findings["project_type"] = "unreal"
        findings["detected_files"].append(uproject_files[0].name)
        findings["has_existing_files"] = True

    return findings


def main():
    parser = argparse.ArgumentParser(description="Detect existing project files")
    parser.add_argument(
        "--path",
        default=".",
        help="Directory to scan (default: current directory)",
    )
    args = parser.parse_args()

    target_dir = Path(args.path).resolve()
    if not target_dir.is_dir():
        print(f"Error: {target_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    findings = detect_existing_files(target_dir)

    # Output as JSON (safe for any encoding)
    print(json.dumps(findings, indent=2))

    return findings


if __name__ == "__main__":
    # Ensure UTF-8 output on Windows
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
    main()
