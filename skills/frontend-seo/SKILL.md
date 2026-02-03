---
description: Audit and implement SEO optimizations for web applications — detects framework (Next.js, Remix, Astro, React, etc.) and applies framework-specific best practices
disable-model-invocation: true
---

# SEO

Audit and optimize web applications for search engine visibility. Detects the framework in use, researches current best practices via Context7, and implements SEO improvements.

## Process

### Phase 1: Framework Detection

Scan the project to identify:

1. **Framework**: Next.js (App Router / Pages Router), Remix, Astro, Nuxt, SvelteKit, plain React, etc.
2. **Existing SEO setup**: Check for existing metadata, sitemaps, robots.txt, structured data
3. **Route structure**: Map all pages/routes in the application

Detection checks:

- `package.json` dependencies for framework identification
- `next.config.*`, `remix.config.*`, `astro.config.*`, `nuxt.config.*` for framework confirmation
- `app/` vs `pages/` vs `src/routes/` for router type
- Existing `sitemap.*`, `robots.*`, metadata files

Output:

```
DETECTED:

Framework: [name] ([version])
Router: [type]
Routes found: [count]
Existing SEO: [list what's already present]
```

### Phase 2: Context7 Research

**MANDATORY** — Before auditing, research the detected framework's current SEO APIs and best practices.

1. Use `resolve-library-id` to find the framework's documentation
2. Query for: "[framework] SEO metadata API, sitemap generation, structured data"
3. Query for: "[framework] generateMetadata, OpenGraph, robots.txt configuration"

Store findings for use during audit and implementation. This ensures recommendations use the latest APIs, not outdated patterns.

### Phase 3: SEO Audit

Scan every route/page for the following categories:

#### Critical (blocks search visibility)

| Check                 | What to look for                                                    |
| --------------------- | ------------------------------------------------------------------- |
| **Page titles**       | Every route must have a unique, descriptive title                   |
| **Meta descriptions** | Every route must have a unique description                          |
| **Rendering**         | SSR/SSG required for crawlable content — flag client-only rendering |
| **Robots**            | No accidental `noindex` on important pages                          |

#### Important (impacts ranking)

| Check              | What to look for                                     |
| ------------------ | ---------------------------------------------------- |
| **Open Graph**     | og:title, og:description, og:image per route         |
| **Canonical URLs** | Proper canonical tags, especially for dynamic routes |
| **Sitemap**        | sitemap.xml exists and includes all public routes    |
| **robots.txt**     | Exists with sensible defaults                        |
| **Headings**       | H1 on every page, logical hierarchy (H1->H2->H3)     |
| **Image alt text** | All images have descriptive alt attributes           |

#### Nice-to-have (enhances visibility)

| Check                 | What to look for                                                |
| --------------------- | --------------------------------------------------------------- |
| **Structured data**   | JSON-LD for content type (Article, Product, Organization, etc.) |
| **Twitter cards**     | twitter:card, twitter:title, twitter:image                      |
| **Dynamic OG images** | Auto-generated OG images for social sharing                     |
| **Performance**       | Image optimization, lazy loading, Core Web Vitals hints         |

### Phase 4: Audit Report

Present findings grouped by severity. Format:

```
SEO AUDIT REPORT

Score: [X/Y checks passed]

CRITICAL ([count])
- [issue]: [file:line] — [what's wrong]

IMPORTANT ([count])
- [issue]: [file:line] — [what's wrong]

NICE-TO-HAVE ([count])
- [issue]: [description]

PASSING ([count])
- [what's already good]
```

Send notification:

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "SEO audit ready"
```

Use **AskUserQuestion**:

- header: "Fix scope"
- question: "Which issues should be fixed?"
- options:
  - label: "Critical only (Recommended)", description: "Fix blocking SEO issues first"
  - label: "Critical + Important", description: "Fix all impactful issues"
  - label: "Everything", description: "Full SEO implementation including nice-to-haves"
  - label: "Let me pick", description: "I want to select specific issues"
- multiSelect: false

### Phase 5: Implementation

For each selected issue, implement the fix using framework-specific APIs discovered in Phase 2.

**Implementation order:**

1. Global metadata/layout (affects all pages)
2. Per-route metadata (page-specific)
3. Technical files (sitemap, robots.txt)
4. Structured data
5. Image optimization and alt text
6. Open Graph and social cards

**Per fix:**

1. Show what will change (file + diff preview)
2. Implement the change
3. Mark as done in progress tracker

After all fixes are implemented:

```
SEO COMPLETE

Implemented: [count] fixes
- [list of changes with file references]

Remaining: [count] items not selected
```

Send notification:

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "SEO complete"
```

## Framework-Specific Notes

### Next.js (App Router)

- Use `metadata` export or `generateMetadata()` in `layout.tsx` / `page.tsx`
- Create `app/sitemap.ts` and `app/robots.ts`
- Use `next/image` for automatic optimization
- JSON-LD via `<script type="application/ld+json">` in layout

### Next.js (Pages Router)

- Use `next/head` with `<Head>` component
- Create `pages/sitemap.xml.tsx` with `getServerSideProps`
- Use `next-seo` package if available

### Remix

- Use `meta` export function per route
- Handle `robots.txt` and `sitemap.xml` as resource routes

### Astro

- Use frontmatter `title`, `description` or `<SEO>` component
- Built-in sitemap integration (`@astrojs/sitemap`)

### Plain React (Vite/CRA)

- **Warning**: Client-side rendered apps have fundamental SEO limitations
- Use `react-helmet-async` for metadata
- Consider prerendering with `vite-plugin-ssr` or migration to Next.js/Remix
- Implement what's possible but flag SSR/SSG as recommended next step

## Notes

- Always use Context7 for framework-specific API details — don't rely on potentially outdated patterns
- Prefer framework-native solutions over third-party SEO packages
- Never implement SEO at the cost of user experience or performance
