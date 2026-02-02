#!/usr/bin/env python3
"""
Update architecture.md with project structure and component relationships.
Generates Mermaid diagrams for visualization.
"""

import os
import sys
from datetime import datetime
from pathlib import Path


def get_current_date():
    """Get current date in YYYY-MM-DD format."""
    return datetime.now().strftime("%Y-%m-%d")


def scan_project_structure(root_path):
    """Scan project directory and identify key components."""
    structure = {
        'controllers': [],
        'models': [],
        'views': [],
        'components': [],
        'services': [],
        'config': [],
        'routes': []
    }
    
    # Common patterns to look for
    patterns = {
        'controllers': ['controller', 'controllers'],
        'models': ['model', 'models', 'entity', 'entities'],
        'views': ['view', 'views', 'template', 'templates', 'blade'],
        'components': ['component', 'components'],
        'services': ['service', 'services'],
        'config': ['config', 'configuration'],
        'routes': ['route', 'routes', 'api']
    }
    
    # Walk through project directory
    for root, dirs, files in os.walk(root_path):
        # Skip common excluded directories
        dirs[:] = [d for d in dirs if d not in [
            'node_modules', 'vendor', '.git', 'dist', 'build', 
            '__pycache__', '.next', 'venv', 'env'
        ]]
        
        rel_path = os.path.relpath(root, root_path)
        
        for file in files:
            # Skip non-code files
            if not any(file.endswith(ext) for ext in [
                '.php', '.js', '.jsx', '.ts', '.tsx', '.py', 
                '.vue', '.svelte', '.blade.php'
            ]):
                continue
            
            file_path = os.path.join(rel_path, file)
            
            # Categorize based on path and filename
            for category, keywords in patterns.items():
                if any(keyword in rel_path.lower() or keyword in file.lower() for keyword in keywords):
                    structure[category].append(file_path)
                    break
    
    return structure


def generate_folder_tree(root_path):
    """Generate a simple folder tree structure."""
    tree_lines = []
    
    for root, dirs, files in os.walk(root_path):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in [
            'node_modules', 'vendor', '.git', 'dist', 'build',
            '__pycache__', '.next', 'venv', 'env'
        ]]
        
        level = root.replace(root_path, '').count(os.sep)
        indent = '  ' * level
        folder_name = os.path.basename(root) if level > 0 else '.'
        tree_lines.append(f"{indent}{folder_name}/")
        
        # Only show first few files per directory to keep it readable
        sub_indent = '  ' * (level + 1)
        for file in sorted(files)[:5]:
            tree_lines.append(f"{sub_indent}{file}")
        
        if len(files) > 5:
            tree_lines.append(f"{sub_indent}... ({len(files) - 5} more files)")
        
        # Limit depth
        if level >= 2:
            dirs.clear()
    
    return '\n'.join(tree_lines[:50])  # Limit total lines


def generate_mermaid_diagram(structure):
    """Generate Mermaid diagram showing component relationships."""
    
    # Simple relationship diagram
    diagram = "```mermaid\ngraph TD\n"
    
    # Common architecture patterns
    if structure['routes']:
        diagram += "  Routes[Routes/API] --> Controllers[Controllers]\n"
    
    if structure['controllers']:
        diagram += "  Controllers[Controllers] --> Services[Services]\n"
        diagram += "  Controllers --> Models[Models]\n"
    
    if structure['services']:
        diagram += "  Services[Services] --> Models[Models]\n"
    
    if structure['models']:
        diagram += "  Models[Models] --> Database[(Database)]\n"
    
    if structure['controllers'] and structure['views']:
        diagram += "  Controllers --> Views[Views/Templates]\n"
    
    if structure['components']:
        diagram += "  Views[Views] --> Components[Components]\n"
    
    if structure['config']:
        diagram += "  Config[Config] -.-> Controllers\n"
        diagram += "  Config -.-> Services\n"
    
    diagram += "```"
    
    return diagram


def generate_architecture_doc(root_path, structure):
    """Generate complete architecture.md content."""
    date = get_current_date()
    
    content = f"""# Project Architecture

Last updated: {date}

## Overview

This document describes the project's architecture, folder structure, and component relationships.

## Folder Structure

```
{generate_folder_tree(root_path)}
```

## Component Relationships

{generate_mermaid_diagram(structure)}

## Key Components

"""
    
    # Add details for each category
    categories = {
        'Controllers': structure['controllers'],
        'Models': structure['models'],
        'Views': structure['views'],
        'Components': structure['components'],
        'Services': structure['services'],
        'Config Files': structure['config'],
        'Routes': structure['routes']
    }
    
    for category, items in categories.items():
        if items:
            content += f"### {category}\n\n"
            for item in sorted(items)[:10]:  # Limit to 10 per category
                content += f"- `{item}`\n"
            
            if len(items) > 10:
                content += f"\n*... and {len(items) - 10} more files*\n"
            
            content += "\n"
    
    content += """## Architecture Notes

### Config Pattern
- Central configuration in `config/` directory
- Components import config, never hardcode values
- Colors, spacing, API endpoints in config files

### Separation of Concerns
- Config → Controller → Component structure
- Minimal tight coupling between components
- Plug and play component design

### Testing Strategy
- Unit tests for business logic
- API tests for endpoints
- Manual tests for UI/UX
- See TESTS.md for current test plan

---

*This file is automatically updated by the /2-code skill*
"""
    
    return content


def update_architecture(root_path=None):
    """Update architecture.md file."""
    if root_path is None:
        root_path = os.getcwd()

    print(f"Scanning project structure in {root_path}...")

    # Scan project
    structure = scan_project_structure(root_path)

    # Generate documentation
    content = generate_architecture_doc(root_path, structure)

    # Create docs folder if it doesn't exist
    docs_dir = os.path.join(root_path, 'docs')
    os.makedirs(docs_dir, exist_ok=True)

    # Write to docs/architecture.md
    arch_path = os.path.join(docs_dir, 'architecture.md')
    with open(arch_path, 'w') as f:
        f.write(content)

    print(f"✓ Updated docs/architecture.md")
    print(f"  Controllers: {len(structure['controllers'])}")
    print(f"  Models: {len(structure['models'])}")
    print(f"  Views: {len(structure['views'])}")
    print(f"  Components: {len(structure['components'])}")
    
    return True


def main():
    """Main entry point."""
    root_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    
    try:
        update_architecture(root_path)
        sys.exit(0)
    except Exception as e:
        print(f"Error updating architecture: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
