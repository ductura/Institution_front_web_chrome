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
| `app/[base]/layout.tsx` | Provjeri bazu (`src/bases.ts`, inače „Stranica ne postoji” iz `app/not-found.tsx`) i oko stranice postavi domaćina `src/host/Host.tsx`. |
| `src/host/Host.tsx` | Jedno čitanje sesije. Na 401 preusmjerava na prijavu, a na grešku pokazuje ekran s „Pokušaj ponovno”. Ljuska prikazuje ulogu, ime ustanove i „Odjava” (`SignOut.tsx`). Stranicu druge uloge i `/` vodi na početni ekran uloge. Poveznice aplikacije otvara Next router, bez ponovnog učitavanja. |
| `app/[base]/zadaci/`, `zadaci/kolegiji/`, `nastavnik/`, `nastavnik/mentorstva/` | Spojeni ekrani (`src/host/pages.tsx`). |
| `app/[base]/zadaci/radovi/`, `rad/`, `rad/[assignmentId]/{predaja,dnevnik-pristupa,reprodukcija}/`, `upis/`, `upis/kolegij/[courseId]/`, `zadatak/[id]/` | Studentske stranice Ductusa na svojim adresama, iza oznake `TREBA API` (u datoteci piše koja operacija `/api/v1` nedostaje u `src/client`). Do tada pokazuju naslov i napomenu da prikaz još nije spojen. |
| `app/[base]/nastavnik/{brz-put,rad/[id],rad/[id]/reprodukcija}/` | Nastavničke stranice Ductusa iza oznake `TREBA API`. `nastavnik/kolegiji/` preusmjerava na `nastavnik/` pod istom bazom. |
| `app/[base]/nastavnik/zadatak/{novi,[assignmentId]/uredi,[assignmentId]/rad/[documentId]/jezik}/` | HOST-T2: odabir kolegija i objava zadatka, učitavanje i objava nove verzije te jezik pojedinačnog rada (`src/host/teacher/assignment/`). Čitanje jezika pojedinačnog rada čeka serversku rutu. |
| `app/[base]/ustanova/{,korisnici,kolegiji,pravila}/` | Stranice administratora ustanove (A-01 do A-04), iza oznake `TREBA API`: ugovor za njih još nema čitanje. |
| `app/[base]/kako-radi/` | „Kako Ductura radi” za svaku prijavljenu ulogu. Čeka prijenos `src/components/how-it-works`, koji još uvozi Ductusov `@/lib/i18n/messages.hr`. |
| `app/[base]/stanje/`, `app/[base]/prijava/` | Javne stranice: domaćin ne čita sesiju i ne stavlja ljusku (`public` u `src/routes.ts`). „Stanje sustava” je iza oznake `TREBA API` (`platform.status.get`). „Prijava” vodi ravno na prijavu preko AAI@EduHr (D-09) i vraća na traženu stranicu pod istom bazom. |
| `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` | Greška stranice, greška korijenskog layouta i nepostojeća stranica, na hrvatskom. |
| `app/[base]/[[...path]]/` | `/` pod bazom (domaćin vodi na početni ekran uloge) i putanje bez stranice („Stranica ne postoji” u ljusci). |
| `src/routes.ts` | Čiste funkcije: baza, putanja, stranica po ulozi (rute iz `src/components/shell/nav.ts` i stranice Ductusa s dinamičkim segmentom, npr. `/zadatak/[id]`), preusmjeravanje na početni ekran uloge. |
| `tsconfig.json` | Uz stroge opcije i Ductusov alias `@/` iz `src/components/tsconfig.json`, da domaćin montira ekrane kopirane iz Ductusa (HOST). |
| `vitest.config.ts` | Jedinični testovi čistih dijelova (`src/**/*.test.ts`). |
| `src/text.ts` | Nekoliko tekstova samog domaćina. `text.test.ts` ih provjerava skenerom zabranjenih izraza. |
| `e2e/session.spec.ts` | Lažni `/api/v1` (`page.route`): 401 vodi na prijavu s `returnTo`, 200 otvara ekran uloge, odjava, nedostupan poslužitelj, nastavnička čitanja (200, 401, 403, 503). Uz to provjerava konzolu i axe. Poslužitelj je `next build && next start`. Tijela nastavničkih odgovora u `e2e/fixtures/teacher.json` su vektori iz `@ductura/test-fakes` 3.0.1. |
| `e2e/teacher-assignment.spec.ts` | HOST-T2 preko `page.route`: uspješna čitanja, 401, 503, ponovno čitanje nakon sukoba verzija i prikaz uspjeha nakon odgovora na upis. |

Spojeni ekrani:

- student: S01 i S02 (`student.assignments.get`);
- student: upis kodom na `upis/` i korak do obavijesti na `upis/kolegij/[courseId]/` (`student.enrollments.post`, `student.assignments.get`; HOST-S3);
- nastavnik: „Moji kolegiji” (`teacher.courses.get`) i „Radovi uz mentora” (`teacher.mentorships.get`). Na 401 vodi na prijavu, na 403 traži nastavnički račun, a na ostalo javlja grešku i nudi „Pokušaj ponovno”.

Ostale stranice zasad imaju naslov i napomenu da prikaz još nije spojen na poslužitelj ustanove. Ductusove API rute (`src/app/api/**`) ne prenose se ovamo: `/api/v1` je Institution_server. Ductusova početna `/` je ovdje preloader. Ekrani administratora ustanove imaju vlastite rute, ali čekaju rute za čitanje u ugovoru; `@ductura/contracts` 2.8.0 za `/api/v1/institution` ima samo POST.
