# OWASP Top 10:2025 — Compact Reference

## Quick Reference

| Code | Category                           | Risk     | Focus                                          |
| ---- | ---------------------------------- | -------- | ---------------------------------------------- |
| A01  | Broken Access Control              | CRITICAL | Authorization, IDOR, path traversal, SSRF      |
| A02  | Security Misconfiguration          | HIGH     | Headers, defaults, error exposure, permissions |
| A03  | Software Supply Chain Failures     | HIGH     | Dependencies, CI/CD, build integrity           |
| A04  | Cryptographic Failures             | HIGH     | Secrets, encryption, hashing, TLS              |
| A05  | Injection                          | CRITICAL | SQL, Command, XSS, LDAP, template              |
| A06  | Insecure Design                    | MEDIUM   | Business logic, threat modeling                |
| A07  | Authentication Failures            | HIGH     | Sessions, passwords, MFA, brute force          |
| A08  | Software/Data Integrity Failures   | MEDIUM   | Deserialization, unsigned updates              |
| A09  | Security Logging & Alerting        | MEDIUM   | Audit logs, monitoring, alerting               |
| A10  | Mishandling Exceptional Conditions | MEDIUM   | Error handling, crashes, DoS                   |

---

## Secret Detection Patterns

```regex
(?i)(api[_-]?key|apikey|secret|password|token|auth)["\s]*[:=]["\s]*["'][^"']+["']
(?i)sk-[a-zA-Z0-9]{20,}
(?i)ghp_[a-zA-Z0-9]{36}
(?i)-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----
```

---

## Config Files to Check

- `.env`, `.env.production`
- `docker-compose.yml`
- `nginx.conf`, `apache.conf`
- `web.config`
- `package.json`, `requirements.txt`, `composer.json`

---

## Required Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Design Review Checklist

- [ ] Rate limiting on auth endpoints
- [ ] Account lockout after N failures
- [ ] CAPTCHA on public forms
- [ ] UUIDs instead of sequential IDs
- [ ] Principle of least privilege
- [ ] Defense in depth

## Session Security Checklist

- [ ] Secure, HttpOnly, SameSite cookies
- [ ] Session timeout configured
- [ ] Session regeneration on auth state change
- [ ] Strong session secrets
- [ ] No credentials in URLs or logs

## Logging Checklist

- [ ] Log all authentication events (success/failure)
- [ ] Log authorization failures
- [ ] Log input validation failures
- [ ] Never log passwords, tokens, PII
- [ ] Include correlation IDs
- [ ] Centralized log aggregation
- [ ] Alerting on anomalies
