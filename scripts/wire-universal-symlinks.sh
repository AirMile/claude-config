#!/usr/bin/env bash
# scripts/wire-universal-symlinks.sh — Wire universal skills and config across
# Claude Code (~/.claude), Antigravity (~/.gemini/config), Cursor, Codex, and GitHub Copilot.
#
# Usage:
#   bash scripts/wire-universal-symlinks.sh [--global] [--project /path/to/project]
#
# Exit 0 = symlinks wired successfully.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_PROJECT=""
DO_GLOBAL=1

while [ $# -gt 0 ]; do
  case "$1" in
    --global)
      DO_GLOBAL=1
      shift ;;
    --project)
      TARGET_PROJECT="${2:-}"
      shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--global] [--project /path/to/project]"
      exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1 ;;
  esac
done

echo "🔧 Wiring Universal AI Agent Configurations..."

# 1. Sync Copilot Prompts & Cursor Rules
echo "📦 Generating GitHub Copilot Prompts & Cursor Rules..."
node "$REPO_ROOT/scripts/sync-universal.js"

# 2. Global Wiring (Claude Code + Antigravity + Cursor + Codex)
if [ "$DO_GLOBAL" -eq 1 ]; then
  echo ""
  echo "🌐 Wiring Global Symlinks..."

  # Claude Code
  mkdir -p "$HOME/.claude"
  for dir in skills agents hooks scripts; do
    target="$HOME/.claude/$dir"
    if [ -L "$target" ] || [ ! -e "$target" ]; then
      ln -sfn "$REPO_ROOT/$dir" "$target"
      echo "  ✅ ~/.claude/$dir -> $REPO_ROOT/$dir"
    else
      echo "  ⚠️ ~/.claude/$dir exists and is not a symlink (skipped)"
    fi
  done

  # Antigravity (~/.gemini/config)
  GEMINI_CONFIG="$HOME/.gemini/config"
  mkdir -p "$GEMINI_CONFIG"
  if [ -L "$GEMINI_CONFIG/skills" ] || [ ! -e "$GEMINI_CONFIG/skills" ]; then
    ln -sfn "$REPO_ROOT/skills" "$GEMINI_CONFIG/skills"
    echo "  ✅ ~/.gemini/config/skills -> $REPO_ROOT/skills"
  else
    echo "  ⚠️ ~/.gemini/config/skills exists and is not a symlink (skipped)"
  fi

  # Universal Global Guidelines (CLAUDE.md -> GEMINI.md, AGENTS.md, .cursorrules, CODEX)
  CLAUDE_GLOBAL="$HOME/.claude/CLAUDE.md"
  if [ -f "$CLAUDE_GLOBAL" ]; then
    # Antigravity Global Guidelines
    if [ -L "$GEMINI_CONFIG/GEMINI.md" ] || [ ! -e "$GEMINI_CONFIG/GEMINI.md" ]; then
      ln -sfn "$CLAUDE_GLOBAL" "$GEMINI_CONFIG/GEMINI.md"
      echo "  ✅ ~/.gemini/config/GEMINI.md -> $CLAUDE_GLOBAL"
    fi
    if [ -L "$GEMINI_CONFIG/AGENTS.md" ] || [ ! -e "$GEMINI_CONFIG/AGENTS.md" ]; then
      ln -sfn "$CLAUDE_GLOBAL" "$GEMINI_CONFIG/AGENTS.md"
      echo "  ✅ ~/.gemini/config/AGENTS.md -> $CLAUDE_GLOBAL"
    fi

    # Cursor Global Rules (~/.cursorrules)
    if [ -L "$HOME/.cursorrules" ] || [ ! -e "$HOME/.cursorrules" ]; then
      ln -sfn "$CLAUDE_GLOBAL" "$HOME/.cursorrules"
      echo "  ✅ ~/.cursorrules -> $CLAUDE_GLOBAL"
    fi

    # Codex Global Instructions (~/.codex/instructions.md)
    CODEX_CONFIG="$HOME/.codex"
    mkdir -p "$CODEX_CONFIG"
    if [ -L "$CODEX_CONFIG/instructions.md" ] || [ ! -e "$CODEX_CONFIG/instructions.md" ]; then
      ln -sfn "$CLAUDE_GLOBAL" "$CODEX_CONFIG/instructions.md"
      echo "  ✅ ~/.codex/instructions.md -> $CLAUDE_GLOBAL"
    fi
  fi

  # Cursor Global Rules (~/.cursor/rules)
  CURSOR_CONFIG="$HOME/.cursor"
  if [ -d "$CURSOR_CONFIG" ] || [ -L "$CURSOR_CONFIG" ]; then
    mkdir -p "$CURSOR_CONFIG"
    if [ -L "$CURSOR_CONFIG/rules" ] || [ ! -e "$CURSOR_CONFIG/rules" ]; then
      ln -sfn "$REPO_ROOT/dist/cursor/rules" "$CURSOR_CONFIG/rules"
      echo "  ✅ ~/.cursor/rules -> $REPO_ROOT/dist/cursor/rules"
    else
      echo "  ⚠️ ~/.cursor/rules exists and is not a symlink (skipped)"
    fi
  fi
fi

# 3. Project-specific wiring if requested
if [ -n "$TARGET_PROJECT" ]; then
  echo ""
  echo "📁 Wiring Project: $TARGET_PROJECT..."
  if [ ! -d "$TARGET_PROJECT" ]; then
    echo "❌ Error: Project directory does not exist: $TARGET_PROJECT" >&2
    exit 1
  fi

  # Wire .claude
  mkdir -p "$TARGET_PROJECT/.claude"
  ln -sfn "$REPO_ROOT/skills" "$TARGET_PROJECT/.claude/skills"
  echo "  ✅ .claude/skills -> $REPO_ROOT/skills"

  # Wire .agents (Antigravity project scope)
  mkdir -p "$TARGET_PROJECT/.agents"
  ln -sfn "$REPO_ROOT/skills" "$TARGET_PROJECT/.agents/skills"
  echo "  ✅ .agents/skills -> $REPO_ROOT/skills"

  # Wire .cursor/rules (Cursor)
  mkdir -p "$TARGET_PROJECT/.cursor"
  ln -sfn "$REPO_ROOT/dist/cursor/rules" "$TARGET_PROJECT/.cursor/rules"
  echo "  ✅ .cursor/rules -> $REPO_ROOT/dist/cursor/rules"

  # Wire .github/prompts (GitHub Copilot)
  mkdir -p "$TARGET_PROJECT/.github"
  ln -sfn "$REPO_ROOT/dist/copilot/prompts" "$TARGET_PROJECT/.github/prompts"
  echo "  ✅ .github/prompts -> $REPO_ROOT/dist/copilot/prompts"

  # Universal Project AI Guidelines (CLAUDE.md / AGENTS.md / GEMINI.md / CODEX.md / .cursorrules)
  if [ -f "$TARGET_PROJECT/CLAUDE.md" ]; then
    for cfg in AGENTS.md GEMINI.md CODEX.md .cursorrules; do
      if [ -L "$TARGET_PROJECT/$cfg" ] || [ ! -e "$TARGET_PROJECT/$cfg" ]; then
        ln -sfn "CLAUDE.md" "$TARGET_PROJECT/$cfg"
        echo "  ✅ $TARGET_PROJECT/$cfg -> CLAUDE.md"
      fi
    done
  elif [ -f "$TARGET_PROJECT/AGENTS.md" ]; then
    for cfg in CLAUDE.md GEMINI.md CODEX.md .cursorrules; do
      if [ -L "$TARGET_PROJECT/$cfg" ] || [ ! -e "$TARGET_PROJECT/$cfg" ]; then
        ln -sfn "AGENTS.md" "$TARGET_PROJECT/$cfg"
        echo "  ✅ $TARGET_PROJECT/$cfg -> AGENTS.md"
      fi
    done
  elif [ -f "$REPO_ROOT/AGENTS.base.md" ]; then
    cp "$REPO_ROOT/AGENTS.base.md" "$TARGET_PROJECT/CLAUDE.md"
    echo "  ✅ Created $TARGET_PROJECT/CLAUDE.md"
    for cfg in AGENTS.md GEMINI.md CODEX.md .cursorrules; do
      ln -sfn "CLAUDE.md" "$TARGET_PROJECT/$cfg"
      echo "  ✅ $TARGET_PROJECT/$cfg -> CLAUDE.md"
    done
  fi
fi

echo ""
echo "🎉 Done! Skills & Configs are now universally available across Claude Code, Antigravity, Cursor, Codex, and GitHub Copilot."
