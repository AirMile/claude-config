# OWASP Top 10:2025 Reference

Source: [OWASP Top 10:2025 Release Candidate](https://owasp.org/Top10/2025/)

---

## Quick Reference

| Code | Category | Risk Level | Focus |
|------|----------|------------|-------|
| A01 | Broken Access Control | CRITICAL | Authorization, IDOR, path traversal, SSRF |
| A02 | Security Misconfiguration | HIGH | Headers, defaults, error exposure, permissions |
| A03 | Software Supply Chain Failures | HIGH | Dependencies, CI/CD, build integrity |
| A04 | Cryptographic Failures | HIGH | Secrets, encryption, hashing, TLS |
| A05 | Injection | CRITICAL | SQL, Command, XSS, LDAP, template |
| A06 | Insecure Design | MEDIUM | Business logic, threat modeling |
| A07 | Authentication Failures | HIGH | Sessions, passwords, MFA, brute force |
| A08 | Software/Data Integrity Failures | MEDIUM | Deserialization, unsigned updates |
| A09 | Security Logging & Alerting Failures | MEDIUM | Audit logs, monitoring, alerting |
| A10 | Mishandling Exceptional Conditions | MEDIUM | Error handling, crashes, DoS |

---

## A01:2025 - Broken Access Control

**Description:** Unauthorized access to resources or functionality. Users can act outside their intended permissions.

**What to scan:**
- Missing authorization checks on endpoints
- IDOR (Insecure Direct Object References)
- Path traversal (`../`, `..\\`)
- CORS misconfiguration
- JWT validation bypass
- SSRF (Server-Side Request Forgery) - moved here from A10:2021

**Patterns to detect:**

```javascript
// IDOR - direct ID usage without ownership check
app.get('/user/:id', (req, res) => {
  return db.users.find(req.params.id)  // No authz check!
})

// Path traversal
fs.readFile(userInput)  // No sanitization
path.join(basePath, userInput)  // Can escape with ../
```

```python
# SSRF
requests.get(user_provided_url)  # No URL validation
urllib.request.urlopen(url)
```

```php
// Missing authorization
$user = User::find($request->id);  // No ownership check
file_get_contents($userInput);  // Path traversal / SSRF
```

**Fix patterns:**
- Always verify resource ownership
- Use allowlists for URLs (SSRF)
- Sanitize path inputs
- Implement RBAC/ABAC

---

## A02:2025 - Security Misconfiguration

**Description:** Improper system setup, insecure defaults, verbose errors, unnecessary features enabled.

**What to scan:**
- Default credentials
- Verbose error messages in production
- Missing security headers
- Unnecessary HTTP methods enabled
- Directory listing enabled
- Debug mode in production

**Patterns to detect:**

```yaml
# Docker/K8s misconfigs
privileged: true
runAsRoot: true
allowPrivilegeEscalation: true
```

```javascript
// Debug mode
app.use(errorHandler({ dumpExceptions: true }))
DEBUG=true
NODE_ENV=development  // in production
```

```python
# Django
DEBUG = True  # in production
ALLOWED_HOSTS = ['*']
```

```php
// Laravel
APP_DEBUG=true  // in production
'debug' => true
```

**Config files to check:**
- `.env`, `.env.production`
- `docker-compose.yml`
- `nginx.conf`, `apache.conf`
- `web.config`
- Security headers in responses

**Required headers:**
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: ...
Strict-Transport-Security: max-age=...
```

---

## A03:2025 - Software Supply Chain Failures

**Description:** Vulnerabilities in development and deployment pipeline - dependencies, build process, CI/CD.

**What to scan:**
- Vulnerable dependencies (npm audit, composer audit, pip-audit)
- Unpinned dependency versions
- CI/CD pipeline injection
- Unsigned artifacts
- Compromised build scripts

**Patterns to detect:**

```json
// package.json - unpinned versions
{
  "dependencies": {
    "lodash": "*",        // Any version - dangerous
    "express": "^4.0.0",  // Major unpinned
    "axios": "latest"     // Floating version
  }
}
```

```yaml
# GitHub Actions injection
run: echo "${{ github.event.issue.title }}"  # Injection!

# Unsafe artifact download
- uses: actions/download-artifact@v3
  # No hash verification
```

```dockerfile
# Unpinned base image
FROM node:latest  # Should pin version + digest
FROM python       # No version at all
```

**Fix patterns:**
- Pin all dependency versions with lockfiles
- Use dependency scanning (Dependabot, Snyk, etc.)
- Sign commits and artifacts
- Verify checksums of downloads
- Use environment variables for GH Actions inputs

---

## A04:2025 - Cryptographic Failures

**Description:** Inadequate encryption, weak algorithms, exposed secrets, improper key management.

**What to scan:**
- Hardcoded secrets/API keys
- Weak hashing (MD5, SHA1 for passwords)
- Weak encryption (DES, RC4)
- Missing encryption for sensitive data
- Improper TLS configuration

**Patterns to detect:**

```javascript
// Hardcoded secrets
const API_KEY = "sk-1234567890"
const password = "admin123"
jwt.sign(payload, "secret")  // Hardcoded JWT secret

// Weak hashing
crypto.createHash('md5')
crypto.createHash('sha1')
```

```python
# Weak hashing
hashlib.md5(password)
hashlib.sha1(password)

# Hardcoded secrets
SECRET_KEY = "hardcoded-secret"
```

```php
// Weak hashing
md5($password)
sha1($password)

// Should use
password_hash($password, PASSWORD_BCRYPT)
```

**Files to scan for secrets:**
- `.env*` files
- `config/*.json`
- `*.yml`, `*.yaml`
- Source code (grep for patterns)

**Secret patterns:**
```regex
(?i)(api[_-]?key|apikey|secret|password|token|auth)["\s]*[:=]["\s]*["'][^"']+["']
(?i)sk-[a-zA-Z0-9]{20,}
(?i)ghp_[a-zA-Z0-9]{36}
(?i)-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----
```

---

## A05:2025 - Injection

**Description:** Malicious input interpreted as commands/queries. Includes SQL, Command, XSS, LDAP, template injection.

**What to scan:**
- SQL query construction with user input
- Command execution with user input
- HTML output without encoding (XSS)
- Template rendering with user input
- LDAP queries with user input

**Patterns to detect:**

```javascript
// SQL Injection
db.query(`SELECT * FROM users WHERE id = ${userId}`)
db.query("SELECT * FROM users WHERE id = " + userId)

// Command Injection
exec(`command ${userInput}`)
execSync(userInput)
child_process.spawn('sh', ['-c', userInput])

// XSS
element.innerHTML = userInput
document.write(userInput)
dangerouslySetInnerHTML={{ __html: userInput }}
```

```python
# SQL Injection
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")
cursor.execute("SELECT * FROM users WHERE id = " + user_id)

# Command Injection
os.system(f"command {user_input}")
subprocess.call(user_input, shell=True)

# Template Injection
render_template_string(user_input)
Template(user_input).render()
```

```php
// SQL Injection
$query = "SELECT * FROM users WHERE id = " . $_GET['id'];
mysqli_query($conn, $query);

// Command Injection
exec($_GET['cmd']);
shell_exec($userInput);
system($userInput);
```

**Fix patterns:**
- Use parameterized queries / prepared statements
- Use ORM methods
- Use `execFile` instead of `exec`
- Use `subprocess.run(..., shell=False)`
- Use template auto-escaping
- Use `textContent` instead of `innerHTML`

---

## A06:2025 - Insecure Design

**Description:** Fundamental flaws in architecture, missing security controls by design, inadequate threat modeling.

**What to scan:**
- Missing rate limiting
- No account lockout
- Predictable resource IDs
- Missing input validation at design level
- No separation of privileges
- Trust boundaries not defined

**Patterns to detect:**

```javascript
// No rate limiting on sensitive endpoints
app.post('/login', loginHandler)  // No limiter
app.post('/forgot-password', forgotHandler)  // No limiter

// Sequential/predictable IDs
const orderId = lastOrderId + 1
```

```python
# No account lockout
def login(username, password):
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        return success
    return failure  # No tracking of failures
```

**Design review checklist:**
- [ ] Rate limiting on auth endpoints
- [ ] Account lockout after N failures
- [ ] CAPTCHA on public forms
- [ ] UUIDs instead of sequential IDs
- [ ] Principle of least privilege
- [ ] Defense in depth

---

## A07:2025 - Authentication Failures

**Description:** Weaknesses in user identity verification - weak passwords, session issues, missing MFA.

**What to scan:**
- Weak password policies
- Session fixation vulnerabilities
- Missing session timeout
- Credentials in URL
- Missing MFA on sensitive operations
- Brute force vulnerability

**Patterns to detect:**

```javascript
// Weak session config
app.use(session({
  secret: 'keyboard cat',  // Weak secret
  cookie: { secure: false }  // Not HTTPS-only
}))

// Credentials in URL
redirect(`/dashboard?token=${token}`)
```

```python
# Session without timeout
session.permanent = True  # No expiry

# Weak password validation
if len(password) >= 4:  # Too short
    create_user(password)
```

```php
// Session fixation
session_start();
// No session regeneration after login
$_SESSION['user'] = $user;

// Should do:
session_regenerate_id(true);
```

**Session security checklist:**
- [ ] Secure, HttpOnly, SameSite cookies
- [ ] Session timeout configured
- [ ] Session regeneration on auth state change
- [ ] Strong session secrets
- [ ] No credentials in URLs or logs

---

## A08:2025 - Software or Data Integrity Failures

**Description:** Compromised updates, unsigned code, insecure deserialization, CI/CD integrity issues.

**What to scan:**
- Unsafe deserialization
- Unsigned auto-updates
- Unverified downloads
- Missing integrity checks (SRI)

**Patterns to detect:**

```javascript
// Unsafe deserialization
const obj = eval('(' + jsonString + ')')
new Function('return ' + userInput)()

// Missing SRI
<script src="https://cdn.example.com/lib.js"></script>  // No integrity attr
```

```python
# Unsafe deserialization
pickle.loads(user_data)  # Arbitrary code execution
yaml.load(user_data)  # Use yaml.safe_load
```

```php
// Unsafe deserialization
unserialize($userInput);  // Object injection

// Should use
json_decode($userInput);
```

**Fix patterns:**
- Never deserialize untrusted data with pickle/unserialize
- Use JSON for data exchange
- Add SRI attributes to external scripts
- Verify signatures on updates
- Use lockfiles with integrity hashes

---

## A09:2025 - Security Logging and Alerting Failures

**Description:** Inadequate monitoring, missing audit logs, no alerting on security events.

**What to scan:**
- Missing logging on auth events
- Sensitive data in logs
- No alerting configured
- Logs not protected
- Missing correlation IDs

**Patterns to detect:**

```javascript
// Logging sensitive data
logger.info(`User login: ${username}, password: ${password}`)
console.log(req.body)  // May contain secrets

// Missing auth event logging
async function login(user, pass) {
  // No logging of attempt
  return authenticate(user, pass)
}
```

```python
# Sensitive data in logs
logging.info(f"API call with key: {api_key}")
print(request.json)  # Debug logging in production
```

**Logging checklist:**
- [ ] Log all authentication events (success/failure)
- [ ] Log authorization failures
- [ ] Log input validation failures
- [ ] Never log passwords, tokens, PII
- [ ] Include correlation IDs
- [ ] Centralized log aggregation
- [ ] Alerting on anomalies

---

## A10:2025 - Mishandling of Exceptional Conditions

**Description:** Poor error handling leading to crashes, unexpected behavior, information disclosure, DoS.

**What to scan:**
- Unhandled exceptions
- Verbose error messages to users
- Missing try/catch on external calls
- Resource exhaustion vulnerabilities
- Crash on malformed input

**Patterns to detect:**

```javascript
// Unhandled promise rejection
fetch(url).then(response => process(response))
// Missing .catch()

// Verbose errors
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.stack })  // Stack trace exposed
})

// No input limits
app.use(express.json())  // No size limit - DoS risk
```

```python
# Missing exception handling
data = json.loads(user_input)  # Can crash on invalid JSON

# Verbose errors
except Exception as e:
    return str(e)  # Exposes internals
```

```php
// Unhandled exceptions
$data = json_decode($input);
$result = $data->field;  // Null pointer if invalid JSON

// Verbose errors
ini_set('display_errors', 1);  // In production
```

**Fix patterns:**
- Wrap external calls in try/catch
- Return generic error messages to users
- Log detailed errors server-side
- Set input size limits
- Implement circuit breakers
- Graceful degradation

---

## Agent Instructions

Each OWASP agent receives this reference plus specific instructions:

**Agent prompt template:**
```
You are scanning for OWASP {CODE}: {CATEGORY}

Reference patterns: [relevant section from this file]

Files to scan: [file list]

Your mission:
1. Scan all files for patterns listed above
2. Use Grep to find matches
3. Read matched files for context
4. Assess severity (CRITICAL/HIGH/MEDIUM/LOW)
5. Provide specific fix recommendations

Output format:
{
  "category": "A0X",
  "findings": [
    {
      "file": "path/to/file.js",
      "line": 42,
      "severity": "HIGH",
      "issue": "Description of issue",
      "code_snippet": "affected code",
      "fix": "How to fix",
      "cwe": "CWE-XXX"
    }
  ],
  "summary": "X findings (Y critical, Z high)"
}
```

---

## Sources

- [OWASP Top 10:2025 Release Candidate](https://owasp.org/Top10/2025/)
- [OWASP Top 10 2025 vs 2021 Comparison](https://equixly.com/blog/2025/12/01/owasp-top-10-2025-vs-2021/)
- [OWASP Top 10 2025 Key Changes](https://orca.security/resources/blog/owasp-top-10-2025-key-changes/)
