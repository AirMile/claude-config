# Local Font Setup Guide — next/font/local

Use when a font is not on Google Fonts and the user wants to self-host via `next/font/local`.

Detect project structure from `package.json` before rendering paths.

---

## Checklist

Show the following checklist adapted to the detected project (substitute real paths):

```
LOCAL FONT SETUP — {fontName}
════════════════════════════════════════════════

1. Download the font
   → Find the font on the foundry's website or a free source (e.g. fontshare.com, fontsquirrel.com)
   → Download the zip to ~/Downloads/

2. Extract font files
   → Unzip to ~/Downloads/{fontName}/
   → Identify files needed:
     - Regular (400): {fontName}-Regular.otf / .woff2
     - SemiBold (600): {fontName}-SemiBold.otf / .woff2   (if available)
     - Bold (700): {fontName}-Bold.otf / .woff2

3. Place font files
   → Create: {src/app/fonts/} (or {src/assets/fonts/} for non-Next projects)
   → Copy files there:
     src/app/fonts/{fontName}-Regular.otf
     src/app/fonts/{fontName}-SemiBold.otf
     src/app/fonts/{fontName}-Bold.otf

4. Configure in layout.tsx
   → Add to top of {src/app/layout.tsx}:

   import localFont from "next/font/local";

   const {variableName} = localFont({
     src: [
       { path: "./fonts/{fontName}-Regular.otf", weight: "400", style: "normal" },
       { path: "./fonts/{fontName}-SemiBold.otf", weight: "600", style: "normal" },
       { path: "./fonts/{fontName}-Bold.otf", weight: "700", style: "normal" },
     ],
     variable: "--font-{kebab-name}",
     display: "swap",
   });

5. Apply the variable
   → In the <body> className (next to other font variables):

   <body className={`${aileron.variable} ${oranienbaum.variable} font-sans antialiased`}>

6. Register in globals.css @theme block
   → Already done by X.6 Theme Infrastructure Sync (--font-sans or --font-heading)

════════════════════════════════════════════════
When done, come back here and confirm so the font tokens are recorded correctly.
```

---

## Notes

- **woff2 vs otf:** prefer woff2 if available (smaller, better browser support). If only otf available, Next.js auto-converts at build time via @vercel/font.
- **Italic variants:** add separately per weight: `{ path: "./fonts/{fontName}-Italic.otf", weight: "400", style: "italic" }`
- **Variable fonts:** if a `{fontName}[wght].woff2` file is available, use a single `src` entry with `weight: "100 900"` instead of separate files.
- **Fallback:** `display: "swap"` is the correct default for body copy; use `"block"` only for icon fonts.
