# packages/app

Domaćin fronta institucije (ugovor #2028 c.6993786629 §1 i §3.3) na Next.js 16 (App Router). Ekrani su iz `src/components`, API ide kroz `src/client/api.ts`.

```sh
pnpm dev     # next dev na http://localhost:5173/app/web/ i /app/chrome/
pnpm build   # next build
pnpm start   # next start na :5173
```

Konfiguracija ide samo kroz env varijable, bez tajni u repou:

| Varijabla | Zadano | Što |
| --- | --- | --- |
| `INSTITUTION_SERVER_URL` | `http://127.0.0.1:4000` | Kamo Next prosljeđuje `/api/v1/*` kad radi bez edgea (`next dev`, `next start`, Vercel). Čita se pri gradnji. Kroz edge na :8000 `/api/v1/*` ide izravno Institution_serveru. |

Adrese: `basePath` je `/app`, a segment `app/[base]/` je `web` ili `chrome`; za svaki drugi segment stranica ne postoji. Edge ovamo šalje samo `/app/web/*` i `/app/chrome/*`, pa su datoteke gradnje pod `/app/web/_next/` (`assetPrefix`), a javne datoteke u `public/web/`. Za Vercel je projekt `packages/app` s presetom Next.js (`vercel.json`).

| Datoteka | Što |
| --- | --- |
| `next.config.ts` | `basePath`, `assetPrefix`, prosljeđivanje `/api/v1/*` i korijen radnog prostora za Turbopack. |
| `app/layout.tsx` | Korijenski layout: fontovi, tokeni i tema (tamna je zadana, D-188; spremljena svijetla postavlja se prije iscrtavanja). |
| `app/[base]/[[...path]]/` | Svaka putanja pod bazom: provjeri bazu (`src/bases.ts`) i u pregledniku pokaže `App`. Dok stranice ne dobiju vlastite rute, `App` i `src/routes.ts` biraju ekran putanje. |
| `src/main.tsx`, `index.html`, `vite.config.ts` | Stari Vite ulaz (`pnpm build:vite`). Ostaje dok sve rute ne rade u Next.js; `vite.config.ts` je i konfiguracija Vitesta. |
| `src/App.tsx` | Jedno čitanje sesije. Na 401 preusmjerava na prijavu, a na grešku pokazuje ekran s „Pokušaj ponovno”. Ljuska prikazuje ulogu, ime ustanove i „Odjava”. Router je `history` bez novih ovisnosti; poveznice aplikacije otvaraju se bez ponovnog učitavanja. |
| `src/routes.ts` | Čiste funkcije: baza, putanja, stranica po ulozi (rute iz `src/components/shell/nav.ts`), preusmjeravanje na početni ekran uloge. |
| `src/text.ts` | Nekoliko tekstova samog domaćina. `text.test.ts` ih provjerava skenerom zabranjenih izraza. |
| `e2e/session.spec.ts` | Lažni `/api/v1` (`page.route`): 401 vodi na prijavu s `returnTo`, 200 otvara ekran uloge, odjava, nedostupan poslužitelj, nastavnička čitanja (200, 401, 403, 503). Uz to provjerava konzolu i axe. Poslužitelj je `next build && next start`. Tijela nastavničkih odgovora u `e2e/fixtures/teacher.json` su vektori iz `@ductura/test-fakes` 3.0.1. |

Spojeni ekrani:

- student: S01 i S02 (`student.assignments.get`);
- nastavnik: „Moji kolegiji” (`teacher.courses.get`) i „Radovi uz mentora” (`teacher.mentorships.get`). Na 401 vodi na prijavu, na 403 traži nastavnički račun, a na ostalo javlja grešku i nudi „Pokušaj ponovno”.

Ostale rute iz navigacije zasad imaju naslov i napomenu da prikaz još nije spojen na poslužitelj ustanove. Ekrani administratora ustanove čekaju rute za čitanje u ugovoru; `@ductura/contracts` 2.8.0 za `/ustanova` ima samo POST.
