#!/usr/bin/env python3
"""
Generate or update Claude settings.local.json based on user preferences.
Configures permissions for automatic operations without confirmation.
"""

import json
from pathlib import Path
from typing import Dict, List

def get_default_permissions(project_type: str, tech_stack: str) -> Dict:
    """Generate default permissions based on project type and tech stack."""

    base_permissions = {
        "permissions": {
            "create_file": [],
            "edit_file": [],
            "read_file": ["**"],
            "bash": [],
            "git": ["status", "diff", "log"],
            "auto_confirm": {
                "file_operations": False,
                "package_install": False,
                "git_commit": False,
                "test_execution": False
            }
        },
        "excluded_paths": ["node_modules", ".git", "dist", "build", ".cache", "vendor"]
    }

    # Add project-specific permissions
    if "web" in project_type.lower() or "frontend" in project_type.lower():
        base_permissions["permissions"]["create_file"].extend([
            "src/**", "components/**", "pages/**", "tests/**", "public/**"
        ])
        base_permissions["permissions"]["edit_file"].extend([
            "src/**", "components/**", "pages/**", "tests/**", "*.md", "*.json", "*.yaml", "*.yml"
        ])
        base_permissions["permissions"]["bash"].extend([
            "npm", "yarn", "pnpm", "bun", "npx"
        ])

    if "backend" in project_type.lower() or "api" in project_type.lower():
        base_permissions["permissions"]["create_file"].extend([
            "app/**", "src/**", "api/**", "routes/**", "controllers/**", "models/**", "tests/**"
        ])
        base_permissions["permissions"]["edit_file"].extend([
            "app/**", "src/**", "api/**", "routes/**", "*.py", "*.js", "*.ts", "*.php", "*.go"
        ])

    if "laravel" in tech_stack.lower():
        base_permissions["permissions"]["bash"].extend([
            "php", "composer", "artisan"
        ])
        base_permissions["permissions"]["create_file"].extend([
            "app/**", "database/**", "resources/**", "routes/**"
        ])

    if "django" in tech_stack.lower() or "fastapi" in tech_stack.lower():
        base_permissions["permissions"]["bash"].extend([
            "python", "pip", "python3", "pip3", "poetry"
        ])

    if "game" in project_type.lower():
        base_permissions["permissions"]["create_file"].extend([
            "scripts/**", "scenes/**", "assets/**", "src/**"
        ])
        base_permissions["permissions"]["edit_file"].extend([
            "*.gd", "*.cs", "*.cpp", "*.h", "*.tscn", "*.tres"
        ])
        base_permissions["excluded_paths"].extend([
            ".import", ".godot", "Library", "Temp", "Builds"
        ])

    return base_permissions

def prompt_user_preferences() -> Dict:
    """Interactive prompts for permission configuration."""

    print("\n🔐 **Claude Permissions Configuration**\n")

    preferences = {}

    # File operations
    print("**File Operations Permissions:**")
    preferences['auto_create'] = input("Allow Claude to create files without confirmation? (y/n): ").lower() == 'y'
    preferences['auto_edit'] = input("Allow Claude to edit files without confirmation? (y/n): ").lower() == 'y'
    preferences['auto_read'] = True  # Always allow reading

    # Command permissions
    print("\n**Command Permissions:**")
    preferences['auto_install'] = input("Allow package installation without confirmation? (y/n): ").lower() == 'y'
    preferences['auto_test'] = input("Allow running tests without confirmation? (y/n): ").lower() == 'y'
    preferences['auto_git_add'] = input("Allow git add without confirmation? (y/n): ").lower() == 'y'
    preferences['auto_git_commit'] = input("Allow git commit without confirmation? (y/n): ").lower() == 'y'

    # Directory access
    print("\n**Directory Access:**")
    preferences['full_access_dirs'] = []
    while True:
        dir_path = input("Add directory for full Claude access (or press Enter to skip): ").strip()
        if not dir_path:
            break
        preferences['full_access_dirs'].append(dir_path)

    preferences['excluded_dirs'] = []
    while True:
        dir_path = input("Add directory to exclude from Claude (or press Enter to skip): ").strip()
        if not dir_path:
            break
        preferences['excluded_dirs'].append(dir_path)

    return preferences

def generate_settings(project_info: Dict, user_preferences: Dict = None) -> Dict:
    """Generate the complete settings.local.json configuration."""

    # Get base permissions
    settings = get_default_permissions(
        project_info.get('type', 'general'),
        project_info.get('tech_stack', '')
    )

    # Apply user preferences if provided
    if user_preferences:
        settings["permissions"]["auto_confirm"]["file_operations"] = (
            user_preferences.get('auto_create', False) and
            user_preferences.get('auto_edit', False)
        )
        settings["permissions"]["auto_confirm"]["package_install"] = user_preferences.get('auto_install', False)
        settings["permissions"]["auto_confirm"]["git_commit"] = user_preferences.get('auto_git_commit', False)
        settings["permissions"]["auto_confirm"]["test_execution"] = user_preferences.get('auto_test', False)

        if user_preferences.get('auto_git_add'):
            settings["permissions"]["git"].append("add")
        if user_preferences.get('auto_git_commit'):
            settings["permissions"]["git"].append("commit")

        # Add custom directories
        if user_preferences.get('full_access_dirs'):
            for dir_path in user_preferences['full_access_dirs']:
                if not dir_path.endswith('/**'):
                    dir_path += '/**'
                settings["permissions"]["create_file"].append(dir_path)
                settings["permissions"]["edit_file"].append(dir_path)

        if user_preferences.get('excluded_dirs'):
            settings["excluded_paths"].extend(user_preferences['excluded_dirs'])

    # Remove duplicates
    for key in ["create_file", "edit_file", "bash", "git"]:
        if key in settings["permissions"]:
            settings["permissions"][key] = list(set(settings["permissions"][key]))
    settings["excluded_paths"] = list(set(settings["excluded_paths"]))

    return settings

def save_settings(settings: Dict):
    """Save settings to .claude/settings.local.json."""

    claude_dir = Path(".claude")
    claude_dir.mkdir(exist_ok=True)

    settings_path = claude_dir / "settings.local.json"

    # Check if file exists
    if settings_path.exists():
        response = input(f"\n⚠️  {settings_path} already exists. Overwrite? (y/n): ")
        if response.lower() != 'y':
            print("Settings not saved.")
            return False

    # Write settings
    with open(settings_path, 'w', encoding='utf-8') as f:
        json.dump(settings, f, indent=2)

    print(f"\n✅ Settings saved to {settings_path}")
    return True

def main(project_info: Dict = None, interactive: bool = True):
    """Main function to generate and save settings."""

    if not project_info:
        # Default project info for testing
        project_info = {
            'type': 'full-stack',
            'tech_stack': 'react nodejs'
        }

    # Get user preferences
    user_prefs = None
    if interactive:
        user_prefs = prompt_user_preferences()

    # Generate settings
    settings = generate_settings(project_info, user_prefs)

    # Display generated settings
    print("\n📋 **Generated Settings:**")
    print(json.dumps(settings, indent=2))

    # Save settings
    if interactive:
        save_settings(settings)

    return settings

if __name__ == "__main__":
    main()