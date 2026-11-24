# Val 19: razlika (dnevnik stručne prakse, grupni rad s doprinosom, anonimna recenzija među studentima)

Zadatak V19-PREGLED `val19-razlika`. Dodao ga je orkestrator 24. 11. 2026. po planu `ductura/.github` `docs/plan/NOVE-FUNKCIJE.md`, „Val 17: rani početak”, t. 7 (PR #84; odluka vlasnika). Plan oblak ne vidi, pa je opis zadatka iz naloga na Ductus#2055 (c.7146220558). Ovaj dokument je samo pregled i popis zadataka: kod se ne mijenja. Oblik po uzoru na `docs/nalazi/nove-funkcije-6-mentorstvo-konzultacije.md`.

Oznake: nalazi **V19-n**, otvorena pitanja **OP-V19-n**, zadaci `SRV-V19-<NAZIV>` i `WEB-V19-<NAZIV>`.

## 0. Izvori, način pregleda i ograničenja

Pročitano:
- WEB baza `origin/migracija/kopija-ductus-front` na `9b5d202` (#623): `packages/app/src/host/` (student, teacher, editor), `packages/app/src/routes.ts`, `packages/app/src/host/ljuska-po-ekranu.ts`, `src/client/migration-contracts.generated.json` (izvadak), `locales/hr.ts`, `docs/nalazi/*`, `docs/plan/PLAN-MIGRACIJE.md`;
- SRV baza `origin/migracija/kopija-ductus-backend` na `11b6a58c` (#697), javni klon `https://github.com/ductura/Institution_server`: `server/contracts/routes/*.ts`, `server/contracts/inventory.ts`, `server/database/`, `server/http/`, `server/domain/provenance-share/`, `db/main/migrations/` (231 datoteka, zadnja `20261218100000_origin_segments.sql`), `db/main/tests/` (zadnji `246-origin-segments.sql`), `docs/contracts/provenance-share-v1.md`, `docs/contracts/thesis-v1.md`, `docs/contracts/mentorship-consultations-v1.md`, `docs/server-map.md`;
- kanonski opis zadataka (Ductus#2028, c.7008147932): „Zajednička pravila” i „Trake i vlasništvo zajedničkih datoteka”; zadatak V19-PREGLED u njemu nije, opis je iz naloga.

Što nije učinjeno, izričito:
- **aplikacija ni poslužitelj nisu pokrenuti**, nije bilo baze ni Dockera. Sve je izvedeno čitanjem koda i ugovora. Što ugovor dopušta znamo; tko stvarno smije što (RLS) vidi se samo u migracijama koje su čitane pojedinačno gdje je to navedeno;
- **plan `NOVE-FUNKCIJE.md` nije čitan** (oblak nema pristup `ductura/.github`);
- **Ustav, PRODUCT §5 i rječnik zabranjenih izraza nisu čitani u izvorniku** (nisu u ovim repoima). Granice iz njih uzete su iz naloga i iz `provenance-share-v1.md` koji ih citira. Prije koda orkestrator ih provjerava (OP-V19-1, OP-V19-2);
- ništa nije pretraživano na `main` ni u drugim granama osim dviju baza; PR-ovi otvoreni nakon gore navedenih SHA-ova nisu provjereni;
- svi primjeri su izmišljeni („Student A”, „Nastavnik A”, „Organizacija A”).

Odluke i pravila koja vrijede za sve zadatke (ne pitaju se ponovno): prijava samo AAI@EduHr (D-09, D-16), `djelatnik` → nastavnik, `student` → student; ocjena ostaje u Merlinu i ništa iz ovog vala ne ulazi u ocjenu ni u izvoz ocjene; bez rangiranja studenata i bez automatskih sankcija; uz svaki izračun iz zabilježenih događaja trajna napomena „nije dokaz autorstva” (C-6, P-B); student vidi isto što i nastavnik gdje se radi o izračunu (pravilo 5); tuđe, nepoznato i neispravno je isti 404 (C-23); samo izmišljeni podaci.

## 1. Sažetak razlike

| Funkcija | Što već postoji | Što nedostaje |
|---|---|---|
| 1. Dnevnik stručne prakse s potpisom mentora | mentorstvo (`mentorship.*`, mentor je nastavnik, otvara ga nastavnik), etape rada i potvrda mentora (`work.milestones.*`), suglasnost mentora kao zapis samo za dodavanje (`work_mentor_consent_event`), privatne bilješke mentora, poruke uz rad, zapisnik konzultacija | **sve vlastito**: praksa kao pojam, zapisi dnevnika, potpis. Nijedna ruta, tablica ni ekran ne spominje stručnu praksu. Postojeći `isPractice` je „Probni zadatak (bez ocjene)”, **nije** stručna praksa |
| 2. Grupni rad s doprinosom (C-6 a) | seminarske grupe tečaja (administrativne: `institution.course-groups.*`), izračun udjela iz zabilježenih događaja kao čist domenski modul (`server/domain/provenance-share/`, SRV-1221 #509) | **sve vlastito**: timovi studenata na zadatku, prikaz doprinosa. Evidencija je vezana za jednog studenta; rute `*.provenance-share.get` iz ugovora nisu na bazi |
| 3. Anonimna recenzija među studentima koju uključuje nastavnik | komentari i dorada između nastavnika i studenta (`collaboration.comments.post`, `work.comments.*`, `work.review.post`) | **sve vlastito**: svaki student čita samo vlastiti rad; nema kruga recenzija, dodjele, anonimnog čitanja ni primanja recenzije |

## 2. Što već postoji

### 2.1 Baza WEB (`ductura/Institution_front_web_chrome`, `migracija/kopija-ductus-front`)

Aplikacija je u `packages/app/src/host/` (Vite); `src/app` je stari Next kod i ne dira se.

| Područje | Putanje | Napomena za val 19 |
|---|---|---|
| Student: zahtjev za mentorstvo | `host/student/mentorship-request/` (`MentorshipRequestPage.tsx`, `model.ts`, `messages.hr.ts`, `no-direct-api.test.ts`) | polazište za vezu prakse i mentora; praksa se veže uz postojeće mentorstvo, ne zamjenjuje ga |
| Student: radni prostor | `host/student/work/` (`WorkIndex.tsx`, `frame.tsx`, `origin/`), `host/student/courses/` | mjesto s kojeg student ulazi u rad; recenzija i tim ne diraju editor |
| Student: početna i radovi | `host/student/home/`, `host/student/courses/WorksPage.tsx` | ulazna točka za zadatke recenzije i tima |
| Nastavnik: mentorstva i etape | `host/teacher/mentorships/` (`MentorshipsPage.tsx`, `WorkPlan.tsx`, `PlanActions.tsx`, `model.ts`), `host/teacher/n16/` (`RequestsCard.tsx`, `WorksList.tsx`) | polazište za mentorov popis praksi i potpis |
| Nastavnik: podrijetlo teksta | `host/teacher/provenance/` (`ProvenanceMap.tsx`, `model.ts`, `contract.ts`, `no-direct-api.test.ts`) | oblik prikaza s napomenom „nije dokaz autorstva”; ne dira se |
| Nastavnik: obrazac zadatka | `host/teacher/assignment-form/` (`AssignmentForm.tsx`, `PracticeField.tsx`, …) | **`PracticeField` je „Probni zadatak (bez ocjene)”**; ne miješati s praksom; datoteke se ne diraju |
| Nastavnik: nastavni tim kolegija | `host/teacher/teaching-team/TeachingTeam.tsx`, `locales/hr.ts` (A-03 `kolegiji`, seminarske grupe) | seminarska grupa je administrativna jedinica nastavnika, **nije** tim studenata |
| Ruta i okvir | `packages/app/src/routes.ts`, `host/ljuska-po-ekranu.ts` (popis `SCREEN_FRAMES`), `host/pages.tsx`, `host/Host.tsx` | zajednički retci za svaku novu stranicu |
| Klijent ugovora | `src/client/migration-contracts.generated.json`, `migration-contract-types.generated.ts`, `migration-contract-vectors.generated.json`, `src/client/api.ts` (`callMigrationRoute`), `src/client/work-milestones.ts`, `src/client/mentorship-requests.ts` | izvadak ne uređuje pisac; orkestrator ga dopunjuje iz SRV baze |

U izvatku su, među onima koje val 19 dotiče: `mentorship.open.post`, `mentorship.student-mentorships.get`, `mentorship.student-requests.get`, `mentorship.requests.post`, `mentorship.notes.get|post`, `mentorship.key-dates.get`, `work.milestones.*`, `work.milestone-states.get`, `work.messages.get|post`, `work.origin-composition.get`, `work.origin-segments.get`, `work.origin-thresholds.get`, `collaboration.comments.post`, `collaboration.revision-requests.post`, `work.review.post`, `student-work.start.post`, `student-work.works.get`. **U izvatku nema** nijedne operacije za praksu, tim, doprinos ni recenziju među studentima (pretraženo po `provenance-share`, `work-team`, `peer`, `practice`).

Klijent za ugovore koje val 19 tek dobiva ne postoji: WEB zadaci čekaju izvadak (`drzi=izvadak-srv-n`, pravilo iz naloga).

### 2.2 Baza SRV (`Institution_server`, `migracija/kopija-ductus-backend`)

| Područje | Putanje i rute | Napomena za val 19 |
|---|---|---|
| Mentorstvo | `server/contracts/routes/mentorship.ts` (`mentorship.requests.post`, `mentorship.request-approve|decline|withdraw.post`), `mentorship-student.ts`, `mentorship-consultations.ts` (`mentorship.open.post` `POST /api/v1/mentorships`, `mentorship.student-mentorships.get`), `mentor-notes.ts` (`mentorship.notes.get|post`, `/api/v1/mentorships/{id}/notes`), `mentorship-follow.ts`; migracije `20261028100000_institution_mentorship.sql`, `20261104090000_mentorship_request.sql`, `20261126100200_mentorship_approval.sql`, `20261216130000_mentorship_opening_consultations.sql` | mentor je nastavnik; mentorstvo otvara nastavnik; vrste rada mentorstva su završni i diplomski (`bachelor_thesis`, `master_thesis`, `specialist_thesis`, `doctoral_thesis`) |
| Etape i potvrda mentora | `work-milestones.ts` (`work.milestones.get|patch|delete`, `…submit|approve|request-revision.post`, `…details.patch`, `work.milestone-states.get`), `milestone-template.ts`, migracije `20261121101000_work_milestone.sql`, `20261213100000_milestone_states.sql`, `20261213110000_milestone_template.sql` | etape su odnos „student šalje, mentor potvrđuje”; nisu dnevnik i ne drže zapise po danima |
| Suglasnost mentora (uzorak potpisa) | `server/contracts/routes/thesis.ts`, `docs/contracts/thesis-v1.md`, tablica `institution.work_mentor_consent_event` (samo za dodavanje: tko, kada, neobavezan komentar do 1000 znakova), pgTAP `234-thesis-forms-consent.sql` | **jedini postojeći oblik „mentor potvrđuje”**; dnevnik se gradi po istom uzorku |
| Zadaci i vrsta rada | `server/contracts/routes/institution.ts` (`institution.course-assignments.post`, `institution.assignment.get`; `workType` zatvoren skup `short_paper`, `essay`, `seminar_paper`, `bachelor_thesis`, `master_thesis`, `specialist_thesis`, `doctoral_thesis`; `isPractice` = probni zadatak), `faculty-rules.ts` | `workType` je **zatvoren skup u tri ugovora** (`institution.ts`, `faculty-rules.ts`, `mentorship-consultations.ts`): proširenje (npr. vrstom `practice`) lomi ugovor i dira sva tri; zato se praksa **ne** modelira kao vrsta rada |
| Seminarske grupe | `institution.ts` (`institution.course-groups.get|post`, `institution.course-group-teachers.post`), `server/database/institution-groups.ts`, `server/http/institution-groups.ts`, migracije `20261102160000_course_team_groups.sql`, `20261104100000_group_scope.sql`, `20261106180000_group_place_tie.sql` | grupa je skup studenata za nastavnika grupe; student u njoj nema ulogu |
| Rad i evidencija | `student-work.ts` (`student-work.start.post`, `student-work.works.get`), `evidence.ts`, `server/domain/forensics/`; migracija `20261019150000_evidence_open_work.sql`: `evidence.project` je `UNIQUE (assignment_id, institution_id, principal_id)` | **jedan rad, jedan student, jedan lanac evidencije**. Zajednički dokument s više pisaca ne postoji i traži kritičnu promjenu evidencije (OP-V19-3) |
| Podrijetlo teksta | `origin-composition.ts` (`work.origin-composition.get` šest vrsta, `work.origin-segments.get|post`), `origin-thresholds.ts`, migracije `20261213100300_origin_kind_rhythm.sql`, `20261218100000_origin_segments.sql` | udio po vrsti podrijetla za **jedan rad**; bez poretka među osobama |
| Udio predanog teksta (C-6 a) | `server/domain/provenance-share/` (`share.ts`, `record.ts`, `categories.ts`, SRV-1221 #509), `docs/contracts/provenance-share-v1.md` (odobren) | **samo čist domenski modul**: rute `student.provenance-share.get` i `teacher.provenance-share.get`, tablica, izračun nakon predaje i prekidač fakulteta nisu na bazi (SRV-1222 na baznoj grani nije). Doprinos tima ovisi o njima |
| Komentari i dorada | `comments.ts` (`work.comment-drafts.*`, `work.comments.publish*`, `teacher.comment-bank.*`, `work.review.post`, `work.changes-since-review.get`), `collaboration.ts` (`collaboration.comments.post` uz akcije `create|reply|resolve|reopen|delete|list`, `collaboration.revision-requests.post`), `return-for-revision.ts` | `authorRole` je samo `teacher` ili `student` i student piše samo na **vlastitom** radu; recenzent nije uloga |
| Čitanje tuđeg rada | `server/institution/student-assignments-route.ts`, `server/database/my-assignment-work.ts`, `teacher-work.ts` | student čita samo vlastiti rad; nema rute koja studentu daje tekst drugog studenta |
| Obavijesti | `notifications.ts` (`notifications.list.get`, vrste `assignment_version`, `comment_posted`, `course_handover`, `deadline_reminder`, `submission_recorded`) | zatvoren skup vrsta; nova vrsta lomi ugovor, pa obavijest o recenziji ne ide u ovom valu (OP-V19-7) |
| Pravila gradnje | `server/contracts/routes/index.ts`, `inventory.ts`, `contracts.test.ts`, `tests/contracts/contract-only.test.ts`, `server/server.ts`, `server/http/index.ts`, `server/database/index.ts`, `db/main/migrations.sum`, `db/main/tests/030-institution-access-matrix.sql`, `packages/test-fakes/dev-server`, `tests/db/logout-old-cookie.integration.test.ts` | zajednički retci po pravilima iz naloga |

## 3. Nalazi razlike

**V19-1. Praksa nije vrsta rada.** Vrsta rada je zatvoren skup u tri ugovora; dodavanje vrijednosti lomi `contracts:breaking` na tri mjesta i dira kolegije, pravila fakulteta i mentorstvo. Dnevnik se zato modelira kao **zaseban zapis uz postojeće mentorstvo** (mentor je već nastavnik s potvrđenom ulogom, odnos je već u RLS-u), ne kao `workType`.

**V19-2. Mentor je uvijek nastavnik ustanove.** Mentorstvo otvara nastavnik, a nastavnik se prijavljuje samo AAI@EduHr (`djelatnik`). Voditelj prakse u organizaciji nema AAI račun, pa **ne može potpisivati u Ducturi** (D-09). Potpis mentora znači potpis nastavnika mentora ustanove (OP-V19-1).

**V19-3. „Potpis” je zapis u Ducturi, ne kvalificirani potpis.** Po uzorku `work_mentor_consent_event`: tko, kada, što je potpisao (JCS SHA-256 skupa zapisa do određenog datuma), neobavezan komentar. Pravna snaga čeka pravnu osobu ustanove (OP-V19-1).

**V19-4. Dnevnik je zapis samo za dodavanje.** Ispravak je novi zapis koji upućuje na prethodni; potpisani zapis se ne mijenja. Studentov unos ne ide kroz lanac evidencije (to nije tekst rada), pa dnevnik nema „zabilježene događaje” i nema izračun podrijetla.

**V19-5. Grupni rad je u planu izvan pilota (D-78, 3. 10. 2026.).** `PLAN-MIGRACIJE.md` (r. 2554) navodi „grupni radovi S-12 (D-78)” izvan pilota; oznaka S-12 u istom planu označava i „komentari studenta” (r. 2906). Danas ovdje vrijedi nalog (odluka vlasnika, Val 17 t. 7), ali tekst D-78 treba uskladiti (OP-V19-4). Do tada se tim gradi samo za demo s izmišljenim podacima.

**V19-6. Evidencija ne poznaje zajednički dokument.** `evidence.project` je jedinstven po `(assignment, institution, principal)`. Zajedničko pisanje u jednom dokumentu zahtijevalo bi više pisaca u jednom lancu (kritična promjena `src/domain/forensics` i potpisa, `Risk: critical`). **Pretpostavka ovog vala:** svaki član tima piše **svoj dio** u vlastitom radu (postojeći `student-work.start.post`, lanac, predaja), a tim je veza između tih radova. Doprinos se računa iz lanca svakog člana. Zajednički dokument je OP-V19-3 i nije u ovom valu.

**V19-7. Doprinos je najosjetljivija točka pravila „bez rangiranja”.** C-6 (a) po `provenance-share-v1.md` dopušta „udio predanog teksta isključivo iz zabilježenih događaja” (po vrsti podrijetla). Prikaz **po članu tima** nije doslovno u tom tekstu, pa ide kao OP-V19-2 prije koda. Ako se potvrdi, vrijede ograničenja: redoslijed članova je uvijek po prezimenu i imenu (hr kolacija) i nikad po iznosu; nema parametra sortiranja, praga, boje, oznake „visoko/nisko”, zbroja ni usporedbe člana s prosjekom; polje s doprinosom nikad u popisima, izvozima, paketima, obavijestima ni Merlinu; ista tijela za studenta i nastavnika; uvijek napomena „nije dokaz autorstva”; ne ulazi u ocjenu; ne blokira predaju.

**V19-8. Doprinos ovisi o SRV-1222.** Bez zapisanog izračuna po predaji (SRV-1222: tablica, izračun nakon predaje, rute `*.provenance-share.get`) nema što prikazati po članu. Zadatak `SRV-V19-GRUPA-RUTE` zato ovisi o SRV-1222, koji treba biti na SRV bazi prije njega.

**V19-9. Anonimnost recenzije traži novi put čitanja tuđeg rada.** Student danas čita samo vlastiti rad. Anonimna recenzija traži rutu koja recenzentu daje **tekst predane revizije bez ikakvog podatka o autoru** (ni ime, ni id studenta, ni id rada u obliku koji vodi do osobe) i to samo dodijeljenu radu, samo dok krug traje. To je nova granica povjerenja: `Risk: critical`, uz novi pgTAP matricu i negativne slučajeve (OP-V19-5: pravno mišljenje i DPIA prije stvarnih studenata; do tada samo demo s izmišljenim podacima).

**V19-10. „Koju uključuje nastavnik” = nastavnik otvara i vodi krug i vidi tko je recenzent.** Anonimnost je među studentima: autor ne vidi tko ga je recenzirao, recenzent ne vidi čiji rad čita. Nastavnik kolegija vidi dodjele i tko je što napisao (odgovornost, zlouporaba) i smije povući recenziju s razlogom. Zapis povlačenja je zapis samo za dodavanje. Pretpostavka; potvrda OP-V19-6.

**V19-11. Recenzija nema brojčanu ocjenu ni rang.** Samo tekst po kriterijima koje nastavnik postavi (zatvoren skup rubrika bez brojeva) i opći komentar. Bez zbirnih brojeva po studentu, bez „najbolje recenzije”, bez popisa po kvaliteti, bez automatske sankcije za neodrađenu recenziju (samo nastavnik vidi tko je odradio, kao činjenicu bez kazne). Recenzija ne ulazi u ocjenu rada ni u Merlin paket.

**V19-12. Zatvoreni skupovi koji sprječavaju lakši put.** `authorRole` komentara (`teacher|student`), vrste obavijesti i `workType` su zatvoreni; proširenje bi lomilo ugovore koje drže drugi zadaci. Recenzija i tim dobivaju **vlastite rute i tablice**; ništa se u postojećim ugovorima ne mijenja.

**V19-13. Nova stanja prikaza.** Za svaki novi zaslon vrijedi pravilo iz pregleda (4): „učitavanje” i „greška” se ne prikazuju kao „nema podataka”; praznina i greška su različita stanja s različitim tekstom.

## 4. Odluke za koje nije potrebno pitanje (Pretpostavke)

1. Praksa se veže uz **aktivno mentorstvo** (`mentorship.id`); jedan student može imati više praksi (razdoblja), svaka s točno jednim mentorom.
2. Zapis dnevnika: datum (ISO datum, ne u budućnosti, unutar razdoblja prakse), sati (0,5 do 12 u koracima 0,5), tekst 1 do 4000 točaka koda (NFC, bez kontrolnih znakova osim novog retka i tabulatora, bez znakova za promjenu smjera), neobavezno `correctsEntryId`. Najviše 400 zapisa po praksi.
3. Potpis mentora: `{throughDate, comment?}`, pokriva sve zapise do uključivo `throughDate` koji postoje u trenutku potpisa; pohranjuje `entriesSha256` (JCS skupa) i broj zapisa. Zapis dodan poslije za stariji datum je ispravak i traži novi potpis. Potpis se ne povlači (novi potpis ga nadomješta u prikazu, stari ostaje u povijesti).
4. Student **ne** vidi mentorove privatne bilješke (`mentorship.notes`); komentar uz potpis student vidi.
5. Tim: 2 do 6 studenata istog kolegija i istog zadatka, formiranje po izboru nastavnika (`student_choice` ili `teacher_assigned`). Član može napustiti tim dok nije predao svoj dio. Tim se ne briše.
6. Krug recenzije: po zadatku najviše jedan krug u ovom valu; `reviewsPerStudent` 1 do 3; dodjela deterministička (sjeme = id kruga), bez samorecenzije, samo među onima koji su **predali**; zatvoren skup rubrika (do 6) s tekstom nastavnika; recenzija 1 do 4000 točaka koda po rubrici i do 4000 općeg komentara.
7. Svi novi zapisi: tablice samo za dodavanje (okidač odbija `UPDATE`, `DELETE`, `TRUNCATE`), RLS uključen i prisiljen, `ductus_app` bez prava na tablice, pristup samo kroz `app.*` `SECURITY DEFINER` RPC-e, retci u pgTAP matrici u istom PR-u.
8. Verzije migracija: **iza vrha baze** (`20261218100000` danas); pisac prije commita provjerava `git ls-tree --name-only origin/migracija/kopija-ductus-backend db/main/migrations/ | tail -1` i svoju datoteku, ako treba, pomiče iza vrha. Predložene verzije: `20261219100000`, `20261219110000`, `20261219120000`.
9. Brojevi pgTAP datoteka: `247-practice-journal.sql`, `248-work-team.sql`, `249-peer-review.sql` (iza `246-origin-segments.sql`); pisac provjerava slobodan broj.
10. Pristup rutama po uzoru na postojeće: `student_enrolled`, `course_teacher`, `mentor_of_mentorship`; svaka nova ruta ima 401 `unauthorized`, 404 `not_found` (isti za tuđe, nepoznato i neispravno), 503 `unavailable`, a mutacije `MUTATION_GUARD`.

## 5. Zadaci koji nedostaju

Najviše 14, svaki do oko 400 redaka koda (generirane datoteke i lockfile se ne broje). Veličina: S do ~150, M do ~300, L do ~400 redaka. **Server ugovor prije weba**, a WEB zadatak čeka izvadak ugovora (orkestrator ga dodaje u `src/client/migration-contract*.generated.*`; pisac spaja granu izvatka i ne uređuje ga ručno). Parametar klijenta se zove `call`, ne `api`; ključeve `from`/`to` pisati bez navodnika (pravila iz naloga).

Zajednički retci koje smije dodati svaki SRV zadatak sa svojom rutom (po pravilima iz naloga, kod konflikta zadržati oba retka): jedan redak izvoza u `server/http/index.ts`; montiranje u `server/server.ts`; jedan redak izvoza adaptera u `server/database/index.ts`; retci u `server/contracts/contracts.test.ts`, `server/contracts/fake-server.integration.test.ts`, `tests/contracts/contract-only.test.ts`; handler u `packages/test-fakes/dev-server`; introspekcija i slučajevi u `tests/db/logout-old-cookie.integration.test.ts`; jedan redak u `server/domain/index.test.ts` za novu domensku mapu; redci u `db/main/tests/030-institution-access-matrix.sql`; `db/main/migrations.sum` (`pnpm db:sum`). Generirano (`server/contracts/generated/*`, `openapi/v1.json`) se ponovno generira, ne uređuje.

### A. Dnevnik stručne prakse s potpisom mentora

#### 1. SRV-V19-DNEVNIK-UGOVOR · S · SRV, traka S-A
- **Opis:** ugovor za praksu uz mentorstvo: razdoblje prakse, zapisi dnevnika, potpis mentora. Zatvorena tijela, JCS vektori uspjeha i greške za svaku rutu, `docs/contracts/practice-journal-v1.md` (zapis, tko smije, što ugovor ne odlučuje: pravna snaga potpisa, voditelj u organizaciji, ocjena).
- **Nove rute i polja:**
  - `practice.placements.post` `POST /api/v1/practice/placements` `{mentorshipId, organisationName (1–120), startsOn, endsOn}` → `{placementId}` (mentor, `mentor_of_mentorship`);
  - `practice.placements.get` `GET /api/v1/practice/placements` → `{placements:[{placementId, mentorshipId, organisationName, startsOn, endsOn, entryCount, signedThrough|null}]}` (student: svoje; nastavnik: samo svoje mentorirane);
  - `practice.entries.get` `GET /api/v1/practice/placements/{placementId}/entries` → `{entries:[{entryId, date, hours, text, correctsEntryId|null, createdAt}], signoffs:[…]}`;
  - `practice.entries.post` `POST …/entries` `{date, hours, text, correctsEntryId?}` → `{entryId}` (samo student vlasnik; 409 `placement_closed` izvan razdoblja);
  - `practice.signoffs.post` `POST …/signoffs` `{throughDate, comment? (≤1000)}` → `{signoffId, entryCount, entriesSha256}` (samo mentor; 409 `nothing_to_sign`);
  - `practice.signoffs.get` `GET …/signoffs` → `{signoffs:[{signoffId, throughDate, entryCount, entriesSha256, comment|null, signedAt, mentor:{id, givenName, familyName}}]}`.
- **Putanje:** `server/contracts/routes/practice-journal.ts` (novo), `server/contracts/vectors/practice.*.json` (novo, po ruti), `docs/contracts/practice-journal-v1.md` (novo); zajednički registar: `server/contracts/routes/index.ts` (jedan redak izvoza), `server/contracts/inventory.ts` (retci), `server/contracts/version.ts`, `server/contracts/generated/*`, `openapi/v1.json` (generirano).
- **Ovisi o:** ništa. **Prije** `SRV-V19-GRUPA-UGOVOR` i `SRV-V19-RECENZIJA-UGOVOR` (isti zajednički registar i generirani ugovori, vidi §6).

#### 2. SRV-V19-DNEVNIK-BAZA · M · SRV, traka S-B
- **Opis:** migracija s tri tablice samo za dodavanje i RPC-ima; RLS i pgTAP. Student piše i čita svoje; mentor čita i potpisuje samo svoje mentorirane; drugi student, drugi nastavnik i administrator ne čitaju sadržaj zapisa.
- **Nova polja:** `institution.practice_placement (id, institution_id, mentorship_id, student_id, organisation_name, starts_on, ends_on, created_by, created_at)`; `institution.practice_entry (id, placement_id, entry_date, hours numeric(3,1), body, corrects_entry_id, created_at)`; `institution.practice_signoff (id, placement_id, through_date, entry_count, entries_sha256, comment, mentor_id, signed_at)`; RPC `app.open_practice_placement`, `app.add_practice_entry`, `app.sign_practice_entries`, `app.practice_placements`, `app.practice_entries`, `app.practice_signoffs`.
- **Putanje:** `db/main/migrations/20261219100000_practice_journal.sql` (provjeriti verziju prema vrhu baze), `db/main/migrations.sum`, `db/main/tests/247-practice-journal.sql`, retci u `db/main/tests/030-institution-access-matrix.sql`.
- **pgTAP (minimum):** student piše u tuđi placement → odbijeno; drugi student ne čita; mentor drugog studenta ne potpisuje; zapis izvan razdoblja odbijen; `UPDATE` i `DELETE` odbijeni okidačem; ispravak upućuje samo na zapis iste prakse.
- **Ovisi o:** `SRV-V19-DNEVNIK-UGOVOR` (imena i granice), migracijski red (S-B): ide **prije** `SRV-V19-GRUPA-BAZA` i `SRV-V19-RECENZIJA-BAZA`.

#### 3. SRV-V19-DNEVNIK-RUTE · M · SRV, traka S-C
- **Opis:** adapter i HTTP rukovatelji za šest ruta nad `SRV-V19-DNEVNIK-BAZA`; čista domenska funkcija za JCS hash skupa zapisa i provjeru unosa; montiranje.
- **Putanje:** `server/domain/practice-journal/` (novo: `entries-hash.ts`, `validate.ts`, `index.ts`, testovi), `server/database/practice-journal/` (novo: adapter, `index.ts`), `server/http/practice-journal/` (novo: rukovatelji, integracijski testovi), zajednički retci (§5 uvod): `server/server.ts`, `server/http/index.ts`, `server/database/index.ts`, `server/domain/index.test.ts`, `server/contracts/contracts.test.ts`, `server/contracts/fake-server.integration.test.ts`, `tests/contracts/contract-only.test.ts`, `tests/db/logout-old-cookie.integration.test.ts`, `packages/test-fakes/dev-server`.
- **Testovi (minimum):** hash isti za isti skup i različit nakon ispravka; student tuđe prakse → 404; mentor druge prakse → 404; unos izvan razdoblja → 409; potpis bez novih zapisa → 409; lažni dev server vraća vektore.
- **Ovisi o:** `SRV-V19-DNEVNIK-BAZA`, `SRV-V19-DNEVNIK-UGOVOR`.

#### 4. WEB-V19-DNEVNIK-STUDENT · M · WEB (host)
- **Opis:** stranica „Dnevnik prakse” za studenta: popis praksi, zapisi po datumu, obrazac novog zapisa (datum, sati, tekst), ispravak kao novi zapis, oznaka „potpisano do …” s komentarom mentora. Stanja učitavanje, greška, prazno i „nema aktivne prakse” su zasebna.
- **Putanje:** `packages/app/src/host/student/practice-journal/` (novo: `PracticeJournalPage.tsx`, `model.ts`, `read.ts`, `messages.hr.ts`, `model.test.ts`, `no-direct-api.test.ts`), zajednički retci: `packages/app/src/routes.ts`, `packages/app/src/host/ljuska-po-ekranu.ts` (+ `ljuska-po-ekranu.test.ts`), `host/pages.tsx`, e2e `e2e/` ako provjera pokrivenosti traži.
- **Ovisi o:** server ugovor i izvadak (`SRV-V19-DNEVNIK-UGOVOR`, `SRV-V19-DNEVNIK-RUTE`); izvadak dopunjuje orkestrator.

#### 5. WEB-V19-DNEVNIK-MENTOR · M · WEB (host)
- **Opis:** mentorov prikaz: popis praksi mentoriranih studenata (uz postojeći popis mentorstava), otvaranje prakse, čitanje dnevnika, obrazac „Potpiši do datuma” s komentarom i prikaz povijesti potpisa. Nije u `n16`/`mentorships`; ulazi se iz njih samo poveznicom.
- **Putanje:** `packages/app/src/host/teacher/practice-journal/` (novo: `MentorJournalPage.tsx`, `OpenPlacementForm.tsx`, `model.ts`, `messages.hr.ts`, testovi, `no-direct-api.test.ts`); jedna poveznica „Dnevnik prakse” u `host/teacher/mentorships/MentorshipsPage.tsx` (uski dodatak u tuđoj komponenti, ako je slobodna); zajednički retci kao u zadatku 4.
- **Ovisi o:** `WEB-V19-DNEVNIK-STUDENT` (zajednički retci i `ljuska-po-ekranu`), serverski zadaci iz zadatka 4.

### B. Grupni rad s doprinosom iz zabilježenih događaja (C-6 a)

#### 6. SRV-V19-GRUPA-UGOVOR · S · SRV, traka S-A
- **Opis:** ugovor za timove studenata na zadatku i prikaz doprinosa. Svaki član radi vlastiti dio (V19-6). Doprinos je isti zapis za studenta i nastavnika, bez poretka po iznosu, s obveznom napomenom (V19-7).
- **Nove rute i polja:**
  - `institution.assignment-team-setting.put` `PUT /api/v1/institution/assignments/{assignmentId}/team-setting` `{enabled, minSize (2–6), maxSize (2–6), formation: "student_choice"|"teacher_assigned"}`; `…get`;
  - `student.work-team.get` `GET /api/v1/student/assignments/{assignmentId}/team` → `{state: "disabled"|"none"|"member", team?: {teamId, members:[{givenName, familyName}]}}`;
  - `student.work-team.post` `POST …/team` `{action: "create"|"join"|"leave", teamId?}`;
  - `teacher.work-teams.get` `GET /api/v1/teacher/assignments/{assignmentId}/teams` → `{teams:[{teamId, members:[{studentId, givenName, familyName, workState}]}], unassigned:[…]}` (članovi po prezimenu i imenu);
  - `teacher.work-team-member.post` `POST …/teams/{teamId}/members` `{studentId, action: "add"|"remove"}`;
  - `student.work-team-contribution.get` `GET /api/v1/student/assignments/{assignmentId}/team/contribution` i `teacher.work-team-contribution.get` `GET /api/v1/teacher/assignments/{assignmentId}/teams/{teamId}/contribution` → ista zatvorena unija po `state` (`disabled`, `none`, `pending`, `failed`, `ready`); `ready` nosi `{members:[{givenName, familyName, categories:[{category, codePoints}], totalCodePoints}], notice:"not_authorship_evidence"}` **bez** polja `share`, ranga, usporedbe i prosjeka (konačan oblik tek nakon OP-V19-2: ako vlasnik odobri postotak po članu, dodaje se `percent` bez promjene poretka).
- **Putanje:** `server/contracts/routes/work-team.ts` (novo), `server/contracts/vectors/institution.assignment-team-setting.*.json`, `student.work-team*.json`, `teacher.work-team*.json` (novo), `docs/contracts/work-team-v1.md` (novo); zajednički registar kao u zadatku 1.
- **Ovisi o:** `SRV-V19-DNEVNIK-UGOVOR` (isti zajednički registar i generirani ugovori: nakon njega, ne usporedo). Odluka OP-V19-2 i OP-V19-4 prije konačnog oblika `contribution`.

#### 7. SRV-V19-GRUPA-BAZA · M · SRV, traka S-B
- **Opis:** postavka tima po zadatku, timovi i događaji članstva samo za dodavanje; RPC-i. Student vidi samo vlastiti tim i imena članova tog tima; nastavnik kolegija (nositelj, suradnik, nastavnik grupe prema postojećim pravilima) vidi timove svojih zadataka; drugi kolegij ne vidi ništa.
- **Nova polja:** `institution.assignment_team_setting` (verzije, samo dodavanje: enabled, min, max, formation, set_by, set_at), `institution.work_team (id, assignment_id, created_by, created_at)`, `institution.work_team_member_event (team_id, student_id, action, actor_id, actor_role, at)`; RPC `app.set_assignment_team_setting`, `app.assignment_team_setting`, `app.team_action`, `app.student_team`, `app.teacher_teams`, `app.teacher_team_member`.
- **Putanje:** `db/main/migrations/20261219110000_work_team.sql` (iza vrha baze i iza zadatka 2), `db/main/migrations.sum`, `db/main/tests/248-work-team.sql`, retci u `db/main/tests/030-institution-access-matrix.sql`.
- **pgTAP (minimum):** student s tuđeg kolegija ne vidi tim; učlanjenje preko `max` odbijeno; član ne uklanja drugog člana; nastavnik tuđeg kolegija 404; član ne napušta tim nakon što je njegov dio predan; svaki student najviše u jednom timu po zadatku.
- **Ovisi o:** `SRV-V19-DNEVNIK-BAZA` (migracijski red), `SRV-V19-GRUPA-UGOVOR`.

#### 8. SRV-V19-GRUPA-RUTE · L · SRV, traka S-C
- **Opis:** adapter i rukovatelji za rute tima i za doprinos. Doprinos čita zapise izračuna **svakog člana** iz SRV-1222 (po predaji), poredane po prezimenu i imenu; ne računa ništa novo i ne uspoređuje članove. Ako pri provedbi prelazi ~400 redaka, dijeli se na `-TIM` (setting, tim, nastavnik dodaje) i `-DOPRINOS` (obje rute doprinosa); `-DOPRINOS` tada ovisi o `-TIM`.
- **Putanje:** `server/database/work-team/` (novo), `server/http/work-team/` (novo), `server/domain/work-team/` (novo: provjera veličine tima, redoslijed članova, `contribution.ts` koji sastavlja odgovor iz zapisa SRV-1222), zajednički retci iz §5 uvoda.
- **Testovi (minimum):** redoslijed članova je uvijek abecedni, **test pada ako se poredak mijenja prema iznosu**; student tuđeg tima 404; nijedna druga ruta (popisi, izvoz, paket, obavijesti) ne nosi polje `contribution` (isti test kao u odjeljku 10 `provenance-share-v1.md`); isto tijelo za studenta i nastavnika bajt-jednako; stanje `pending` i `failed` bez razloga.
- **Ovisi o:** `SRV-V19-GRUPA-BAZA`, `SRV-V19-GRUPA-UGOVOR`, **SRV-1222 spojen na SRV bazu** (rute i zapis `provenance-share`; danas je na bazi samo domenski modul #509).

#### 9. WEB-V19-GRUPA · L · WEB (host)
- **Opis:** student: kartica „Moj tim” (osnivanje, pridruživanje, napuštanje, imena članova), poveznica na vlastiti rad; nastavnik: postavka tima uz zadatak (uključi, veličine, način formiranja), popis timova s nedodijeljenim studentima, dodavanje i uklanjanje člana i prikaz doprinosa s napomenom „nije dokaz autorstva”, bez ikakvog poretka po iznosu, boje, praga ili oznake „visoko/nisko”. Ako prelazi ~400 redaka, dijeli se na `-STUDENT` i `-NASTAVNIK` (različiti direktoriji, bez preklapanja).
- **Putanje:** `packages/app/src/host/student/work-team/` (novo), `packages/app/src/host/teacher/work-team/` (novo; uključuje `TeamSettingPanel.tsx` kao zasebnu komponentu), zajednički retci: `packages/app/src/routes.ts`, `host/ljuska-po-ekranu.ts` (+ test), `host/pages.tsx`; jedan redak montiranja panela u stranici zadatka (`host/teacher/assignment-facts/` ili `host/teacher/assignment/`, **samo ako je datoteka slobodna**, inače PITANJE).
- **Ovisi o:** `SRV-V19-GRUPA-RUTE` i izvadak ugovora; `WEB-V19-DNEVNIK-STUDENT` i `-MENTOR` zbog zajedničkih redaka u `routes.ts` i `ljuska-po-ekranu.ts` (nakon njih, ne usporedo).

### C. Anonimna recenzija među studentima koju uključuje nastavnik

#### 10. SRV-V19-RECENZIJA-UGOVOR · S · SRV, traka S-A
- **Opis:** ugovor za krug recenzije: nastavnik otvara i vodi, student recenzira dodijeljeni anonimizirani rad i prima anonimne recenzije. Bez brojčane ocjene, bez ranga (V19-11).
- **Nove rute i polja:**
  - `peer-review.round.put` `PUT /api/v1/teacher/assignments/{assignmentId}/peer-review` `{opensAt, dueAt, reviewsPerStudent (1–3), criteria:[{key, label (1–120)}] (1–6)}`; `peer-review.round.get` (nastavnik) → `{round|null, state}`;
  - `peer-review.allocate.post` `POST …/peer-review/allocations` (bez tijela; deterministično; 409 `no_submissions`, 409 `already_allocated`) → `{allocated: n}`;
  - `peer-review.teacher-overview.get` `GET …/peer-review/overview` → `{allocations:[{reviewer:{id, givenName, familyName}, author:{id, givenName, familyName}, state:"pending"|"submitted"|"withdrawn"}]}` (nastavnik vidi oba kraja);
  - `peer-review.review-withdrawal.post` `POST …/peer-review/reviews/{reviewId}/withdrawal` `{reason (1–600)}`;
  - `student.peer-review-tasks.get` `GET /api/v1/student/assignments/{assignmentId}/peer-review/tasks` → `{state:"disabled"|"none"|"open"|"closed", tasks:[{taskId, state, dueAt}]}`;
  - `student.peer-review-work.get` `GET /api/v1/student/peer-review/tasks/{taskId}/work` → `{criteria:[…], document:{revision, blocks}}` **bez ikakvog polja koje vodi do autora**;
  - `student.peer-review.post` `POST /api/v1/student/peer-review/tasks/{taskId}/review` `{byCriterion:[{key, text (1–4000)}], general? (≤4000)}` → `{reviewId}` (409 `closed`, 409 `already_reviewed`);
  - `student.peer-reviews-received.get` `GET /api/v1/student/assignments/{assignmentId}/peer-review/received` → `{reviews:[{reviewId, byCriterion, general, submittedAt}]}` **bez recenzentovog identiteta**, i bez povučenih recenzija.
- **Putanje:** `server/contracts/routes/peer-review.ts` (novo), `server/contracts/vectors/peer-review.*.json`, `student.peer-review*.json` (novo), `docs/contracts/peer-review-v1.md` (novo); zajednički registar kao u zadatku 1.
- **Ovisi o:** `SRV-V19-GRUPA-UGOVOR` (isti zajednički registar i generirani ugovori: nakon njega).

#### 11. SRV-V19-RECENZIJA-BAZA · M · SRV, traka S-B
- **Opis:** krug, dodjele, recenzije i povlačenja samo za dodavanje; RPC koji recenzentu vraća **tekst predane revizije bez identiteta autora** i samo za dodijeljeni rad dok krug traje. Autor čita primljene recenzije bez recenzenta; nastavnik čita oba kraja.
- **Nova polja:** `institution.peer_review_round`, `institution.peer_review_allocation (round_id, reviewer_id, author_work_ref, task_id)`, `institution.peer_review (id, task_id, body_json, submitted_at)`, `institution.peer_review_withdrawal (review_id, teacher_id, reason, at)`; RPC `app.set_peer_review_round`, `app.allocate_peer_review` (deterministički po `round_id`), `app.peer_review_tasks`, `app.peer_review_work` (SECURITY DEFINER, ne vraća `student_id`, `document_id` ni ime), `app.add_peer_review`, `app.peer_reviews_received`, `app.withdraw_peer_review`, `app.peer_review_overview`.
- **Putanje:** `db/main/migrations/20261219120000_peer_review.sql` (iza vrha baze i iza zadatka 7), `db/main/migrations.sum`, `db/main/tests/249-peer-review.sql`, retci u `db/main/tests/030-institution-access-matrix.sql`.
- **pgTAP (minimum, kritično):** student bez dodjele ne čita rad drugog studenta; recenzent ne vidi nijedan stupac koji otkriva autora; samorecenzija nemoguća; krug zatvoren → nema pisanja; autor ne vidi recenzenta ni preko kojeg RPC-a; student drugog kolegija 404; nastavnik tuđeg kolegija 404; povučena recenzija nestaje iz autorova prikaza, ostaje nastavniku; dodjela je ponovljiva (isti ulaz, isti izlaz).
- **Ovisi o:** `SRV-V19-GRUPA-BAZA` (migracijski red), `SRV-V19-RECENZIJA-UGOVOR`.

#### 12. SRV-V19-RECENZIJA-RUTE · M · SRV, traka S-C
- **Opis:** adapter i rukovatelji za osam ruta, čista domenska funkcija dodjele (sjeme = id kruga, bez samorecenzije, ravnomjerno), pročišćavanje odgovora (test da u tijelu nema identiteta autora ni recenzenta), montiranje.
- **Putanje:** `server/domain/peer-review/` (novo: `allocate.ts`, `anonymise.ts`, testovi), `server/database/peer-review/` (novo), `server/http/peer-review/` (novo), zajednički retci iz §5 uvoda.
- **Testovi (minimum):** `allocate` isti ulaz → isti izlaz, nitko sam sebi, svatko točno `reviewsPerStudent`; **odgovor `student.peer-review-work.get` i `student.peer-reviews-received.get` ne sadrži nijedan identifikator osobe** (provjera po cijelom JSON-u, ne samo po poznatim poljima); tuđi zadatak 404; nijedna druga ruta ne nosi recenzije; log ne sadrži tekst recenzije.
- **Ovisi o:** `SRV-V19-RECENZIJA-BAZA`, `SRV-V19-RECENZIJA-UGOVOR`.

#### 13. WEB-V19-RECENZIJA-STUDENT · M · WEB (host)
- **Opis:** student: popis zadataka recenzije uz zadatak, stranica „Recenzija rada” s anonimiziranim tekstom i obrascem po kriterijima, stranica „Primljene recenzije” bez recenzenta. Jasna oznaka „Rad je anoniman” i „Recenzija ne ulazi u ocjenu”. Bez prikaza broja ili ranga.
- **Putanje:** `packages/app/src/host/student/peer-review/` (novo: stranice, `model.ts`, `read.ts`, `messages.hr.ts`, testovi, `no-direct-api.test.ts`), zajednički retci: `packages/app/src/routes.ts`, `host/ljuska-po-ekranu.ts` (+ test), `host/pages.tsx`.
- **Ovisi o:** `SRV-V19-RECENZIJA-RUTE` i izvadak ugovora; zajednički retci: nakon `WEB-V19-GRUPA`.

#### 14. WEB-V19-RECENZIJA-NASTAVNIK · M · WEB (host)
- **Opis:** nastavnik: postavka kruga uz zadatak (rok, broj recenzija po studentu, rubrike), gumb „Dodijeli recenzije”, pregled dodjela s oba kraja, čitanje recenzije i povlačenje s razlogom. Bez zbirne ocjene i bez popisa po kvaliteti.
- **Putanje:** `packages/app/src/host/teacher/peer-review/` (novo: `RoundPanel.tsx`, `OverviewPage.tsx`, `model.ts`, `messages.hr.ts`, testovi, `no-direct-api.test.ts`), zajednički retci kao u zadatku 13; montiranje panela u stranici zadatka **samo ako je datoteka slobodna** (inače PITANJE), isti redak kao `WEB-V19-GRUPA`, pa poslije njega.
- **Ovisi o:** `WEB-V19-RECENZIJA-STUDENT` (zajednički retci), serverski zadaci iz zadatka 13.

## 6. Redoslijed i preklapanja

```
SRV-V19-DNEVNIK-UGOVOR → SRV-V19-GRUPA-UGOVOR → SRV-V19-RECENZIJA-UGOVOR    (isti zajednički registar ugovora i generirano: lanac)
SRV-V19-DNEVNIK-BAZA   → SRV-V19-GRUPA-BAZA   → SRV-V19-RECENZIJA-BAZA      (migracije strogo redom, S-B)
UGOVOR + BAZA → RUTE  (po funkciji);  GRUPA-RUTE dodatno traži SRV-1222
RUTE + izvadak → WEB   (po funkciji)
WEB-V19-DNEVNIK-STUDENT → WEB-V19-DNEVNIK-MENTOR → WEB-V19-GRUPA → WEB-V19-RECENZIJA-STUDENT → WEB-V19-RECENZIJA-NASTAVNIK   (zajednički retci u routes.ts, ljuska-po-ekranu.ts, pages.tsx)
```

- **Ugovor:** tri SRV ugovorna zadatka imaju svaki svoju datoteku ruta, ali dijele `server/contracts/routes/index.ts`, `inventory.ts`, `version.ts` i generirane datoteke; zato su u lancu (ovisnost), bez dvije paralelne grane na istoj generiranoj datoteci.
- **Migracije:** tri migracije moraju ići redom i iza vrha baze; svaki pisac prije commita provjerava vrh baze (D-91) i ne mijenja već spojene migracije.
- **Zajednički WEB retci:** `routes.ts`, `ljuska-po-ekranu.ts` i `pages.tsx` dira svaki WEB zadatak jednim retkom; lanac iznad je dogovor, a kod konflikta vrijedi spajanje baze i zadržavanje oba retka.
- **Tuđe datoteke:** `host/teacher/assignment-form/**` i `host/teacher/assignment-facts/**` ne diramo (obrazac zadatka drži druga traka); paneli tima i recenzije su samostalne komponente čije montiranje traži jedan redak i, ako datoteku drži otvoreni PR, ide kao `OBLAK … PITANJE`.
- **Najveći preostali rizik veličine:** `SRV-V19-GRUPA-RUTE` i `WEB-V19-GRUPA` su L; podjela je unaprijed zapisana.

## 7. Otvorena pitanja (jedino što stvarno čeka odluku)

- **OP-V19-1. Pravna snaga potpisa mentora i voditelj prakse u organizaciji.** Potpis je zapis nastavnika mentora u Ducturi (AAI djelatnik). Ima li fakultet potrebu za potpisom voditelja iz organizacije (nema AAI račun, D-09)? Odlučuje vlasnik uz pravnu osobu; dok ne odluči, gradi se samo potpis mentora ustanove.
- **OP-V19-2. Doprinos po članu tima (C-6 a).** Smije li se prikazati udio po članu (postotak) ili samo brojevi znakova po vrsti podrijetla u dijelu člana? Tekst C-6 (a) govori o udjelu predanog teksta po vrsti podrijetla, ne po osobi. Odlučuje vlasnik i usklađuje se Ustav i PRODUCT §5 kroz Q-18; do tada oblik bez postotka po članu.
- **OP-V19-3. Zajednički dokument.** Pisanje više studenata u jednom dokumentu traži kritičnu promjenu evidencije i potpisa. Nije u ovom valu; zasebni zadatak orkestratora ako vlasnik to želi.
- **OP-V19-4. D-78 (grupni radovi izvan pilota).** Odluka u nalogu je vlasnikova; potrebno je uskladiti tekst D-78 i `PLAN-MIGRACIJE.md`. Do tada samo demo s izmišljenim podacima.
- **OP-V19-5. Čitanje tuđeg rada u recenziji.** Studentov rad čita drugi student: pravno mišljenje i DPIA prije stvarnih studenata; do tada samo demo s izmišljenim podacima (isti uvjet kao za P-1 i izvještaj „Podrijetlo teksta”).
- **OP-V19-6. Tko vidi recenzenta.** Pretpostavka: nastavnik vidi oba kraja, studenti ne. Potvrditi s vlasnikom prije migracije.
- **OP-V19-7. Obavijest o recenziji.** Vrste obavijesti su zatvorene; nova vrsta lomi ugovor. U ovom valu nema obavijesti (student vidi zadatke recenzije na početnoj); ako je treba, zasebni zadatak za `notifications.ts`.

## 8. Što se namjerno ne radi

Ocjena i bodovi u Ducturi; automatske sankcije (za neodrađenu recenziju, premalo sati u dnevniku, mali doprinos); rangiranje ili popis studenata po sličnosti, kvaliteti ili doprinosu; modeli i detektori; e-pošta (P-17 / NZ-9 odgođeno); promjena `workType`, `authorRole`, vrsta obavijesti ili bilo kojeg postojećeg ugovora; promjena postojećih migracija; novi način prijave; stvarni studentski podaci.

## 9. Tablica za orkestratora

| ID | r | deps | paths |
|---|---|---|---|
| SRV-V19-DNEVNIK-UGOVOR | S | – | `server/contracts/routes/practice-journal.ts`, `server/contracts/vectors/practice.*.json`, `docs/contracts/practice-journal-v1.md`, registar (`routes/index.ts`, `inventory.ts`, `version.ts`, `generated/*`, `openapi/v1.json`) |
| SRV-V19-DNEVNIK-BAZA | M | SRV-V19-DNEVNIK-UGOVOR | `db/main/migrations/20261219100000_practice_journal.sql`, `db/main/migrations.sum`, `db/main/tests/247-practice-journal.sql`, `030-institution-access-matrix.sql` |
| SRV-V19-DNEVNIK-RUTE | M | SRV-V19-DNEVNIK-BAZA, SRV-V19-DNEVNIK-UGOVOR | `server/domain/practice-journal/`, `server/database/practice-journal/`, `server/http/practice-journal/`, zajednički retci (`server.ts`, `http/index.ts`, `database/index.ts`, testovi ugovora, dev-server) |
| WEB-V19-DNEVNIK-STUDENT | M | SRV-V19-DNEVNIK-RUTE, izvadak | `packages/app/src/host/student/practice-journal/`, `routes.ts`, `ljuska-po-ekranu.ts`, `pages.tsx` |
| WEB-V19-DNEVNIK-MENTOR | M | WEB-V19-DNEVNIK-STUDENT, SRV-V19-DNEVNIK-RUTE | `packages/app/src/host/teacher/practice-journal/`, `routes.ts`, `ljuska-po-ekranu.ts`, jedna poveznica u `host/teacher/mentorships/MentorshipsPage.tsx` |
| SRV-V19-GRUPA-UGOVOR | S | SRV-V19-DNEVNIK-UGOVOR | `server/contracts/routes/work-team.ts`, `server/contracts/vectors/*team*.json`, `docs/contracts/work-team-v1.md`, registar |
| SRV-V19-GRUPA-BAZA | M | SRV-V19-DNEVNIK-BAZA, SRV-V19-GRUPA-UGOVOR | `db/main/migrations/20261219110000_work_team.sql`, `migrations.sum`, `db/main/tests/248-work-team.sql`, `030-institution-access-matrix.sql` |
| SRV-V19-GRUPA-RUTE | L | SRV-V19-GRUPA-BAZA, SRV-V19-GRUPA-UGOVOR, SRV-1222 | `server/domain/work-team/`, `server/database/work-team/`, `server/http/work-team/`, zajednički retci |
| WEB-V19-GRUPA | L | SRV-V19-GRUPA-RUTE, izvadak, WEB-V19-DNEVNIK-MENTOR | `packages/app/src/host/student/work-team/`, `packages/app/src/host/teacher/work-team/`, `routes.ts`, `ljuska-po-ekranu.ts`, `pages.tsx` |
| SRV-V19-RECENZIJA-UGOVOR | S | SRV-V19-GRUPA-UGOVOR | `server/contracts/routes/peer-review.ts`, `server/contracts/vectors/*peer-review*.json`, `docs/contracts/peer-review-v1.md`, registar |
| SRV-V19-RECENZIJA-BAZA | M | SRV-V19-GRUPA-BAZA, SRV-V19-RECENZIJA-UGOVOR | `db/main/migrations/20261219120000_peer_review.sql`, `migrations.sum`, `db/main/tests/249-peer-review.sql`, `030-institution-access-matrix.sql` |
| SRV-V19-RECENZIJA-RUTE | M | SRV-V19-RECENZIJA-BAZA, SRV-V19-RECENZIJA-UGOVOR | `server/domain/peer-review/`, `server/database/peer-review/`, `server/http/peer-review/`, zajednički retci |
| WEB-V19-RECENZIJA-STUDENT | M | SRV-V19-RECENZIJA-RUTE, izvadak, WEB-V19-GRUPA | `packages/app/src/host/student/peer-review/`, `routes.ts`, `ljuska-po-ekranu.ts`, `pages.tsx` |
| WEB-V19-RECENZIJA-NASTAVNIK | M | WEB-V19-RECENZIJA-STUDENT, SRV-V19-RECENZIJA-RUTE | `packages/app/src/host/teacher/peer-review/`, `routes.ts`, `ljuska-po-ekranu.ts` |

Prije koda: OP-V19-1, OP-V19-2 i OP-V19-5 orkestrator unosi u Owner queue; zadaci koji ne ovise o njima (sve osim konačnog oblika `contribution`) mogu krenuti.
