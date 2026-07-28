# Staging Safety

Run before staging any files — both from the single-commit "stage all" path (SKILL.md Step 2)
and from every commit in a multi-commit split (`multi-commit-split.md` § 3).

**Automatically block staging of:**

```
# Secrets & credentials (NEVER stage)
.env, .env.*, *.env
credentials.json, secrets.json, secrets.yml
*.pem, *.key, *.pfx, *.p12, *.crt
.tfvars, .tfvars.json
config/secrets.yml
**/service-account*.json
```

**Warn for:**

- Large files (>1MB) → show file size
- New file types not yet in `.gitignore`
- Binary files → ask for confirmation

**Warn for tracking removals:**
If `.gitignore` changes cause files to be removed from tracking (`git rm --cached`):

- Show the number of files being removed from tracking
- Show the directories that are affected
- Ask for explicit confirmation via AskUserQuestion
- Suggest doing the tracking removal as a **separate commit** (e.g. `chore: remove X from git tracking`)

**Warn for deletion of critical files:**
If staged changes delete or remove from tracking any of the following files, show an explicit warning and ask for confirmation:

```
CLAUDE.md
.github/**
package.json, package-lock.json
tsconfig.json
vite.config.*, vitest.config.*
.gitignore
```

**`.gitignore` coverage check:**
Before staging, verify that risky file patterns are covered by `.gitignore`. This prevents accidental commits outside this skill (e.g. manual `git add -A`).

1. Read `.gitignore` (if it exists) and collect all patterns
2. Check if the following categories are covered — only flag patterns that are **both missing from `.gitignore` AND actually present** as files/directories in the working tree:

   **Secrets & credentials (from blocklist above):**

   ```
   .env, .env.*, *.key, *.pem, *.pfx, *.p12, *.crt
   credentials.json, secrets.json, secrets.yml
   .tfvars, *.tfvars.json
   **/service-account*.json
   ```

   **Build output:**

   ```
   dist/, build/, out/, .next/, .nuxt/, .output/
   ```

   **Dependencies:**

   ```
   node_modules/, vendor/, __pycache__/, .venv/, venv/
   ```

   **IDE/OS artifacts:**

   ```
   .idea/, .DS_Store, Thumbs.db
   ```

   **Logs:**

   ```
   *.log, npm-debug.log*
   ```

3. If missing patterns are found that match existing files/directories, show them grouped by category and ask via AskUserQuestion:
   - header: ".gitignore"
   - question: "These patterns are missing from .gitignore but exist in your working tree:\n\n[list per category]\n\nDo you want to add them?"
   - options:
     - "Add all (Recommended)" → append all missing patterns to `.gitignore`
     - "Let me pick" → show each pattern individually for yes/no
     - "Skip" → continue without changes
4. If patterns were added: stage the updated `.gitignore` file (`git add .gitignore`) so it's included in the commit
