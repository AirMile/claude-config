# Screencast Script - League of Legends Jungle Champions API

**Totale duur: ~9-10 minuten**
**Server URL:** http://145.24.237.11:8001/
**Collectie URL:** http://145.24.237.11:8001/items/

> TIP: Neem elk onderdeel apart op in OBS. Plak ze daarna in CapCut aan elkaar.
> Zorg dat je in Postman de header `Accept: application/json` altijd instelt!

---

## ONDERDEEL 0: CHECKER + INTRO (~30 sec)

**ACTIE:** Open browser naar https://cmgt.hr.nl:8001/

**VOICEOVER:**
"Hallo, dit is mijn webservice over League of Legends jungle champions. De API draait op http://145.24.237.11:8001 en de collectie is bereikbaar via /items/. Laten we eerst de checker gebruiken om te verifiëren dat de service correct werkt."

**ACTIE:** Voer de base URL in bij de checker, wacht op resultaat

**VOICEOVER:**
"De checker geeft aan dat de webservice volledig voldoet aan alle vereisten."

**ACTIE:** Toon het goedkeuringsresultaat op scherm

---

## ONDERDEEL 1: GET OP DETAIL (~1 min)

### Code tonen

**ACTIE:** Open `routes/items.js`, toon regel 12-15

**VOICEOVER:**
"We beginnen met het ophalen van een enkel item. In routes/items.js op regel 12 staat de GET-route met een ID-parameter. Eerst loopt de request door validateId middleware, die checkt of het een geldig MongoDB ObjectId is. Daarna gaat het naar de getById controller."

**ACTIE:** Open `controllers/itemController.js`, toon regel 39-50

**VOICEOVER:**
"In de getById controller op regel 40 wordt het item opgehaald met findByIdOrFail. Als het item niet bestaat, wordt automatisch een 404 error gegooid. Het item wordt teruggestuurd met alle velden plus HATEOAS links via de respondWithItem helperfunctie op regel 15."

**ACTIE:** Open `models/Item.js`, toon regel 52-56

**VOICEOVER:**
"findByIdOrFail is een custom static method op het Item model. Op regel 54 zie je: als findById null teruggeeft, gooit het een NotFoundError."

### Postman bewijs

**ACTIE:** Open Postman
- Methode: **GET**
- URL: `http://145.24.237.11:8001/items/{een_bestaand_id}`
- Header: `Accept: application/json`
- Verstuur

**VOICEOVER:**
"In Postman stuur ik een GET-request naar een bestaand item. We krijgen status 200 terug met alle velden: name, title, role, difficulty, damageType, clearSpeed, ganking en scaling. Plus het _links object met HATEOAS links naar de resource zelf en de collectie."

**ACTIE:** Toon de JSON response, wijs de velden en _links aan

---

## ONDERDEEL 2: PUT OP DETAIL (~1 min)

### Code tonen

**ACTIE:** Open `routes/items.js`, toon regel 27-31

**VOICEOVER:**
"De PUT-route staat op regel 27. Net als GET loopt het door validateId, maar nu ook door validateItem middleware die de body valideert. Daarna gaat het naar de update controller."

**ACTIE:** Open `controllers/itemController.js`, toon regel 66-74

**VOICEOVER:**
"De update controller op regel 67 gebruikt findByIdAndUpdateOrFail. Deze methode update het item en geeft de nieuwe versie terug dankzij de optie 'new: true' op regel 70. Als het item niet bestaat, krijg je een 404."

**ACTIE:** Open `middleware/validation.js`, toon regel 42-44

**VOICEOVER:**
"In de validatie op regel 43 wordt gecheckt of het een PUT of PATCH is. Bij updates zijn velden niet verplicht, maar als je ze meestuurt worden ze wel gevalideerd op type en of ze niet leeg zijn."

### Postman bewijs

**ACTIE:** Open Postman
- Methode: **PUT**
- URL: `http://145.24.237.11:8001/items/{id}`
- Headers: `Accept: application/json`, `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "name": "Warwick",
  "title": "The Uncaged Wrath",
  "role": "Fighter",
  "difficulty": "3",
  "damageType": "Physical",
  "clearSpeed": "Fast",
  "ganking": "Strong",
  "scaling": "Mid game"
}
```
- Verstuur

**VOICEOVER:**
"In Postman stuur ik een PUT-request met een volledige JSON body. We krijgen status 200 terug met het bijgewerkte item. Alle velden zijn aangepast naar de nieuwe waarden."

---

## ONDERDEEL 3: STATUS 201 (~1 min)

### Code tonen

**ACTIE:** Open `controllers/itemController.js`, toon regel 52-64

**VOICEOVER:**
"Bij het aanmaken van een nieuw item gebruiken we de create controller. Het belangrijke staat op regel 60: we sturen niet de standaard status 200, maar status 201 Created. Dit vertelt de client dat er daadwerkelijk een nieuwe resource is aangemaakt."

"Op regel 58 stellen we ook de Location header in. Deze bevat de URL van de zojuist aangemaakte resource, zodat de client direct weet waar het nieuwe item te vinden is."

### Postman bewijs

**ACTIE:** Open Postman
- Methode: **POST**
- URL: `http://145.24.237.11:8001/items/`
- Headers: `Accept: application/json`, `Content-Type: application/json`
- Body (raw JSON):
```json
{
  "name": "Amumu",
  "title": "The Sad Mummy",
  "role": "Tank",
  "difficulty": "2",
  "damageType": "Magic",
  "clearSpeed": "Fast",
  "ganking": "Strong",
  "scaling": "Mid game"
}
```
- Verstuur

**VOICEOVER:**
"We sturen een POST-request met alle verplichte velden. Kijk: de status is 201 Created, niet 200 OK. En in de response headers zien we de Location header met de URL naar het nieuwe item. In de body krijgen we het complete item terug inclusief het gegenereerde ID en de HATEOAS links."

**ACTIE:** Toon status 201 en de Location header in Postman's response headers tab

---

## ONDERDEEL 4: STATUS 404 (~45 sec)

### Code tonen

**ACTIE:** Open `models/Item.js`, toon regel 52-56

**VOICEOVER:**
"Hoe gaat de API om met niet-bestaande items? In het Item model zie je findByIdOrFail. Op regel 54: als het item niet gevonden wordt, gooit het een NotFoundError."

**ACTIE:** Open `middleware/errorHandler.js`, toon regel 8-9

**VOICEOVER:**
"NotFoundError is een factory functie die een ApiError maakt met statuscode 404 en de boodschap 'Item not found'."

**ACTIE:** Toon regel 31-34 in errorHandler.js

**VOICEOVER:**
"De errorHandler middleware vangt deze fout op en stuurt een JSON response met de juiste statuscode."

### Postman bewijs

**ACTIE:** Open Postman
- Methode: **GET**
- URL: `http://145.24.237.11:8001/items/aaaaaaaaaaaaaaaaaaaaaaaa`
- Header: `Accept: application/json`
- Verstuur

**VOICEOVER:**
"We sturen een GET-request met een geldig ObjectId formaat dat niet in de database staat. Resultaat: status 404 met de foutmelding 'Item not found'."

**ACTIE:** Toon status 404 en de JSON error response

---

## ONDERDEEL 5: CORS HEADERS (~1.5 min)

### Uitleg waarom CORS bestaat

**VOICEOVER:**
"Nu een belangrijk onderdeel: CORS, Cross-Origin Resource Sharing. Browsers blokkeren standaard requests naar andere domeinen. Dit heet de Same-Origin Policy en is een beveiligingsmaatregel. Als jouw frontend op domein A draait en data probeert te halen van domein B, zegt de browser: nee, dat mag niet. CORS headers vertellen de browser dat het wél is toegestaan."


### Code tonen

**ACTIE:** Open `middleware/cors.js`, toon regel 3-7

**VOICEOVER:**
"In de corsHeaders middleware zetten we twee headers. Regel 4: Access-Control-Allow-Origin met een sterretje. Dit betekent dat elke website requests mag sturen naar onze API. Zonder deze header blokkeert de browser de response.
Regel 5: Access-Control-Expose-Headers met Last-Modified. Dit maakt de Last-Modified header zichtbaar voor JavaScript in de browser. Normaal kan JavaScript niet alle headers lezen."

**ACTIE:** Toon `app.js` regel 17-18

**VOICEOVER:**
"Deze middleware wordt globaal toegepast op alle requests via app.use op regel 17."

**ACTIE:** Toon `middleware/cors.js` regel 23-28

**VOICEOVER:**
"De optionsHandler handelt preflight requests af. Als een browser een complexe request wil doen, stuurt hij eerst een OPTIONS request om te vragen: 'mag dit?'
De Allow header op regel 24 geeft aan welke HTTP methods zijn toegestaan.
Access-Control-Allow-Methods op regel 25 is specifiek voor CORS - de browser checkt dit.
Access-Control-Allow-Headers op regel 26 geeft aan welke custom headers de client mag meesturen."

**ACTIE:** Toon `app.js` regel 20-22

**VOICEOVER:**
"Per endpoint configureren we welke methods zijn toegestaan. /items kan GET en POST, /items/:id kan ook PUT, PATCH en DELETE."

### Postman bewijs - OPTIONS

**ACTIE:** Open Postman
- Methode: **OPTIONS**
- URL: `http://145.24.237.11:8001/items/`
- Verstuur

**VOICEOVER:**
"Eerst de OPTIONS request. In de response headers zien we: Allow met GET, POST, OPTIONS. Access-Control-Allow-Methods met dezelfde waarden. En Access-Control-Allow-Headers met Content-Type, X-HTTP-Method-Override en If-Modified-Since. Status 204 No Content, want er is geen body nodig."

**ACTIE:** Toon de response headers in Postman

### Postman bewijs - GET

**ACTIE:** Open Postman
- Methode: **GET**
- URL: `http://145.24.237.11:8001/items/`
- Header: `Accept: application/json`
- Verstuur

**VOICEOVER:**
"Bij een normale GET request zien we in de response headers: Access-Control-Allow-Origin met het sterretje. Dit is wat de browser controleert. De browser ziet dit, denkt 'oké, dit is toegestaan', en geeft de data door aan JavaScript."

**ACTIE:** Toon Access-Control-Allow-Origin header in de response

---

## ONDERDEEL 6 (EXTRA): PATCH + METHOD OVERRIDE (~1.5 min)

### PATCH - Code tonen

**ACTIE:** Open `routes/items.js`, toon regel 33-37

**VOICEOVER:**
"Nu de extra onderdelen. Eerst PATCH voor gedeeltelijke updates. In de routes op regel 33 zie je dat PATCH dezelfde update controller gebruikt als PUT."

ACTIE: Open middleware/validation.js, toon regel 46-48 en dan regel 22-25

VOICEOVER:
"Het verschil zit in de validatie. Op regel 47 wordt gecheckt of het een PUT of PATCH is. Als het een update is, zijn velden niet verplicht - je ziet op regel 22 dat required velden worden overgeslagen bij updates. Bij PATCH kun je dus maar 1 veld sturen."

### PATCH - Postman bewijs

**ACTIE:** Open Postman
- Methode: **PATCH**
- URL: `http://145.24.237.11:8001/items/{id}`
- Headers: `Accept: application/json`, `Content-Type: application/json`
- Body: `{ "name": "Nieuwe naam" }`
- Verstuur

**VOICEOVER:**
"We sturen een PATCH met alleen het name veld. Resultaat: het item is bijgewerkt, maar alle andere velden zijn ongewijzigd. PATCH is dus ideaal voor gedeeltelijke updates."

### Method Override - Code tonen

**ACTIE:** Open `middleware/methodOverride.js`, toon het hele bestand

**VOICEOVER:**
"Sommige clients ondersteunen alleen GET en POST. Met method override kunnen ze toch PUT, PATCH of DELETE uitvoeren. Op regel 6 checkt de middleware of het een POST is. Op regel 10 leest het de X-HTTP-Method-Override header. Op regel 23 wordt de methode vervangen, zodat Express het als de juiste methode routeert."

### Method Override - Postman bewijs

**ACTIE:** Open Postman
- Methode: **POST**
- URL: `http://145.24.237.11:8001/items/{id}`
- Headers: `Accept: application/json`, `Content-Type: application/json`, `X-HTTP-Method-Override: PATCH`
- Body: `{ "title": "Override test" }`
- Verstuur

**VOICEOVER:**
"We sturen een POST-request, maar met de header X-HTTP-Method-Override: PATCH. De server behandelt dit als een PATCH request en voert de update uit. Zo kunnen beperkte clients toch alle operaties uitvoeren."

---

## ONDERDEEL 7 (EXTRA): IF-MODIFIED-SINCE CACHING (~1.5 min)

### Code tonen

**VOICEOVER:**
"Het volgende extra onderdeel: conditional requests met If-Modified-Since. Dit bespaart bandbreedte. De client zegt: 'ik heb al een versie van deze datum, is er iets veranderd?' Als het antwoord nee is, stuurt de server alleen een lege 304 terug."

**ACTIE:** Open `middleware/caching.js`, toon regel 45-63

**VOICEOVER:**
"De isModifiedSince functie op regel 45 vergelijkt timestamps. Op regel 46 pakt het de If-Modified-Since header van de client. Als die er niet is, returnt het true - stuur het volledige item. Op regel 59-60 worden de timestamps vergeleken in seconden. Als de resource nieuwer is dan wat de client heeft, krijgt de client het volledige item."

**ACTIE:** Open `controllers/itemController.js`, toon regel 39-50

**VOICEOVER:**
"In de getById controller op regel 43: als isModifiedSince false returnt - dus niet gewijzigd - dan sturen we op regel 45 een 304 Not Modified. Geen body, geen JSON, alleen headers. Bandbreedte bespaard."

### Postman bewijs - Stap 1: Eerste request

**ACTIE:** Open Postman
- Methode: **GET**
- URL: `http://145.24.237.11:8001/items/{id}`
- Header: `Accept: application/json`
- Verstuur

**VOICEOVER:**
"Eerst een normale GET. We krijgen status 200 met het volledige item. Kijk in de response headers: daar staat Last-Modified met een datum. Kopieer deze waarde."

**ACTIE:** Kopieer de Last-Modified header waarde

### Postman bewijs - Stap 2: Conditional request

**ACTIE:** Zelfde request, voeg header toe:
- `If-Modified-Since: {gekopieerde waarde}`
- Verstuur

**VOICEOVER:**
"Nu dezelfde request, maar met de header If-Modified-Since en de gekopieerde datum. Resultaat: status 304 Not Modified. Geen body! De server zegt: wat je hebt is nog actueel. Als we het item zouden updaten via PUT en dan opnieuw deze GET doen met de oude datum, krijgen we weer een 200 met de nieuwe data."

**ACTIE:** Toon de 304 status en lege body

---

## ONDERDEEL 8 (EXTRA): FILE UPLOAD (~1.5 min)

### Code tonen

**ACTIE:** Open `routes/files.js`, toon regel 22-27

**VOICEOVER:**
"Het laatste extra onderdeel: file upload. De POST-route op regel 22 heeft een bijzondere middleware-keten. Eerst express.raw() op regel 23 - dit ontvangt de data als een ruwe buffer in plaats van JSON. Dan parseFileUpload voor het parsen van het multipart formaat, validateFileUpload voor validatie, en dan de controller."

ACTIE: Open middleware/validation.js, toon regel 91-106

VOICEOVER:
"De parseFileUpload middleware op regel 91 pakt de boundary uit de Content-Type header en parsed het multipart formaat handmatig, zonder externe libraries zoals multer. Het bestand wordt opgeslagen in req.parsedFile."

ACTIE: Open middleware/validation.js, toon regel 108-138

VOICEOVER:
"De validatie checkt drie dingen: het MIME-type moet een afbeelding zijn - PNG, JPEG, GIF of WebP. De grootte mag niet boven 5 megabyte. En de bestandsnaam mag geen pad-karakters bevatten voor de veiligheid."

ACTIE: Open controllers/fileController.js, toon regel 39-73

VOICEOVER:
"De upload controller genereert een unieke bestandsnaam met crypto.randomBytes op regel 44, schrijft het bestand naar schijf op regel 49, slaat metadata op in MongoDB, en stuurt een 201 Created terug met een Location header."



### Postman bewijs - Upload

**ACTIE:** Open Postman
- Methode: **POST**
- URL: `http://145.24.237.11:8001/files/`
- Body: **form-data**
  - Key: `file` (type: File) - selecteer een afbeelding
  - Key: `itemId` (type: Text) - een geldig item ID (optioneel)
- Verstuur

**VOICEOVER:**
"In Postman maken we een POST naar /files/ met form-data body. We selecteren een afbeelding en voegen optioneel een itemId toe. Status 201 Created! In de response zien we het bestand-ID, MIME-type, grootte, en het moment van upload."

### Postman bewijs - Download

**ACTIE:** Open Postman
- Methode: **GET**
- URL: `http://145.24.237.11:8001/files/{fileId}/download`
- Verstuur

**VOICEOVER:**
"En we kunnen het bestand downloaden via GET /files/{id}/download. De afbeelding wordt teruggestuurd met de juiste Content-Type header. Dit is de volledige flow: multipart parsing, validatie, opslaan, en downloaden - allemaal zonder externe upload-libraries."

---

# TIJDSOVERZICHT VOOR CAPCUT

| # | Onderdeel | Geschatte duur |
|---|-----------|---------------|
| 0 | Checker + Intro | 0:30 |
| 1 | GET op detail | 1:00 |
| 2 | PUT op detail | 1:00 |
| 3 | Status 201 | 1:00 |
| 4 | Status 404 | 0:45 |
| 5 | CORS headers | 1:30 |
| 6 | PATCH + Method Override | 1:30 |
| 7 | If-Modified-Since Caching | 1:30 |
| 8 | File Upload | 1:30 |
| **Totaal** | | **~9:15** |

# POSTMAN CHECKLIST

Zorg dat je voor de opname deze requests klaar hebt staan in Postman:

1. **GET detail** - `GET /items/{id}` + Accept header
2. **PUT detail** - `PUT /items/{id}` + volledige JSON body
3. **POST nieuw item** - `POST /items/` + JSON body (voor 201)
4. **GET niet-bestaand** - `GET /items/aaaaaaaaaaaaaaaaaaaaaaaa` (voor 404)
5. **OPTIONS collectie** - `OPTIONS /items/` (voor CORS)
6. **GET collectie** - `GET /items/` + Accept header (voor CORS)
7. **PATCH** - `PATCH /items/{id}` + partial body
8. **POST met override** - `POST /items/{id}` + X-HTTP-Method-Override: PATCH
9. **GET met cache** - `GET /items/{id}` + If-Modified-Since header
10. **POST file** - `POST /files/` + form-data met afbeelding
11. **GET download** - `GET /files/{id}/download`

> TIP: Maak al deze requests vooraf aan in een Postman Collection, zodat je tijdens het opnemen alleen hoeft te klikken!
