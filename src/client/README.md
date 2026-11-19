# src/client

Jedini put kojim web zove API (DAN-752, web 2.c3). Poziv ide kroz klijent generiran iz ugovora `@ductura/contracts` ([ductura/server `packages/contracts`](https://github.com/ductura/server/blob/main/packages/contracts/README.md)).

| Datoteka                 | Što                                                                                                                                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.ts`                 | `createApi()`: generirani `createClient` iste domene. Ulaz se jednom kopira kao JSON i šalje se samo ta kopija. Ulaz koji krši ugovor (`validateInput`) ili sadrži polje koje ugovor ne imenuje ne ide na mrežu (`client_rejected`). Odgovor 2xx mora točno odgovarati shemi iz `openapi/v1.json` paketa; nepoznato polje, krivi tip, neprijavljen status ili tijelo koje nije JSON daju `unexpected`. |
| `session-marks.ts`, `session-end.ts` | Doslovni prijenos iz Ductusa 0cdb0f1 (F-5, D-118): oznake sesije u `localStorage` i kolačićima te slušanje kraja sesije u kartici. Ne zovu API. Razlika od izvora je samo u `session-end.ts`: `globalThis.window` i destrukturirani `data` poruke, jer skener zabrane poziva oba izvorna oblika čita kao zaobilaženje. |
| `schema-check.ts`        | Mala provjera JSON Scheme, samo ključne riječi koje ugovor koristi. Bez Ajv-a, jer on kompilira kroz `new Function`, a to strogi CSP ne dopušta. Nepoznata ključna riječ ili format baca grešku.                                                                                                      |
| `*.test.ts`              | Vektori ugovora nad lažnim serverom iz `@ductura/test-fakes`, negativni slučajevi odgovora i ulaza, pokrivenost sheme, zabrana izravnog poziva i konfiguracija registra.                                                                                                                                |

## Zabrana poziva mimo klijenta

`no-direct-api.test.ts` čita svaki izvor koji ide u preglednik (`src`, `public`, `packages`, `catalog`, `app`; JS, TS, HTML, SVG, CSS). Prije provjere tekst normalizira: dekodira escape nizove i HTML entitete, briše komentare i spaja dijelove stringova. Pada na mrežne primitive (`fetch`, `XMLHttpRequest`, `sendBeacon`, `EventSource`, `WebSocket`, workere, Cache API), zaobilaženje imena (izračunati ili prepisani globalni objekt, `Reflect`, `eval`, `Function`, `.constructor`, timer sa stringom, kod iz `data:`/`blob:`), elemente koji šalju zahtjev (forma, slika, `src`/`href`, `ping`, `window.open`, `location`), izravan uvoz `@ductura/contracts` ili `@ductura/test-fakes`, uvoz testne datoteke i URL `/api`. Vanjski uvoz mora biti na popisu dopuštenih. Ovo je tekstualna provjera, ne AST lint (web još nema ESLint), pa review i dalje čita novi kod. Iznimka je samo `api.ts`, uz zatvoren popis:

- `public/app.js`: npm kostur zove svoj memorijski `/api/documents`, koji nije u ugovoru, do E-0.3. Dopuštena su samo njegova postojeća tri poziva.

**Zapisana iznimka ugovora: klijent evidencije.** `evidence/open` i `evidence/commit` traže zaglavlje `ductus-protocol`, `Origin` i kolačić. Generirani klijent ih ne šalje, a od greške čita samo kod, pa gubi stanje rada iz 409 i `stage` iz 503 (ductura/server [`docs/vs1-rute.md`](https://github.com/ductura/server/blob/main/docs/vs1-rute.md)). Ductusov `evidence-ingest` stiže u kasnijem rezu, zajedno s domenom (2.c4, E-0.3). Iznimka vrijedi dok `RequestSpec` ugovora ne dobije zaglavlja. Na zatvoreni popis ulazi tek s modulom, ograničena na `evidence/open` i `evidence/commit`.

**Razdjelnici putanja.** Skener uspoređuje putanje u POSIX obliku. Na Windowsu se `\` čita kao `/`, pa `EXCEPTIONS`, `CONFIG` i `packages/` daju isti ishod kao na Linuxu. Drugdje je `\` dio imena, pa skenirana putanja s `\` ruši test. Ključ popisa mora već biti u POSIX obliku, jer bi na Linuxu ključ s `\` čitao drugu datoteku. Dva ključa koja daju isti put su greška. Pravilo uvoza testne datoteke prihvaća oba razdjelnika i ne razlikuje velika i mala slova imena mapa (`E2E`, `Dist`), jer ih Windows ne razlikuje. Popis datoteka gradi jedna funkcija (`scannedFiles`) s ubrizganim datotečnim sustavom i `node:path`. CI radi na Linuxu, pa test istu funkciju pušta s `path.win32` kroz stvarno stablo repoa i kroz sintetičko stablo (`C:\`, UNC, završni razdjelnik).

Testne datoteke i `e2e/` kataloga ili paketa se ne čitaju, jer pokreću aplikaciju, a nisu njezin dio. Datoteka aplikacije ne smije uvesti testnu datoteku. Alati u korijenu (`dev-server.mjs`, `playwright.config.js`) također nisu kod aplikacije.

## Paketi i registar

- `@ductura/contracts` 2.8.0 i `@ductura/test-fakes` 3.0.1 (samo `devDependencies`) instaliraju se s URL-a tarballa na javnim GitHub Releases ductura/servera (oznake `contracts-v2.8.0` i `test-fakes-v3.0.1`; put DAN-965, podizanje DAN-973 i DAN-1062). 2.6.0 je prva verzija s katalogom grešaka; 2.7.0 i 2.8.0 dodaju rute za koje test-fakes 3.0.1 nema vektore. Za to ne treba token. Lockfile drži točan URL i integritet (`sha512`), pa zamijenjen tarball ruši instalaciju. Obrisan tarball je također ruši: integritet štiti od podmetanja, ne od gubitka. Nova verzija ugovora ulazi PR-om koji mijenja URL. CI tada pada ako tipovi, vektori, shema ili ključne riječi više ne odgovaraju klijentu.
- Ostale ovisnosti su prikvačene na točne verzije s npm registra.
- `.npmrc` i dalje sadrži samo registar opsega `@ductura` (`https://npm.pkg.github.com`) i nijedan token. Za ova dva paketa se ne koristi. Novi `@ductura/*` paket naveden brojem verzije, a ne URL-om, išao bi kroz GitHub Packages i tražio bi token. Test `registry-config.test.ts` to ne dopušta.
- U CI-ju (`.github/workflows/ci.yml`, posao `client`) korak instalacije još dobiva token posla s `packages: read`, iako ga više ne treba. Uklanjanje je zaseban PR. Taj korak radi s `--ignore-scripts`, a checkout ne čuva git vjerodajnice (`persist-credentials: false`). Svaki workflow ima izričit `permissions: contents: read`.
- Paket ima vlastiti lockfile (`pnpm-lock.yaml`, pnpm 10.33.0) i instalira se s `pnpm install --ignore-workspace`.

## Istek sesije (DAN-1062)

Nijedna ruta ugovora još ne navodi `session_expired` (S-1D-d), pa ga generirani klijent vraća kao `unexpected`. `createApi` ga vraća kao `{ ok: false, status: 401, code: "session_expired" }` (tip `SessionExpired`) kad je klijent dao točno `401 unexpected`, tijelo je JSON (ista provjera `content-type` kao u klijentu), prvi string među vlastitim poljima `code`, `error`, `status` je kod unosa iz `@ductura/contracts/errors/catalog.json`, a ruta u ugovoru ima 401 i nije `auth.*`. Status, kod i ključ poruke (`SESSION_EXPIRED_ENTRY`) čitaju se iz kataloga; ako katalog nema točno jedan unos s kodom `session_expired` ili mu status nije 401, modul se ne učita (drugi unosi 401, npr. `unauthenticated`, su dopušteni). Čitaju se samo vlastita polja tijela, i samo kod odgovora 401. Svaki drugi odgovor je točno ono što daje generirani klijent (`session-expired.test.ts`, diferencijalno). Lažni server nema vektor s tim kodom, pa test šalje isti oblik na žici kao njegovo odbijanje.

## Poveznica za prijavu (DAN-1081)

`signInHref(returnTo?)` daje relativnu poveznicu iste domene na rutu `auth.login.get`. Putanju i ime parametra `returnTo` čita iz `openapi/v1.json` ugovora; ako ugovor nema točno jednu takvu GET rutu s tim parametrom, modul se ne učita. `returnTo` ulazi u poveznicu samo ako ga zadrži pravilo jednako serverskom `safeReturnTo` (ductura/server `server/session/return-to.ts`), u obliku koji bi server vratio; sve ostalo daje poveznicu bez njega. Server granicu od 512 znakova provjerava prije normalizacije, a normalizacija postotno kodira (`č` postaje šest znakova), pa kad bi normalizirani oblik prešao granicu, poveznica nosi ulaz kakav je dan: server ga normalizira u isto odredište. Funkcija ne baca. Server `returnTo` provjerava ponovno, pa je ovo obrana u dubini, nikad šira od serverske (`sign-in-href.test.ts`).

## Sesija fronta institucije (#2028 c.6993786629 §3.3)

`GET /api/v1/me` još nije u ugovoru 2.8.0 (dodaje ga Institution_server, w1111a), pa ga `readSession()` čita ručno, samo u ovoj datoteci, s `credentials: "include"`. 200 s JSON objektom znači da je korisnik prijavljen (`parseSession` čita `role` ili `roles`, `displayName` te `institution.displayName` ili `institutionName`; ostala polja ne čita). 401 znači da nije prijavljen, a sve ostalo da sesija nije dostupna. `goToSignIn(here)` vodi na `signInHref(here)`. `signOut()` ide kroz `auth.logout.post` iz ugovora. `leaveFor(href)` je jedini izlaz iz aplikacije, jer `no-direct-api.test.ts` zabranjuje `location.assign` izvan ove datoteke. Kad ugovor dobije rutu sesije, `readSession` prelazi na `createApi`.

## Granice generiranog klijenta

- U pregledniku je svako preusmjeravanje ručno i neprozirno (`opaqueredirect`), pa generirani klijent svaki 3xx na rutama prijave javlja kao `ok: true, status: 303`. Zaglavlja odgovora (`location`, `retry-after`) ne provjerava se prema ugovoru.
- Cijeli broj iznad `Number.MAX_SAFE_INTEGER` gubi preciznost već u `JSON.parse`, prije provjere sheme.

## Pokretanje

```bash
cd src/client
pnpm install --ignore-workspace --frozen-lockfile --ignore-scripts   # bez tokena
pnpm run typecheck
pnpm run test
```

## Što još nije ovdje

Rez b (DAN-752) donosi `logout-request` i `session-marks` iz Ductusa (`auth.logout.post`). Ostali Ductusovi moduli idu u DAN-799, kad server doda njihove rute u ugovor i kad 2.c4 i E-0.3 donesu domenu. Izravni `fetch` za njih se ne prenosi.
