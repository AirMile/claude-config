---
description: Commit changes met automatisch gegenereerde message
---

# Commit

Analyseer staged changes en genereer een duidelijke commit message.

## Trigger

`/commit` of `/commit [extra context]`

## Process

### 1. Pre-flight Checks

Voer parallel uit:
- `git status` - bekijk staged/unstaged changes
- `git diff --cached` - bekijk staged changes (of `git diff` als niets staged)

**Stop condities** (meld en exit):
- Geen changes → "Geen wijzigingen om te committen"
- Rebase in progress → "Rebase actief, los eerst op met `git rebase --continue` of `--abort`"
- Merge in progress → "Merge conflict actief, los eerst op"
- Cherry-pick in progress → "Cherry-pick actief, los eerst op"

**Detectie rebase/merge state:**
```bash
# Check voor actieve operaties
ls .git/rebase-merge .git/rebase-apply .git/MERGE_HEAD .git/CHERRY_PICK_HEAD 2>/dev/null
```

### 2. Stage Changes (indien nodig)

Als er unstaged changes zijn maar niets staged:
- Toon overzicht van unstaged files

**Blokkeer automatisch stagen van:**
```
# Secrets & credentials (NOOIT stagen)
.env, .env.*, *.env
credentials.json, secrets.json, secrets.yml
*.pem, *.key, *.pfx, *.p12, *.crt
.tfvars, .tfvars.json
config/secrets.yml
**/service-account*.json
```

**Waarschuw bij:**
- Grote files (>1MB) → toon bestandsgrootte
- Nieuwe file types die nog niet in `.gitignore` staan
- Binary files → vraag bevestiging

- Vraag: "Stage all changes?" (met AskUserQuestion)
- Bij ja: `git add -A`

### 3. Analyze Changes

Analyseer de diff op:

**Type** (Conventional Commits):
| Type | Gebruik | SemVer |
|------|---------|--------|
| `feat` | Nieuwe feature | MINOR |
| `fix` | Bug fix | PATCH |
| `docs` | Alleen documentatie | - |
| `style` | Formatting, whitespace | - |
| `refactor` | Code refactoring | - |
| `perf` | Performance verbetering | PATCH |
| `test` | Tests toevoegen/fixen | - |
| `build` | Build system, dependencies | - |
| `ci` | CI/CD configuratie | - |
| `chore` | Overige taken | - |
| `revert` | Revert vorige commit | - |

**Scope**: Component/module naam (optioneel)
**Breaking change**: Voeg ! toe na type voor breaking changes

### 4. Generate Message

**Formaat (Conventional Commits 1.0.0):**
```
<type>[optional scope][!]: <description>

[optional body]

[optional footer(s)]
```

**Validatieregels:**
- Header max **72 karakters** (Git conventie)
- Type: lowercase, uit toegestane lijst
- Subject: lowercase start, geen punt aan einde, imperatief ("add" niet "added")
- Body: lege regel na header, leg "waarom" uit niet "wat"
- Breaking change: gebruik ! of BREAKING CHANGE: footer

**Voorbeelden:**
```
feat(auth): add OAuth2 login support

fix!: resolve race condition in request handling

docs: update API documentation for v2 endpoints
```

**Niet toestaan:**
- "Co-Authored-By" of "Generated with Claude" footer
- Emoji's in commit messages
- Subject langer dan 72 karakters

### 5. Confirm & Commit

Toon gegenereerde message en vraag bevestiging:
- "Commit" → voer commit uit
- "Edit" → laat user aanpassen
- "Cancel" → annuleer

**Commit uitvoeren met HEREDOC** (veilig voor quotes en multiline):
```bash
git commit -m "$(cat <<'EOF'
<message>
EOF
)"
```

### 6. Error Handling

**Pre-commit hook failure:**
1. Toon volledige error output
2. Vraag gebruiker (AskUserQuestion):
   - "Fix issues" → los probleem op, **maak NIEUWE commit** (nooit amend op failure)
   - "Skip hooks" → `HUSKY=0 git commit ...` of `git commit --no-verify`
   - "Cancel" → annuleer

**Hook bypass waarschuwing:**
```
⚠️ Hooks worden overgeslagen. Dit kan CI failures veroorzaken.
```

**Andere failures:**
- Empty commit → "Geen staged changes. Gebruik `git add` eerst."
- Lock file exists → "Git is bezig (.git/index.lock). Wacht of verwijder lock."

**Bij succes:**
```bash
git log -1 --oneline
```

### 7. Amend Safety (ALLEEN indien user vraagt)

**Amend ALLEEN toestaan wanneer ALLE voorwaarden waar zijn:**
1. User vraagt expliciet om amend
2. Vorige commit is door jou gemaakt (check: `git log -1 --format='%an'`)
3. Commit is NIET gepusht naar remote (check: `git status` toont "ahead")
4. Het is GEEN recovery van een gefaalde commit

**Bij twijfel:** Maak nieuwe commit, nooit amend.

## Output

**Succes:**
```
✅ Committed: <type>(<scope>): <title>

   [hash] op branch [branch-name]
   [+X -Y files changed]
```

**Error:**
```
❌ Commit failed: <reden>

   💡 <suggestie voor oplossing>
```

**Hook skipped:**
```
⚠️ Committed (hooks skipped): <type>(<scope>): <title>

   [hash] op branch [branch-name]
```
