#!/usr/bin/env python3
"""
Update CLAUDE.md with project information.
Adds or updates project overview, tech stack, and development setup sections.
"""

import os
from pathlib import Path
from datetime import datetime
from typing import Dict, List

def generate_claude_md_content(project_info: Dict) -> str:
    """Generate content for CLAUDE.md based on project information."""

    content = []

    # Project Overview Section
    content.append("## Project Overview\n")
    content.append(f"**Name**: {project_info.get('name', 'Unnamed Project')}")
    content.append(f"**Description**: {project_info.get('description', 'No description provided')}")
    content.append(f"**Type**: {project_info.get('type', 'Unknown')}")
    content.append(f"**Created**: {datetime.now().strftime('%Y-%m-%d')}")
    content.append("")

    # Tech Stack Section
    content.append("## Tech Stack\n")
    if project_info.get('language'):
        content.append(f"- **Primary Language**: {project_info['language']}")
    if project_info.get('framework'):
        content.append(f"- **Framework**: {project_info['framework']}")
    if project_info.get('database'):
        content.append(f"- **Database**: {project_info['database']}")
    if project_info.get('dependencies'):
        content.append("- **Key Dependencies**:")
        for dep in project_info['dependencies']:
            content.append(f"  - {dep}")
    content.append("")

    # Development Setup Section
    content.append("## Development Setup\n")
    content.append("### Prerequisites")
    if project_info.get('prerequisites'):
        for prereq in project_info['prerequisites']:
            content.append(f"- {prereq}")
    content.append("")

    content.append("### Installation")
    content.append("```bash")
    if project_info.get('install_commands'):
        for cmd in project_info['install_commands']:
            content.append(cmd)
    else:
        content.append("# Install dependencies")
        if 'package.json' in str(project_info.get('config_files', [])):
            content.append("npm install")
        elif 'composer.json' in str(project_info.get('config_files', [])):
            content.append("composer install")
        elif 'requirements.txt' in str(project_info.get('config_files', [])):
            content.append("pip install -r requirements.txt")
    content.append("```")
    content.append("")

    # Development Workflow Section
    if project_info.get('dev_commands'):
        content.append("### Development Commands")
        content.append("```bash")
        for cmd in project_info['dev_commands']:
            content.append(cmd)
        content.append("```")
        content.append("")

    # Additional Notes
    if project_info.get('notes'):
        content.append("## Notes\n")
        for note in project_info['notes']:
            content.append(f"- {note}")
        content.append("")

    return "\n".join(content)

def update_claude_md(project_info: Dict, merge: bool = True):
    """Update or create CLAUDE.md file with project information."""

    claude_md_path = Path(".claude/CLAUDE.md")

    # Ensure .claude directory exists
    claude_md_path.parent.mkdir(exist_ok=True)

    new_content = generate_claude_md_content(project_info)

    if claude_md_path.exists() and merge:
        # Read existing content
        with open(claude_md_path, 'r', encoding='utf-8') as f:
            existing_content = f.read()

        # Check if project sections already exist
        if "## Project Overview" in existing_content:
            # Replace existing project sections
            # Find the start of Project Overview
            start_idx = existing_content.find("## Project Overview")

            # Find the next major section after our project info
            # Look for common section headers that might come after
            end_markers = [
                "## Architecture",
                "## Guidelines",
                "## Contributing",
                "## License",
                "# "  # Any H1 header
            ]

            end_idx = len(existing_content)
            for marker in end_markers:
                idx = existing_content.find(marker, start_idx + 1)
                if idx != -1 and idx < end_idx:
                    end_idx = idx

            # Combine: before + new content + after
            final_content = (
                existing_content[:start_idx] +
                new_content +
                "\n" +
                existing_content[end_idx:]
            )
        else:
            # Add project sections at the beginning (after any H1 title)
            lines = existing_content.split('\n')
            insert_idx = 0

            # Skip initial comments and find first H1
            for i, line in enumerate(lines):
                if line.startswith('# '):
                    insert_idx = i + 1
                    break

            # Insert new content after H1
            lines.insert(insert_idx, '')
            lines.insert(insert_idx + 1, new_content)
            final_content = '\n'.join(lines)
    else:
        # Create new file or overwrite
        final_content = f"# Project Configuration\n\n{new_content}"

    # Write the updated content
    with open(claude_md_path, 'w', encoding='utf-8') as f:
        f.write(final_content)

    print(f"✅ Updated CLAUDE.md with project information")
    return True

def main():
    """Example usage of the update function."""

    # Example project info
    project_info = {
        "name": "MyAwesomeApp",
        "description": "A task management app with real-time collaboration",
        "type": "Full-stack Web Application",
        "language": "JavaScript/TypeScript",
        "framework": "React + Node.js",
        "database": "PostgreSQL",
        "dependencies": [
            "React 18.x",
            "Express 4.x",
            "TypeScript 5.x",
            "Prisma ORM"
        ],
        "prerequisites": [
            "Node.js 18+ and npm",
            "PostgreSQL 14+",
            "Git"
        ],
        "install_commands": [
            "# Clone the repository",
            "git clone <repository-url>",
            "",
            "# Install frontend dependencies",
            "cd frontend && npm install",
            "",
            "# Install backend dependencies",
            "cd ../backend && npm install",
            "",
            "# Setup database",
            "npm run db:migrate"
        ],
        "dev_commands": [
            "# Start frontend",
            "cd frontend && npm run dev",
            "",
            "# Start backend (new terminal)",
            "cd backend && npm run dev"
        ],
        "notes": [
            "Ensure PostgreSQL is running before starting the backend",
            "Default API runs on port 3001, frontend on port 3000"
        ]
    }

    update_claude_md(project_info)

if __name__ == "__main__":
    main()