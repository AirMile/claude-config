#!/usr/bin/env python3
"""
PreToolUse hook: waarschuw Claude bij riskante patronen in Write/Edit/MultiEdit.

Smal pattern-set (high-signal, lage false positive rate):
  - eval( / new Function(             → code injection
  - dangerouslySetInnerHTML            → XSS
  - ${{ github.event.* }} in run:      → workflow injection
  - pickle.load(s) op untrusted data   → deserialization

Filters: skip test/build/vendor paths. Per sessie + regel dedup.
Niet-blokkerend: exit code altijd 0.
"""

import json
import os
import re
import sys
import time
from pathlib import Path

CACHE_DIR = Path.home() / ".claude" / ".cache"
CACHE_TTL_SECONDS = 7 * 24 * 3600

PATH_SKIP_PATTERNS = [
    r"/node_modules/",
    r"/\.git/",
    r"/dist/",
    r"/build/",
    r"/out/",
    r"/\.next/",
    r"/coverage/",
    r"/vendor/",
    r"/\.venv/",
    r"/venv/",
    r"/__pycache__/",
    r"\.test\.",
    r"\.spec\.",
    r"/tests?/",
    r"/__tests__/",
    r"/__mocks__/",
]

RULES = [
    {
        "name": "eval_injection",
        "extensions": {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py"},
        "regex": re.compile(r"\beval\s*\("),
        "message": (
            "eval() voert willekeurige code uit en is een major security risk. "
            "Overweeg JSON.parse() voor data, of een ander design patroon. "
            "Alleen gebruiken als arbitraire code-evaluatie écht nodig is."
        ),
    },
    {
        "name": "new_function_injection",
        "extensions": {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"},
        "regex": re.compile(r"\bnew\s+Function\s*\("),
        "message": (
            "new Function() met dynamische strings kan code injection veroorzaken. "
            "Overweeg een aanpak die geen arbitraire code evalueert."
        ),
    },
    {
        "name": "react_dangerous_html",
        "extensions": {".jsx", ".tsx", ".js", ".ts"},
        "regex": re.compile(r"dangerouslySetInnerHTML"),
        "message": (
            "dangerouslySetInnerHTML kan XSS veroorzaken bij untrusted content. "
            "Sanitize via DOMPurify of gebruik veilige alternatieven."
        ),
    },
    {
        "name": "github_actions_injection",
        "path_check": lambda p: ".github/workflows/" in p
        and (p.endswith(".yml") or p.endswith(".yaml")),
        "regex": re.compile(
            r"run:[^\n]*\$\{\{\s*github\.(event|head_ref|pull_request)\.",
            re.MULTILINE,
        ),
        "message": (
            "Workflow injection risk: ${{ github.event.* }} in een run: block "
            "kan command injection veroorzaken. Gebruik env: met quoted vars:\n"
            "  env:\n    TITLE: ${{ github.event.issue.title }}\n  run: echo \"$TITLE\""
        ),
    },
    {
        "name": "pickle_deserialization",
        "extensions": {".py"},
        "regex": re.compile(r"\bpickle\.loads?\s*\("),
        "message": (
            "pickle.load/loads op untrusted content kan arbitrary code execution "
            "veroorzaken. Gebruik JSON of een ander veilig serialisatieformaat."
        ),
    },
]


def should_skip_path(file_path: str) -> bool:
    return any(re.search(p, file_path) for p in PATH_SKIP_PATTERNS)


def get_content(tool_input: dict) -> str:
    parts = []
    for key in ("content", "new_string"):
        v = tool_input.get(key)
        if isinstance(v, str):
            parts.append(v)
    edits = tool_input.get("edits")
    if isinstance(edits, list):
        for e in edits:
            if isinstance(e, dict) and isinstance(e.get("new_string"), str):
                parts.append(e["new_string"])
    return "\n".join(parts)


def cleanup_old_cache():
    if not CACHE_DIR.exists():
        return
    cutoff = time.time() - CACHE_TTL_SECONDS
    for f in CACHE_DIR.glob("security-warnings-*.json"):
        try:
            if f.stat().st_mtime < cutoff:
                f.unlink()
        except OSError:
            pass


def load_seen(session_id: str) -> set:
    path = CACHE_DIR / f"security-warnings-{session_id}.json"
    if not path.exists():
        return set()
    try:
        return set(json.loads(path.read_text()))
    except (json.JSONDecodeError, OSError):
        return set()


def save_seen(session_id: str, seen: set):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"security-warnings-{session_id}.json"
    try:
        path.write_text(json.dumps(sorted(seen)))
    except OSError:
        pass


def check_rules(file_path: str, content: str) -> list:
    ext = os.path.splitext(file_path)[1].lower()
    hits = []
    for rule in RULES:
        if "path_check" in rule:
            if not rule["path_check"](file_path):
                continue
        elif "extensions" in rule:
            if ext not in rule["extensions"]:
                continue
        if rule["regex"].search(content):
            hits.append(rule)
    return hits


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    tool_input = data.get("tool_input") or {}
    file_path = tool_input.get("file_path") or tool_input.get("path") or ""
    if not file_path or should_skip_path(file_path):
        sys.exit(0)

    content = get_content(tool_input)
    if not content:
        sys.exit(0)

    hits = check_rules(file_path, content)
    if not hits:
        sys.exit(0)

    cleanup_old_cache()
    session_id = data.get("session_id") or "default"
    seen = load_seen(session_id)

    new_hits = [r for r in hits if r["name"] not in seen]
    if not new_hits:
        sys.exit(0)

    for rule in new_hits:
        seen.add(rule["name"])
    save_seen(session_id, seen)

    warnings = "\n\n".join(f"⚠️  {r['message']}" for r in new_hits)
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": f"Security reminder ({len(new_hits)} pattern(s) detected):\n\n{warnings}",
        }
    }
    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
