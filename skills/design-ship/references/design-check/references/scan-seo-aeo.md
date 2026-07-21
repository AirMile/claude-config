# SEO + AEO Scan

Loaded when scope contains **SEO** and/or **AEO**.

## SEO Scan

Per route, check:

**Critical:** Page titles (S001), meta descriptions (S002), rendering (S003 — validate SSR via
`playwright-cli snapshot` **+ content-endpoint check via `requests`/`request <i>` to prove content
doesn't come from a fallback due to a failing API**; `playwright-cli` daemon by default — scriptable
per-route scan, see `shared/BROWSER-VEHICLES.md`), robots config (S004).

**Important:** Open Graph (S101), canonical URLs (S102), sitemap (S103), robots.txt (S104), heading hierarchy (H002/H003), image alt text (R002).

**Enhancement:** Structured data / JSON-LD (S201), Twitter cards (S202), dynamic OG images (S203).

Use Context7 to research framework-specific SEO APIs before recommending fixes.

## AEO Scan (AI Search Optimization)

Optimize for AI answer engines (ChatGPT Search, Perplexity, Google AI Overviews, Gemini).

**Crawlability:**

- AE001: AI bot access — check robots.txt for ChatGPT-User, PerplexityBot, Google-Extended, Anthropic
- AE002: Structured content — semantic HTML (article, section, aside, nav) vs div soup
- AE003: Clear content hierarchy — H1 → H2 → H3 with logical grouping

**Answerability:**

- AE101: FAQ sections — question-answer pairs that AI can extract
- AE102: FAQ Schema (FAQPage JSON-LD) — structured data for Q&A
- AE103: HowTo Schema — step-by-step instructions as JSON-LD
- AE104: Concise definitions — key terms defined in first paragraph or summary
- AE105: TL;DR / summary sections — scannable summaries at top of content

**Citations:**

- AE201: Author/source attribution — bylines, credentials, publication dates
- AE202: Data citations — sources for statistics, claims, quotes
- AE203: About page / E-E-A-T signals — expertise, experience, authority, trust

**Freshness:**

- AE301: Last-modified headers / dateModified in schema
- AE302: Content timestamps visible on page
- AE303: Changelog / update history for evergreen content
