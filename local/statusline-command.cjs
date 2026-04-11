#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const data = JSON.parse(input);
  const dir = data.workspace?.current_dir || data.cwd || "~";
  const used = data.context_window?.used_percentage;

  const repo = path.basename(dir);
  let branch = "";
  try {
    branch = execSync("git symbolic-ref --short HEAD 2>/dev/null", {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    }).trim();
  } catch {}

  let out = repo;
  if (branch) out += ` | ${branch}`;
  if (used != null) out += ` | ${Math.floor(used)}%`;
  console.log(out);
});
