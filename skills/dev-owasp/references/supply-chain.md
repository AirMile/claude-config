# Supply-chain & SAST tooling — dev-owasp PHASE 2b

Open-source SAST + supply-chain scanning on top of the LLM-driven OWASP scanners. Motivation: the A03 (Supply Chain) scanner is pattern-based and misses real-world CVE data and malicious-package signals. The Qix/chalk-debug compromise (Sep 2025, ~2.6 billion weekly downloads) is a concrete example where OSV-Scanner picked it up within hours. Semgrep CE catches code-level anti-patterns with a faster ruleset than an LLM pass.

---

## Tooling

| Tool                     | Purpose                                        | License      | Run-mode                                |
| ------------------------ | ---------------------------------------------- | ------------ | --------------------------------------- |
| **OSV-Scanner V2**       | Known-vuln detection via lockfiles + container | Apache 2.0   | `osv-scanner --format=json scan source` |
| **Semgrep CE**           | Semantic SAST, 30+ languages, YAML rules       | LGPL         | `semgrep ci --json`                     |
| (optional) **npm audit** | NPM-specific audit trail                       | Built-in npm | `npm audit --json --omit=dev`           |

**Default recommendation for solo-dev:** OSV-Scanner + Semgrep CE. `npm audit` as a 3rd layer — short, noisy, sometimes still useful.

---

## Steps

### 1. Detect package ecosystem

```bash
# Which lockfiles exist?
ls package-lock.json yarn.lock pnpm-lock.yaml Cargo.lock go.sum requirements.txt poetry.lock composer.lock Gemfile.lock 2>/dev/null
```

OSV-Scanner V2 supports 19+ lockfile types + 11+ ecosystems. If there is no lockfile: skip with log "no lockfile, supply-chain skip".

### 2. Run OSV-Scanner

```bash
# First run (install if needed — not an npm package, its own binary)
which osv-scanner || echo "Install: brew install osv-scanner OR go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest"

# Actual scan
osv-scanner --format=json scan source ./ > .project/owasp/osv-report.json 2> .project/owasp/osv-stderr.log
```

Parse `osv-report.json` → `results[].packages[].vulnerabilities[]`. Per vuln: `id` (CVE/GHSA), `severity`, `summary`, `affected_versions`, `fixed_version`.

### 3. Run Semgrep CE

```bash
which semgrep || echo "Install: pip install semgrep OR brew install semgrep"

# Community ruleset (free, no account)
semgrep ci --config auto --json > .project/owasp/semgrep-report.json 2>&1
```

`--config auto` uses Semgrep's free community ruleset (language-detected). For headless agents: `--json --quiet`.

### 4. Merge into OWASP findings

Add supply-chain findings to the PHASE 3 aggregation as category `A03` (Supply Chain), severity mapping:

| OSV severity | OWASP severity |
| ------------ | -------------- |
| CRITICAL     | CRITICAL       |
| HIGH         | HIGH           |
| MODERATE/MED | MEDIUM         |
| LOW          | LOW            |

For Semgrep findings: use Semgrep's `severity` field as-is, map to the OWASP category via the rule's `metadata.category` (often e.g. `security`, `injection`).

### 5. Threshold + fix strategy

- **CRITICAL OSV vuln with `fixed_version` available** → automatically add to the Minimal strategy (PHASE 4) as "upgrade `{pkg}` to `{fixed_version}`".
- **HIGH OSV vuln without a fix** → Pragmatic strategy + observation "no upstream fix — consider replacement of `{pkg}`".
- **Semgrep findings**: triage manually due to the high FP rate (~75% according to the "Sifting the Noise" benchmark). Mark as `confidence: low` unless the rule is high-precision.

---

## Guided remediation (OSV-Scanner `fix`)

```bash
osv-scanner fix --strategy=in-place -L package-lock.json --non-interactive
```

`--strategy=in-place` only upgrades patch/minor (semver-safe). For major bumps, run `--strategy=relax` first with user confirmation. **Do not run on untrusted code without review** — scripts can trigger.

---

## Anti-patterns

- **Tool sprawl.** Keep it to 2-3 scanners. Four+ leads to triage fatigue.
- **`npm audit` as the only layer.** Misses a lot, produces noise, no prioritization.
- **Treating all Semgrep findings as blockers.** ~75% FP rate on the OWASP Benchmark — triage first.
- **`osv-scanner fix` without lockfile review.** Can trigger major upgrades that break things.
- **Running OSV and Semgrep through the same report pipe.** Split stdout/stderr per tool — otherwise debugging is a nightmare.

---

## Caveats

- Real-time malicious-package detection (Socket.dev level) has no fully-fledged OSS equivalent. OSV.dev's feed is after-the-fact — known-after-publication. Mitigation: `npm install --cooldown=24h` (minimum release age, available in npm 11+) so that a just-published malicious package gets quarantined.
- CodeQL is free for public repos but requires GitHub Advanced Security for private ones — hence the preference for Semgrep for private/solo.
- Semgrep CE rules are free; Semgrep Pro rules are paid. The CE set is generally sufficient for solo-dev.
