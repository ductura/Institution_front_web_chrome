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
| Student čita stil ustanove | `student.text-check-config.get` (`server/contracts/routes/text-check-config.ts`, vraća i `citation.style`) | ruta postoji, ugovorno čitanje u izvatku provjeriti |
| Katalog servera | `server/domain/settings/catalogue.ts`: `citation.style` ∈ `fpzg, apa, chicago, ieee, vancouver, fusnote`, razina ustanova | katalog je već proširen |
| **Nesklad** | `server/database/institution-config/schema.ts` `CITATION_STYLES = ["fpzg"]`; `server/settings/institutions.ts` `CITATION_STYLES = ["fpzg"]` | zapisnik pravila fakulteta (`institution.faculty-rules.post`) prihvaća samo `fpzg`, iako katalog dopušta pet drugih |
| Server oblikuje stil? | ne: serveru stil služi samo kao oznaka; oblikovanje je na klijentu | zato su stilovi WEB datoteke |

Nesklad se bilježi kao otvoren i rješava zadatkom SRV-V20-STILOVI-USTANOVA. `fusnote` (bilješke ispod crte) nije izraziv tipom `CitationStyle` (samo `author-date` i `numeric`); njegovo uvođenje mijenja kanonski model dokumenta i ide samo kroz kritični zadatak (usporedi PIL-K-SHEMA-V3), pa ga ovaj val **ne gradi**: ostaje u katalogu, a sučelje ga prikazuje kao „nije dostupno” i koristi FPZG.

## 3. Zadaci koji nedostaju (14)

Oznake: veličina S ≤ ~120 redaka koda, M ≤ ~400. Ovisnost „server ugovor prije weba” ovdje ne nastaje: jedini SRV zadatak ne mijenja ugovor i nijedan WEB zadatak ga ne čeka. Svaki zadatak ima svoje nove datoteke; zajedničke točke montiranja su navedene jednom.

**Zajedničke točke montiranja** (po jedan redak, svaka samo u jednom zadatku): `host/editor/toolbar/ToolbarBehaviour.tsx` (WEB-V20-POSTAVKE-DIJALOG), `host/editor/toolbar/StudentToolbar.tsx`, `host/editor/toolbar/quick-tools.ts` (WEB-V20-NAGLAS-UREDNIK), `host/editor/right/PregledGroup.tsx` (WEB-V20-NAGLAS-NACRT), `host/editor/bibliography/student/StudentBibliographyHost.tsx` (WEB-V20-STIL-POPIS). Nijedan zadatak ne mijenja datoteku ugovora; nijedan ne dira `packages/ui/src/tokens/globals.css`, `packages/editor-core` ni `src/**`.

### Font i prikaz

1. **WEB-V20-PREF-CITANJE** (S). Jedan spremnik osobnih postavki čitanja u pregledniku: `font` (`standard` | `dyslexia`), `width`, `lineHeight`, `letterSpacing`, `paragraphGap` (zatvoreni skupovi koraka), ključ `ductura.reading.v1`; neispravna pohranjena vrijednost se zanemaruje, blokirana pohrana ne ruši ekran; primjena kroz atribute `data-reading-*` na `<html>`. Nema API-ja ni novih polja. Veličina: S. Ovisi o: ništa. Putanje: `packages/app/src/host/shared/reading-prefs/{model.ts,store.ts,model.test.ts,store.test.ts}`.
2. **WEB-V20-FONT-DISLEKSIJA** (M). Lokalna datoteka fonta za disleksiju (licenca potvrđena, bilješka o izvoru i licenci u istom direktoriju), `@font-face` i pravilo koje pri `data-reading-font="dyslexia"` mijenja font lista i teksta rada; interfejs ljuske ostaje. Test: bez atributa font je nepromijenjen; bez CDN-a (pretraga URL-ova u CSS-u). Veličina: M. Ovisi o: WEB-V20-PREF-CITANJE. Putanje: `packages/ui/src/fonts/dyslexia/**` (novo), `packages/ui/src/styles/reading-font.css` (novo), `packages/ui/src/fonts/dyslexia.test.ts` (novo).
3. **WEB-V20-NACIN-CITANJA** (M). Pravila prikaza lista po `data-reading-width|lineHeight|letterSpacing|paragraphGap` (širina retka, razmak redaka, slova, odlomaka); komponenta `ReadingModeControls` s kontrolama iz `@ductura/ui` (odabir koraka, vraćanje na zadano). Bez skrivanja ploča (VIZ-S1). Test: svaka vrijednost daje atribut; zadano ne mijenja ništa. Veličina: M. Ovisi o: WEB-V20-PREF-CITANJE. Putanje: `packages/app/src/host/editor/reading-mode/{ReadingModeControls.tsx,reading-mode.module.css,messages.hr.ts,reading-mode.test.ts}`.
4. **WEB-V20-POSTAVKE-DIJALOG** (M). Dijalog „Prikaz i čitanje” (font, način čitanja, brzina čitanja naglas) iz postojećih kontrola; ulaz iz izbornika trake alata. Nova polja: nema. Test: dijalog mijenja pohranjene postavke; „Zadano” ih vraća. Veličina: M. Ovisi o: WEB-V20-FONT-DISLEKSIJA, WEB-V20-NACIN-CITANJA, WEB-V20-NAGLAS-JEZGRA (samo uvoz tipa `ReadAloudRate`). Putanje: `packages/app/src/host/editor/reading-settings/{ReadingSettingsDialog.tsx,messages.hr.ts,reading-settings.test.ts}`; montiranje: jedan redak u `host/editor/toolbar/ToolbarBehaviour.tsx`.

### Čitanje naglas

5. **WEB-V20-NAGLAS-JEZGRA** (M). Čista jezgra čitanja naglas nad Web Speech API-jem: dijeljenje teksta na dijelove po rečenici (≤ 200 znakova), red čitanja, pauza/nastavak/stani, brzina (0,75 do 1,5), izbor glasa `hr-HR` ako postoji (inače zadani s napomenom), povratni pozivi za početak i kraj dijela (za isticanje). Ugrađena podrška se provjerava kao u `speechSupport`; nikad ne šalje tekst nigdje. Stari `src/components/editor/addons/speech.ts` ostaje neizmijenjen. Test s lažnim `speechSynthesis`: dijeljenje, pauza, otkazivanje starog čitanja, nepodržan preglednik, prazan tekst. Veličina: M. Ovisi o: ništa. Putanje: `packages/app/src/host/editor/read-aloud/{chunks.ts,controller.ts,support.ts,chunks.test.ts,controller.test.ts}`.
6. **WEB-V20-NAGLAS-UREDNIK** (M). Čitanje iz editora: „Čitaj odlomak”, „Čitaj odabir”, „Čitaj rad”, uz pauzu i stani; dekoracija ProseMirrora ističe rečenicu koja se čita; tipka Escape zaustavlja. Samo čitanje dokumenta, bez izmjene dokumenta i bez zapisa u dnevnik. Stanja: nepodržano, nema teksta, čita, pauza. Test: čitanje odabira ne mijenja dokument; nepodržan preglednik pokazuje poruku, ne grešku. Veličina: M. Ovisi o: WEB-V20-NAGLAS-JEZGRA. Putanje: `packages/app/src/host/editor/read-aloud/{ReadAloudControls.tsx,highlight.ts,messages.hr.ts,read-aloud-controls.test.ts}`; montiranje (zadatak drži sve tri točke): rukovatelj radnje i prikaz u `host/editor/toolbar/StudentToolbar.tsx` (stolna traka), plugin dekoracije u sklopu editora istog hosta; `quick-tools.ts` je samo metapodatak mobilne trake (vidljiva do 640 px, `QuickTool` ima zatvoren skup id-eva) i ne smije biti jedino mjesto. Uskladba s WEB-V20-POSTAVKE-DIJALOG: ta dva zadatka ne diraju iste retke `ToolbarBehaviour.tsx`/`StudentToolbar.tsx`; zadatak koji kasnije dođe spaja bazu.
7. **WEB-V20-NAGLAS-NACRT** (S). Podprikaz „Nacrt” prelazi sa starog `readAloud` na novu jezgru (pauza, brzina), zadržava poruke i ponašanje. Test: isti tekst za isti opseg; promjena opsega zaustavlja čitanje. Veličina: S. Ovisi o: WEB-V20-NAGLAS-JEZGRA. Putanje: `packages/app/src/host/editor/right/PregledGroup.tsx` (izmjena uvoza i `toggle`), `packages/app/src/host/editor/right/pregled-read-aloud.test.ts` (novo).

### Stilovi citiranja

8. **WEB-V20-STIL-APA-CHICAGO** (M). Dvije datoteke stila u istom obliku kao `config/faculties/fpzg/citation.json`, prilagođene hrvatskom (veznik „i”, „i sur.”, „ur.”, „U:”, „pristupljeno”, crtica raspona), s `provenance` (izvor pravila, bez prepisivanja tuđeg teksta), pravilima i primjerima s izmišljenim autorima. Test: `parseCitationStyle` prihvaća; format uz izmišljene izvore daje očekivane nizove; neispravna datoteka pada. Veličina: M. Ovisi o: ništa. Putanje: `config/citation-styles/apa.json`, `config/citation-styles/chicago.json`, `packages/app/src/host/editor/citation-styles/styles-apa-chicago.test.ts` (novo).
9. **WEB-V20-STIL-IEEE-VANCOUVER** (M). Dva numerička stila (`[1]` za IEEE, `1.` za Vancouver) na postojećem `numeric` dijelu `CitationStyle`; hrvatske oznake stranica. Test kao u 8., plus numeriranje po prvom navodu i popis po redu navođenja. Veličina: M. Ovisi o: ništa. Putanje: `config/citation-styles/ieee.json`, `config/citation-styles/vancouver.json`, `packages/app/src/host/editor/citation-styles/styles-ieee-vancouver.test.ts` (novo).
10. **WEB-V20-STIL-KATALOG** (S). Katalog stilova u hostu: `fpzg` (postojeća datoteka), `apa`, `chicago`, `ieee`, `vancouver`; funkcija `citationStyleOf(id)` vraća stil ili `null` za `fusnote` i nepoznat id; zatvoren popis ID-eva u skladu s `settings.catalogue.get`. Test: svaki ID iz kataloga servera osim `fusnote` ima stil; `fusnote` i izmišljen id → `null`. Veličina: S. Ovisi o: WEB-V20-STIL-APA-CHICAGO, WEB-V20-STIL-IEEE-VANCOUVER. Putanje: `packages/app/src/host/editor/citation-styles/{catalog.ts,catalog.test.ts}`.
11. **WEB-V20-STIL-ODABIR** (M). Čitanje stila ustanove u hostu: `student.text-check-config.get` (ili `settings.values.get`, ovisno o izvatku) → `citation.style`; ishodi: stil, zadani FPZG uz oznaku „stil nije dostupan” (npr. `fusnote`), greška čitanja kao zasebno stanje (ne „nema podataka”); zamjenjuje stari `institution-citation-settings.ts` samo u hostu. Bez novih ruta; ako ruta nije u izvatku: PITANJE s točnim imenom operacije. Test: tuđa ustanova nije izvediva (stil dolazi od sesije); 503 ≠ prazno. Veličina: M. Ovisi o: WEB-V20-STIL-KATALOG. Putanje: `packages/app/src/host/editor/citation-styles/{use-institution-style.ts,messages.hr.ts,use-institution-style.test.ts}`.
12. **WEB-V20-STIL-POPIS** (M). Popis literature u studentskom pogledu i navod u tekstu oblikuju se stilom ustanove (za `author-date` stilove `formatBibliographyEntry`, `formatInText`, `assignYearSuffixes`, koji ne granaju po `style.style`; za `numeric` stilove `deriveBibliography` i `formatCitation` iz `packages/editor-core/src/document/citation/bibliography.ts`, koji numeriraju po prvom navodu); odabir stila prikazan uz popis, bez izmjene dokumenta i bez zapisa na server. Test: točni nizovi (ne samo „različito”): `fpzg` daje autor-godina, `ieee` daje `[1]`, `[2]` po prvom navodu i popis po redu navođenja; pad čitanja stila ne mijenja popis (ostaje FPZG s napomenom). Veličina: M. Ovisi o: WEB-V20-STIL-ODABIR. Putanje: `packages/app/src/host/editor/bibliography/student/styled-entries.ts` (novo), `.../styled-entries.test.ts` (novo); montiranje: jedan redak u `StudentBibliographyHost.tsx`.
13. **SRV-V20-STILOVI-USTANOVA** (S). Zapisnik pravila fakulteta prihvaća sve ID-eve stila iz kataloga postavki (`fpzg, apa, chicago, ieee, vancouver, fusnote`) umjesto samo `fpzg`: `CITATION_STYLES` u `server/database/institution-config/schema.ts` i `server/settings/institutions.ts`, `server/domain/settings/catalogue.ts` ostaje izvor. Nova polja: nema; oblik `institution.faculty-rules.post` (`citationStyle`) širi dopuštene vrijednosti (provjeriti zahtijeva li to `contracts:breaking`; ako da: zadržati postojeći ugovor i upisati pod „Otvoreno za vlasnika”, po pravilu orkestratora). Test: svaka vrijednost prolazi, nepoznata pada; datoteka ustanova s `apa` se čita. Veličina: S. Ovisi o: ništa; **WEB-V20-STIL-ODABIR ne čeka** ovaj zadatak (čita postavku i ako je ustanova ostala na `fpzg`). Putanje: `server/database/institution-config/schema.ts`, `server/settings/institutions.ts`, `server/database/institution-config/schema.test.ts`, `server/settings/institutions.test.ts`; ugovorne datoteke samo ako provjera traži (jedna traka S-A).
14. **WEB-V20-E2E** (S). Playwright tok na lokalnom stogu (lažni OIDC) kao izmišljeni student: uključi font za disleksiju i način čitanja (atributi na `<html>`, ostaju nakon osvježenja), pokreni čitanje naglas s lažnim `speechSynthesis` (pauza, stani), promijeni stil popisa literature (`fpzg` ↔ `ieee`); axe na 1250 i 400 px; tuđi rad → 404. Veličina: S. Ovisi o: WEB-V20-POSTAVKE-DIJALOG, WEB-V20-NAGLAS-UREDNIK, WEB-V20-STIL-POPIS. Putanje: `e2e/val20-razlika.spec.js` (novo).

## 4. Redoslijed i preklapanja

```
PREF-CITANJE → FONT-DISLEKSIJA ┐
PREF-CITANJE → NACIN-CITANJA   ├→ POSTAVKE-DIJALOG ┐
NAGLAS-JEZGRA ─┬→ (tip brzine) ┘                    │
               ├→ NAGLAS-UREDNIK ───────────────────┼→ E2E
               └→ NAGLAS-NACRT                      │
APA-CHICAGO ┐                                       │
IEEE-VANC.  ┴→ KATALOG → ODABIR → POPIS ────────────┘
SRV-V20-STILOVI-USTANOVA (neovisno)
```

- Nijedan par zadataka ne dijeli datoteku ugovora; jedini SRV zadatak drži svoje dvije datoteke i, ako treba, traku S-A.
- Zajedničke datoteke diraju po jedan zadatak (popis u §3). `messages.hr` svaki zadatak piše u vlastitom direktoriju.
- Prvi val (bez ovisnosti): PREF-CITANJE, NAGLAS-JEZGRA, APA-CHICAGO, IEEE-VANCOUVER, SRV-V20-STILOVI-USTANOVA.

## 5. Otvoreno i granice

- **Font i licenca** (§2.1): vlasnik bira font; do tada WEB-V20-FONT-DISLEKSIJA ne spaja datoteku fonta bez potvrđene licence.
- **Skrivanje ploča u načinu čitanja** traži izmjenu okvira ljuske (VIZ-S1): izvan vala.
- **`fusnote`** (§2.4) traži kritični zadatak nad kanonskim modelom dokumenta: izvan vala.
- **Čitanje naglas u nastavničkom prikazu rada** (`live.document.get`): nije traženo; ako se želi, zaseban WEB zadatak nad `host/teacher/**` s istom jezgrom.
- **Nesklad kataloga i zapisnika pravila** (§2.4) ostaje otvoren do SRV-V20-STILOVI-USTANOVA.
- **Nije građeno** (čeka licence): pravopis, gramatika, Struna, Hrčak, CROSBI.

## 6. Tablica za orkestratora

| ID | r | deps | paths |
|---|---|---|---|
| WEB-V20-PREF-CITANJE | S | - | `packages/app/src/host/shared/reading-prefs/**` |
| WEB-V20-FONT-DISLEKSIJA | M | WEB-V20-PREF-CITANJE | `packages/ui/src/fonts/dyslexia/**`, `packages/ui/src/styles/reading-font.css`, `packages/ui/src/fonts/dyslexia.test.ts` |
| WEB-V20-NACIN-CITANJA | M | WEB-V20-PREF-CITANJE | `packages/app/src/host/editor/reading-mode/**` |
| WEB-V20-POSTAVKE-DIJALOG | M | WEB-V20-FONT-DISLEKSIJA, WEB-V20-NACIN-CITANJA, WEB-V20-NAGLAS-JEZGRA | `packages/app/src/host/editor/reading-settings/**`; `host/editor/toolbar/ToolbarBehaviour.tsx` (1 redak) |
| WEB-V20-NAGLAS-JEZGRA | M | - | `packages/app/src/host/editor/read-aloud/{chunks,controller,support}.ts` + testovi |
| WEB-V20-NAGLAS-UREDNIK | M | WEB-V20-NAGLAS-JEZGRA | `packages/app/src/host/editor/read-aloud/{ReadAloudControls.tsx,highlight.ts,messages.hr.ts}` + test; `host/editor/toolbar/StudentToolbar.tsx` (rukovatelj i prikaz; `quick-tools.ts` samo uz mobilni unos) |
| WEB-V20-NAGLAS-NACRT | S | WEB-V20-NAGLAS-JEZGRA | `packages/app/src/host/editor/right/PregledGroup.tsx`, `.../right/pregled-read-aloud.test.ts` |
| WEB-V20-STIL-APA-CHICAGO | M | - | `config/citation-styles/{apa,chicago}.json`, `packages/app/src/host/editor/citation-styles/styles-apa-chicago.test.ts` |
| WEB-V20-STIL-IEEE-VANCOUVER | M | - | `config/citation-styles/{ieee,vancouver}.json`, `packages/app/src/host/editor/citation-styles/styles-ieee-vancouver.test.ts` |
| WEB-V20-STIL-KATALOG | S | WEB-V20-STIL-APA-CHICAGO, WEB-V20-STIL-IEEE-VANCOUVER | `packages/app/src/host/editor/citation-styles/{catalog.ts,catalog.test.ts}` |
| WEB-V20-STIL-ODABIR | M | WEB-V20-STIL-KATALOG | `packages/app/src/host/editor/citation-styles/{use-institution-style.ts,messages.hr.ts,use-institution-style.test.ts}` |
| WEB-V20-STIL-POPIS | M | WEB-V20-STIL-ODABIR | `packages/app/src/host/editor/bibliography/student/{styled-entries.ts,styled-entries.test.ts}`; `StudentBibliographyHost.tsx` (1 redak) |
| SRV-V20-STILOVI-USTANOVA | S | - | `server/database/institution-config/schema.ts`, `server/settings/institutions.ts` + testovi (ugovor samo ako provjera traži) |
| WEB-V20-E2E | S | WEB-V20-POSTAVKE-DIJALOG, WEB-V20-NAGLAS-UREDNIK, WEB-V20-STIL-POPIS | `e2e/val20-razlika.spec.js` |

Neutvrđeno pri pisanju: ugovorni oblik `student.text-check-config.get` u WEB izvatku (ne provjeravano u kodu), točan CSS selektor lista u editoru (WEB-V20-FONT-DISLEKSIJA i WEB-V20-NACIN-CITANJA ga utvrđuju u svojem PR-u), i je li širenje `citationStyle` u `institution.faculty-rules.post` lomljenje ugovora (provjerava SRV pisac).
