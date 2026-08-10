#!/usr/bin/env node
/**
 * Ground-truth computed-style extraction for /design-convert.
 *
 * Used twice in the route with the same contract:
 *   - convert-mode-copy.md §1.0 — against a live URL source, to build
 *     $EXTRACTED_STYLES for the fidelity table.
 *   - convert-verification-loop.md §3.2c — against the rendered localhost
 *     page, to diff what actually shipped against that table.
 *
 * Prints one JSON object on stdout. Exit 0 = extracted, 1 = page never loaded.
 *
 *   node extract-computed-styles.mjs <url> [--viewport 1440x900] [--selector <css>]
 *
 * Requires `playwright` to be resolvable from the project directory — run it
 * from the project root, not from the skill directory.
 */
import { chromium } from "playwright";

const args = process.argv.slice(2);
const url = args[0];
if (!url) {
  console.error("usage: extract-computed-styles.mjs <url> [--viewport WxH] [--selector <css>]");
  process.exit(1);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const [width, height] = flag("viewport", "1440x900").split("x").map(Number);
const scope = flag("selector", null);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
} catch (err) {
  console.error(`page never loaded: ${err.message}`);
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(2500);

// Fire every scroll-triggered entrance before measuring: elements below the
// fold sit at opacity:0 / translated until their observer fires, and a
// full-page capture does not trigger them on its own.
await page.evaluate(async () => {
  const step = window.innerHeight * 0.8;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 200));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 500));
});

const result = await page.evaluate((scopeSel) => {
  // Walk inline children so a heading with an accent <span> yields one entry
  // per color segment. getComputedStyle on the parent alone reports a single
  // color for a two-tone title — that is the defect this exists to catch.
  const seg = (el) => {
    const out = [];
    for (const n of el.childNodes) {
      const t = (n.textContent || "").trim();
      if (!t) continue;
      const host = n.nodeType === 3 ? el : n;
      const s = getComputedStyle(host);
      out.push({
        text: t.slice(0, 40),
        color: s.color,
        fontWeight: s.fontWeight,
        fontStyle: s.fontStyle,
        fontFamily: s.fontFamily.split(",")[0].replace(/["']/g, ""),
      });
    }
    return out.length > 1 ? out : undefined;
  };

  const pick = (el) => {
    const s = getComputedStyle(el);
    return {
      text: (el.textContent || "").trim().slice(0, 80),
      segments: seg(el),
      color: s.color,
      background: s.backgroundColor,
      fontFamily: s.fontFamily.split(",")[0].replace(/["']/g, ""),
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      padding: s.padding,
      margin: s.margin,
      gap: s.gap,
      borderRadius: s.borderRadius,
      border: s.border,
      boxShadow: s.boxShadow,
    };
  };

  const root = scopeSel ? document.querySelector(scopeSel) : document;
  if (!root) return { error: `selector not found: ${scopeSel}` };

  // Wrapper selectors are load-bearing: section padding and grid gaps live on
  // these, not on h1/p/section.
  const sels = [
    "h1", "h2", "h3", "h4", "p", "a", "button", "nav", "header", "footer",
    "section", "input", "section > div",
    "[class*=container]", "[class*=grid]", "[class*=flex]",
  ];

  const elements = Object.fromEntries(
    sels.map((sel) => [sel, [...root.querySelectorAll(sel)].slice(0, 8).map(pick)])
  );

  // Per-section box, so each section is compared against its own fidelity row
  // rather than one page-wide average.
  const sections = [...document.querySelectorAll("main > *")].map((n) => {
    const s = getComputedStyle(n);
    return {
      label: n.getAttribute("aria-label") || n.tagName.toLowerCase(),
      background: s.backgroundColor,
      innerBackground: n.firstElementChild
        ? getComputedStyle(n.firstElementChild).backgroundColor
        : null,
      padding: s.padding,
      marginTop: s.marginTop,
      borderTopLeftRadius: s.borderTopLeftRadius,
    };
  });

  // The only measurement that looks at two sections at once: a negative value
  // means this section is pulled over the one above it. Compare against the
  // `offset` field of the second section's fidelity row (absent = expected 0).
  const rects = [...document.querySelectorAll("main > *")].map((n) =>
    n.getBoundingClientRect()
  );
  const seams = rects.slice(1).map((b, i) => Math.round(b.top - rects[i].bottom));

  const assets = {
    images: [...document.images].slice(0, 20).map((i) => ({
      src: i.currentSrc,
      alt: i.alt,
      w: i.naturalWidth,
      h: i.naturalHeight,
      broken: i.naturalWidth === 0,
    })),
    svgCount: document.querySelectorAll("svg").length,
  };

  return { elements, sections, seams, assets };
}, scope);

result.consoleErrors = consoleErrors;
console.log(JSON.stringify(result, null, 2));
await browser.close();
