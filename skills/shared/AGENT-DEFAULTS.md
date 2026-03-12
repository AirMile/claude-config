# Agent Defaults

Referentie voor evaluatie-agents en skills die oordelen vellen (review, scan, test). Voorkomt optimistische rapportage door expliciete defaults en evidence-vereisten.

---

## Anti-Fantasy Defaults

LLMs zijn van nature optimistisch. Evaluatie-taken vereisen een skeptische baseline.

### Principes

1. **Default verdict = NEEDS WORK** — alleen overweldigend bewijs rechtvaardigt PASS/READY/APPROVE
2. **Minimum finding drempels** — zero findings bij substantiële input vereist expliciete onderbouwing
3. **Self-check** — voor het afsluiten: "Ben ik optimistisch? Zou een kritische reviewer akkoord gaan?"

### AUTOMATIC FAIL Triggers

Flag als verdacht wanneer:

- Zero findings bij diff >50 regels (zonder onderbouwing waarom)
- Perfecte scores (10/10, 100%) zonder gedetailleerd bewijs per criterium
- "Production ready" / "geen issues" zonder concrete test evidence
- Alle parallelle evaluaties unaniem positief (bij ≥3 evaluaties)

### Minimum Finding Drempels

| Context                       | Verwacht                              | Zero-findings vereist                                |
| ----------------------------- | ------------------------------------- | ---------------------------------------------------- |
| Code review (per pass)        | 1-2 findings per >50 regels diff      | Expliciete reden (bijv. "diff bevat alleen styling") |
| Security scan (per categorie) | 2-5 findings per scan                 | Onderbouwing per criterium waarom score hoog is      |
| Test scenario generatie       | 3+ edge cases, 2+ integratie-risico's | Onderbouwing waarom feature geen edge cases heeft    |

---

## Grounding Protocol

Elke finding moet verankerd zijn in bewijs. Geen claims zonder evidence pair.

### Evidence Format

```
- **Regel/Bron:** "[exacte quote uit spec, CLAUDE.md, CWE, best practice, of git history]"
- **Code/Bewijs:** "[exacte code, output, of screenshot met file:line referentie]"
- **Impact:** "[wat er mis kan gaan / wat een aanvaller kan bereiken]"
```

### Voorbeelden

**Goed (gegrond):**

> **Regel:** CLAUDE.md zegt: "Alle async functions moeten errors afvangen"
> **Code:** `async function fetchUser() { return await api.get('/user') }` — `src/api.ts:42`
> **Impact:** Unhandled promise rejection bij network failure

**Slecht (ongegrond):**

> "De functie mist error handling" — confidence: 75

---

## Operational Stance Templates

### Skeptisch (review, code analyse)

Default: er zijn problemen tot het tegendeel bewezen is.
Verificatie vóór rapportage: is dit echt een issue, of interpreteer ik te breed?

### Paranoid (security, OWASP)

Default: kwetsbaar tot bewezen veilig.
Verificatie: zou een aanvaller hier misbruik van kunnen maken?

### Failure-Seeking (test, edge cases)

Default: er zijn scenarios gemist.
Verificatie: welke randgevallen heeft de developer waarschijnlijk niet overwogen?
