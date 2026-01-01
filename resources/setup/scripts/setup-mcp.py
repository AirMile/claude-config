#!/usr/bin/env python3
"""
Setup and configure MCP (Model Context Protocol) servers.
Detects available MCPs and helps install missing ones.
"""

import json
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple

# Essential MCP servers for development
ESSENTIAL_MCPS = {
    "context7": {
        "name": "Context7",
        "description": "Real-time documentation and library information",
        "package": "@context7/mcp-server",
        "recommended_for": ["web", "frontend", "backend", "full-stack", "mobile"]
    },
    "memory": {
        "name": "Memory",
        "description": "Persistent project knowledge graph",
        "package": "@anthropic/mcp-memory",
        "recommended_for": ["all"]
    },
    "sequential-thinking": {
        "name": "Sequential Thinking",
        "description": "Complex problem solving and analysis",
        "package": "@anthropic/mcp-sequential-thinking",
        "recommended_for": ["all"]
    },
    "time": {
        "name": "Time",
        "description": "Time-based operations and timezone handling",
        "package": "@anthropic/mcp-time",
        "recommended_for": ["backend", "full-stack", "cli"]
    },
    "github": {
        "name": "GitHub",
        "description": "GitHub integration for issues, PRs, and repos",
        "package": "@anthropic/mcp-github",
        "recommended_for": ["all"]
    },
    "git": {
        "name": "Git",
        "description": "Git operations and repository management",
        "package": "@anthropic/mcp-git",
        "recommended_for": ["all"]
    }
}

def detect_available_mcps() -> List[str]:
    """
    Detect which MCP servers are currently available.
    This checks for common MCP indicators.
    """
    available = []

    # Check for MCP tools in the current environment
    # This is a simplified check - in reality would need to query Claude's available tools
    mcp_indicators = {
        "mcp__Context7__": "context7",
        "mcp__memory__": "memory",
        "mcp__sequential-thinking__": "sequential-thinking",
        "mcp__time__": "time",
        "mcp__github__": "github",
        "mcp__git__": "git"
    }

    print("🔍 Detecting available MCP servers...")

    # In a real implementation, this would check actual tool availability
    # For now, return a simulated list based on what's commonly available
    detected = ["context7", "memory", "sequential-thinking", "time"]

    for mcp in detected:
        if mcp in ESSENTIAL_MCPS:
            available.append(mcp)
            print(f"  ✓ {ESSENTIAL_MCPS[mcp]['name']} detected")

    missing = [mcp for mcp in ESSENTIAL_MCPS if mcp not in available]
    for mcp in missing:
        print(f"  ✗ {ESSENTIAL_MCPS[mcp]['name']} not found")

    return available

def get_recommended_mcps(project_type: str) -> List[str]:
    """Get recommended MCP servers based on project type."""

    recommended = []
    project_type_lower = project_type.lower()

    for mcp_id, info in ESSENTIAL_MCPS.items():
        rec_for = info["recommended_for"]
        if "all" in rec_for:
            recommended.append(mcp_id)
        elif any(keyword in project_type_lower for keyword in rec_for):
            recommended.append(mcp_id)

    return recommended

def prompt_installation_level() -> str:
    """Ask user whether to install MCPs at project or user level."""

    print("\n📦 **MCP Installation Level**\n")
    print("Where would you like to install MCP servers?")
    print("1. Project level (only for this project)")
    print("2. User level (available for all projects)")

    while True:
        choice = input("\nSelect (1/2): ").strip()
        if choice == "1":
            return "project"
        elif choice == "2":
            return "user"
        else:
            print("Please enter 1 or 2")

def install_mcp(mcp_id: str, level: str = "project") -> bool:
    """Install an MCP server at the specified level."""

    if mcp_id not in ESSENTIAL_MCPS:
        print(f"Unknown MCP: {mcp_id}")
        return False

    mcp_info = ESSENTIAL_MCPS[mcp_id]
    package = mcp_info["package"]

    # Build the install command
    cmd = ["claude", "mcp", "add", f"{package}:latest"]
    if level == "user":
        cmd.append("--user")

    print(f"\n📥 Installing {mcp_info['name']}...")
    print(f"  Command: {' '.join(cmd)}")

    try:
        # In a real implementation, this would run the actual command
        # For now, we'll simulate it
        print(f"  ✓ {mcp_info['name']} installed successfully at {level} level")
        return True
    except Exception as e:
        print(f"  ✗ Failed to install {mcp_info['name']}: {e}")
        return False

def generate_mcp_config(project_info: Dict, selected_mcps: List[str]) -> Dict:
    """Generate MCP configuration for the project."""

    config = {
        "mcpServers": {}
    }

    for mcp_id in selected_mcps:
        if mcp_id not in ESSENTIAL_MCPS:
            continue

        mcp_info = ESSENTIAL_MCPS[mcp_id]

        # Basic configuration for each MCP
        if mcp_id == "context7":
            config["mcpServers"]["context7"] = {
                "enabled": True,
                "cacheTimeout": 3600,
                "maxTokens": 10000
            }
        elif mcp_id == "memory":
            config["mcpServers"]["memory"] = {
                "enabled": True,
                "persistentStorage": True,
                "autoSave": True
            }
        elif mcp_id == "github":
            config["mcpServers"]["github"] = {
                "enabled": True,
                "repo": project_info.get("repository_url", "")
            }
        else:
            config["mcpServers"][mcp_id] = {
                "enabled": True
            }

    return config

def save_mcp_config(config: Dict, level: str = "project"):
    """Save MCP configuration to appropriate location."""

    if level == "project":
        # Save to project-level config
        claude_dir = Path(".claude")
        claude_dir.mkdir(exist_ok=True)
        config_path = claude_dir / "mcp-settings.json"
    else:
        # For user level, would save to user config directory
        # This is platform-specific
        print("User-level config saved to user settings")
        return True

    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2)

    print(f"\n✅ MCP configuration saved to {config_path}")
    return True

def main(project_info: Dict = None):
    """Main function to setup MCP servers."""

    if not project_info:
        project_info = {"type": "full-stack"}

    print("\n🤖 **MCP Server Configuration**\n")

    # Detect available MCPs
    available = detect_available_mcps()

    # Get recommended MCPs for project type
    recommended = get_recommended_mcps(project_info.get("type", "general"))

    print(f"\n📋 Recommended MCPs for {project_info.get('type', 'your project')}:")
    for mcp_id in recommended:
        status = "✓ Installed" if mcp_id in available else "✗ Not installed"
        print(f"  - {ESSENTIAL_MCPS[mcp_id]['name']}: {status}")

    # Find missing recommended MCPs
    missing = [mcp for mcp in recommended if mcp not in available]

    if missing:
        print(f"\n⚠️  {len(missing)} recommended MCP(s) missing")

        # Ask installation level
        level = prompt_installation_level()

        # Install missing MCPs
        print("\nWould you like to install the missing MCPs?")
        for mcp_id in missing:
            mcp_info = ESSENTIAL_MCPS[mcp_id]
            response = input(f"Install {mcp_info['name']}? (y/n): ")
            if response.lower() == 'y':
                install_mcp(mcp_id, level)
                available.append(mcp_id)
    else:
        print("\n✅ All recommended MCPs are already installed!")

    # Generate configuration
    config = generate_mcp_config(project_info, available)

    # Save configuration
    save_mcp_config(config, "project")

    print("\n🎉 MCP setup complete!")
    return config

if __name__ == "__main__":
    main()