# VS-1: vertikalni presjek nad isporučenim webom (DAN-887)

Prihvat VS-1 prema `PLAN-MIGRACIJE.md` §4a-1 (odluke O-2 i O-3, Ductus#87 c.6880835493) i scenarijima A05 i A06. Ovaj dokument navodi tvrdnje VS-1.1 do VS-1.13, gdje se svaka provjerava i ishod zadnjeg zabilježenog prolaza.

## Što se pokreće

Sistemski test radi nad onim što se isporučuje:

- **Web:** izgradnja `packages/app` ovog repoa (`pnpm build` i `pnpm start`, isti `next build` kao isporuka), pod `/app/web/`. Stari Next u `src/app` se ne poslužuje.
- **Ulaz:** lokalni edge Preloadera (`deploy/edge/dev-proxy.mjs` iz `ductura/Preloader`) na `http://localhost:8000`: `/` je izgradnja Preloadera, `/api/v1/*` Institution_server, `/app/web/*` `packages/app`. Student otvara `/` i odabire „Prijava preko AAI@EduHr”.
- **Server:** Institution_server s PostgreSQL-om, migracijama i demo seedom, lokalnim simulatorom AAI@EduHr (`:8090`), lokalnim S3 i razvojnim ključem za potpis (K1). Protokol 1: potpis u istom odgovoru.
- **Podaci:** samo izmišljeni (demo seed, rečenica s nasumičnim UUID-om). Prijava samo preko simulatora AAI@EduHr (D-09).

Workflow `.github/workflows/sistem.yml` (samo `workflow_dispatch`) podiže taj stog na GitHub runneru i pokreće `pnpm test:sistem`. Test VS-1 je `e2e/sistem/vs1-prijava-spremi-osvjezi.sistem.ts`; `e2e/vs-run/vs-run.mjs` iz izvještaja i zapisanih vrijednosti izrađuje `vs-run.json` i tablicu.

Čitanja koja dokazuju VS-1.9 i VS-1.13 idu kroz API servera kao student (`POST /api/v1/evidence/open` u sesiji studenta), nikad administratorskom vezom na bazu (§4a-1).

## Tvrdnje

Brojevi VS-1.1 do VS-1.12 složeni su redom kriterija prihvata iz §4a-1 jer tablica DAN-760 nije dostupna iz oblaka; VS-1.7, VS-1.9 i VS-1.13 odgovaraju upućivanjima u §4a-1.

| Tvrdnja | Što se tvrdi | Kako test provjerava |
| --- | --- | --- |
| VS-1.1 | Student ulazi kroz `/` (Preloader) na stogu sa sintetičkim podacima. | `page.goto('/')`, poveznica Preloadera „Prijava preko AAI@EduHr” s `returnTo=/app/web/`. |
| VS-1.2 | Prijava kroz lokalni OIDC (simulator AAI@EduHr) i povratak u isti web pod `/app/web/`. | Preusmjeravanje na `:8090`, odabir `demo-student`, povratak na `/app/web/zadaci`, `/api/v1/me` vraća ulogu `student`. |
| VS-1.3 | Ekrane poslužuje isporučeni host `packages/app`. | Preflight provjerava da `/app/web/` dolazi iz izgradnje `packages/app` (`/app/web/_next/`); rad se otvara na `/app/web/rad/<id>`. |
| VS-1.4 | Student otvara vlastiti postojeći rad u editoru. | Poveznica rada na početnoj stranici, `evidence/open` za taj zadatak, uređiv editor. |
| VS-1.5 | Student upisuje jedinstvenu rečenicu. | `insertText` izmišljene rečenice s UUID-om. |
| VS-1.6 | Upis je prvo zabilježen na uređaju (A05). | Zahtjev spremanja se zadrži; za to vrijeme rečenica je u lokalnom dnevniku (IndexedDB `ductus-journal-v1-*`), oznaka je pokazala „Spremljeno na uređaju”, a „Spremljeno na poslužitelju” se nije pojavila. |
| VS-1.7 | „Spremljeno na poslužitelju” tek nakon provjere potpisa za poslanu transakciju, dokument i reviziju (A05). | Odgovor 200 s potpisanom potvrdom; test sam provjerava Ed25519 potpis ključem iz `evidence/open` za isti `documentId`, `clientTransactionId` i reviziju te `segmentHash` poslanog segmenta. Prva pojava oznake je nakon puštanja zahtjeva. |
| VS-1.8 | Nakon osvježavanja student vidi rečenicu. | `page.reload()`, rečenica u editoru. |
| VS-1.9 | Čisti kontekst bez lokalnog dnevnika dobiva s poslužitelja isti `documentId`, reviziju, hash i tekst (A05). | Novi `browser.newContext()` bez baza dnevnika, ponovna prijava kroz Preloader, `evidence/open`; test sam računa SHA-256 primljenih bajtova i čita tekst iz dokumenta. |
| VS-1.10 | Isti ključ i isti bajtovi daju jednu reviziju (izgubljeni odgovor). | Isti zahtjev spremanja (isti `clientTransactionId`, isto tijelo) šalje se ponovno: 200 `duplicate` s istom revizijom, a `evidence/open` i dalje vraća istu reviziju. |
| VS-1.11 | Drugi student ne može pročitati ni izmijeniti taj rad. | `demo-student-2` u zasebnom kontekstu: `evidence/open` za isti zadatak ne vraća taj dokument, a isti zahtjev spremanja je odbijen (4xx). |
| VS-1.12 | Uz prolaz se bilježe SHA Preloadera, weba i servera i rezultat provjera. | `vs-run.json`: tri puna SHA-a, host `packages/app`, ishod svake tvrdnje. |
| VS-1.13 | Nakon VS-1.7 proces servera se gasi i ponovno podiže, zatim se ponavlja VS-1.9 iz trajne baze, ne iz memorije procesa (A06). | `e2e/sistem/server-proces.ts`: proces na `:4000` dobiva SIGTERM, ista naredba se pokreće ponovno; novi PID mora biti različit i zdravlje s bazom `ok`. Zatim svjež kontekst preglednika i iste četiri vrijednosti kroz API kao student. |

Za VS-1.13 stog radi bez nadzornika `pnpm lokalno` (`e2e/sistem/stog-bez-nadzora.mjs`): nadzornik gasi sve podprocese kad jedan izađe, pa iste naredbe s istom okolinom nastavljaju kao samostalni procesi. Simulator AAI@EduHr i lokalni S3 rade dalje dok se server gasi.

## Ishod

Ishod zadnjeg zabilježenog prolaza, iz `vs-run.json` (artifact `sistem`; kopija u `e2e/vs-run/vs-run.json`): [run 45066207023](https://github.com/ductura/Institution_front_web_chrome/actions/runs/45066207023), 22. 11. 2026., sve tvrdnje i sva četiri scenarija **PROLAZ** (`ok: true`).

| Repo | Puni SHA |
| --- | --- |
| Institution_front_web_chrome (web) | `a5c7b9c201fac344b82e7b9af7da2dee6cb109a5` |
| Institution_server | `f41a5c6075c61512aed290fac68c06888aa80d8d` |
| Preloader | `73d0462f11a0775c51a66232a545932ef5597907` |

Host `packages/app`, ulaz `http://localhost:8000/` → `http://localhost:8000/app/web/`. PID servera prije i poslije ponovnog pokretanja: 4542 → 4905. Svjež kontekst: `browser.newContext()`, na početku bez baza lokalnog dnevnika.

| Vrijednost | Prije ponovnog pokretanja | Poslije (svjež kontekst) |
| --- | --- | --- |
| documentId | `91e64ee6-2808-4ede-86b4-bb9fba1f4ea9` | `91e64ee6-2808-4ede-86b4-bb9fba1f4ea9` |
| revizija | 1 | 1 |
| tekst | „U izmišljenom vrtu nastaje kompost (VS-1 87a5dc60-…).” | isti |
| hash (SHA-256, računa test) | `1520b4a55829b25db9f8e001a82178cbe770524947f8e5d134d1de6ec85347ee` | isti |

| Tvrdnja | Ishod | Dokaz iz prolaza |
| --- | --- | --- |
| VS-1.1 | PROLAZ | ulaz na `/` (Preloader) i povratak u `/app/web/` |
| VS-1.2 | PROLAZ | prijava kroz simulator AAI@EduHr (D-09), `/api/v1/me` = student |
| VS-1.3 | PROLAZ | `packages/app` poslužuje `/app/web/rad/<id>` |
| VS-1.4 | PROLAZ | vlastiti rad iz seeda otvoren u editoru (uređiv) |
| VS-1.5 | PROLAZ | jedinstvena izmišljena rečenica upisana u editor |
| VS-1.6 | PROLAZ | „Spremljeno na uređaju” i zapis u IndexedDB prije odgovora poslužitelja |
| VS-1.7 | PROLAZ | HTTP 200, `committed`, revizija 1, potpis Ed25519 provjeren; „Spremljeno na poslužitelju” nakon odgovora |
| VS-1.8 | PROLAZ | nakon osvježavanja rečenica u editoru |
| VS-1.9 | PROLAZ | novi kontekst: isti `documentId`, revizija, tekst i hash |
| VS-1.10 | PROLAZ | ponovljeni zahtjev (isti `clientTransactionId`, isti bajtovi): HTTP 200 `duplicate`, revizija ostaje 1 |
| VS-1.11 | PROLAZ | `demo-student-2`: `evidence/open` HTTP 404, isti commit HTTP 404 |
| VS-1.12 | PROLAZ | tri puna SHA-a i host zapisani u `vs-run.json` |
| VS-1.13 | PROLAZ | PID 4542 → 4905; svjež kontekst kroz API kao student vraća iste četiri vrijednosti |
