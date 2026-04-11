#!/usr/bin/env node
/**
 * UserPromptSubmit hook: records timestamp per session.
 * Used by other hooks to calculate elapsed time.
 */

const fs = require("fs");
const path = require("path");

function getStateFile(sessionId) {
  return path.join(
    require("os").tmpdir(),
    `.claude-prompt-state-${sessionId}.json`,
  );
}

async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let sessionId;
  try {
    sessionId = JSON.parse(input).session_id;
  } catch {}
  if (!sessionId) process.exit(0);

  fs.writeFileSync(
    getStateFile(sessionId),
    JSON.stringify({ timestamp: Date.now() }),
    "utf8",
  );
}

main();
