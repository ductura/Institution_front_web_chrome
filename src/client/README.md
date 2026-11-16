# src/client

Jedini put kojim web zove API (DAN-752, web 2.c3). Poziv ide kroz klijent generiran iz ugovora `@ductura/contracts` ([ductura/server `packages/contracts`](https://github.com/ductura/server/blob/main/packages/contracts/README.md)).

| Datoteka                 | Što                                                                                                                                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.ts`                 | `createApi()`: generirani `createClient` iste domene. Ulaz koji krši ugovor (`validateInput`) ne ide na mrežu (`client_rejected`). Odgovor 2xx mora točno odgovarati shemi iz `openapi/v1.json` paketa; nepoznato polje, krivi tip, neprijavljen status ili tijelo koje nije JSON daju `unexpected`. |
| `schema-check.ts`        | Mala provjera JSON Scheme, samo ključne riječi koje ugovor koristi. Bez Ajv-a, jer on kompilira kroz `new Function`, a to strogi CSP ne dopušta. Nepoznata ključna riječ ili format baca grešku.                                                                                                      |
| `*.test.ts`              | Vektori ugovora nad lažnim serverom iz `@ductura/test-fakes`, negativni slučajevi odgovora i ulaza, pokrivenost sheme, zabrana izravnog poziva i konfiguracija registra.                                                                                                                                |

## Zabrana poziva mimo klijenta

`no-direct-api.test.ts` čita svaki izvor koji ide u preglednik (`src`, `public`, `packages`, `catalog`, `app`). Pada na `fetch`, `XMLHttpRequest`, `sendBeacon`, `EventSource`, `WebSocket`, `importScripts`, Cache API, HTTP biblioteke, izračunati pristup globalnom objektu, `eval` i `Function` te na URL `/api`. Iznimka je samo `api.ts`, uz zatvoren popis:

- `public/app.js`: npm kostur zove svoj memorijski `/api/documents`, koji nije u ugovoru, do E-0.3.
- `src/client/evidence-ingest.ts` (**zapisana iznimka ugovora**): `evidence/open` i `evidence/commit` traže zaglavlje `ductus-protocol`, `Origin` i kolačić. Generirani klijent ih ne šalje, a od greške čita samo kod, pa gubi stanje rada iz 409 i `stage` iz 503 (ductura/server [`docs/vs1-rute.md`](https://github.com/ductura/server/blob/main/docs/vs1-rute.md)). Ductusov `evidence-ingest` stiže u kasnijem rezu, zajedno s domenom (2.c4, E-0.3). Iznimka vrijedi dok `RequestSpec` ugovora ne dobije zaglavlja.

Testne datoteke i `e2e/` se ne čitaju, jer pokreću aplikaciju, a nisu njezin dio. Alati u korijenu (`dev-server.mjs`, `playwright.config.js`) također nisu kod aplikacije.

## Paketi i registar

- `@ductura/contracts` je prikvačen na točno `1.0.1`, a `@ductura/test-fakes` na `0.1.1` (samo `devDependencies`). Nova verzija ugovora ulazi PR-om koji mijenja broj. CI tada pada ako tipovi, vektori, shema ili ključne riječi više ne odgovaraju klijentu.
- `.npmrc` sadrži samo registar opsega `@ductura` (`https://npm.pkg.github.com`) i nijedan token. U CI-ju (`.github/workflows/ci.yml`, posao `client`) token posla ima samo `packages: read` i dolazi samo u korak instalacije. Lokalno vrijedi korisnikov npm config izvan repoa.
- Paket ima vlastiti lockfile (`pnpm-lock.yaml`, integritet objavljenih tarballa) i instalira se s `pnpm install --ignore-workspace`, pa ostali poslovi (npm kostur, `ui.yml`) ne trebaju pristup paketima.

## Pokretanje

```bash
cd src/client
pnpm install --ignore-workspace   # treba čitanje GitHub Packages
pnpm run typecheck
pnpm run test
```

## Što još nije ovdje

Rez b (DAN-752) donosi `logout-request` i `session-marks` iz Ductusa (`auth.logout.post`). Ostali Ductusovi moduli idu u DAN-799, kad server doda njihove rute u ugovor i kad 2.c4 i E-0.3 donesu domenu. Izravni `fetch` za njih se ne prenosi.
