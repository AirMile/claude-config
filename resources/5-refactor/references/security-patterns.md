# Security Patterns Reference

Known vulnerability patterns to check during refactor. Based on Anthropic's security reminder hook.

## Quick Reference

| Pattern | Detection | Risk Level |
|---------|-----------|------------|
| child_process.exec | Substring | High |
| os.system | Substring | High |
| eval() | Substring | High |
| new Function() | Substring | High |
| GitHub Actions injection | Path + content | High |
| innerHTML | Substring | Medium |
| dangerouslySetInnerHTML | Substring | Medium |
| document.write | Substring | Medium |
| pickle | Substring | Medium |

---

## Injection Vulnerabilities

### 1. child_process.exec (Node.js)

**Detection:** Check for substrings `child_process.exec`, `exec(`, `execSync(`

**Risk:** Command injection - user input can execute arbitrary shell commands.

**Unsafe:**
```javascript
exec(`command ${userInput}`)
```

**Safe:**
```javascript
import { execFile } from 'child_process'
execFile('command', [userInput])
```

**Why:** `execFile` doesn't spawn a shell, preventing injection.

---

### 2. os.system (Python)

**Detection:** Check for substrings `os.system`, `from os import system`

**Risk:** Command injection via shell execution.

**Unsafe:**
```python
os.system(f"command {user_input}")
```

**Safe:**
```python
import subprocess
subprocess.run(["command", user_input], shell=False)
```

**Why:** `subprocess.run` with `shell=False` prevents shell injection.

---

### 3. eval() (JavaScript/Python)

**Detection:** Check for substring `eval(`

**Risk:** Arbitrary code execution.

**Unsafe:**
```javascript
eval(userInput)
```

**Safe:**
```javascript
JSON.parse(userInput)  // For data parsing
```

**Why:** `eval` executes any code. Use structured parsing instead.

---

### 4. new Function() (JavaScript)

**Detection:** Check for substring `new Function`

**Risk:** Dynamic code evaluation, similar to eval.

**Unsafe:**
```javascript
const fn = new Function('return ' + userInput)
```

**Safe:** Avoid dynamic function creation. Use predefined functions or safe alternatives.

---

### 5. GitHub Actions Workflow Injection

**Detection:**
- Path check: `.github/workflows/*.yml` or `.github/workflows/*.yaml`
- Content check: Direct use of `${{ github.event.* }}` in `run:` commands

**Risk:** Attacker-controlled input (issue titles, PR descriptions) executed as shell commands.

**Unsafe:**
```yaml
run: echo "${{ github.event.issue.title }}"
```

**Safe:**
```yaml
env:
  TITLE: ${{ github.event.issue.title }}
run: echo "$TITLE"
```

**Dangerous inputs to watch:**
- `github.event.issue.title` / `github.event.issue.body`
- `github.event.pull_request.title` / `github.event.pull_request.body`
- `github.event.comment.body`
- `github.event.review.body`
- `github.event.commits.*.message`
- `github.event.head_commit.message`
- `github.head_ref`

**Reference:** https://github.blog/security/vulnerability-research/how-to-catch-github-actions-workflow-injections-before-attackers-do/

---

## XSS Vulnerabilities

### 6. innerHTML (JavaScript)

**Detection:** Check for substrings `.innerHTML =`, `.innerHTML=`

**Risk:** XSS if content contains user input.

**Unsafe:**
```javascript
element.innerHTML = userInput
```

**Safe:**
```javascript
element.textContent = userInput  // Plain text
// Or use DOMPurify for HTML:
element.innerHTML = DOMPurify.sanitize(userInput)
```

---

### 7. dangerouslySetInnerHTML (React)

**Detection:** Check for substring `dangerouslySetInnerHTML`

**Risk:** XSS in React components.

**Unsafe:**
```jsx
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

**Safe:**
```jsx
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

---

### 8. document.write (JavaScript)

**Detection:** Check for substring `document.write`

**Risk:** XSS and performance issues.

**Unsafe:**
```javascript
document.write(userInput)
```

**Safe:**
```javascript
const element = document.createElement('div')
element.textContent = userInput
document.body.appendChild(element)
```

---

## Deserialization Vulnerabilities

### 9. pickle (Python)

**Detection:** Check for substring `pickle`

**Risk:** Arbitrary code execution when deserializing untrusted data.

**Unsafe:**
```python
import pickle
data = pickle.loads(user_input)
```

**Safe:**
```python
import json
data = json.loads(user_input)
```

**Why:** `pickle` can execute arbitrary code during deserialization. Only use with trusted data.

---

## Usage in Refactor Skill

During Phase 4 (Create Refactor Plan), scan loaded code files for these patterns:

1. Use Grep tool with each substring pattern
2. Check for `.github/workflows/` files and scan for injection patterns
3. Log all matches found
4. Include matches in refactor plan with remediation guidance

Priority order for fixes:
1. Injection (command/code) - highest risk
2. XSS - medium-high risk
3. Deserialization - medium risk
