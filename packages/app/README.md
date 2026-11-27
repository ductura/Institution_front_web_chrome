# packages/app

Domaćin fronta institucije (ugovor #2028 c.6993786629 §1 i §3.3) na Next.js 16 (App Router). Ekrani su iz `src/components`, API ide kroz `src/client/api.ts`.

```sh
pnpm dev     # next dev na http://localhost:5173/aplikacija/
pnpm build   # next build
pnpm start   # next start na :5173
```

Konfiguracija ide samo kroz env varijable, bez tajni u repou:

| Varijabla | Zadano | Što |
| --- | --- | --- |
| `INSTITUTION_SERVER_URL` | `http://127.0.0.1:4000` | Kamo Next prosljeđuje `/api/v1/*` kad radi bez edgea (`next dev`, `next start`, Vercel). Čita se pri gradnji. Kroz edge na :8000 `/api/v1/*` ide izravno Institution_serveru. |

Adrese (D-318): `basePath` je `/aplikacija`, a stranice su u grupi ruta `app/(host)/`, koja ne ulazi u adresu. Stare adrese `/app/web/*` i `/app/chrome/*` ne poslužuju se ovdje, preusmjerava ih rub. Edge ovamo šalje samo `/aplikacija/*`, pa su datoteke gradnje pod `/aplikacija/_next/`, a javne datoteke (`public/`) pod `/aplikacija/`. Za Vercel je projekt `packages/app` s presetom Next.js (`vercel.json`).

| Datoteka | Što |
| --- | --- |
| `next.config.ts` | `basePath`, `assetPrefix`, prosljeđivanje `/api/v1/*` i korijen radnog prostora za Turbopack. |
| `app/layout.tsx` | Korijenski layout: fontovi, tokeni i tema (tamna je zadana, D-188; spremljena svijetla postavlja se prije iscrtavanja). |
| `app/(host)/layout.tsx` | Provjeri bazu (`src/bases.ts`, inače „Stranica ne postoji” iz `app/not-found.tsx`) i oko stranice postavi domaćina `src/host/Host.tsx`. |
| `src/host/Host.tsx` | Javnu stranicu prikazuje bez čitanja sesije. Ostale putanje vodi u `src/host/SignedInHost.tsx`, koji se učitava tek izvan javnih stranica (DAN-1571). Naslov kartice može postaviti sama stranica (`usePageTitle`). |
| `src/host/SignedInHost.tsx` | Jedno čitanje sesije. Na 401 preusmjerava na prijavu, a na grešku pokazuje ekran s „Pokušaj ponovno”. Ljuska prikazuje ulogu, ime ustanove i „Odjava” (`SignOut.tsx`). Stranicu druge uloge i `/` vodi na početni ekran uloge. Poveznice aplikacije otvara Next router, bez ponovnog učitavanja. |
| `app/(host)/zadaci/`, `zadaci/kolegiji/`, `nastavnik/`, `nastavnik/mentorstva/` | Spojeni ekrani (`src/host/pages.tsx`). |
| `app/(host)/zadatak/[id]/` | Obavijest zadatka (`src/host/student/notice/NoticePage.tsx`). Čita aktualnu verziju preko `student.notice.get`, bilježi otvaranje preko `student.notice-read.post` i potvrđuje prikazanu verziju preko `institution.acknowledgment.post`. |
| `app/(host)/rad/`, `upis/`, `upis/kolegij/[courseId]/` | Studentske stranice Ductusa na svojim adresama, iza oznake `TREBA API` (u datoteci piše koja operacija `/api/v1` nedostaje u `src/client`). Do tada pokazuju naslov i napomenu da prikaz još nije spojen. |
| `app/(host)/rad/[assignmentId]/predaja/{,izjava,pregled,slanje,potvrda}` | Predaja rada u pet koraka (`src/host/student/submission/`). Svaki korak provjerava zadatak (`student.assignments.get`, `student.assignment-work.get`): odjava vodi na AAI@EduHr, nepotvrđena obavijest na obavijest. Potvrda se čita s poslužitelja pri svakom otvaranju. E2E s lažnim API-jem je u `e2e/student-submission.spec.ts`. |
| `app/(host)/zadaci/radovi/`, `rad/[assignmentId]/{dnevnik-pristupa,reprodukcija}/` | „Moji radovi” (filtri `?q=` i `?godina=`), dnevnik pristupa i reprodukcija vlastitog rada (`src/host/student/other/`). Dnevnik i reprodukcija čitaju dokument rada iz potpisane potvrde predaje, pa se stvarno prikazuju samo za predan rad. Rad u tijeku čita se kao nedostupan, a nezapočet kao nezapočet. E2E s lažnim API-jem je u `e2e/student-other.spec.ts`. |
| `app/(host)/nastavnik/rad/[id]/{,reprodukcija,predaja,konzultacije}` | Rad uživo s komentarima, reprodukcija, potvrda predaje i zapisi konzultacija (`src/host/teacher/work/`). Čitanje potvrde po ID-u rada ovisi o `teacher.work.get`. E2E s lažnim API-jem je u `e2e/teacher-work.spec.ts`. |
| `app/(host)/nastavnik/brz-put/` | Nastavnička stranica Ductusa iza oznake `TREBA API`. `nastavnik/kolegiji/` preusmjerava na `nastavnik/` pod istom bazom. |
| `app/(host)/nastavnik/zadatak/{novi,[assignmentId]/uredi,[assignmentId]/rad/[documentId]/jezik}/` | HOST-T2: odabir kolegija i objava zadatka, učitavanje i objava nove verzije te jezik pojedinačnog rada (`src/host/teacher/assignment/`). Jezik pojedinačnog rada ima lažni API u testu. Na poslužitelju treba dodati GET i montirati postojeći POST ugovor. |
| `app/(host)/ustanova/{,korisnici,kolegiji,pravila}/` | Stranice administratora ustanove (A-01 do A-04) u `src/host/institution/`. „Novi kolegij” koristi `institution.admin-courses.post`. Pregled, popisi i pravila imaju zasebne poruke o nedostupnosti do uvođenja čitanja. |
| `app/(host)/kako-radi/` | Statični ekran „Kako Ductura radi” za svaku prijavljenu ulogu. Koristi `src/components/how-it-works` i hrvatske poruke iz `locales/hr.ts`. |
| `app/(host)/stanje/` | Javno „Stanje sustava” bez čitanja sesije. `StatusBoard` čita `platform.status.get` kroz `src/client` i prikazuje rezultate, zastarjelost ili grešku s ponovnim pokušajem. |
| `app/(host)/prijava/` | Javna stranica vodi ravno na prijavu preko AAI@EduHr (D-09) i vraća na traženu stranicu pod istom bazom. |
| `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` | Greška stranice, greška korijenskog layouta i nepostojeća stranica, na hrvatskom. |
| `app/(host)/page.tsx` i `app/(host)/[...path]/` | `/` pod bazom (domaćin vodi na početni ekran uloge) i putanje bez stranice („Stranica ne postoji” u ljusci). |
| `src/routes.ts` | Čiste funkcije: baza, putanja, stranica po ulozi (rute iz `src/components/shell/nav.ts` i stranice Ductusa s dinamičkim segmentom, npr. `/zadatak/[id]`), preusmjeravanje na početni ekran uloge. |
| `tsconfig.json` | Uz stroge opcije i Ductusov alias `@/` iz `src/components/tsconfig.json`, da domaćin montira ekrane kopirane iz Ductusa (HOST). |
| `vitest.config.ts` | Jedinični testovi čistih dijelova (`src/**/*.test.ts`). |
| `src/text.ts` | Nekoliko tekstova samog domaćina. `text.test.ts` ih provjerava skenerom zabranjenih izraza. |
| `e2e/session.spec.ts` | Lažni `/api/v1` (`page.route`): prijava s `returnTo`, odjava, ekrani uloga, „Kako Ductura radi” i javno stanje (200, 401, 503 s ponovnim pokušajem). Uz to provjerava konzolu i axe. Poslužitelj je `next build && next start`. Tijela nastavničkih odgovora u `e2e/fixtures/teacher.json` su vektori iz `@ductura/test-fakes` 3.0.1. |
| `e2e/teacher-assignment.spec.ts` | HOST-T2 preko `page.route`: uspješna čitanja, 401, 503, ponovno čitanje nakon sukoba verzija i prikaz uspjeha nakon odgovora na upis. |

Spojeni ekrani:

- student: S01 i S02 (`student.assignments.get`);
- student: upis kodom na `upis/` i korak do obavijesti na `upis/kolegij/[courseId]/` (`student.enrollments.post`, `student.assignments.get`; HOST-S3);
- nastavnik: „Moji kolegiji” (`teacher.courses.get`) i „Radovi uz mentora” (`teacher.mentorships.get`). Na 401 vodi na prijavu, na 403 traži nastavnički račun, a na ostalo javlja grešku i nudi „Pokušaj ponovno”.
- administrator: „Novi kolegij” na `ustanova/kolegiji/` (HOST-A1, obrazac iz WEB-20). Poslužitelj prima izradu s potvrđenim nositeljem i praznim popisom grupa. Potvrda izrade prikazuje se nakon uspješnog odgovora API-ja.

Ostale stranice zasad imaju naslov i napomenu da prikaz još nije spojen na poslužitelj ustanove. Ductusove API rute (`src/app/api/**`) ne prenose se ovamo: `/api/v1` je Institution_server. Ductusova početna `/` je ovdje preloader.

SRV treba izložiti čitanja nad postojećim `readInstitutionOverview`, `readTeacherRoles`, `readAcademicYears` i `readInstitutionCourses` te `readFacultyRules`. `institution.course-groups.get` traži identifikator pojedinog kolegija. Za A-03 treba čitanje akademskih godina i popisa kolegija ustanove s nastavnim timovima, grupama i brojem upisanih. A-02 treba popis kandidata, potvrđenih nastavnika i nastavnika za pregled prije spajanja potvrde i opoziva uloga. [SRV zadatak za HOST-A1](https://github.com/danielrisavi77-create/Ductus/issues/2051#issuecomment-7050231059)
