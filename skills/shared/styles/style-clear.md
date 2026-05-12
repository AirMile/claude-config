# Style: Clear

Miles style, objectively framed. Narrating voice, no "ik" unless truly necessary. For READMEs, project docs, technical explanations, brand pages.

## Sentence Structure

- Front-load the sentence. Critical information in the first 5-7 words. Readers scan, they don't read to the end.
- "Restart het systeem via dit commando." Niet: "Om het systeem succesvol te restarten, voer je het volgende commando in."
- Hard limit: 25 words per sentence. Shorter preferred.
- Burstiness: vary sentence length. Three medium-length sentences in a row = AI rhythm.
- No em dashes. Commas or new sentences.
- Colon for enumeration and specification: "Stack: Laravel, React, MySQL."
- Passive constructions under 10%. Active is faster to process.
- No typographic disruption:
  - No CAPITALS for emphasis (reduces readability 13-18%).
  - Sentence case for headings: "Webhooks configureren" not "Webhooks Configureren".
  - Always replace "&" with "en".

## Word Choice

- Third person or imperative. "X werkt zo." / "Voer Y uit." No "ik" as information carrier.
- Active constructions: "DraftGap scrapet", "de CLI genereert", "het systeem detecteert".
- Tech terms in English, rest follows input language.
- No adjective stacking. Max one descriptor.
- No operational politeness. Drop "Please note that...", "We raden vriendelijk aan...", "Vergeet niet om...". Straight to the instruction.
- Inherits all anti-patterns from `_anti-patterns.md`. Plus style-specific:
- Forbidden — anti-marketing-speak (red flags for technical readers in 2024-2026):
  - "seamless(ly)", "naadloos", "effortlessly", "moeiteloos"
  - "powerful", "robust", "krachtig", "schaalbaar"
  - "unlock", "unleash", "ontsluiten" (als capability-werkwoord)
  - "next-generation", "cutting-edge", "state-of-the-art", "industry-leading", "best-in-class", "next-level", "game-changing", "revolutionary"
  - "delightful", "magisch", "enchanting"
  - "elevate", "ultimate", "transformative", "supercharged"
  - "blazing fast", "lightning fast" (without a benchmark)

## Structure

- Subheadings form the backbone. Reading only H2/H3 must be sufficient for the full story. Descriptive headings ("Webhooks configureren") not generic ("Volgende stappen", "Overzicht").
- F-pattern safe: critical information never at the end of a long sentence or at the bottom of a closed paragraph. Readers scan vertically along the left margin.
- One concept per paragraph. Max 3-4 sentences.
- Atomic answers: every paragraph stands on its own. Someone reading only that paragraph (via search or AI summary) gets a complete answer.
- Table for matrix data (3+ variables). Bullet for enumeration. Numbered list only for chronological steps.
- Code block for anything that is code. Inline only for variable names or short flags.
- Examples over abstractions: "Voer `npm run dev` uit" not "De applicatie kan gestart worden via de CLI".
- Document error cases explicitly. Edge cases, rate limits, error codes — call them out separately, don't bury them.
- No filler intro or outro: no "Welcome to X!" opener, no "Thank you for using..." closer, no "Built with ❤️", no emoji openers.

## Tone

- Inform, don't sell. Facts, not promises.
- Imperative, not user stories. "Voeg profielfoto-upload toe via S3." Not: "Als gebruiker wil ik een profielfoto kunnen uploaden zodat..."
- No congratulations or hype-reward at every step ("Geweldig!", "🎉 Done!", "You're all set!").
- Judgemental statements only when backed up: "X is sneller dan Y door Z" is fine. "X is geweldig" is not.
- Business-like but warm: not cold, not enthusiastic. No excessive politeness, but not blunt either.

## Examples

**Bad** (marketing vomit): "Unlock your team's ultimate potential with our next-generation, seamless productivity ecosystem designed to elevate your workflow and drive unprecedented growth."

**Good** (front-loaded, concreet): "DraftGap toont matchup-aanbevelingen op basis van actuele winrate data van U.GG. Voeg je pool toe, zie direct je zwakke plekken."

**Bad** (passief, niet front-loaded, beleefd): "Please note that before you can successfully initialize the API connection to retrieve user data, it is required that the unique authorization token is copied from your settings panel."

**Good** (front-loaded, imperatief): "Authenticeer de API. Kopieer de `authorization_token` uit Settings → API Keys en voeg toe aan je header."

**Bad** (positiviteit faken bij fout): "Occasionally, the connection might experience a slight delay. Rest assured, our robust infrastructure is working hard in the background!"

**Good** (transparant, troubleshooting-focus): "Rate limit overschreden (HTTP 429). De API staat 100 requests/seconde toe. Implementeer exponential backoff in je retry-logica."

**Bad** (data verstopt in proza): "De Hobby-tier biedt deployment via openbare repositories, terwijl de Pro-tier geschikt is voor alle repositories en meer bandbreedte levert. Enterprise biedt daarnaast volledige controle over toegangsrechten."

**Good** (matrix-data in tabel):

| Tier       | Repos            | Bandbreedte | Toegangsbeheer |
| ---------- | ---------------- | ----------- | -------------- |
| Hobby      | Public only      | Standaard   | Basis          |
| Pro        | Public + Private | Uitgebreid  | Basis          |
| Enterprise | Public + Private | Onbeperkt   | SSO/SAML       |

**Bad** (filler-introductie + emoji + user story): "Welcome to our docs! 🎉 As a user, you might want to set up authentication so that you can access protected routes."

**Good** (direct, imperatief): "Stel authenticatie in. Voeg `AUTH_SECRET` toe aan je `.env` en herstart de server."
