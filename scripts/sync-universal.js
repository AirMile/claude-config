#!/usr/bin/env node
// scripts/sync-universal.js - Sync skills/*/SKILL.md to universal formats:
//   1. GitHub Copilot (.prompt.md) in dist/copilot/prompts/
//   2. Cursor Rules (.mdc) in dist/cursor/rules/
//
// Usage:
//   node scripts/sync-universal.js [--project <project-root>] [--watch]

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

const DEFAULT_COPILOT_DIR = path.join(REPO_ROOT, 'dist', 'copilot', 'prompts');
const DEFAULT_CURSOR_DIR = path.join(REPO_ROOT, 'dist', 'cursor', 'rules');

// Parse CLI args
const args = process.argv.slice(2);
let targetCopilotDir = DEFAULT_COPILOT_DIR;
let targetCursorDir = DEFAULT_CURSOR_DIR;
let projectRoot = null;
let watchMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project' && args[i + 1]) {
    projectRoot = path.resolve(args[i + 1]);
    targetCopilotDir = path.join(projectRoot, '.github', 'prompts');
    targetCursorDir = path.join(projectRoot, '.cursor', 'rules');
    i++;
  } else if (args[i] === '--watch') {
    watchMode = true;
  }
}

/**
 * Extract YAML frontmatter and body from a markdown file.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const rawYaml = match[1];
  const body = match[2];
  const frontmatter = {};

  const lines = rawYaml.split('\n');
  let currentKey = null;

  for (const line of lines) {
    const keyValMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyValMatch) {
      currentKey = keyValMatch[1];
      let val = keyValMatch[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      frontmatter[currentKey] = val;
    } else if (currentKey && line.startsWith('  ')) {
      frontmatter[currentKey] += ' ' + line.trim();
    }
  }

  return { frontmatter, body };
}

/**
 * Normalize body content for cross-agent compatibility:
 * - Replaces hardcoded `.claude/skills/` with relative or universal references
 * - Normalizes Claude-specific tool directives
 */
function normalizeBody(body, skillName) {
  let transformed = body;

  // 1. Normalize .claude/skills/ paths
  transformed = transformed.replace(/\.claude\/skills\//g, 'skills/');

  // 2. Normalize AskUserQuestion mentions to standard user confirmation
  transformed = transformed.replace(/AskUserQuestion/g, 'user confirmation / prompt');

  return transformed;
}

/**
 * Convert a single SKILL.md to Copilot (.prompt.md) and Cursor (.mdc)
 */
function convertSkill(skillDirName, copilotOutDir, cursorOutDir) {
  const skillMdPath = path.join(SKILLS_DIR, skillDirName, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return false;
  }

  const rawContent = fs.readFileSync(skillMdPath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(rawContent);

  const skillName = frontmatter.name || skillDirName;
  const description = frontmatter.description || `Execute the ${skillName} skill`;
  const cleanDescription = description.replace(/"/g, '\\"');
  const normalizedBody = normalizeBody(body, skillName).trim();

  // 1. GitHub Copilot Prompt format
  const copilotPromptContent = `---
description: "${cleanDescription}"
---

${normalizedBody}
`;
  const copilotFile = path.join(copilotOutDir, `${skillName}.prompt.md`);
  fs.writeFileSync(copilotFile, copilotPromptContent, 'utf8');

  // 2. Cursor Rule (.mdc) format
  const cursorRuleContent = `---
description: "${cleanDescription}"
globs: ""
alwaysApply: false
---

${normalizedBody}
`;
  const cursorFile = path.join(cursorOutDir, `${skillName}.mdc`);
  fs.writeFileSync(cursorFile, cursorRuleContent, 'utf8');

  return true;
}

/**
 * Sync all skills in the skills/ directory
 */
function syncAllSkills(copilotOutDir, cursorOutDir) {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`Error: skills directory not found at ${SKILLS_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(copilotOutDir, { recursive: true });
  fs.mkdirSync(cursorOutDir, { recursive: true });

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'shared') {
      const ok = convertSkill(entry.name, copilotOutDir, cursorOutDir);
      if (ok) count++;
    }
  }

  console.log(`✅ Synced ${count} skills:`);
  console.log(`   - Copilot Prompts: ${path.relative(REPO_ROOT, copilotOutDir) || copilotOutDir}`);
  console.log(`   - Cursor Rules:    ${path.relative(REPO_ROOT, cursorOutDir) || cursorOutDir}`);
}

// Initial Sync
syncAllSkills(targetCopilotDir, targetCursorDir);

// Watch mode if requested
if (watchMode) {
  console.log(`👀 Watching ${SKILLS_DIR} for changes... (Press Ctrl+C to stop)`);
  let debounceTimeout = null;
  fs.watch(SKILLS_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.md')) {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        console.log(`\n🔄 Change detected in ${filename}, re-syncing...`);
        syncAllSkills(targetCopilotDir, targetCursorDir);
      }, 200);
    }
  });
}
