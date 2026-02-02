#!/usr/bin/env python3
"""
Detect existing project files and configurations.
This script checks for common project files and reports what already exists.
"""

import os
import json
from pathlib import Path

def detect_existing_files():
    """Check for existing project files and configurations."""

    current_dir = Path.cwd()
    findings = {
        "has_existing_files": False,
        "project_type": None,
        "detected_files": [],
        "config_files": [],
        "package_managers": []
    }

    # Check for package manager files
    package_files = {
        "package.json": "node",
        "composer.json": "php",
        "requirements.txt": "python",
        "pyproject.toml": "python",
        "Cargo.toml": "rust",
        "go.mod": "go",
        "Gemfile": "ruby",
        "pom.xml": "java",
        "build.gradle": "java"
    }

    for file, lang in package_files.items():
        if (current_dir / file).exists():
            findings["has_existing_files"] = True
            findings["detected_files"].append(file)
            findings["package_managers"].append(lang)

    # Check for framework-specific files
    framework_indicators = {
        "next.config.js": "nextjs",
        "nuxt.config.js": "nuxt",
        "angular.json": "angular",
        "vue.config.js": "vue",
        "vite.config.js": "vite",
        "webpack.config.js": "webpack",
        "laravel": "artisan",
        "django": "manage.py",
        "rails": "Rakefile"
    }

    for file, framework in framework_indicators.items():
        if (current_dir / file).exists():
            findings["detected_files"].append(file)
            if not findings["project_type"]:
                findings["project_type"] = framework

    # Check for config files
    config_files = [
        ".env", ".env.example", ".gitignore",
        "tsconfig.json", "jsconfig.json",
        ".eslintrc.js", ".prettierrc",
        "Dockerfile", "docker-compose.yml"
    ]

    for file in config_files:
        if (current_dir / file).exists():
            findings["config_files"].append(file)
            findings["has_existing_files"] = True

    # Check for game engine files
    game_files = {
        "project.godot": "godot",
        "ProjectSettings.asset": "unity",
        ".uproject": "unreal"
    }

    for file, engine in game_files.items():
        if any(current_dir.glob(f"**/{file}")):
            findings["project_type"] = engine
            findings["detected_files"].append(file)

    return findings

def main():
    findings = detect_existing_files()

    if findings["has_existing_files"]:
        print("🔍 Detected existing project files:")
        print(json.dumps(findings, indent=2))

        print("\n📋 Summary:")
        if findings["project_type"]:
            print(f"  Project Type: {findings['project_type']}")
        if findings["package_managers"]:
            print(f"  Languages: {', '.join(set(findings['package_managers']))}")
        print(f"  Config files found: {len(findings['config_files'])}")
        print(f"  Total files detected: {len(findings['detected_files'])}")
    else:
        print("✨ No existing project files detected - starting fresh!")

    return findings

if __name__ == "__main__":
    main()