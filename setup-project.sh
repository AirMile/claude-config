#!/bin/bash
# Links claude-config into a project's .claude/ directory
# Usage: setup-project.sh <project-name>

set -e

PROJECT="$1"
if [ -z "$PROJECT" ]; then
    echo "Usage: setup-project.sh <project-name>"
    exit 1
fi

PROJECT_DIR="$HOME/$PROJECT"
CLAUDE_DIR="$PROJECT_DIR/.claude"
CONFIG_DIR="$HOME/claude-config"

if [ ! -d "$PROJECT_DIR" ]; then
    echo "Error: $PROJECT_DIR does not exist"
    exit 1
fi

mkdir -p "$CLAUDE_DIR"

# Create project-specific symlinks
# Note: agents/, skills/, scripts/ are global (symlinked in ~/.claude/)
ln -sfn "$CONFIG_DIR/CLAUDE.base.md" "$CLAUDE_DIR/CLAUDE.base.md"

# Add screenshots to .gitignore if not present
GITIGNORE="$PROJECT_DIR/.gitignore"
if [ -f "$GITIGNORE" ]; then
    if ! grep -q ".workspace/screenshots/" "$GITIGNORE"; then
        printf '\n# Screenshots (synced via Syncthing)\n.workspace/screenshots/\n' >> "$GITIGNORE"
        echo "Added screenshots to .gitignore"
    fi
fi

echo "Linked claude-config -> $CLAUDE_DIR"
