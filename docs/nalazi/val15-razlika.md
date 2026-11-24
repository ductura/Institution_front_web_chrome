# Val 15: razlika (V15-PREGLED `val15-razlika`)

Datum: 25. 11. 2026. Pisac: slot `wv15pregled`. Nalog: orkestrator, Ductus#2055 (komentar 7147314384), po odluci vlasnika („Može, idemo na sve valove”; `ductura/.github` `docs/plan/NOVE-FUNKCIJE.md` t. 8, PR #85; `PLAN-MIGRACIJE.md` val 15). **Samo dokumentacija; kod se ne mijenja.**

Pregledane baze:

| Repo | Grana | SHA |
|---|---|---|
| WEB `ductura/Institution_front_web_chrome` | `migracija/kopija-ductus-front` | `ff7d6798efbe1e0e5f87629ef79e5df5a2a6f5b3` |
| SRV `ductura/Institution_server` (javno) | `migracija/kopija-ductus-backend` | `abf94a9431fddc85631570b8d258816384bf18de` |

SRV `API_VERSION` na toj bazi je `1.116.0` (`server/contracts/version.ts`). Izvadak ugovora u WEB-u može zaostajati; prije svakog SRV zadatka provjeri `git ls-tree` baze.

## 1. Opseg vala 15

Plan (`PLAN-MIGRACIJE.md`, redak vala 15): „Statistička analiza (u stilu jamovija ili SPSS-a). Nakon pilota. Zaseban repo i servis za izračune (Python ili R) otvara se tek kad val krene; web prikazuje rezultate samo kroz `/api/v1`. Rezultat je ponovljiv iz istih podataka i iste verzije analize. Kod pod AGPL ili GPL licencom (npr. jamovi) ne kopira se bez odluke vlasnika o licenci.”

**U opsegu (samo dijelovi bez novog repoa i bez koda pod AGPL/GPL):**

1. ugovor `/api/v1` za **opis analize** i **rezultat**, ponovljiv iz istih podataka i verzije analize;
2. web prikaz rezultata i učitavanje skupa podataka, na izmišljenim podacima;
3. mock izračun na našem serveru, samo jer je **deterministički i malen**: opisna statistika, tablica učestalosti, Pearsonov koeficijent korelacije.

**Isključeno (ne gradi se u ovom valu):**

- zaseban servis za izračune (Python/R) i novi repo: otvara ga vlasnik kad val 15 stvarno krene;
- bilo koji kod iz jamovija, SPSS-a, R paketa ili drugog AGPL/GPL izvora; formule se pišu iz javno poznatih definicija, bez kopiranja koda (odluka o licenci je kod vlasnika);
- testovi značajnosti i p-vrijednosti (t-test, ANOVA, hi-kvadrat, regresija): traže provjerenu numeriku (nepotpuna beta/gama funkcija), pa idu uz stvarni servis;
- pohrana skupova podataka i spremljenih analiza na serveru: traži tablicu, RLS i pgTAP retke, a osobni podaci ispitanika traže DPIA; u ovom valu je izračun **bez stanja** (skup putuje u zahtjevu i ne ostaje);
- upitnici i kvalitativno kodiranje (val 18), prijenos iz Merlina ili izvoz u SPSS/jamovi formate;
- rangiranje studenata, ocjenjivanje i automatske sankcije: analiza nikad ne prima identitet osobe niti vraća usporedbu osoba;
- plaćeni API-ji i tuđi servisi.

Pravila koja vrijede za sve zadatke ispod: samo izmišljeni podaci (nikad stvarni studentski radovi ni osobni podaci); podaci samo kroz `/api/v1`; komponente iz `@ductura/ui`; vizualni smjer „papir i grafit”; tekst sučelja na hrvatskom; aplikacija živi **isključivo** u `packages/app/src/host/` (`src/app`, `src/components` su stari kod i ne diraju se); PR ≤ ~400 redaka koda.

## 2. Što već postoji

### 2.1 Statistika i analiza

| Stavka | Stanje |
|---|---|
| Statistička analiza, skup podataka, korelacija, srednja vrijednost, standardna devijacija (pretraga u WEB `packages/`, `src/client`, SRV `server/`, `db/main/migrations`, `config/`) | **ne postoji.** Pogoci riječi „analiza/statisti” su nepovezani (npr. SRV `server/log/analysis`, vidi dolje; WEB `Merlin`, `pilot-metrics`) |
| Ugovor za opis analize ili rezultat | **ne postoji**; u `server/contracts/routes/` nema rute s imenom `analysis`, a izvadak `src/client/migration-contracts.generated.json` ih ne sadrži |
| Statistički servis, repo, Python/R | **ne postoji** i ne gradi se (§1) |

### 2.2 Dijelovi na koje se zadaci oslanjaju (nisu statistika, ali daju obrazac)

| Stavka | Putanja | Što daje |
|---|---|---|
| Obrazac „isti ključ = isti rezultat” | SRV `server/contracts/routes/merlin-packages.ts` (`requestKey`, 8 do 128 znakova) | primjer ugovora s idempotentnim zahtjevom; **ovdje se ne koristi** jer izračun nema stanja |
| Kanonski JSON i otisak | SRV `server/domain/forensics/jcs.ts` (`canonicalizeJcs`), `server/domain/forensics/crypto.ts` (`sha256WebCrypto`) | deterministična serijalizacija i SHA-256; osnova za `datasetSha256` i `resultSha256` |
| Zajednički JSON tipovi | SRV `server/domain/json/` | tipovi i provjere ulaza |
| Ugovorna shema i pristup | SRV `server/contracts/schema/index.ts` (`closed`, `defineRoute`, `error`); pristup `signed_in` (36 ruta), `teacher`, `student`, `operator` itd.; `MUTATION_GUARD` u `server/contracts/routes/shared.ts` | zatvorene sheme (nepoznato polje pada), čuvar mutacija |
| Primjer ugovora s malim zbirnim brojevima | SRV `server/contracts/routes/pilot-metrics.ts` | zbirni, anonimni odgovor bez identifikatora; ista filozofija (bez osoba) |
| Primjer ulaza kao CSV | SRV `server/contracts/routes/roster-import.ts` (`ROSTER_IMPORT_MAX_CSV_LENGTH = 200000`, `ROSTER_IMPORT_MAX_ROWS = 1000`, separator `;` ili `,`, RFC 4180 navodnici, BOM) | postojeća ograničenja i pravila čitanja CSV-a; ovdje je CSV samo klijentski, na serveru ulazi JSON |
| Ograničenja tijela zahtjeva | SRV `server/contracts/routes/import.ts` (`maxBodyBytes`, 413 `body_too_large`) | način deklariranja najveće veličine tijela |
| Pravila log analize | SRV `server/log/analysis/` (`analyzeLog`) | **nije** statistika za korisnike (zapisi sustava); ne dira se i ne koristi |
| Zajednička tablica | WEB `packages/ui/src/index.ts`: `DataTable`, `DataTableColumn`, `DataTableProps` (iz `./table`) | tablice rezultata iz `@ductura/ui` |
| Ostali UI | WEB `packages/ui/src/components/`: Button, Card, TextField, Select, Dialog, Details, ErrorScreen, RouteLoading, Skeleton, Tag, Chip, `searchable-list`, `segmented` | gumbi, polja, kartice, stanja učitavanje/greška |
| Čitanje s trima ishodima (učitavanje, greška, prazno) | WEB `packages/app/src/host/operator/pilot-metrics/{read.ts,view.ts,no-direct-api.test.ts}` | obrazac za klijentsko čitanje rute i zabranu izravnog API-ja |
| Klijent API-ja | WEB `src/client/api.ts` (`ApiOperationId`, `callMigrationRoute`), izvadak `src/client/migration-contract*.generated.*` | tipizirani pozivi; nove operacije u izvadak dodaje orkestrator |
| Montiranje stranice | WEB `packages/app/src/routes.ts` (popis ruta, `roles`, `accounts`), `packages/app/src/host/pages.tsx` | gdje se nova stranica registrira |
| Montiranje rute na serveru | SRV `server/contracts/routes/index.ts`, `server/contracts/inventory.ts`, `server/http/index.ts` (`createPilotMetricsRouteFor` kao uzorak), `packages/test-fakes/dev-server` (`DEV_HANDLERS`) | zajedničke točke koje svaki SRV zadatak dira jednim retkom |
| Lažni dev server | SRV `packages/test-fakes/dev-server/index.ts`, `coverage.test.ts` | handler za novu rutu i scenarij |
| Domenske mape | SRV `server/domain/index.test.ts` (fiksni popis domenskih mapa) | novi redak `analysis` |

### 2.3 Što fali (sažetak)

1. Ugovor: `analysis.catalogue.get` i `analysis.runs.post` s opisom analize i rezultatom (§3.1).
2. Čista domena `server/domain/analysis/`: provjera skupa, opisna statistika, učestalosti, korelacija, otisci, izvršitelj s verzijom analize.
3. HTTP rukovatelj (tanki adapter) iza zastavice „isključeno”, lažni dev handler i fiksni testovi.
4. WEB: klijent, učitavanje CSV-a, izmišljeni skupovi, odabir analize, prikaz rezultata, stranica, e2e.

## 3. Predloženi ugovor (nove rute i polja)

Svi zadaci niže izvode polja iz ove tablice; **jedini vlasnik** datoteke `server/contracts/routes/analysis.ts` i njezinih generiranih ugovora je SRV-V15-UGOVOR.

### 3.1 Rute

| Id operacije | Metoda i putanja | Pristup | Što radi |
|---|---|---|---|
| `analysis.catalogue.get` | GET `/api/v1/analysis/catalogue` | `signed_in` | popis analiza, njihove verzije, parametri i ograničenja skupa |
| `analysis.runs.post` | POST `/api/v1/analysis/runs` | `signed_in`, `MUTATION_GUARD` | izračun nad skupom iz tijela zahtjeva; **bez stanja i bez zapisa**, ime „runs” je samo ime radnje |

Pretpostavke ugovora (zapisati u PR-ove): pristup je `signed_in` jer skup putuje u zahtjevu pa nema tuđeg resursa i nema retka u bazi; ruta je **isključena zadano** (zastavica kao OC-1, mijenja se samo vlasnikovim PR-om) i dok je isključena odgovara 404 `not_found` kao da ne postoji; mutacijski čuvar se stavlja jer je POST.

### 3.2 `analysis.catalogue.get`, odgovor 200

| Polje | Tip | Napomena |
|---|---|---|
| `limits.maxRows` | cijeli broj, 500 | najviše redaka skupa |
| `limits.maxColumns` | cijeli broj, 12 | najviše stupaca |
| `limits.maxCellLength` | cijeli broj, 64 | najviše znakova u ćeliji tipa kategorija |
| `limits.maxBodyBytes` | cijeli broj, 131072 | najveće tijelo zahtjeva (413 iznad) |
| `analyses[]` | zatvoreno polje | |
| `analyses[].id` | `"descriptive"` \| `"frequencies"` \| `"correlation"` | zatvoren popis |
| `analyses[].version` | tekst `major.minor.patch` | verzija algoritma; mijenja se pri svakoj promjeni numerike |
| `analyses[].variables.kind` | `"numeric"` \| `"any"` | koje stupce analiza prima |
| `analyses[].variables.min`, `.max` | cijeli brojevi | koliko stupaca (korelacija min 2) |

Naslovi i opisi analiza **nisu** u odgovoru: ID-evi se prevode na hrvatski u WEB-u (katalog poruka).

### 3.3 `analysis.runs.post`, tijelo zahtjeva (zatvoreno, nepoznato polje pada)

| Polje | Tip | Napomena |
|---|---|---|
| `analysisId` | iz zatvorenog popisa | |
| `analysisVersion` | tekst `major.minor.patch` | mora biti verzija koju server još drži; inače 422 `unknown_analysis_version` |
| `variables[]` | nazivi stupaca, 1 do 12, različiti | moraju postojati u skupu i odgovarati vrsti |
| `dataset.columns[]` | `{ name, kind }` | `name` 1 do 40 znakova, različiti; `kind` `"numeric"` \| `"category"` |
| `dataset.rows[][]` | polje redaka, broj ćelija = broj stupaca | ćelija je broj, tekst ili `null` (nedostaje); do 500 redaka |

### 3.4 `analysis.runs.post`, odgovor 200

| Polje | Tip | Napomena |
|---|---|---|
| `analysisId`, `analysisVersion` | kao u zahtjevu | odraz |
| `datasetSha256` | 64 hex znaka | SHA-256 kanonskog JSON-a (JCS) skupa i odabranih varijabli |
| `resultSha256` | 64 hex znaka | SHA-256 kanonskog JSON-a polja `result` |
| `rowCount` | cijeli broj | |
| `result` | po `kind`: `descriptive`, `frequencies`, `correlation` | zatvoren razlikovni zbroj |
| `result.descriptive.columns[]` | `{ name, n, missing, mean, sd, median, min, q1, q3, max }` | brojevi zaokruženi na 6 decimala; `sd` je uzorna (n−1); `null` kad nije definirano (n < 2) |
| `result.frequencies.columns[]` | `{ name, n, missing, values: [{ value, count, share }] }` | poredak po `count` silazno, pa po tekstu rastući (hrvatski poredak); najviše 50 vrijednosti, ostatak u `otherCount` |
| `result.correlation.pairs[]` | `{ a, b, n, r }` | Pearson, parno brisanje nedostajućih; `r` je `null` kad je n < 3 ili je varijanca 0 |

**Ponovljivost:** isti `analysisVersion` + isti skup (isti retci, isti poredak stupaca) daje bajt-za-bajt isti `result`, `datasetSha256` i `resultSha256`. Redoslijed redaka ne smije mijenjati rezultat (zbrajanje se radi nad sortiranim vrijednostima). Rezultat ne sadrži vrijeme izračuna, slučajne vrijednosti ni identitet.

**Greške:** 401 `unauthorized`; 404 `not_found` (isključeno); 413 `body_too_large`; 415 `unsupported_media_type`; 422 `invalid_input` (loš skup, nepoznata varijabla, pogrešna vrsta stupca), 422 `unknown_analysis_version`; 503 `unavailable`.

Ako `contracts:breaking` odbije išta od ovog, ugovor je novi (nema starog), pa se ne očekuje; promjena prava pristupa postojeće rute ne postoji.

## 4. Zadaci koji nedostaju (14)

Oznake: veličina S ≤ ~120 redaka koda, M ≤ ~400, L nema. Server ugovor ide prije weba: WEB zadaci koji zovu API ovise o SRV-V15-UGOVOR, a orkestrator njegove operacije dodaje u WEB izvadak (`izvadak-ugovora.mjs`); bez izvatka pisac javlja PITANJE s točnim imenom operacije. Nijedna datoteka ugovora nema dva zadatka.

**Zajedničke točke montiranja** (po jedan redak, svaka u samo jednom zadatku): `server/contracts/routes/index.ts`, `server/contracts/inventory.ts`, `server/contracts/version.ts` i fiksni testovi ugovora (SRV-V15-UGOVOR); `server/domain/index.ts`/`server/domain/index.test.ts` (SRV-V15-IZVRSITELJ); `server/http/index.ts`, `packages/test-fakes/dev-server`, `tests/db/logout-old-cookie.integration.test.ts`, `server/database/index.ts` ako lint traži (SRV-V15-HTTP); `packages/app/src/routes.ts` (zapis rute i uvoz `host/analysis/messages.hr.ts`) i `packages/app/src/host/pages.tsx` (WEB-V15-STRANICA). Nijedan zadatak ne dira `packages/ui/src/tokens/globals.css`, `packages/editor-core`, `src/**`, `db/main/migrations/**` (nema nove tablice, pa nema RLS ni pgTAP redaka).

### Server

1. **SRV-V15-UGOVOR** (M). Ugovor iz §3: rute `analysis.catalogue.get` i `analysis.runs.post`, sheme (zatvorene), konstante ograničenja i test da ograničenja u ugovoru i u domeni ostaju jednaka, vektori, generirani ugovori i `openapi/v1.json`, podizanje minor verzije API-ja, retci u fiksnim testovima ugovora (`server/contracts/contracts.test.ts`, `server/contracts/fake-server.integration.test.ts`, `tests/contracts/contract-only.test.ts`). Nova polja: sva iz §3. Ne montira rutu. Veličina: M. Ovisi o: ništa; **jedini vlasnik** datoteke ugovora. Putanje: `server/contracts/routes/analysis.ts` (novo), `server/contracts/routes/index.ts`, `server/contracts/inventory.ts`, `server/contracts/version.ts`, `server/contracts/contracts.test.ts`, `server/contracts/fake-server.integration.test.ts`, `tests/contracts/contract-only.test.ts` (po jedan redak, kao u SRV-1108), `server/contracts/vectors/analysis.catalogue.get.json`, `server/contracts/vectors/analysis.runs.post.json`, `server/contracts/analysis.test.ts` (novo), generirano (`server/contracts/generated/**`, `openapi/v1.json`) se regenerira.
2. **SRV-V15-SKUP** (S). Domenska provjera skupa: stupci i vrste, ograničenja (500 redaka, 12 stupaca, 64 znaka, 40 znakova naziva), različiti nazivi, broj ćelija po retku, `null` za nedostaje, odbijanje `NaN`/`Infinity`/prototipnih ključeva, zamrznut izlaz; otisak `datasetSha256` preko `canonicalizeJcs` + `sha256WebCrypto`. Nikad ne baca na loš ulaz, nego vraća strukturiranu grešku. Test: loš i rubni ulaz (prazan skup, 501 redak, duplikat stupca, tekst u numeričkom stupcu, `-0`, vrlo veliki broj), isti skup daje isti otisak, promjena jedne ćelije mijenja otisak. Veličina: S. Ovisi o: ništa. Putanje: `server/domain/analysis/dataset.ts` (novo), `server/domain/analysis/fingerprint.ts` (novo), `server/domain/analysis/dataset.test.ts`, `server/domain/analysis/fingerprint.test.ts` (novo).
3. **SRV-V15-OPISNA** (M). Čisti izračun opisne statistike (`n`, `missing`, `mean`, `sd` uzorna, `median`, `min`, `q1`, `q3`, `max`; kvartili metodom linearne interpolacije, dokumentirano) i tablice učestalosti (poredak i granica 50 vrijednosti, `otherCount`, udjeli). Zbrajanje nad sortiranim vrijednostima (isti rezultat za svaki poredak redaka), zaokruživanje na 6 decimala jednim pomoćnim pozivom, bez `Math.random` i vremena. Test: ručno izračunani primjer na izmišljenim brojevima, permutacija redaka daje isti rezultat, n = 0 i n = 1 daju `null` gdje nije definirano, sve vrijednosti `null`, hrvatski poredak (č, ć, š, ž, đ). Veličina: M. Ovisi o: SRV-V15-SKUP (tip skupa). Putanje: `server/domain/analysis/descriptive.ts` (novo), `server/domain/analysis/frequencies.ts` (novo), `server/domain/analysis/descriptive.test.ts`, `server/domain/analysis/frequencies.test.ts` (novo).
4. **SRV-V15-KORELACIJA** (S). Pearsonov `r` po parovima odabranih numeričkih stupaca, parno brisanje nedostajućih, `n` po paru, `r = null` za n < 3 ili nultu varijancu, `r` ograničen na [−1, 1] (zaštita od zaokruživanja). Bez p-vrijednosti (isključeno). Test: savršena pozitivna i negativna korelacija, nulta varijanca, nedostajuće vrijednosti, simetrija `r(a,b) = r(b,a)`, permutacija redaka. Veličina: S. Ovisi o: SRV-V15-SKUP. Putanje: `server/domain/analysis/correlation.ts` (novo), `server/domain/analysis/correlation.test.ts` (novo).
5. **SRV-V15-IZVRSITELJ** (S). `runAnalysis(request)`: registar analiza s verzijama (`descriptive`, `frequencies`, `correlation`, svaka `1.0.0`), provjera da su `variables` u skupu i prave vrste, nepoznata verzija vraća grešku `unknown_analysis_version`, sastavlja odgovor iz §3.4 s `datasetSha256` i `resultSha256`. Jedini zadatak koji piše `server/domain/analysis/index.ts` (izvoz svega) i redak `analysis` u `server/domain/index.test.ts`. Test: odgovor je zamrznut, isti zahtjev dvaput daje jednake bajtove, drugi `analysisVersion` pada, `variables` izvan skupa pada. Veličina: S. Ovisi o: SRV-V15-SKUP, SRV-V15-OPISNA, SRV-V15-KORELACIJA. Putanje: `server/domain/analysis/registry.ts` (novo), `server/domain/analysis/run.ts` (novo), `server/domain/analysis/index.ts` (novo), `server/domain/analysis/run.test.ts` (novo), `server/domain/index.ts` (jedan redak `export * from "./analysis/index.ts"`), `server/domain/index.test.ts` (jedan redak).
6. **SRV-V15-HTTP** (M). Tanki HTTP adapter iza zastavice (zadano isključeno, 404 `not_found`): GET katalog (ograničenja iz domene, analize iz registra) i POST izračun (parsira tijelo po ugovoru, zove `runAnalysis`, ne piše u bazu, ne zapisuje sadržaj skupa ni u dnevnik). Jedan redak izvoza u `server/http/index.ts`, handler u `packages/test-fakes/dev-server` (`DEV_HANDLERS`, scenarij u coverage testu), redak u `tests/db/logout-old-cookie.integration.test.ts` (401 bez sesije za obje rute) i, ako lint traži, u `server/database/index.ts`. Test: bez sesije 401; isključeno 404 za obje rute; 413 iznad ograničenja; 415 za krivi sadržaj; 422 za loš skup; **sadržaj skupa nije u zapisima** (provjera dnevnika). Veličina: M. Ovisi o: SRV-V15-UGOVOR, SRV-V15-IZVRSITELJ. Putanje: `server/http/analysis/{index.ts,index.test.ts}` (novo), `server/http/index.ts` (jedan redak), `packages/test-fakes/dev-server/**` (handler + scenarij), `tests/db/logout-old-cookie.integration.test.ts`, `server/database/index.ts` (jedan redak, samo ako lint traži).
7. **SRV-V15-PONOVLJIVOST** (S). Zlatni vektori ponovljivosti: nekoliko izmišljenih skupova (mali, s nedostajućim vrijednostima, s hrvatskim slovima, s negativnim brojevima, s decimalama koje se loše zaokružuju) i očekivani `result`, `datasetSha256`, `resultSha256` kao JSON; test da `runAnalysis` daje točno te bajtove; test da se vektor **ne mijenja bez podizanja verzije analize** (promjena očekivanog izlaza bez nove verzije pada). Pokriva i da `datasetSha256` ne ovisi o poretku ključeva u zahtjevu. Veličina: S. Ovisi o: SRV-V15-IZVRSITELJ. Putanje: `server/domain/analysis/golden/*.json` (novo), `server/domain/analysis/golden.test.ts` (novo).

### Web

8. **WEB-V15-KLIJENT** (S). Klijentsko čitanje i izračun kroz `/api/v1` iz izvatka: `readCatalogue()` i `runAnalysis(request)` nad `callMigrationRoute`/`ApiOperationId` (parametar zvati `call`, ne `api`), ishodi kao zasebna stanja: `ready`, `loading`, `unavailable` (503), `off` (404, funkcija isključena), `invalid` (422 s kodom), `tooLarge` (413), `failed`; 503 se nikad ne prikazuje kao „nema podataka”. Ograničenja iz kataloga (`limits`) izlažu se kao konstante za ostale zadatke. Bez `as unknown as`. Ruta nije u izvatku dok SRV-V15-UGOVOR ne uđe: PITANJE s imenima `analysis.catalogue.get` i `analysis.runs.post`. Test: svako stanje, zabrana izravnog API-ja (kao `no-direct-api.test.ts`). Veličina: S. Ovisi o: SRV-V15-UGOVOR (izvadak). Putanje: `packages/app/src/host/analysis/api/{read.ts,run.ts,limits.ts,read.test.ts,run.test.ts,no-direct-api.test.ts}` (novo), izvadak ne uređuje ručno.
9. **WEB-V15-SKUP-UCITAVANJE** (M). Učitavanje skupa u pregledniku iz CSV datoteke ili zalijepljenog teksta: UTF-8 i BOM, separator `;` ili `,` (kao uvoz popisa), RFC 4180 navodnici, prvi redak zaglavlje, prepoznavanje vrste stupca (numerički s točkom ili zarezom kao decimalnim znakom, inače kategorija), prazna ćelija je `null`, ograničenja iz `limits.ts`. Greške su po retku i stupcu na hrvatskom, loš ulaz ne ruši ekran; datoteka se **čita lokalno i nigdje ne šalje** osim u tijelu izračuna. Komponente: polje za datoteku i tekstno polje iz `@ductura/ui`. Test: ispravan skup, BOM, `;` i `,`, decimalni zarez, 501. redak, 13. stupac, prazna datoteka, datoteka bez zaglavlja, stupac s miješanim tipom, zaglavlje s duplikatom. Veličina: M. Ovisi o: WEB-V15-KLIJENT (konstante ograničenja). Putanje: `packages/app/src/host/analysis/dataset/{parse-csv.ts,infer-kinds.ts,DatasetLoader.tsx,messages.hr.ts,parse-csv.test.ts,infer-kinds.test.ts,dataset-loader.test.ts}` (novo).
10. **WEB-V15-IZMISLJENI-SKUPOVI** (S). Tri izmišljena skupa za demo i testove (npr. „Izmišljeno istraživanje: kućno kompostiranje”): oko 40 do 60 redaka, numeričke i kategorijske varijable, nekoliko nedostajućih vrijednosti, hrvatska slova; gumb „Učitaj primjer” (bez datoteke). Bez ikakvih osobnih podataka (bez imena, e-pošte, OIB-a, JMBAG-a; test pretraga tih obrazaca) i bez stupca koji bi identificirao osobu. Test: svaki skup prolazi parser i ograničenja, sadrži barem jednu `null`, ne sadrži zabranjene obrasce. Veličina: S. Ovisi o: WEB-V15-SKUP-UCITAVANJE. Putanje: `packages/app/src/host/analysis/samples/{kompostiranje.csv,anketa-mobilnost.csv,mjerenja-izmisljena.csv,samples.ts,samples.test.ts}` (novo).
11. **WEB-V15-ODABIR-ANALIZE** (M). Odabir analize i varijabli: katalog iz `readCatalogue()`, odabir analize (`Select`), odabir stupaca prema `variables.kind/min/max`, čista funkcija `buildRequest(dataset, choice)` koja gradi tijelo zahtjeva (nikad ne dodaje identitet), provjera izbora prije slanja (korelacija traži barem 2 numerička stupca), gumb „Izračunaj” onemogućen s razlogom. Naslovi analiza iz kataloga poruka (ID-evi iz ugovora). Test: izbor koji ugovor odbija ne može se poslati; `buildRequest` je čist i određen; stupac pogrešne vrste se ne nudi. Veličina: M. Ovisi o: WEB-V15-KLIJENT, WEB-V15-SKUP-UCITAVANJE. Putanje: `packages/app/src/host/analysis/choose/{ChooseAnalysis.tsx,build-request.ts,messages.hr.ts,build-request.test.ts,choose-analysis.test.ts}` (novo).
12. **WEB-V15-PRIKAZ-REZULTATA** (M). Prikaz rezultata po `kind`: tablica opisne statistike, tablica učestalosti, matrica ili popis korelacija (`DataTable` iz `@ductura/ui`), prikaz `analysisVersion`, `datasetSha256`, `resultSha256` (kopiranje otiska) i bilješke „Isti podaci i ista verzija analize daju isti rezultat”; brojevi se formatiraju hrvatskim decimalnim zarezom; `null` se prikazuje kao „nije definirano”, ne kao 0. **Bez rangiranja, bez ocjena i bez usporedbe osoba**; stanja `loading`, `failed`, `unavailable` odvojena od praznog. Test: svaki `kind`, `null` vrijednosti, 503 ≠ prazno, otisci su prikazani i kopirani, nema teksta koji rangira (skener zabranjenih izraza). Veličina: M. Ovisi o: WEB-V15-KLIJENT (tipovi rezultata). Putanje: `packages/app/src/host/analysis/result/{ResultView.tsx,format.ts,messages.hr.ts,format.test.ts,result-view.test.ts}` (novo).
13. **WEB-V15-STRANICA** (M). Stranica „Statistička analiza” u koracima (skup, analiza, rezultat) koja slaže zadatke 9 do 12, s oznakom „izmišljeni podaci”, napomenom „podaci se ne spremaju” i stanjem „Funkcija nije uključena” kad je ruta isključena (404); ne upisuje ništa u pregledniku osim po želji korisnika. Montiranje: jedan zapis u `packages/app/src/routes.ts` (put `/analiza`, uloge nastavnik i student, zadano skriveno dok zastavica nije uključena), jedan redak u `packages/app/src/host/pages.tsx` i uvoz vlastitog `host/analysis/messages.hr.ts` u `packages/app/src/routes.ts` (ne dira se katalog druge trake). Test: ruta je montirana (ne samo u testu), pristup bez sesije/uloge vodi na prijavu, isključeno daje poruku a ne grešku, korak naprijed bez skupa je nemoguć. Veličina: M. Ovisi o: WEB-V15-IZMISLJENI-SKUPOVI, WEB-V15-ODABIR-ANALIZE, WEB-V15-PRIKAZ-REZULTATA. Putanje: `packages/app/src/host/analysis/AnalysisPage.tsx`, `packages/app/src/host/analysis/messages.hr.ts`, `packages/app/src/host/analysis/analysis-page.test.ts` (novo); montiranje: `packages/app/src/routes.ts`, `packages/app/src/host/pages.tsx`.
14. **WEB-V15-E2E** (S). Playwright tok na lokalnom stogu (lažni OIDC) kao izmišljeni korisnik: učitaj izmišljeni primjer, odaberi opisnu statistiku i korelaciju, izračunaj (odgovor poslužitelja presreće `page.route` s izmišljenim podacima), provjeri tablice i otiske; isti skup i verzija dvaput daju iste otiske; loš CSV prikazuje grešku; odgovor 503 nije „nema podataka”; 404 prikazuje „Funkcija nije uključena”; axe na 1250 i 400 px; tuđe stvari nije moguće dohvatiti jer nema tuđeg resursa (navesti u opisu). Veličina: S. Ovisi o: WEB-V15-STRANICA. Putanje: `packages/app/e2e/val15-razlika.spec.ts` (novo; host e2e, `packages/app/playwright.config.ts`, testMatch `e2e/**/*.spec.ts`; korijenski `e2e/` vrti stari npm kostur i ne smije se koristiti); axe zaslon: jedan redak u `packages/app/e2e/a11y/screens.ts` (zajednička datoteka, dodaje ga samo ovaj zadatak) provjerava se kroz `check.ts`.

## 5. Redoslijed i preklapanja

```
SRV-V15-SKUP ─┬→ SRV-V15-OPISNA ──┐
              └→ SRV-V15-KORELACIJA ┴→ SRV-V15-IZVRSITELJ ─┬→ SRV-V15-HTTP
                                                           └→ SRV-V15-PONOVLJIVOST
SRV-V15-UGOVOR ───────────────────────────────────────────→ SRV-V15-HTTP
SRV-V15-UGOVOR (ugovor prije weba, izvadak) → WEB-V15-KLIJENT ─┬→ WEB-V15-SKUP-UCITAVANJE → WEB-V15-IZMISLJENI-SKUPOVI ┐
                                                               ├→ WEB-V15-ODABIR-ANALIZE (i SKUP-UCITAVANJE) ──────────┼→ WEB-V15-STRANICA → WEB-V15-E2E
                                                               └→ WEB-V15-PRIKAZ-REZULTATA ───────────────────────────┘
```

- Jedina datoteka ugovora je `server/contracts/routes/analysis.ts` (SRV-V15-UGOVOR, jedini vlasnik) uz zajedničke retke u `routes/index.ts`, `inventory.ts`, `version.ts`.
- WEB zadaci rade samo u `packages/app/src/host/analysis/**` (svaki u svojoj podmapi) osim STRANICE koja dira `routes.ts` i `pages.tsx`; dva zadatka nikad ne pišu istu datoteku. SRV zadaci rade svaki u svojim datotekama `server/domain/analysis/**`; `index.ts` te mape piše samo SRV-V15-IZVRSITELJ.
- SRV-V15-UGOVOR i domenski zadaci 2 do 5 su neovisni i mogu ići paralelno; WEB zadaci 8 do 14 čekaju samo izvadak ugovora (8), a 9, 10 i 12 mogu početi s probnim odgovorom u testu.

## 6. Otvoreno za vlasnika

1. **Vrijeme:** plan kaže „Nakon pilota”; vlasnik je 25. 11. rekao „idemo na sve valove”. Zastavica je zadano **isključena** i mijenja se samo vlasnikovim PR-om (kao OC-1).
2. **Licenca i servis:** odluka o stvarnom servisu (Python/R, zaseban repo) i o svakom kodu pod AGPL/GPL ostaje kod vlasnika; ovdje se ništa od toga ne gradi ni ne kopira.
3. **Tko smije koristiti:** pretpostavka je `signed_in` (nastavnik i student), jer nema pohrane ni tuđeg resursa. Ako treba suziti (npr. samo nastavnik ili samo mentor), mijenja se pristup u UGOVORU prije prvog izdanja.
4. **Testovi značajnosti** (t-test, ANOVA, hi-kvadrat, regresija) traže provjerenu numeriku i idu uz stvarni servis.
5. **Pohrana skupova na serveru** traži tablicu, RLS, pgTAP retke, rok čuvanja i DPIA (osobni podaci ispitanika, val 18).
6. **Ograničenja** (500 redaka, 12 stupaca, 64 znaka, 128 KiB) su pretpostavka za izmišljene i male skupove; širi skup traži servis.

## 7. Tablica za orkestratora

| ID | r | deps | paths |
|---|---|---|---|
| SRV-V15-UGOVOR | M | — | `server/contracts/routes/analysis.ts`, `routes/index.ts`, `inventory.ts`, `version.ts`, `vectors/analysis.*.json`, `server/contracts/analysis.test.ts`, `server/contracts/contracts.test.ts`, `server/contracts/fake-server.integration.test.ts`, `tests/contracts/contract-only.test.ts`, generirano |
| SRV-V15-SKUP | S | — | `server/domain/analysis/{dataset,fingerprint}.ts` + testovi |
| SRV-V15-OPISNA | M | SRV-V15-SKUP | `server/domain/analysis/{descriptive,frequencies}.ts` + testovi |
| SRV-V15-KORELACIJA | S | SRV-V15-SKUP | `server/domain/analysis/correlation.ts` + test |
| SRV-V15-IZVRSITELJ | S | SRV-V15-SKUP, SRV-V15-OPISNA, SRV-V15-KORELACIJA | `server/domain/analysis/{registry,run,index}.ts`, `run.test.ts`, `server/domain/index.ts`, `server/domain/index.test.ts` |
| SRV-V15-HTTP | M | SRV-V15-UGOVOR, SRV-V15-IZVRSITELJ | `server/http/analysis/**`, `server/http/index.ts`, `packages/test-fakes/dev-server/**`, `tests/db/logout-old-cookie.integration.test.ts`, `server/database/index.ts` (samo ako lint traži) |
| SRV-V15-PONOVLJIVOST | S | SRV-V15-IZVRSITELJ | `server/domain/analysis/golden/*.json`, `server/domain/analysis/golden.test.ts` |
| WEB-V15-KLIJENT | S | SRV-V15-UGOVOR (izvadak) | `packages/app/src/host/analysis/api/**` |
| WEB-V15-SKUP-UCITAVANJE | M | WEB-V15-KLIJENT | `packages/app/src/host/analysis/dataset/**` |
| WEB-V15-IZMISLJENI-SKUPOVI | S | WEB-V15-SKUP-UCITAVANJE | `packages/app/src/host/analysis/samples/**` |
| WEB-V15-ODABIR-ANALIZE | M | WEB-V15-KLIJENT, WEB-V15-SKUP-UCITAVANJE | `packages/app/src/host/analysis/choose/**` |
| WEB-V15-PRIKAZ-REZULTATA | M | WEB-V15-KLIJENT | `packages/app/src/host/analysis/result/**` |
| WEB-V15-STRANICA | M | WEB-V15-IZMISLJENI-SKUPOVI, WEB-V15-ODABIR-ANALIZE, WEB-V15-PRIKAZ-REZULTATA | `packages/app/src/host/analysis/{AnalysisPage.tsx,messages.hr.ts,analysis-page.test.ts}`, `packages/app/src/routes.ts`, `packages/app/src/host/pages.tsx` |
| WEB-V15-E2E | S | WEB-V15-STRANICA | `packages/app/e2e/val15-razlika.spec.ts`, `packages/app/e2e/a11y/screens.ts` (jedan redak) |
