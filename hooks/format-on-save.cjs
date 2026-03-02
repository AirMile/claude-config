#!/usr/bin/env node
/**
 * PostToolUse hook: Auto-format files after Write/Edit operations.
 * Reads Claude Code hook JSON from stdin, extracts the file path,
 * and runs the appropriate formatter.
 *
 * Formatter priority:
 *   1. GDScript (.gd) → gdformat
 *   2. Biome (if biome.json exists in project) → npx biome format --write
 *   3. Prettier (fallback for web files) → npx prettier --write
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Extensions supported by Biome and Prettier
const WEB_EXTENSIONS = new Set([
	".js",
	".jsx",
	".ts",
	".tsx",
	".mjs",
	".cjs",
	".css",
	".json",
	".jsonc",
]);

// Extensions only Prettier handles (not Biome)
const PRETTIER_ONLY_EXTENSIONS = new Set([
	".scss",
	".less",
	".md",
	".mdx",
	".html",
	".yml",
	".yaml",
	".graphql",
	".gql",
]);

// GDScript extensions for gdformat
const GDSCRIPT_EXTENSIONS = new Set([".gd"]);

// Cache biome.json detection per cwd
let _biomeDetected = null;
let _biomeCwd = null;

function hasBiome(cwd) {
	if (_biomeCwd === cwd) return _biomeDetected;
	_biomeCwd = cwd;
	_biomeDetected = fs.existsSync(path.join(cwd, "biome.json"));
	return _biomeDetected;
}

function formatWith(command, filePath, cwd) {
	try {
		execSync(`${command} "${filePath}"`, {
			stdio: "pipe",
			timeout: 10000,
			cwd,
		});
	} catch {
		// Formatter failure is non-blocking — skip silently
	}
}

async function main() {
	let input = "";

	// Read JSON from stdin
	for await (const chunk of process.stdin) {
		input += chunk;
	}

	let hookData;
	try {
		hookData = JSON.parse(input);
	} catch {
		process.exit(0);
	}

	const filePath =
		hookData?.tool_input?.file_path || hookData?.tool_input?.path;
	if (!filePath) {
		process.exit(0);
	}

	const ext = path.extname(filePath).toLowerCase();
	const cwd = process.env.PROJECT_DIR || process.cwd();

	if (GDSCRIPT_EXTENSIONS.has(ext)) {
		formatWith("gdformat", filePath, cwd);
	} else if (WEB_EXTENSIONS.has(ext)) {
		if (hasBiome(cwd)) {
			formatWith("npx biome format --write", filePath, cwd);
		} else {
			formatWith("npx prettier --write", filePath, cwd);
		}
	} else if (PRETTIER_ONLY_EXTENSIONS.has(ext)) {
		formatWith("npx prettier --write", filePath, cwd);
	}
}

main();
