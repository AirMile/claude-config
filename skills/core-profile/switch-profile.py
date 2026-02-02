#!/usr/bin/env python3
"""Switch skill profiles by managing per-skill directory junctions/symlinks."""

import argparse
import os
import platform
import subprocess
import sys
from pathlib import Path


def load_profiles(profiles_path: Path) -> dict:
    """Parse simple YAML with top-level keys mapping to lists of strings."""
    profiles = {}
    current_key = None
    with open(profiles_path) as f:
        for line in f:
            stripped = line.rstrip()
            if not stripped or stripped.startswith("#"):
                continue
            if not stripped.startswith(" ") and stripped.endswith(":"):
                current_key = stripped[:-1]
                profiles[current_key] = []
            elif current_key and stripped.strip().startswith("- "):
                value = stripped.strip()[2:].strip().strip('"').strip("'")
                profiles[current_key].append(value)
    return profiles


def get_all_skills(source_dir: Path) -> list[str]:
    return [
        d.name for d in sorted(source_dir.iterdir())
        if d.is_dir() and (d / "SKILL.md").exists()
    ]


def resolve_skills(profiles: dict, profile_names: list[str], source_dir: Path) -> set[str]:
    skills = set()
    for name in profile_names:
        if name not in profiles:
            print(f"Unknown profile: {name}", file=sys.stderr)
            print(f"Available: {', '.join(profiles.keys())}", file=sys.stderr)
            sys.exit(1)
        profile_skills = profiles[name]
        if "*" in profile_skills:
            skills.update(get_all_skills(source_dir))
        else:
            skills.update(profile_skills)
    # Always include core-profile
    skills.add("core-profile")
    return skills


def remove_junctions(skills_dir: Path):
    if not skills_dir.exists():
        return
    for item in skills_dir.iterdir():
        if item.is_dir():
            if platform.system() == "Windows":
                # On Windows, junctions appear as dirs - use rmdir to remove junction without deleting target
                subprocess.run(["cmd", "/c", "rmdir", str(item)], check=True, capture_output=True)
            else:
                if item.is_symlink():
                    item.unlink()
                # Skip non-symlink directories


def create_junction(source: Path, target: Path):
    if platform.system() == "Windows":
        subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(target), str(source)],
            check=True, capture_output=True
        )
    else:
        os.symlink(source, target)


def main():
    parser = argparse.ArgumentParser(description="Switch skill profiles")
    parser.add_argument("--profiles", nargs="+", required=True, help="Profile name(s) to activate")
    parser.add_argument("--skills-dir", required=True, help="Path to .claude/skills/ directory")
    parser.add_argument("--source-dir", default=None, help="Path to source skills directory (auto-detected from script location)")
    args = parser.parse_args()

    skills_dir = Path(args.skills_dir).resolve()
    # Auto-detect source dir from script location: script is at source/activate/switch-profile.py
    source_dir = Path(args.source_dir).resolve() if args.source_dir else Path(__file__).resolve().parent.parent
    profiles_path = source_dir / "core-profile" / "profiles.yaml"

    if not profiles_path.exists():
        print(f"Profiles not found: {profiles_path}", file=sys.stderr)
        sys.exit(1)

    profiles = load_profiles(profiles_path)
    target_skills = resolve_skills(profiles, args.profiles, source_dir)

    # Validate all skills exist in source
    available = set(get_all_skills(source_dir))
    missing = target_skills - available
    if missing:
        print(f"Warning: skills not found in source: {', '.join(sorted(missing))}", file=sys.stderr)
        target_skills -= missing

    # Remove existing junctions
    remove_junctions(skills_dir)

    # Ensure skills_dir exists as regular directory
    skills_dir.mkdir(parents=True, exist_ok=True)

    # Create junctions for each skill
    created = 0
    for skill in sorted(target_skills):
        source_path = source_dir / skill
        target_path = skills_dir / skill
        if source_path.exists() and not target_path.exists():
            create_junction(source_path, target_path)
            created += 1

    print(f"Activated {created} skills: {', '.join(sorted(target_skills))}")
    print(f"Profiles: {', '.join(args.profiles)}")


if __name__ == "__main__":
    main()
