# src/client

Jedini put kojim web zove API (DAN-752, web 2.c3). Poziv ide kroz klijent generiran iz ugovora `@ductura/contracts` ([ductura/server `packages/contracts`](https://github.com/ductura/server/blob/main/packages/contracts/README.md)).

| Datoteka                 | Što                                                                                                                                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.ts`                 | `createApi()`: generirani `createClient` iste domene. Ulaz se jednom kopira kao JSON i šalje se samo ta kopija. Ulaz koji krši ugovor (`validateInput`) ili sadrži polje koje ugovor ne imenuje ne ide na mrežu (`client_rejected`). Odgovor 2xx mora točno odgovarati shemi iz `openapi/v1.json` paketa; nepoznato polje, krivi tip, neprijavljen status ili tijelo koje nije JSON daju `unexpected`. |
| `schema-check.ts`        | Mala provjera JSON Scheme, samo ključne riječi koje ugovor koristi. Bez Ajv-a, jer on kompilira kroz `new Function`, a to strogi CSP ne dopušta. Nepoznata ključna riječ ili format baca grešku.                                                                                                      |
| `*.test.ts`              | Vektori ugovora nad lažnim serverom iz `@ductura/test-fakes`, negativni slučajevi odgovora i ulaza, pokrivenost sheme, zabrana izravnog poziva i konfiguracija registra.                                                                                                                                |

## Zabrana poziva mimo klijenta

`no-direct-api.test.ts` čita svaki izvor koji ide u preglednik (`src`, `public`, `packages`, `catalog`, `app`; JS, TS, HTML, SVG, CSS). Prije provjere tekst normalizira: dekodira escape nizove i HTML entitete, briše komentare i spaja dijelove stringova. Pada na mrežne primitive (`fetch`, `XMLHttpRequest`, `sendBeacon`, `EventSource`, `WebSocket`, workere, Cache API), zaobilaženje imena (izračunati ili prepisani globalni objekt, `Reflect`, `eval`, `Function`, `.constructor`, timer sa stringom, kod iz `data:`/`blob:`), elemente koji šalju zahtjev (forma, slika, `src`/`href`, `ping`, `window.open`, `location`), izravan uvoz `@ductura/contracts` ili `@ductura/test-fakes`, uvoz testne datoteke i URL `/api`. Vanjski uvoz mora biti na popisu dopuštenih. Ovo je tekstualna provjera, ne AST lint (web još nema ESLint), pa review i dalje čita novi kod. Iznimka je samo `api.ts`, uz zatvoren popis:

- `public/app.js`: npm kostur zove svoj memorijski `/api/documents`, koji nije u ugovoru, do E-0.3. Dopuštena su samo njegova postojeća tri poziva.

**Zapisana iznimka ugovora: klijent evidencije.** `evidence/open` i `evidence/commit` traže zaglavlje `ductus-protocol`, `Origin` i kolačić. Generirani klijent ih ne šalje, a od greške čita samo kod, pa gubi stanje rada iz 409 i `stage` iz 503 (ductura/server [`docs/vs1-rute.md`](https://github.com/ductura/server/blob/main/docs/vs1-rute.md)). Ductusov `evidence-ingest` stiže u kasnijem rezu, zajedno s domenom (2.c4, E-0.3). Iznimka vrijedi dok `RequestSpec` ugovora ne dobije zaglavlja. Na zatvoreni popis ulazi tek s modulom, ograničena na `evidence/open` i `evidence/commit`.

Testne datoteke i `e2e/` kataloga ili paketa se ne čitaju, jer pokreću aplikaciju, a nisu njezin dio. Datoteka aplikacije ne smije uvesti testnu datoteku. Alati u korijenu (`dev-server.mjs`, `playwright.config.js`) također nisu kod aplikacije.

## Paketi i registar

- `@ductura/contracts` je prikvačen na točno `1.0.1`, a `@ductura/test-fakes` na `0.1.1` (samo `devDependencies`). Nova verzija ugovora ulazi PR-om koji mijenja broj. CI tada pada ako tipovi, vektori, shema ili ključne riječi više ne odgovaraju klijentu.
- `.npmrc` sadrži samo registar opsega `@ductura` (`https://npm.pkg.github.com`) i nijedan token. U CI-ju (`.github/workflows/ci.yml`, posao `client`) token posla ima samo `packages: read` i dolazi samo u korak instalacije. Taj korak radi s `--ignore-scripts`, a checkout ne čuva git vjerodajnice (`persist-credentials: false`). Svaki workflow ima izričit `permissions: contents: read`. Lokalno vrijedi korisnikov npm config izvan repoa.
- Paket ima vlastiti lockfile (`pnpm-lock.yaml`, integritet objavljenih tarballa) i instalira se s `pnpm install --ignore-workspace`, pa ostali poslovi u `ci.yml` (npm kostur `test`, `ui`) ne trebaju pristup paketima.

## Granice generiranog klijenta

- U pregledniku je svako preusmjeravanje ručno i neprozirno (`opaqueredirect`), pa generirani klijent svaki 3xx na rutama prijave javlja kao `ok: true, status: 303`. Zaglavlja odgovora (`location`, `retry-after`) ne provjerava se prema ugovoru.
- Cijeli broj iznad `Number.MAX_SAFE_INTEGER` gubi preciznost već u `JSON.parse`, prije provjere sheme.

## Pokretanje

```bash
cd src/client
pnpm install --ignore-workspace --ignore-scripts   # treba čitanje GitHub Packages
pnpm run typecheck
pnpm run test
```

## Što još nije ovdje

Rez b (DAN-752) donosi `logout-request` i `session-marks` iz Ductusa (`auth.logout.post`). Ostali Ductusovi moduli idu u DAN-799, kad server doda njihove rute u ugovor i kad 2.c4 i E-0.3 donesu domenu. Izravni `fetch` za njih se ne prenosi.
