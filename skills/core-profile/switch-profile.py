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


def get_listable_profiles(profiles: dict) -> list[str]:
    """Return profile names in config order, excluding 'core' (it's the base)."""
    return [k for k in profiles if k != "core"]


def resolve_profile_input(raw_inputs: list[str], profiles: dict) -> list[str]:
    """Convert numbers or names to profile names. Accepts '1', 'dev', 'all', 'A'."""
    listable = get_listable_profiles(profiles)
    resolved = []
    for inp in raw_inputs:
        if inp.lower() == "a" or inp.lower() == "all":
            resolved.append("all")
        elif inp.isdigit():
            idx = int(inp) - 1
            if 0 <= idx < len(listable):
                resolved.append(listable[idx])
            else:
                print(f"Invalid number: {inp} (valid: 1-{len(listable)})", file=sys.stderr)
                sys.exit(1)
        else:
            resolved.append(inp)
    return resolved


def resolve_skills(profiles: dict, profile_names: list[str], source_dir: Path) -> set[str]:
    skills = set()
    for name in profile_names:
        if name == "all":
            skills.update(get_all_skills(source_dir))
            continue
        if name not in profiles:
            print(f"Unknown profile: {name}", file=sys.stderr)
            listable = get_listable_profiles(profiles)
            print(f"Available: {', '.join(listable)}, all", file=sys.stderr)
            sys.exit(1)
        skills.update(profiles[name])
    # Always inherit core skills + core-profile
    if "core" in profiles:
        skills.update(profiles["core"])
    skills.add("core-profile")
    return skills


def list_profiles(profiles: dict):
    """Print numbered profile list to stdout."""
    listable = get_listable_profiles(profiles)
    for i, name in enumerate(listable, 1):
        skills_str = ", ".join(profiles[name])
        print(f"{i}. {name} — {skills_str}")
    print(f"A. all — All skills")


def validate_profiles(profiles: dict, source_dir: Path) -> bool:
    """Check all skills in profiles exist as folders. Returns True if valid."""
    available = set(get_all_skills(source_dir))
    all_referenced = set()
    issues = []

    for profile_name, skill_list in profiles.items():
        for skill in skill_list:
            all_referenced.add(skill)
            if skill not in available:
                issues.append(f"  {skill} (in profile: {profile_name})")

    missing_from_profiles = available - all_referenced - {"core-profile"}

    valid = True
    if issues:
        print("Missing skills (in profiles.yaml but no folder):")
        for issue in issues:
            print(issue)
        valid = False

    if missing_from_profiles:
        print("Orphaned skills (folder exists but not in any profile):")
        for skill in sorted(missing_from_profiles):
            print(f"  {skill}")
        valid = False

    if valid:
        print("All skills valid.")
    return valid


def is_junction_or_symlink(path: Path) -> bool:
    """Check if path is a symlink or junction (not a real directory)."""
    if path.is_symlink():
        return True
    if platform.system() == "Windows":
        try:
            os.readlink(path)
            return True
        except OSError:
            return False
    return False


def remove_junctions(skills_dir: Path):
    """Remove only junctions/symlinks from skills_dir. Real directories are never touched."""
    if not skills_dir.exists():
        return
    for item in skills_dir.iterdir():
        if not item.is_dir():
            continue
        if not is_junction_or_symlink(item):
            print(f"Skipping real directory: {item.name}", file=sys.stderr)
            continue
        if platform.system() == "Windows":
            subprocess.run(["cmd", "/c", "rmdir", str(item)], check=True, capture_output=True)
        else:
            item.unlink()


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
    parser.add_argument("--profiles", nargs="+", help="Profile name(s) or number(s) to activate")
    parser.add_argument("--skills-dir", help="Path to .claude/skills/ directory")
    parser.add_argument("--source-dir", default=None, help="Path to source skills directory (auto-detected from script location)")
    parser.add_argument("--list", action="store_true", help="List available profiles")
    parser.add_argument("--validate", action="store_true", help="Validate profiles against source")
    args = parser.parse_args()

    source_dir = Path(args.source_dir).resolve() if args.source_dir else Path(__file__).resolve().parent.parent
    profiles_path = source_dir / "core-profile" / "profiles.yaml"

    if not profiles_path.exists():
        print(f"Profiles not found: {profiles_path}", file=sys.stderr)
        sys.exit(1)

    profiles = load_profiles(profiles_path)

    if args.list:
        list_profiles(profiles)
        sys.exit(0)

    if args.validate:
        valid = validate_profiles(profiles, source_dir)
        sys.exit(0 if valid else 1)

    if not args.profiles:
        parser.error("--profiles is required (or use --list / --validate)")

    if not args.skills_dir:
        parser.error("--skills-dir is required when switching profiles")

    skills_dir = Path(args.skills_dir).resolve()
    profile_names = resolve_profile_input(args.profiles, profiles)
    target_skills = resolve_skills(profiles, profile_names, source_dir)

    # Validate target skills exist
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

    print(f"Activated {created} skills for: {', '.join(profile_names)}")


if __name__ == "__main__":
    main()
