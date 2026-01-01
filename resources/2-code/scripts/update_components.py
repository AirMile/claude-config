#!/usr/bin/env python3
"""
Generate component/service dependency map for Laravel backend.
Scans Controllers, Services, Repositories and builds dependency graph.
Outputs to docs/components.mmd as Mermaid diagram.
"""

import os
import sys
import re
from datetime import datetime


def get_current_date():
    """Get current date in YYYY-MM-DD format."""
    return datetime.now().strftime("%Y-%m-%d")


def scan_php_files(directory):
    """
    Scan PHP files in a directory and extract class info.

    Returns:
        list: [{
            "class": "UserController",
            "file": "app/Http/Controllers/UserController.php",
            "dependencies": ["UserService", "UserRepository"]
        }]
    """
    if not os.path.exists(directory):
        return []

    classes = []

    for root, dirs, files in os.walk(directory):
        for file in files:
            if not file.endswith('.php'):
                continue

            filepath = os.path.join(root, file)
            rel_path = os.path.relpath(filepath, os.getcwd())

            with open(filepath, 'r', encoding='utf-8') as f:
                try:
                    content = f.read()
                except:
                    continue

            # Extract class name
            class_match = re.search(r'class\s+(\w+)', content)
            if not class_match:
                continue

            class_name = class_match.group(1)

            # Extract dependencies from constructor injection
            dependencies = []

            # Find __construct method
            constructor_match = re.search(
                r'public\s+function\s+__construct\s*\((.*?)\)',
                content,
                re.DOTALL
            )

            if constructor_match:
                params = constructor_match.group(1)

                # Extract type hints (UserService $userService)
                param_matches = re.findall(r'(\w+)\s+\$\w+', params)
                dependencies = param_matches

            classes.append({
                "class": class_name,
                "file": rel_path,
                "dependencies": dependencies
            })

    return classes


def generate_mermaid_diagram(controllers, services, repositories):
    """Generate Mermaid graph from components."""
    date = get_current_date()

    diagram = f"""---
title: Component & Service Dependencies
---
graph TD
    %% Controllers
"""

    # Add controller nodes
    for ctrl in controllers:
        class_name = ctrl["class"]
        diagram += f"    {class_name}[{class_name}]\n"

    diagram += "\n    %% Services\n"
    for svc in services:
        class_name = svc["class"]
        diagram += f"    {class_name}[{class_name}]\n"

    diagram += "\n    %% Repositories\n"
    for repo in repositories:
        class_name = repo["class"]
        diagram += f"    {class_name}[{class_name}]\n"

    diagram += "\n    %% Dependencies\n"

    # Add controller → service connections
    for ctrl in controllers:
        for dep in ctrl["dependencies"]:
            diagram += f"    {ctrl['class']} --> {dep}\n"

    # Add service → repository connections
    for svc in services:
        for dep in svc["dependencies"]:
            diagram += f"    {svc['class']} --> {dep}\n"

    # Add repository → model connections (if we can detect them)
    for repo in repositories:
        # Try to guess model name from repository name
        # UserRepository → User
        if repo["class"].endswith("Repository"):
            model_name = repo["class"].replace("Repository", "")
            diagram += f"    {repo['class']} --> {model_name}[({model_name} Model)]\n"

    # Styling
    diagram += f"""
    %% Styling
    classDef controller fill:#3B82F6,stroke:#1E40AF,color:#fff
    classDef service fill:#10B981,stroke:#059669,color:#fff
    classDef repository fill:#F59E0B,stroke:#D97706,color:#fff
    classDef model fill:#8B5CF6,stroke:#6D28D9,color:#fff

    class {','.join([c['class'] for c in controllers])} controller
    class {','.join([s['class'] for s in services])} service
    class {','.join([r['class'] for r in repositories])} repository

%% Generated: {date}
%% Auto-updated by /2-code skill
"""

    return diagram


def update_components(root_path=None):
    """Update components documentation."""
    if root_path is None:
        root_path = os.getcwd()

    print(f"Scanning Laravel components in {root_path}...")

    # Scan controllers
    controllers_path = os.path.join(root_path, 'app', 'Http', 'Controllers')
    controllers = scan_php_files(controllers_path)
    print(f"  Found {len(controllers)} controllers")

    # Scan services
    services_path = os.path.join(root_path, 'app', 'Services')
    services = scan_php_files(services_path)
    print(f"  Found {len(services)} services")

    # Scan repositories
    repositories_path = os.path.join(root_path, 'app', 'Repositories')
    repositories = scan_php_files(repositories_path)
    print(f"  Found {len(repositories)} repositories")

    if not controllers and not services and not repositories:
        print("No components found. Skipping component map generation.")
        return False

    # Generate Mermaid diagram
    diagram = generate_mermaid_diagram(controllers, services, repositories)

    # Create docs folder
    docs_dir = os.path.join(root_path, 'docs')
    os.makedirs(docs_dir, exist_ok=True)

    # Write to docs/components.mmd
    components_path = os.path.join(docs_dir, 'components.mmd')
    with open(components_path, 'w', encoding='utf-8') as f:
        f.write(diagram)

    print(f"✓ Generated docs/components.mmd")
    print(f"  Controllers: {len(controllers)}")
    print(f"  Services: {len(services)}")
    print(f"  Repositories: {len(repositories)}")

    return True


def main():
    """Main entry point."""
    root_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()

    try:
        success = update_components(root_path)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error updating components map: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
