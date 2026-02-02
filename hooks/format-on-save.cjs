#!/usr/bin/env node
/**
 * PostToolUse hook: Auto-format files after Write/Edit operations.
 * Reads Claude Code hook JSON from stdin, extracts the file path,
 * and runs Prettier on supported file types.
 */

const { execSync } = require('child_process');
const path = require('path');

// Supported extensions for Prettier
const SUPPORTED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.css', '.scss', '.less',
  '.json', '.jsonc',
  '.md', '.mdx',
  '.html', '.yml', '.yaml',
  '.graphql', '.gql'
]);

async function main() {
  let input = '';

  // Read JSON from stdin
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch {
    // Not valid JSON — skip silently
    process.exit(0);
  }

  // Extract file path from the hook data
  const filePath = hookData?.tool_input?.file_path || hookData?.tool_input?.path;
  if (!filePath) {
    process.exit(0);
  }

  // Check if file extension is supported
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    process.exit(0);
  }

  // Run Prettier
  try {
    execSync(`npx prettier --write "${filePath}"`, {
      stdio: 'pipe',
      timeout: 10000,
      cwd: process.env.PROJECT_DIR || process.cwd()
    });
  } catch {
    // Formatter failure is non-blocking — skip silently
    process.exit(0);
  }
}

main();
