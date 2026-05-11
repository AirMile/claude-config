# Style: Clear

Miles-stijl, objectief geframed. Sprekend-vertellend, geen "ik" tenzij echt nodig. Voor README's, project-docs, technische uitleg, brand pages.

## Sentence Structure

- Front-load de zin. Kritieke informatie staat in de eerste 5-7 woorden. Lezers scannen, ze lezen niet door tot het eind.
- "Restart het systeem via dit commando." Niet: "Om het systeem succesvol te restarten, voer je het volgende commando in."
- Hard limit: 25 woorden per zin. Bij voorkeur korter.
- Burstiness: wissel zinslengte af. Drie middellange zinnen achter elkaar = AI-ritme.
- Geen em dashes. Komma's of nieuwe zinnen.
- Dubbele punt voor opsomming en specificatie: "Stack: Laravel, React, MySQL."
- Passieve constructies onder 10%. Actief is sneller te verwerken.
- Geen typografische disruptie:
  - Geen KAPITALEN voor nadruk (verlaagt leesbaarheid 13-18%).
  - Sentence case voor koppen: "Webhooks configureren" niet "Webhooks Configureren".
  - "&" altijd vervangen door "en".

## Word Choice

- Derde persoon of imperatief. "X werkt zo." / "Voer Y uit." Geen "ik" als informatiedrager.
- Actieve constructies: "DraftGap scrapet", "de CLI genereert", "het systeem detecteert".
- Tech termen in het Engels, rest volgt invoertaal.
- Geen adjective stacking. Max één descriptor.
- Geen operationele beleefdheid. Weg met "Please note that...", "We raden vriendelijk aan...", "Vergeet niet om...". Direct de instructie.
- Erft alle anti-patterns uit `_anti-patterns.md`. Plus stijl-specifiek:
- Verboden — anti-marketing-speak (rode vlaggen voor technische lezers in 2024-2026):
  - "seamless(ly)", "naadloos", "effortlessly", "moeiteloos"
  - "powerful", "robust", "krachtig", "schaalbaar"
  - "unlock", "unleash", "ontsluiten" (als capability-werkwoord)
  - "next-generation", "cutting-edge", "state-of-the-art", "industry-leading", "best-in-class", "next-level", "game-changing", "revolutionary"
  - "delightful", "magisch", "enchanting"
  - "elevate", "ultimate", "transformative", "supercharged"
  - "blazing fast", "lightning fast" (zonder benchmark)

## Structure

- Tussenkoppen vormen de ruggengraat. Alleen H2/H3 lezen moet voldoende zijn voor het hele verhaal. Beschrijvende koppen ("Webhooks configureren") niet generieke ("Volgende stappen", "Overzicht").
- F-patroon-veilig: kritieke informatie nooit aan het eind van een lange zin of onderaan een gesloten alinea. Lezers scannen verticaal langs de linkermarge.
- Eén concept per alinea. Max 3-4 zinnen.
- Atomic answers: elke alinea staat zelfstandig. Iemand die alleen die alinea leest (via zoek of AI-overzicht) krijgt een kloppend antwoord.
- Tabel voor matrix-data (3+ variabelen). Bullet voor opsomming. Genummerde lijst alleen voor chronologische stappen.
- Code-block voor alles wat code is. Inline alleen voor variabele-namen of korte flags.
- Voorbeelden boven abstracties: "Voer `npm run dev` uit" niet "De applicatie kan gestart worden via de CLI".
- Documenteer foutgevallen expliciet. Edge cases, rate limits, error codes — apart benoemen, niet wegmoffelen.
- Geen filler-introductie of -slot: geen "Welcome to X!" opener, geen "Thank you for using..." closer, geen "Built with ❤️", geen emoji-openers.

## Tone

- Informeren, niet verkopen. Feiten, geen beloftes.
- Imperatief, geen user stories. "Voeg profielfoto-upload toe via S3." Niet: "Als gebruiker wil ik een profielfoto kunnen uploaden zodat..."
- Geen feliciteringen of hype-beloning bij elke stap ("Geweldig!", "🎉 Done!", "You're all set!").
- Oordelende uitspraken alleen onderbouwd: "X is sneller dan Y door Z" mag. "X is geweldig" niet.
- Zakelijk maar warm: niet koud, niet enthousiast. Geen overdreven beleefdheid, ook niet bot.

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
