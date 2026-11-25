# Ductura / web-chrome

Prioritetni frontend za Google Chrome na računalu. Preloader ovamo šalje korisnike Chromea na Windowsu, macOS-u i Linuxu.

## Funkcionalna provjera

Izmjena u editoru ostaje spremljena nakon osvježavanja stranice. Pokriva je `e2e/editor-persists.spec.js` u svakom stupcu e2e matrice (DAN-755, [kanonski plan](https://github.com/ductura/.github/blob/main/docs/plan/PLAN-MIGRACIJE.md#katalog-zadataka)): `chromium`, `chrome` (pravi Google Chrome), `firefox`, `webkit`, `edge` (Microsoft Edge), `mobile-pixel-7`, `mobile-iphone-14`, `tablet-ipad` i `tablet-ipad-landscape`. Stupci se izvode jedan po jedan jer dijele memorijski API. `chrome` i `edge` registriraju se u CI-ju ili uz `DUCTURA_BRANDED=1`; Opera se provjerava ručno prije izdanja.

Razvojni editor nakon HTTP uspjeha memorijskog API-ja ne piše „Spremljeno”, nego „Razvojni poslužitelj primio je tekst · ne čuva se nakon ponovnog pokretanja” (DAN-886). To pokriva `e2e/dev-save-status.spec.js`, zajedno s negativnim slučajem odbijenog PUT-a.

Preneseni Ductus e2e (DAN-755, 755-2): `e2e/local-editor.spec.js` (axe na stranici editora, WCAG 2.0/2.1 A i AA) s pomoćnikom `e2e/support/axe.js`. Ostali testovi iz Ductusa čekaju editor s dnevnikom na uređaju (E-0.3).

## Front institucije (`packages/app`)

Domaćin aplikacije prema ugovoru #2028 c.6993786629 §1 i §3.3. Front je Next.js aplikacija u `packages/app`: `pnpm build` je `next build`, a `pnpm dev` (`next dev`) ekrane iz `src/components` poslužuje na :5173 pod `/app/web/` i `/app/chrome/`. Na startu aplikacija zove `GET /api/v1/me`. Na 401 šalje preglednik na `/api/v1/auth/login?returnTo=<trenutna putanja>` (AAI@EduHr, D-09), a na 200 otvara početni ekran uloge s imenom ustanove u ljusci. „Odjava” šalje `POST /api/v1/auth/logout` pa vodi na `/`. API ide samo kroz `src/client/api.ts`. Next prosljeđuje `/api/v1/*` na `INSTITUTION_SERVER_URL` (zadano `http://127.0.0.1:4000`), pa front radi i izravno na :5173. Kroz edge na :8000 te zahtjeve prima Institution_server.

```bash
pnpm install && (cd src/client && pnpm install --ignore-workspace --frozen-lockfile --ignore-scripts)
pnpm build
pnpm dev                                   # http://localhost:5173/app/web/
pnpm --filter @ductura/app run test:e2e    # lažni /api/v1, axe
```

## Pokretanje

```bash
pnpm install --frozen-lockfile
node dev-server.mjs         # stari kostur na http://localhost:5173 s memorijskim API-jem
pnpm run test:helpers       # pomoćne funkcije (public/lib/doc.js)
pnpm exec playwright install chromium firefox webkit   # chrome i msedge samo uz DUCTURA_BRANDED=1
pnpm run test:functional    # funkcionalni test u pregledniku
```

## Nestabilni testovi: pravilo „3 zelena zaredom”

Test je stabilan, a popravak nestabilnog testa prihvaćen, tek kad isti CI posao prođe **3 puta zaredom na istom commitu**. Jedan zeleni run nije dokaz: pad koji se javlja jednom u pet pokretanja prođe i dvaput zaredom.

```bash
node scripts/ci/tri-zelena.mjs --run <id runa>                      # cijeli run
node scripts/ci/tri-zelena.mjs --run <id runa> --job '^app \(2/3\)$'  # jedan posao
```

Skripta ponovno pokreće pravi posao na istom runu (isti commit i postavke) dok ne skupi 3 zelena pokušaja, a staje s izlazom 1 na prvom koji nije zelen. Pokušaj se ne broji kao zelen ni kad je test prošao tek u ponovnom pokušaju Playwrighta (`retries: 1` u CI-ju, „N flaky” u logu). Strože je od CI-ja i ne mijenja nijednu kapiju: ne dodaje retry, ne preskače test i ne dira axe. Pravilo grane, 3 zelena `ci-ok` zaredom na bazi, provjerava `scripts/ci-nestabilni.mjs` u `ductura/.github`. Testovi skripte: `test/unit/tri-zelena.test.js`.

`dev-server.mjs` (stari kostur, ne front institucije) oponaša `Ductura/server` API. U produkciji frontend zove pravi API na `/api` iste domene (ductura.org).
