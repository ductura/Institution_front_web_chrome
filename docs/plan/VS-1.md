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

Ishod zadnjeg prolaza upisuje se ovdje iz `vs-run.json` (artifact `sistem` workflowa).

<!-- ISHOD -->
