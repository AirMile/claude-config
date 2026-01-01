#!/usr/bin/env python3
"""
Generate smart suggestions based on selected tech stack.
Suggests complementary tools and packages based on user's choices.
"""

import json
from typing import List, Dict

def get_suggestions(tech_stack: str, project_type: str) -> Dict[str, List[Dict]]:
    """Generate smart suggestions based on tech stack selection."""

    suggestions = {
        "recommended": [],
        "optional": [],
        "dev_tools": []
    }

    # React suggestions
    if "react" in tech_stack.lower():
        suggestions["recommended"].extend([
            {"name": "React Router", "package": "react-router-dom", "reason": "Essential for multi-page navigation"},
            {"name": "TypeScript", "config": "tsconfig.json", "reason": "Type safety and better IDE support"}
        ])
        suggestions["optional"].extend([
            {"name": "Redux Toolkit", "package": "@reduxjs/toolkit", "reason": "State management for complex apps"},
            {"name": "Zustand", "package": "zustand", "reason": "Lightweight state management alternative"},
            {"name": "React Query", "package": "@tanstack/react-query", "reason": "Server state management"},
            {"name": "React Hook Form", "package": "react-hook-form", "reason": "Performant form handling"}
        ])
        suggestions["dev_tools"].extend([
            {"name": "ESLint", "package": "eslint", "reason": "Code quality and consistency"},
            {"name": "Prettier", "package": "prettier", "reason": "Code formatting"}
        ])

    # Vue suggestions
    elif "vue" in tech_stack.lower():
        suggestions["recommended"].extend([
            {"name": "Vue Router", "package": "vue-router", "reason": "Official routing solution"},
            {"name": "Pinia", "package": "pinia", "reason": "Official state management"}
        ])
        suggestions["optional"].extend([
            {"name": "TypeScript", "config": "tsconfig.json", "reason": "Type safety for larger projects"},
            {"name": "VueUse", "package": "@vueuse/core", "reason": "Collection of Vue composition utilities"}
        ])

    # Laravel suggestions
    elif "laravel" in tech_stack.lower():
        suggestions["recommended"].extend([
            {"name": "Laravel Sail", "command": "composer require laravel/sail --dev", "reason": "Docker development environment"},
            {"name": "Laravel Sanctum", "package": "laravel/sanctum", "reason": "API authentication"}
        ])
        suggestions["optional"].extend([
            {"name": "Laravel Livewire", "package": "livewire/livewire", "reason": "Reactive UI without JavaScript"},
            {"name": "Laravel Telescope", "package": "laravel/telescope", "reason": "Debugging and monitoring"},
            {"name": "Pest PHP", "package": "pestphp/pest", "reason": "Modern testing framework"}
        ])

    # Node.js backend suggestions
    elif "node" in tech_stack.lower() and "backend" in project_type.lower():
        suggestions["recommended"].extend([
            {"name": "Express", "package": "express", "reason": "Web framework for Node.js"},
            {"name": "TypeScript", "package": "typescript", "reason": "Type safety for backend"},
            {"name": "Nodemon", "package": "nodemon", "reason": "Auto-restart on file changes"}
        ])
        suggestions["optional"].extend([
            {"name": "Prisma", "package": "prisma", "reason": "Modern database ORM"},
            {"name": "JWT", "package": "jsonwebtoken", "reason": "Token-based authentication"},
            {"name": "Joi", "package": "joi", "reason": "Data validation"}
        ])

    # Game project suggestions
    if "game" in project_type.lower():
        suggestions["recommended"].extend([
            {"name": "Git LFS", "command": "git lfs install", "reason": "Handle large binary assets efficiently"}
        ])
        suggestions["optional"].extend([
            {"name": "Custom .gitignore", "file": ".gitignore", "reason": "Ignore engine-specific files"},
            {"name": "Build Scripts", "file": "build.sh", "reason": "Automate build process"}
        ])

    # Full-stack suggestions
    if "full-stack" in project_type.lower():
        suggestions["recommended"].extend([
            {"name": "Docker", "file": "docker-compose.yml", "reason": "Containerize full stack"},
            {"name": "Monorepo Tools", "package": "lerna/nx/turborepo", "reason": "Manage frontend and backend"}
        ])
        suggestions["optional"].extend([
            {"name": "API Documentation", "package": "swagger", "reason": "Document your APIs"},
            {"name": "CORS Configuration", "config": "cors", "reason": "Handle cross-origin requests"}
        ])

    # Universal dev tools
    if project_type not in ["cli"]:
        suggestions["dev_tools"].extend([
            {"name": "Husky", "package": "husky", "reason": "Git hooks for quality control"},
            {"name": "Testing Framework", "package": "jest/vitest/pytest", "reason": "Ensure code quality"}
        ])

    return suggestions

def format_suggestions(suggestions: Dict[str, List[Dict]]) -> str:
    """Format suggestions for display."""

    output = []

    if suggestions["recommended"]:
        output.append("🌟 **Recommended additions:**")
        for item in suggestions["recommended"]:
            name = item['name']
            reason = item.get('reason', '')
            if 'package' in item:
                output.append(f"   - {name} (`{item['package']}`) - {reason}")
            elif 'command' in item:
                output.append(f"   - {name} - {reason}")
            else:
                output.append(f"   - {name} - {reason}")

    if suggestions["optional"]:
        output.append("\n💡 **Optional enhancements:**")
        for item in suggestions["optional"]:
            name = item['name']
            reason = item.get('reason', '')
            if 'package' in item:
                output.append(f"   - {name} (`{item['package']}`) - {reason}")
            else:
                output.append(f"   - {name} - {reason}")

    if suggestions["dev_tools"]:
        output.append("\n🛠️ **Development tools:**")
        for item in suggestions["dev_tools"]:
            name = item['name']
            reason = item.get('reason', '')
            if 'package' in item:
                output.append(f"   - {name} (`{item['package']}`) - {reason}")
            else:
                output.append(f"   - {name} - {reason}")

    return "\n".join(output)

def main(tech_stack: str = "react", project_type: str = "web-frontend"):
    """Main function to generate and display suggestions."""

    suggestions = get_suggestions(tech_stack, project_type)
    formatted = format_suggestions(suggestions)

    print("\n📦 Smart Suggestions for your project:\n")
    print(formatted)
    print("\nWhich of these would you like to include? (You can select multiple)")

    return suggestions

if __name__ == "__main__":
    # Example usage
    import sys
    tech = sys.argv[1] if len(sys.argv) > 1 else "react"
    proj_type = sys.argv[2] if len(sys.argv) > 2 else "web-frontend"
    main(tech, proj_type)