#!/usr/bin/env node
// scripts/sync-copilot.js - Sync skills/*/SKILL.md to GitHub Copilot .prompt.md format.
//
// Scans all skills in skills/ and generates corresponding .prompt.md files in dist/copilot/prompts/
// or directly in a target project's .github/prompts/ directory.
// Normalizes Claude-specific paths and tool calls to universal instructions for Copilot.
//
// Usage:
//   node scripts/sync-copilot.js [--project <project-root>] [--out <output-dir>] [--watch]

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'dist', 'copilot', 'prompts');

// Parse CLI args
const args = process.argv.slice(2);
let targetOutDir = DEFAULT_OUT_DIR;
let projectRoot = null;
let watchMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project' && args[i + 1]) {
    projectRoot = path.resolve(args[i + 1]);
    targetOutDir = path.join(projectRoot, '.github', 'prompts');
    i++;
  } else if (args[i] === '--out' && args[i + 1]) {
    targetOutDir = path.resolve(args[i + 1]);
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
      // Continuation line
      frontmatter[currentKey] += ' ' + line.trim();
    }
  }

  return { frontmatter, body };
}

/**
 * Normalize body content for cross-agent / Copilot compatibility:
 * - Replaces hardcoded `.claude/skills/` with relative or universal references
 * - Normalizes Claude-specific tool directives
 */
function normalizeBodyForCopilot(body, skillName) {
  let transformed = body;

  // 1. Normalize .claude/skills/ paths
  transformed = transformed.replace(/\.claude\/skills\//g, 'skills/');

  // 2. Normalize AskUserQuestion mentions to standard user confirmation
  transformed = transformed.replace(/AskUserQuestion/g, 'user confirmation / prompt');

  return transformed;
}

/**
 * Convert a single SKILL.md to Copilot .prompt.md format
 */
function convertSkillToPrompt(skillDirName, outDir) {
  const skillMdPath = path.join(SKILLS_DIR, skillDirName, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    return false;
  }

  const rawContent = fs.readFileSync(skillMdPath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(rawContent);

  const promptName = frontmatter.name || skillDirName;
  const description = frontmatter.description || `Execute the ${promptName} skill`;
  const normalizedBody = normalizeBodyForCopilot(body, promptName);

  // Copilot prompt format: clean YAML frontmatter with description, followed by body
  const copilotPromptContent = `---
description: "${description.replace(/"/g, '\\"')}"
---

${normalizedBody.trim()}
`;

  const outFile = path.join(outDir, `${promptName}.prompt.md`);
  fs.writeFileSync(outFile, copilotPromptContent, 'utf8');
  return true;
}

/**
 * Sync all skills in the skills/ directory
 */
function syncAllSkills(outDir) {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`Error: skills directory not found at ${SKILLS_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  let count = 0;

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'shared') {
      const ok = convertSkillToPrompt(entry.name, outDir);
      if (ok) count++;
    }
  }

  console.log(`✅ Synced ${count} skills to Copilot prompts at: ${path.relative(REPO_ROOT, outDir) || outDir}`);
}

// Initial Sync
syncAllSkills(targetOutDir);

// Watch mode if requested
if (watchMode) {
  console.log(`👀 Watching ${SKILLS_DIR} for changes... (Press Ctrl+C to stop)`);
  let debounceTimeout = null;
  fs.watch(SKILLS_DIR, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.md')) {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        console.log(`\n🔄 Change detected in ${filename}, re-syncing...`);
        syncAllSkills(targetOutDir);
      }, 200);
    }
  });
}
