#!/usr/bin/env python3
"""
Master documentation orchestrator.
Reads project type from CLAUDE.md and executes relevant documentation generators.
"""

import os
import sys
import re
import json
import subprocess
from pathlib import Path


def parse_claude_md(root_path):
    """
    Parse CLAUDE.md to extract project type and enabled generators.

    Returns:
        dict: {
            "project_type": "laravel-backend",
            "enabled_generators": ["api", "components", "events", "erd"]
        }
    """
    claude_md_path = os.path.join(root_path, '.claude', 'CLAUDE.md')

    if not os.path.exists(claude_md_path):
        print(f"⚠️  CLAUDE.md not found at {claude_md_path}")
        return {"project_type": "unknown", "enabled_generators": []}

    with open(claude_md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    result = {
        "project_type": "unknown",
        "enabled_generators": []
    }

    # Extract Project Type
    project_type_match = re.search(r'[-\*]\s*\*\*Project Type\*\*:\s*([^\n]+)', content, re.IGNORECASE)
    if project_type_match:
        result["project_type"] = project_type_match.group(1).strip()

    # Extract Enabled Generators
    # Look for "### Documentation Generators" section
    doc_section_match = re.search(
        r'### Documentation Generators\s*\n\*\*Enabled:\*\*\s*\n((?:- .+\n?)+)',
        content,
        re.MULTILINE
    )

    if doc_section_match:
        enabled_block = doc_section_match.group(1)
        # Extract generator IDs (before the dash description)
        enabled_matches = re.findall(r'^- ([a-z-]+)', enabled_block, re.MULTILINE)
        result["enabled_generators"] = enabled_matches

    return result


def load_docs_config(root_path):
    """
    Load optional docs.config.json for overrides.

    Returns:
        dict or None
    """
    config_path = os.path.join(root_path, '.claude', 'docs.config.json')

    if not os.path.exists(config_path):
        return None

    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return None


# Generator ID → Script mapping
GENERATORS = {
    # Backend (Laravel)
    "api": "update_api_docs.py",
    "components": "update_components.py",
    "erd": "update_erd.py",
    "events": "update_events.py",
    "middleware": "update_middleware.py",
    "auth-flow": "update_auth_flow.py",
    "routes": "update_routes.py",

    # Frontend (React/Vue)
    # "components": "update_components.py",  # Same ID, different implementation
    # "routes": "update_routes.py",
    "state": "update_state.py",
    "design-tokens": "update_design_tokens.py",
    "api-calls": "update_api_calls.py",

    # Full-stack
    "dataflow": "update_dataflow.py",

    # Games (Unity/Unreal/Godot)
    "scenes": "update_scenes.py",
    "game-classes": "update_game_classes.py",
    "state-machines": "update_state_machines.py",
    "behavior-trees": "update_behavior_trees.py",
    "blueprints": "update_blueprints.py",
    "prefabs": "update_prefabs.py",
    "asset-deps": "update_asset_deps.py",
    "signals": "update_signals.py",
    "autoloads": "update_autoloads.py",
    "resources": "update_resources.py"
}


# Available generators per project type
PROJECT_GENERATORS = {
    "laravel-backend": ["api", "components", "erd", "events", "middleware", "auth-flow", "routes"],
    "react-frontend": ["components", "routes", "state", "design-tokens", "api-calls"],
    "vue-frontend": ["components", "routes", "state", "design-tokens"],
    "laravel-react-fullstack": ["api", "components", "erd", "events", "routes", "dataflow", "auth-flow"],
    "laravel-vue-fullstack": ["api", "components", "erd", "events", "routes", "dataflow", "auth-flow"],
    "unity-game": ["scenes", "game-classes", "state-machines", "behavior-trees", "prefabs", "asset-deps"],
    "unreal-game": ["scenes", "blueprints", "game-classes", "state-machines", "behavior-trees"],
    "godot-game": ["scenes", "game-classes", "state-machines", "signals", "autoloads", "resources"]
}


def get_available_generators(project_type):
    """Get available generators for a project type."""
    return PROJECT_GENERATORS.get(project_type, [])


def run_generator(script_name, root_path):
    """
    Execute a generator script.

    Returns:
        dict: {
            "success": True/False,
            "script": "update_api_docs.py",
            "output": "docs/api.md",
            "error": None or error message
        }
    """
    script_path = os.path.join(root_path, '.claude', 'skills', '2-code', 'scripts', script_name)

    if not os.path.exists(script_path):
        return {
            "success": True,
            "script": script_name,
            "output": None,
            "skipped": True,
            "error": f"Generator not implemented yet: {script_name}"
        }

    try:
        result = subprocess.run(
            [sys.executable, script_path, root_path],
            capture_output=True,
            text=True,
            timeout=120
        )

        return {
            "success": result.returncode == 0,
            "script": script_name,
            "output": result.stdout,
            "error": result.stderr if result.returncode != 0 else None
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "script": script_name,
            "output": None,
            "error": "Script timeout (120s exceeded)"
        }
    except Exception as e:
        return {
            "success": False,
            "script": script_name,
            "output": None,
            "error": str(e)
        }


def main():
    """Main entry point."""
    root_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()

    print("\n" + "="*60)
    print("DOCUMENTATION GENERATOR")
    print("="*60 + "\n")

    # 1. Parse CLAUDE.md
    config = parse_claude_md(root_path)
    project_type = config["project_type"]
    enabled_generators = config["enabled_generators"]

    print(f"📋 Project Type: {project_type}")
    print(f"📝 Enabled Generators: {', '.join(enabled_generators)}\n")

    if project_type == "unknown":
        print("⚠️  Project type not found in CLAUDE.md")
        print("Please run /setup skill to configure project type.")
        return 1

    if not enabled_generators:
        print("⚠️  No generators enabled in CLAUDE.md")
        print("Please run /setup skill to select generators.")
        return 1

    # 2. Load optional config overrides
    custom_config = load_docs_config(root_path)
    if custom_config:
        print(f"✓ Loaded custom config from .claude/docs.config.json\n")

    # 3. Validate generators are available for project type
    available = get_available_generators(project_type)
    to_run = [g for g in enabled_generators if g in available and g in GENERATORS]

    if not to_run:
        print(f"⚠️  No valid generators to run for {project_type}")
        return 1

    print(f"🔨 Running {len(to_run)} generator(s)...\n")

    # 4. Execute generators
    results = []
    for gen_id in to_run:
        script = GENERATORS[gen_id]
        print(f"  Running {gen_id} ({script})...")

        result = run_generator(script, root_path)
        results.append(result)

        if result.get("skipped"):
            print(f"    ℹ️  Skipped (not implemented)")
        elif result["success"]:
            print(f"    ✓ Success")
        else:
            print(f"    ✗ Failed: {result['error']}")

    # 5. Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)

    successful = [r for r in results if r["success"] and not r.get("skipped")]
    skipped = [r for r in results if r.get("skipped")]
    failed = [r for r in results if not r["success"]]

    print(f"\n✓ Successful: {len(successful)}")
    for r in successful:
        # Extract output file from script output if possible
        output_match = re.search(r'docs/[\w\-\.]+', r["output"] or "")
        output_file = output_match.group(0) if output_match else "generated"
        print(f"  - {r['script']}: {output_file}")

    if skipped:
        print(f"\nℹ️  Skipped: {len(skipped)} (not yet implemented)")
        for r in skipped:
            print(f"  - {r['script']}")

    if failed:
        print(f"\n✗ Failed: {len(failed)}")
        for r in failed:
            print(f"  - {r['script']}: {r['error']}")

    print("\n" + "="*60 + "\n")

    return 0 if not failed else 1


if __name__ == '__main__':
    sys.exit(main())
