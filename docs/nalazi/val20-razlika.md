# Val 20: razlika (V20-PREGLED `val20-razlika`)

Datum: 24. 11. 2026. Pisac: `claude:wv20pregled:frontend`. Nalog: orkestrator, Ductus#2055 (komentar 7146221027), po planu „Val 17: rani početak”, t. 7 (odluka vlasnika). **Samo dokumentacija; kod se ne mijenja.**

Pregledane baze:

| Repo | Grana | SHA |
|---|---|---|
| WEB `ductura/Institution_front_web_chrome` | `migracija/kopija-ductus-front` | `9b5d202b88be1c859ee7fab155c085a4e6587431` |
| SRV `ductura/Institution_server` (javno) | `migracija/kopija-ductus-backend` | `11b6a58cc6e26f8d4cf12bf3e16e6bfba6d7565b` |

Izvadak ugovora u WEB-u kaže „API 1.113.0, Institution_server 869800e5”; SRV vrh je novija grana, pa se prije svakog SRV zadatka provjeri `git ls-tree` baze.

## 1. Opseg vala 20

U opsegu (samo dijelovi bez tuđih servisa):

1. font za disleksiju;
2. način čitanja;
3. čitanje naglas kroz Web Speech API (C-14);
4. hrvatski stilovi citiranja na postojećem `domain/citation` (u hostu: `@ductura/editor-core` `document/citation`).

**Isključeno (čeka licence, ne gradi se):** provjera pravopisa, provjera gramatike, Struna, uvoz iz Hrčka, uvoz iz CROSBI-ja. Lekta profili (`lekta.profile`) ostaju kako jesu; Q-11 se ne dira.

Pravila koja vrijede za sve zadatke ispod: bez rangiranja studenata i bez automatskih sankcija; samo izmišljeni podaci; podaci samo kroz `/api/v1`; komponente iz `@ductura/ui`; vizualni smjer „papir i grafit”; tekst sučelja na hrvatskom; aplikacija živi **isključivo** u `packages/app/src/host/` (`src/app`, `src/components` su stari kod i ne diraju se).

## 2. Što već postoji

### 2.1 Font za disleksiju

| Stavka | Stanje |
|---|---|
| Font ili CSS za disleksiju, bilo gdje u WEB-u ili SRV-u | **ne postoji** (pretraga `dyslex`, `disleks`, `OpenDyslexic`, `Lexend`: 0 pogodaka) |
| Fontovi aplikacije | `packages/ui/src/fonts/faces.css`, `fonts.css`: Instrument Sans (`--font-ui`), Newsreader (`--font-display`), JetBrains Mono; lokalno, bez CDN-a (A-13) |
| Osobne postavke prikaza u pregledniku | tema `packages/ui/src/theme/theme.ts` (`ductura.theme`), veličina teksta `packages/app/src/host/editor/toolbar/text-size.ts` (`ductura.toolbar.zoom.v1`, 5 koraka), traka `toolbar-prefs.ts` (`ductura.toolbar.prefs.v1`); sve u `localStorage`, nikad na server |
| Serverske osobne postavke | `server/domain/settings/catalogue.ts`: osobno samo `notifications.email` i `display.reduced_motion`; ruta `settings.values.put` postoji ali za font nema ključa |

Odluka (Pretpostavka): font se pamti **samo u pregledniku**, kao tema i veličina teksta. Time nema SRV zadatka, nema novog ključa u katalogu i nema osobnog podatka na serveru. Otvoreno za vlasnika: koji je font i licenca (preporuka: font s licencom SIL OFL koji se smije isporučiti lokalno, npr. Lexend ili OpenDyslexic; provjera licence prije spajanja datoteke fonta).

### 2.2 Način čitanja

| Stavka | Stanje |
|---|---|
| Način čitanja kao pojam | **ne postoji** u hostu ni na serveru |
| Povezano | veličina teksta (`text-size.ts`), tema lista (`ui/theme`), prečaci, `work.reading-place.put/.delete` (mjesto čitanja u mentorskom praćenju, `server/contracts/routes/mentorship-follow.ts`; to je nešto drugo i ne dira se) |
| Čitanje rada (nastavnik) | `live.document.get` (samo za čitanje), stranice u `packages/app/src/host/teacher/` |

Odluka (Pretpostavka): „način čitanja” je osobni prikaz lista u pregledniku: širina retka, razmak redaka, razmak slova i riječi, razmak odlomaka. Bez servera. Skrivanje bočnih ploča (fokus) traži izmjenu okvira ljuske (`ShellView`, VIZ-S1) i **nije** u ovom valu.

### 2.3 Čitanje naglas (C-14)

| Stavka | Putanja | Napomena |
|---|---|---|
| Omot Web Speech API-ja | `src/components/editor/addons/speech.ts` (`speechSupport`, `readAloud`, `stopReading`, `startDictation`) | stari direktorij, ali ga host izravno uvozi |
| Jedino mjesto uporabe | `packages/app/src/host/editor/right/PregledGroup.tsx` (podprikaz „Nacrt”: gumb „Poslušaj”, tekst iz `listenText`) | poruke `host/editor/right/messages.hr.ts`: `listen`, `listenStop`, `listenEmpty`, `listenUnsupported`, `listenLocal` |
| Stari gumbi | `src/components/editor/addons/SpeechControls.tsx` | stari kod, host ga ne koristi |
| Testovi | `src/components/editor/addons/addons.test.tsx`, `host/editor/right/pregled-model.test.ts` | |

Što fali: čitanje odlomka, odabira i cijelog rada; brzina i glas (hr-HR); pauza/nastavak; dijeljenje dugog teksta na dijelove (preglednici prekidaju predugu izjavu); isticanje rečenice koja se čita; ulaz iz trake alata. Server ne sudjeluje: tekst ne napušta preglednik (`listenLocal`). Diktiranje postoji (`startDictation`) i ne dira se.

### 2.4 Hrvatski stilovi citiranja

| Stavka | Putanja | Napomena |
|---|---|---|
| Jezgra oblikovanja | `packages/editor-core/src/document/citation/` (`format.ts`, `style.ts`, `bibliography.ts`, `types.ts`); kopija `src/domain/citation/` (stara) | tip `CitationStyle`: `style: "author-date" \| "numeric"`; `numeric` s oznakama `[1]` ili `1.` ima test `numeric-style.test.ts` s **probnim** ulazom |
| Jedini stvarni stil | `config/faculties/fpzg/citation.json` (autor-godina, „i sur.”, „ur.”, „U:”, „pristupljeno”, uvlaka 1,25 cm) | jedina datoteka stila u repou |
| Čitanje postavke | `src/components/editor/parts/institution-citation-settings.ts`: `settings.values.get` (`citation.style`, `lekta.profile`); formatira samo za `fpzg`, inače `formattingStyle: null` | stari direktorij; host ga ne uvozi |
| Host | `packages/app/src/host/editor/bibliography/student/*`, `teacher/*`, `footnote/*`: **ne zovu** `formatBibliographyEntry`, `formatInText` ni `parseCitationStyle` (pretraga u `packages/app/src`: 0 pogodaka) | popis literature u hostu ne primjenjuje stil ustanove |
| Student čita stil ustanove | **ne može.** `student.text-check-config.get` (`server/contracts/routes/text-check-config.ts:28`, izvadak `src/client/migration-contract-types.generated.ts:248`) vraća samo `enabledCheckIds` i `lektaProfileId`, ne `citation.style`. `settings.values.get` s `level: "institution"` smije čitati samo administrator ustanove (SRV `db/main/migrations/20261117120000_settings_read.sql`, `institution.actor_has_role('admin')`); student dobiva 404, a `inherited` pokriva samo ključeve tražene razine | **Nedostaje na poslužitelju:** studentska ruta za stil ustanove (zadatak SRV-V20-STIL-STUDENT) |
| Katalog servera | `server/domain/settings/catalogue.ts`: `citation.style` ∈ `fpzg, apa, chicago, ieee, vancouver, fusnote`, razina ustanova | katalog je već proširen |
| **Nesklad** | `server/database/institution-config/schema.ts` `CITATION_STYLES = ["fpzg"]` (polje `citationStyle` datoteke pravila fakulteta); `server/settings/institutions.ts` `CITATION_STYLES = ["fpzg"]` | datoteke pravila i zapisi ustanova prihvaćaju samo `fpzg`, iako katalog dopušta pet drugih. Ruta `institution.faculty-rules.post` (izvadak `migration-contract-types.generated.ts:310`) **nema** polje `citationStyle` (tijelo: `workType`, `basedOnVersionNo`, `aiPolicy`, `aiPurposes`, `evidenceProfile`, `importAllowed`), pa širenje popisa ne mijenja ugovor |
| Server oblikuje stil? | ne: serveru stil služi samo kao oznaka; oblikovanje je na klijentu | zato su stilovi WEB datoteke |

Nesklad se bilježi kao otvoren i rješava zadatkom SRV-V20-STILOVI-USTANOVA. `fusnote` (bilješke ispod crte) nije izraziv tipom `CitationStyle` (samo `author-date` i `numeric`); njegovo uvođenje mijenja kanonski model dokumenta i ide samo kroz kritični zadatak (usporedi PIL-K-SHEMA-V3), pa ga ovaj val **ne gradi**: ostaje u katalogu, a sučelje ga prikazuje kao „nije dostupno” i koristi FPZG.

## 3. Zadaci koji nedostaju (14)

Oznake: veličina S ≤ ~120 redaka koda, M ≤ ~400. Ovisnost „server ugovor prije weba” nastaje jednom: SRV-V20-STIL-STUDENT dodaje `citationStyle` u odgovor `student.text-check-config.get`, a WEB-V20-STIL-ODABIR i sve iza njega ovise o njemu. Svaki zadatak ima svoje nove datoteke; zajedničke točke montiranja su navedene jednom.

**Zajedničke točke montiranja** (po jedan redak, svaka samo u jednom zadatku): `host/editor/toolbar/ToolbarBehaviour.tsx` (WEB-V20-POSTAVKE-DIJALOG); `host/editor/toolbar/StudentToolbar.tsx` i `host/student/work.tsx` (WEB-V20-NAGLAS-UREDNIK; `quick-tools.ts` samo uz mobilni unos); `host/editor/right/PregledGroup.tsx` (WEB-V20-NAGLAS-NACRT); `packages/app/app/layout.tsx` i `packages/ui/package.json` (izvoz CSS-a, WEB-V20-FONT-DISLEKSIJA); `host/editor/bibliography/student/StudentBibliographyHost.tsx` (WEB-V20-STIL-POPIS). Jedini zadatak koji mijenja datoteku ugovora je SRV-V20-STIL-STUDENT (jedini vlasnik `server/contracts/routes/text-check-config.ts`); nijedan ne dira `packages/ui/src/tokens/globals.css`, `packages/editor-core` ni `src/**`.

### Font i prikaz

1. **WEB-V20-PREF-CITANJE** (S). Jedan spremnik osobnih postavki čitanja u pregledniku: `font` (`standard` | `dyslexia`), `width`, `lineHeight`, `letterSpacing`, `paragraphGap` (zatvoreni skupovi koraka), ključ `ductura.reading.v1`; neispravna pohranjena vrijednost se zanemaruje, blokirana pohrana ne ruši ekran; primjena kroz atribute `data-reading-*` na `<html>`. Nema API-ja ni novih polja. Veličina: S. Ovisi o: ništa. Putanje: `packages/app/src/host/shared/reading-prefs/{model.ts,store.ts,model.test.ts,store.test.ts}`.
2. **WEB-V20-FONT-DISLEKSIJA** (M). Lokalna datoteka fonta za disleksiju (licenca potvrđena, bilješka o izvoru i licenci u istom direktoriju), `@font-face` i pravilo koje pri `data-reading-font="dyslexia"` mijenja font lista i teksta rada; interfejs ljuske ostaje. Test: bez atributa font je nepromijenjen; bez CDN-a (pretraga URL-ova u CSS-u). Veličina: M. Ovisi o: WEB-V20-PREF-CITANJE. Putanje: `packages/ui/src/fonts/dyslexia/**` (novo), `packages/ui/src/styles/reading-font.css` (novo), `packages/ui/src/fonts/dyslexia.test.ts` (novo). Točka uključivanja (pravilo je bez nje neaktivno): izvoz `./reading-font.css` u `packages/ui/package.json` (kao postojeći `./fonts.css`) i jedan redak `import "@ductura/ui/reading-font.css";` u `packages/app/app/layout.tsx` kraj uvoza `fonts.css`/`tokens.css`.
3. **WEB-V20-NACIN-CITANJA** (M). Pravila prikaza lista po `data-reading-width|lineHeight|letterSpacing|paragraphGap` (širina retka, razmak redaka, slova, odlomaka); komponenta `ReadingModeControls` s kontrolama iz `@ductura/ui` (odabir koraka, vraćanje na zadano). Bez skrivanja ploča (VIZ-S1). Test: svaka vrijednost daje atribut; zadano ne mijenja ništa. Veličina: M. Ovisi o: WEB-V20-PREF-CITANJE. Putanje: `packages/app/src/host/editor/reading-mode/{ReadingModeControls.tsx,reading-mode.module.css,messages.hr.ts,reading-mode.test.ts}`.
4. **WEB-V20-POSTAVKE-DIJALOG** (M). Dijalog „Prikaz i čitanje” (font, način čitanja, brzina čitanja naglas) iz postojećih kontrola; ulaz iz izbornika trake alata. Nova polja: nema. Test: dijalog mijenja pohranjene postavke; „Zadano” ih vraća. Veličina: M. Ovisi o: WEB-V20-FONT-DISLEKSIJA, WEB-V20-NACIN-CITANJA, WEB-V20-NAGLAS-JEZGRA (samo uvoz tipa `ReadAloudRate`). Putanje: `packages/app/src/host/editor/reading-settings/{ReadingSettingsDialog.tsx,messages.hr.ts,reading-settings.test.ts}`; montiranje: jedan redak u `host/editor/toolbar/ToolbarBehaviour.tsx`.

### Čitanje naglas

5. **WEB-V20-NAGLAS-JEZGRA** (M). Čista jezgra čitanja naglas nad Web Speech API-jem: dijeljenje teksta na dijelove po rečenici (≤ 200 znakova), red čitanja, pauza/nastavak/stani, brzina (0,75 do 1,5), izbor glasa `hr-HR` ako postoji (inače zadani s napomenom), povratni pozivi za početak i kraj dijela (za isticanje). Ugrađena podrška se provjerava kao u `speechSupport`; nikad ne šalje tekst nigdje. Stari `src/components/editor/addons/speech.ts` ostaje neizmijenjen. Test s lažnim `speechSynthesis`: dijeljenje, pauza, otkazivanje starog čitanja, nepodržan preglednik, prazan tekst. Veličina: M. Ovisi o: ništa. Putanje: `packages/app/src/host/editor/read-aloud/{chunks.ts,controller.ts,support.ts,chunks.test.ts,controller.test.ts}`.
6. **WEB-V20-NAGLAS-UREDNIK** (M). Čitanje iz editora: „Čitaj odlomak”, „Čitaj odabir”, „Čitaj rad”, uz pauzu i stani; dekoracija ProseMirrora ističe rečenicu koja se čita; tipka Escape zaustavlja. Samo čitanje dokumenta, bez izmjene dokumenta i bez zapisa u dnevnik. Stanja: nepodržano, nema teksta, čita, pauza. Test: čitanje odabira ne mijenja dokument; nepodržan preglednik pokazuje poruku, ne grešku. Veličina: M. Ovisi o: WEB-V20-NAGLAS-JEZGRA. Putanje: `packages/app/src/host/editor/read-aloud/{ReadAloudControls.tsx,highlight.ts,messages.hr.ts,read-aloud-controls.test.ts}`; montiranje (zadatak drži sve točke): `packages/app/src/host/editor/read-aloud/ReadAloudHost.tsx` po uzoru na `host/editor/marks/MarksHost.tsx`: uzme `useLocalEditor()` i registrira plugin dekoracije kroz `editor.registerPlugin(...)` (isti mehanizam kao `marksPlugin()`), mont u jednom retku u `packages/app/src/host/student/work.tsx` pored `<MarksHost />`; rukovatelj radnje i prikaz gumba u `host/editor/toolbar/StudentToolbar.tsx` (stolna traka). `quick-tools.ts` je samo metapodatak mobilne trake (do 640 px, zatvoren skup id-eva) i nije jedino mjesto. Uskladba s WEB-V20-POSTAVKE-DIJALOG: različite datoteke (`ToolbarBehaviour.tsx` ondje, `StudentToolbar.tsx` ovdje); tko dođe kasnije spaja bazu.
7. **WEB-V20-NAGLAS-NACRT** (S). Podprikaz „Nacrt” prelazi sa starog `readAloud` na novu jezgru (pauza, brzina), zadržava poruke i ponašanje. Test: isti tekst za isti opseg; promjena opsega zaustavlja čitanje. Veličina: S. Ovisi o: WEB-V20-NAGLAS-JEZGRA. Putanje: `packages/app/src/host/editor/right/PregledGroup.tsx` (izmjena uvoza i `toggle`), `packages/app/src/host/editor/right/pregled-read-aloud.test.ts` (novo).

### Stilovi citiranja

8. **WEB-V20-STIL-APA-CHICAGO** (M). Dvije datoteke stila u istom obliku kao `config/faculties/fpzg/citation.json`, prilagođene hrvatskom (veznik „i”, „i sur.”, „ur.”, „U:”, „pristupljeno”, crtica raspona), s `provenance` (izvor pravila, bez prepisivanja tuđeg teksta), pravilima i primjerima s izmišljenim autorima. Test: `parseCitationStyle` prihvaća; format uz izmišljene izvore daje očekivane nizove; neispravna datoteka pada. Veličina: M. Ovisi o: ništa. Putanje: `config/citation-styles/apa.json`, `config/citation-styles/chicago.json`, `packages/app/src/host/editor/citation-styles/styles-apa-chicago.test.ts` (novo).
9. **WEB-V20-STIL-IEEE-VANCOUVER** (M). Dva numerička stila (`[1]` za IEEE, `1.` za Vancouver) na postojećem `numeric` dijelu `CitationStyle`; hrvatske oznake stranica. Test kao u 8., plus numeriranje po prvom navodu i popis po redu navođenja. Veličina: M. Ovisi o: ništa. Putanje: `config/citation-styles/ieee.json`, `config/citation-styles/vancouver.json`, `packages/app/src/host/editor/citation-styles/styles-ieee-vancouver.test.ts` (novo).
10. **WEB-V20-STIL-ODABIR** (M). Katalog stilova u hostu (`fpzg` iz postojeće datoteke, `apa`, `chicago`, `ieee`, `vancouver`; `citationStyleOf(id)` vraća stil ili `null` za `fusnote` i nepoznat id) i čitanje **stila ustanove** (samo prikaz, bez osobnog odabira): `student.text-check-config.get` s novim poljem `citationStyle` → stil; ishodi: stil, zadani FPZG uz oznaku „stil nije dostupan” (npr. `fusnote`), greška čitanja kao zasebno stanje (ne „nema podataka”). Ruta/polje nisu u izvatku dok SRV-V20-STIL-STUDENT ne uđe: orkestrator ih dodaje u izvadak, pisac spaja tu granu; bez toga PITANJE s točnim imenom. Test: svaki ID iz kataloga servera osim `fusnote` ima stil; tuđa ustanova nije izvediva (stil dolazi od sesije); 503 ≠ prazno. Veličina: M. Ovisi o: SRV-V20-STIL-STUDENT, WEB-V20-STIL-APA-CHICAGO, WEB-V20-STIL-IEEE-VANCOUVER. Putanje: `packages/app/src/host/editor/citation-styles/{catalog.ts,catalog.test.ts,use-institution-style.ts,use-institution-style.test.ts,messages.hr.ts}`.
11. **WEB-V20-STIL-POPIS** (M). Popis literature u studentskom pogledu i navod u tekstu oblikuju se **stilom ustanove** (za `author-date` stilove `formatBibliographyEntry`, `formatInText`, `assignYearSuffixes`, koji ne granaju po `style.style`; za `numeric` stilove `deriveBibliography` i `formatCitation` iz `packages/editor-core/src/document/citation/bibliography.ts`, koji numeriraju po prvom navodu). Student stil **ne mijenja**: uz popis se samo prikazuje „Stil: <naziv> (postavka ustanove)”. Bez izmjene dokumenta i bez zapisa na server. Test: točni nizovi: `fpzg` daje autor-godina, `ieee` daje `[1]`, `[2]` po prvom navodu i popis po redu navođenja; pad čitanja stila ne mijenja popis (ostaje FPZG s napomenom). Veličina: M. Ovisi o: WEB-V20-STIL-ODABIR. Putanje: `packages/app/src/host/editor/bibliography/student/{styled-entries.ts,styled-entries.test.ts}`; montiranje: jedan redak u `StudentBibliographyHost.tsx`.
12. **SRV-V20-STIL-STUDENT** (S). Student čita stil svoje ustanove: odgovor `student.text-check-config.get` dobiva obvezno polje `citationStyle` (zatvoren popis iz kataloga postavki: `fpzg, apa, chicago, ieee, vancouver, fusnote`; zadano `fpzg` kad ustanova nije postavila). Reader (`server/database/settings/text-check-config.ts`) već čita `citation.style` i `lekta.profile` za ustanovu zadatka; dodaje se samo polje u odgovor. Nova polja: `citationStyle` u odgovoru; nova ruta ne. Vektori, `server/contracts/generated/**`, `openapi/v1.json`, rukovatelj `server/http/text-check-config/index.ts` i test jednakosti ugovora s katalogom. Ako `contracts:breaking` odbije dodavanje obaveznog polja: gradi na postojećem ugovoru i upiši pod „Otvoreno za vlasnika”, ili nova studentska ruta `student.citation-style.get` (odluka orkestratora). Test: student upisan na kolegij vidi stil svoje ustanove, nepoznat ili tuđi `assignmentId` → 404. Veličina: S. Ovisi o: ništa; **jedini vlasnik** `server/contracts/routes/text-check-config.ts` i njegovih generiranih ugovora (traka S-A). Putanje: `server/contracts/routes/text-check-config.ts`, `server/contracts/vectors/student.text-check-config.get.json`, `server/http/text-check-config/index.ts`, `server/database/settings/text-check-config.ts` + testovi; generirano se regenerira.
13. **SRV-V20-STILOVI-USTANOVA** (S). Datoteka pravila fakulteta i zapis ustanove prihvaćaju sve ID-eve stila iz kataloga postavki umjesto samo `fpzg`: `CITATION_STYLES` u `server/database/institution-config/schema.ts` i `server/settings/institutions.ts` (`server/domain/settings/catalogue.ts` ostaje izvor). Ugovor se ne mijenja: `institution.faculty-rules.post` nema polje `citationStyle` (izvadak `migration-contract-types.generated.ts:310`). Test: svaka vrijednost prolazi, nepoznata pada; datoteka ustanove s `apa` se čita. Veličina: S. Ovisi o: ništa (ne dira datoteke ugovora). Putanje: `server/database/institution-config/schema.ts`, `server/settings/institutions.ts`, `server/database/institution-config/schema.test.ts`, `server/settings/institutions.test.ts`.
14. **WEB-V20-E2E** (S). Playwright tok na lokalnom stogu (lažni OIDC) kao izmišljeni student: uključi font za disleksiju i način čitanja (atributi na `<html>`, ostaju nakon osvježenja), pokreni čitanje naglas s lažnim `speechSynthesis` (pauza, stani), provjeri popis literature za stil ustanove: stil se **ne bira**, nego se mijenja odgovor poslužitelja: `page.route` presreće `student.text-check-config.get` i vraća `citationStyle` `fpzg`, zatim `ieee` (izmišljeni podaci, bez lažne ustanove); axe na 1250 i 400 px; tuđi rad → 404. Veličina: S. Ovisi o: WEB-V20-POSTAVKE-DIJALOG, WEB-V20-NAGLAS-UREDNIK, WEB-V20-STIL-POPIS. Putanje: `e2e/val20-razlika.spec.js` (novo).

## 4. Redoslijed i preklapanja

```
PREF-CITANJE → FONT-DISLEKSIJA ┐
PREF-CITANJE → NACIN-CITANJA   ├→ POSTAVKE-DIJALOG ┐
NAGLAS-JEZGRA ─┬→ (tip brzine) ┘                    │
               ├→ NAGLAS-UREDNIK ───────────────────┼→ E2E
               └→ NAGLAS-NACRT                      │
APA-CHICAGO ┐                                       │
IEEE-VANC.  ┼→ STIL-ODABIR → STIL-POPIS ───────────┘
SRV-STIL-STUDENT ┘ (ugovor prije weba)
SRV-V20-STILOVI-USTANOVA (neovisno)
```

- Jedina datoteka ugovora je `server/contracts/routes/text-check-config.ts` (SRV-V20-STIL-STUDENT, jedini vlasnik); WEB izvadak dopunjuje orkestrator prije STIL-ODABIR.
- Zajedničke datoteke diraju po jedan zadatak (popis u §3). `messages.hr` svaki zadatak piše u vlastitom direktoriju.
- Prvi val (bez ovisnosti): PREF-CITANJE, NAGLAS-JEZGRA, APA-CHICAGO, IEEE-VANCOUVER, SRV-V20-STIL-STUDENT, SRV-V20-STILOVI-USTANOVA.

## 5. Otvoreno i granice

- **Font i licenca** (§2.1): vlasnik bira font; do tada WEB-V20-FONT-DISLEKSIJA ne spaja datoteku fonta bez potvrđene licence.
- **Skrivanje ploča u načinu čitanja** traži izmjenu okvira ljuske (VIZ-S1): izvan vala.
- **`fusnote`** (§2.4) traži kritični zadatak nad kanonskim modelom dokumenta: izvan vala.
- **Čitanje naglas u nastavničkom prikazu rada** (`live.document.get`): nije traženo; ako se želi, zaseban WEB zadatak nad `host/teacher/**` s istom jezgrom.
- **Nesklad kataloga i datoteke pravila** (§2.4) ostaje otvoren do SRV-V20-STILOVI-USTANOVA; **studentska ruta za stil** do SRV-V20-STIL-STUDENT (Nedostaje na poslužitelju).
- **Nije građeno** (čeka licence): pravopis, gramatika, Struna, Hrčak, CROSBI.

## 6. Tablica za orkestratora

| ID | r | deps | paths |
|---|---|---|---|
| WEB-V20-PREF-CITANJE | S | - | `packages/app/src/host/shared/reading-prefs/**` |
| WEB-V20-FONT-DISLEKSIJA | M | WEB-V20-PREF-CITANJE | `packages/ui/src/fonts/dyslexia/**`, `packages/ui/src/styles/reading-font.css`, `packages/ui/src/fonts/dyslexia.test.ts`; `packages/ui/package.json` (izvoz), `packages/app/app/layout.tsx` (1 redak uvoza) |
| WEB-V20-NACIN-CITANJA | M | WEB-V20-PREF-CITANJE | `packages/app/src/host/editor/reading-mode/**` |
| WEB-V20-POSTAVKE-DIJALOG | M | WEB-V20-FONT-DISLEKSIJA, WEB-V20-NACIN-CITANJA, WEB-V20-NAGLAS-JEZGRA | `packages/app/src/host/editor/reading-settings/**`; `host/editor/toolbar/ToolbarBehaviour.tsx` (1 redak) |
| WEB-V20-NAGLAS-JEZGRA | M | - | `packages/app/src/host/editor/read-aloud/{chunks,controller,support}.ts` + testovi |
| WEB-V20-NAGLAS-UREDNIK | M | WEB-V20-NAGLAS-JEZGRA | `packages/app/src/host/editor/read-aloud/{ReadAloudControls.tsx,ReadAloudHost.tsx,highlight.ts,messages.hr.ts}` + test; `host/editor/toolbar/StudentToolbar.tsx`, `host/student/work.tsx` (1 redak); `quick-tools.ts` samo uz mobilni unos |
| WEB-V20-NAGLAS-NACRT | S | WEB-V20-NAGLAS-JEZGRA | `packages/app/src/host/editor/right/PregledGroup.tsx`, `.../right/pregled-read-aloud.test.ts` |
| WEB-V20-STIL-APA-CHICAGO | M | - | `config/citation-styles/{apa,chicago}.json`, `packages/app/src/host/editor/citation-styles/styles-apa-chicago.test.ts` |
| WEB-V20-STIL-IEEE-VANCOUVER | M | - | `config/citation-styles/{ieee,vancouver}.json`, `packages/app/src/host/editor/citation-styles/styles-ieee-vancouver.test.ts` |
| WEB-V20-STIL-ODABIR | M | SRV-V20-STIL-STUDENT, WEB-V20-STIL-APA-CHICAGO, WEB-V20-STIL-IEEE-VANCOUVER | `packages/app/src/host/editor/citation-styles/{catalog.ts,catalog.test.ts,use-institution-style.ts,use-institution-style.test.ts,messages.hr.ts}` |
| WEB-V20-STIL-POPIS | M | WEB-V20-STIL-ODABIR | `packages/app/src/host/editor/bibliography/student/{styled-entries.ts,styled-entries.test.ts}`; `StudentBibliographyHost.tsx` (1 redak) |
| SRV-V20-STIL-STUDENT | S | - | `server/contracts/routes/text-check-config.ts` (jedini vlasnik), `server/contracts/vectors/student.text-check-config.get.json`, `server/http/text-check-config/index.ts`, `server/database/settings/text-check-config.ts` + testovi, generirano |
| SRV-V20-STILOVI-USTANOVA | S | - | `server/database/institution-config/schema.ts`, `server/settings/institutions.ts` + testovi (bez ugovora) |
| WEB-V20-E2E | S | WEB-V20-POSTAVKE-DIJALOG, WEB-V20-NAGLAS-UREDNIK, WEB-V20-STIL-POPIS | `e2e/val20-razlika.spec.js` |

Neutvrđeno pri pisanju: točan CSS selektor lista u editoru (WEB-V20-FONT-DISLEKSIJA i WEB-V20-NACIN-CITANJA ga utvrđuju u svojem PR-u) i hoće li `contracts:breaking` odbiti obavezno polje `citationStyle` (provjerava SRV pisac; ishodi navedeni u zadatku 12).
