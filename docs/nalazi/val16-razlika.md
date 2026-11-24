# Val 16: razlika (V16-PREGLED `val16-razlika`)

Datum: 24. 11. 2026. Pisac: `claude:wv16pregled:frontend`. Nalog: orkestrator, Ductus#2055 (komentar 7147315071), po odluci vlasnika („Može, idemo na sve valove”; `ductura/.github` `docs/plan/NOVE-FUNKCIJE.md` t. 8, PR #85; `PLAN-MIGRACIJE.md` val 16). **Samo dokumentacija; kod se ne mijenja.**

Pregledane baze:

| Repo | Grana | SHA |
|---|---|---|
| WEB `ductura/Institution_front_web_chrome` | `migracija/kopija-ductus-front` | `ff7d6798efbe1e0e5f87629ef79e5df5a2a6f5b3` |
| SRV `ductura/Institution_server` (javno) | `migracija/kopija-ductus-backend` | `abf94a9431fddc85631570b8d258816384bf18de` |

Najnovija SRV migracija na bazi je `20261218100000_origin_segments.sql`, zadnji pgTAP je `246-origin-segments.sql`. Prije svakog SRV zadatka provjeri `git ls-tree --name-only origin/<baza> db/main/migrations/ | tail -1` (D-91: postojeća migracija se ne dira).

## 1. Opseg vala 16

Završni i diplomski rad, pet dijelova:

1. prijedlog teme;
2. odobrenje mentora;
3. etape (na postojećem mentorstvu i `milestone-template`);
4. povjerenstvo;
5. termin obrane.

**Isključeno (ne gradi se):** pohrana završnog rada u Dabar. Čeka dogovor sa Srcem i ustanovom; nema zadatka, rute ni polja. Obrazac „Izjava o pohrani rada u repozitorij” ostaje samo stanje obrasca (`not_submitted | submitted | accepted`) iz postojećeg ugovora, bez datoteke.

Pravila za sve zadatke ispod: bez rangiranja studenata i bez automatskih sankcija; ništa iz vala ne ulazi u ocjenu ni izvoz (ocjena ostaje u Merlinu); samo izmišljeni podaci; podaci samo kroz `/api/v1`; komponente iz `@ductura/ui`; vizualni smjer „papir i grafit”; tekst sučelja na hrvatskom, kroz katalog poruka (skener zabranjenih izraza); prijava samo AAI@EduHr. Aplikacija živi **isključivo** u `packages/app/src/host/` (`src/app`, `src/components` su stari kod i ne diraju se).

## 2. Što već postoji

### 2.1 Mentorstvo (ulaz u završni/diplomski rad)

| Stavka | SRV (rute i putanje) | WEB |
|---|---|---|
| Student traži mentora | `mentorship.requests.post` `POST /api/v1/mentorship-requests` tijelo `{teacherId, workType}`; `mentorship.request-withdraw.post`; čitanje: `mentorship.student-requests.get` `GET /api/v1/student/mentorship-requests`, `mentorship.student-mentor-candidates.get` (`server/contracts/routes/mentorship.ts`, `mentorship-student.ts`) | `packages/app/src/host/student/mentorship-request/` (`MentorshipRequestPage.tsx`, ruta `/zadaci/mentorstvo`, `src/routes.ts:110`) |
| Mentor odlučuje o zahtjevu | `mentorship.request-approve.post`, `mentorship.request-decline.post` (razlog 1 do 600 znakova), `teacher.mentorship-requests.get` | `host/teacher/n16/RequestsCard.tsx`, `host/teacher/mentorships/MentorshipsPage.tsx` |
| Mentor sam otvara mentorstvo | `mentorship.open.post` `POST` tijelo `{studentId, workType, topic?}`, tema 1 do 300 znakova, **jedini zapis teme u sustavu**; zapisuje se jednom u `institution.mentorship_opening.topic` i nikad se ne mijenja (migracija `20261216130000_mentorship_opening_consultations.sql`) | `host/teacher/n16` |
| Vrste rada | `bachelor_thesis`, `master_thesis`, `specialist_thesis`, `doctoral_thesis` | `WORK_TYPES` u `host/admin/faculty-settings/read.ts` |
| Popisi | `teacher.mentorships.get` (`mentorshipId, assignmentId, documentId \| null, student, title, workType, workState`), `teacher.mentorship.get`, `mentorship.student-mentorships.get` `GET /api/v1/student/mentorships` | `host/teacher/mentorships/*` (`MyStudents`, `OpenMentorshipCard`, `WorkPlan`) |
| Ključni rokovi | `mentorship.key-dates.get` `GET /api/v1/mentorships/{id}/key-dates` (rok, etape, termini konzultacija) | `host/teacher/key-dates/*` |

### 2.2 Prijedlog teme i odobrenje mentora

| Stavka | Stanje |
|---|---|
| Prijedlog teme studenta (naslov i opis) | **ne postoji ni na SRV-u ni u WEB-u.** Zahtjev za mentorstvo nosi samo `{teacherId, workType}`; tema postoji samo kad je mentor sam otvara (`mentorship.open.post`, neizmjenjiva) |
| Odobrenje teme | **ne postoji.** Postoji samo stanje obrasca fakulteta „Prijava teme završnog ili diplomskog rada” (kod `prijava-teme`, stanja `not_submitted \| submitted \| accepted`, `work.thesis-form.put`): to je evidencija obrasca fakulteta, ne tekst teme ni odluka mentora o temi |
| Suglasnost mentora za predaju | postoji: `work.mentor-consent.get/.put` (`none \| given \| withdrawn`, komentar do 1000 znakova, cijela povijest); prekidač fakulteta `institution.thesis-settings.get/.put` (zadano isključen; ne blokira predaju, PR-1 čeka pravni pregled) |

### 2.3 Obrasci, suglasnost i stanje nakon predaje (SRV-MENTOR-2)

SRV: `server/contracts/routes/thesis.ts` (ugovor 1.101.0), `server/http/thesis/`, `server/database/thesis/`, migracija `20261216120000_thesis_forms_consent.sql`, pgTAP `234-thesis-forms-consent.sql`, lažni poslužitelj `packages/test-fakes/dev-server/thesis-routes.ts`, ugovor `docs/contracts/thesis-v1.md`. Deset ruta:

| Operacija | Metoda i put | Pristup |
|---|---|---|
| `institution.thesis-forms.get/.post` | `/api/v1/institution/thesis-forms` | prijavljen / administrator |
| `institution.thesis-settings.get/.put` | `/api/v1/institution/thesis-settings` | administrator |
| `work.thesis-forms.get`, `work.thesis-form.put` | `/api/v1/works/{documentId}/thesis-forms[/{code}]` | student, mentor, administrator |
| `work.mentor-consent.get/.put` | `/api/v1/works/{documentId}/mentor-consent` | čitaju trojica; piše mentor |
| `work.thesis-stage.get/.put` | `/api/v1/works/{documentId}/thesis-stage` | čitaju trojica; piše mentor ili administrator |

**Termin obrane već postoji u ugovoru:** `ThesisStage` = `none \| submitted_to_office \| defense_scheduled \| defended` uz `defenseAt` (obavezan za `defense_scheduled`, zabranjen za ostala). Mjesto obrane i sastav povjerenstva u ugovoru **ne postoje**.

**WEB:** svih deset operacija je u izvatku `src/client/migration-contract*.generated.*`, ali ih **nijedan zaslon hosta ne zove** (pretraga `thesis-forms`, `thesis-stage`, `mentor-consent`, `thesis-settings` u `packages/app/src`: 0 pogodaka izvan testova izvatka). Student i mentor dakle ne mogu vidjeti obrasce, suglasnost ni stanje obrane; administrator ne može objaviti obrazac ni uključiti prekidač.

### 2.4 Etape (milestone)

| Stavka | SRV | WEB |
|---|---|---|
| Predložak etapa ustanove (verzioniran, samo administrator) | `institution.milestone-template.get/.put` (`server/contracts/routes/milestone-template.ts`, migracija `20261213110000_milestone_template.sql`, `server/database/milestone-template/`, `server/http/milestone-template/`): do 20 etapa, `relativeDue` 1 do 1095 dana, `submits` `topic_text \| current_version`, `requireFinalStageApproval`; novo mentorstvo dobiva zadnju verziju | **nema zaslona** za administratora (pretraga `milestone-template` u hostu: samo `overview-*`) |
| Plan etapa rada | `work.milestone-plan.get`, `work.milestone-plan.add.post`, `work.milestone-plan.apply-template.post` | mentor: `host/teacher/mentorships/WorkPlan.tsx`, `plan-actions.ts` (primijeni predložak, dodaj etapu); e2e `packages/app/e2e/mentorstvo-nf6-etape.spec.ts` |
| Stanja etapa | `work.milestone-states.get`, `work.milestones.get/.patch/.delete`, `work.milestones.details.patch` | mentor čita (`overview-read.ts`); student: samo redak „sljedeća etapa” u `host/editor/mentor/MentorCard.tsx` (`nextStageLine`) |
| Predaja i odluka | `work.milestones.submit.post`, `work.milestones.approve.post`, `work.milestones.request-revision.post` | **nijedan zaslon hosta ih ne zove** (stari `src/components/editor/mentor/milestones/stages-api.ts` i `src/client/milestone-submit.ts` ostaju izvan hosta); PR #631 (NF6 runda) treba provjeriti prije početka |

### 2.5 Povjerenstvo

| Stavka | Stanje |
|---|---|
| Model | SRV `institution.work_grant` (migracija `20261103010000_work_grant.sql`, `20261126100400_co_mentor_committee.sql`; pgTAP `102-work-grant.sql`, `127-work-grant-binding.sql`): `kind` `co_mentor \| committee`, radnje samo `read_text` i `comment`, vremenski ograničeno (najviše 366 dana), bez reprodukcije i procesa (D-238), daje nastavnik rada, prima potvrđeni nastavnik iste ustanove; funkcije `institution.grant_work_access()`, `revoke_work_access()` |
| HTTP ruta i ugovor | **ne postoje** (`grant_work_access` se ne zove iz `server/**`, nema operacije u `server/contracts/routes/`) |
| Popis članova povjerenstva (predsjednik, članovi) kao zapis uz rad | **ne postoji** |
| Sučelje | **ne postoji** (PLAN M6.12 je uvjetan: „sučelje komentora i povjerenstva čeka” U-1; povjerenstvo ne vidi reprodukciju dok se ne izmijene Ustav v1.4 i D-154, D-238) |

### 2.6 Predaja i pregled po fakultetu

Predaja rada (`submission.*`) postoji i ne dira se. Popis završnih radova ustanove s fazom i datumom obrane (za referadu) **ne postoji** (`teacher.mentorships.get` vraća samo radove jednog mentora).

## 3. Zadaci koji nedostaju (14)

Oznake: S ≤ ~120 redaka koda, M ≤ ~400. **Server ugovor prije weba:** WEB-V16-TEMA-STUDENT, WEB-V16-TEMA-MENTOR, WEB-V16-POVJERENSTVO i WEB-V16-POPIS-FAKULTET ovise o svojim SRV zadacima; orkestrator dopunjuje izvadak ugovora iz SRV baze (`izvadak-ugovora.mjs`), pisac spaja tu granu. WEB-V16-OBRASCI, -OBRANA, -ETAPE-* i -ETAPE-ADMIN koriste operacije koje su već u izvatku.

**Zajedničke točke (po zadatku, bez dijeljenja):**

- Svaki SRV zadatak dodaje **svoju novu datoteku ugovora** (`server/contracts/routes/thesis-topic.ts`, `thesis-committee.ts`, `thesis-overview.ts`); nijedan ne dira `thesis.ts`, `mentorship*.ts` ni `milestone-template.ts`. Zajednički redci (jedan po zadatku): `server/contracts/routes/index.ts`, `server/contracts/inventory.ts`, `server/http/index.ts`, `server/database/index.ts`, `server/server.ts`; generirani ugovori se regeneriraju; fiksni testovi ugovora i montiranih ruta po uputi iz „Zajedničke datoteke (SRV)”.
- Migracije idu **strogo redom** (traka S-B): SRV-V16-TEMA-PRIJEDLOG → SRV-V16-POVJERENSTVO-ZAPIS → SRV-V16-POPIS-FAKULTET. Verzija nove migracije je iza vrha baze u trenutku pisanja; nijedna ne mijenja postojeću migraciju.
- WEB: sve nove stranice i odjeljci u vlastitom direktoriju. Odjeljci „Završni rad” na zajedničkoj kartici dolaze preko `host/thesis/` (zadatak 4); točka montiranja je jedna, a odjeljke registrira `import.meta.glob("./*/section.tsx")` (ako glob ne prođe lint ili gradnju, zamjena je jedan redak uvoza po zadatku u `host/thesis/sections.ts`). Stranice administratora traže po jedan redak u `packages/app/src/routes.ts` i `src/i18n/shell.ts` (svaki zadatak svoj).

### Server

1. **SRV-V16-TEMA-PRIJEDLOG** (M). Student vlasnik rada u mentorstvu predlaže temu (naslov i kratak opis), mentor je odobrava ili vraća s komentarom. Zapis je samo za dodavanje (verzija po prijedlogu, odluka uz verziju), RLS i RPC-i `app.*` kao u `20261216120000_thesis_forms_consent.sql`. Stanja: `none → proposed`; `proposed → proposed` (nova verzija, student), `approved`, `returned` (mentor); `returned → proposed` (student); `approved → returned` (samo mentor, s razlogom). Tuđi rad, rad bez mentorstva i druga ustanova: 404. Ništa ne ulazi u ocjenu i ne mijenja obrazac `prijava-teme` (odvojeno). **Nove rute i polja:**
   - `work.thesis-topic.get` `GET /api/v1/works/{documentId}/thesis-topic` (student, mentor, administrator) → `{ state: none|proposed|approved|returned, current: {version, title (1–200), summary (0–1000), proposedAt}|null, decision: {version, decision, comment|null, decidedAt, decidedByPart: mentor}|null, history: [{version, title, summary, proposedAt}] (najviše 100) }`;
   - `work.thesis-topic.put` `PUT /api/v1/works/{documentId}/thesis-topic` tijelo `{ title, summary? }`, samo student vlasnik (mentor 403); isti sadržaj kao zadnji ne piše ništa; nakon `approved` 409;
   - `work.thesis-topic-decision.post` `POST /api/v1/works/{documentId}/thesis-topic/decision` tijelo `{ version, decision: approved|returned, comment? }`, samo mentor; `comment` obavezan za `returned`; `version` koja nije zadnja: 409.
   Veličina: M. Ovisi o: ništa. Putanje: `db/main/migrations/<verzija iza vrha baze>_thesis_topic.sql`, `db/main/tests/247-thesis-topic.sql`, retci u `db/main/tests/030-institution-access-matrix.sql`, `server/contracts/routes/thesis-topic.ts` (novo), `server/contracts/vectors/work.thesis-topic*.json`, `server/database/thesis-topic/**` (novo), `server/http/thesis-topic/**` (novo), `packages/test-fakes/dev-server/thesis-topic-routes.ts` (novo) + zajednički retci i generirano. Test: tuđi student i drugi mentor 404; vraćanje bez komentara 422; odluka na staroj verziji 409; mentor ne može predložiti (403).
2. **SRV-V16-POVJERENSTVO-ZAPIS** (M). Povjerenstvo kao popis uz rad, **bez ikakvog prava čitanja rada** (pristup tekstu ostaje zasebno i čeka U-1, vidi §5). Administrator ustanove imenuje povjerenstvo (najviše 5 članova, najviše jedan predsjednik, članovi su potvrđeni nastavnici iste ustanove, različiti, student nije član); zapis je samo za dodavanje (svaka promjena je događaj), pa povijest ostaje. **Nove rute:**
   - `work.thesis-committee.get` `GET /api/v1/works/{documentId}/thesis-committee` (student, mentor, administrator) → `{ members: [{ userId, name: {givenName, familyName}|null, role: chair|member }], changedAt|null, changedByPart: faculty|null }`;
   - `work.thesis-committee.put` `PUT /api/v1/works/{documentId}/thesis-committee` tijelo `{ members: [{ userId, role }] }` (cijeli popis se zamjenjuje, kao popis asistenata u `teaching-team`), samo administrator ustanove; ista vrijednost ne piše ništa; osoba izvan ustanove, nepotvrđena ili opozvana: 422/404 (isto značenje kao kod mentorstva).
   Veličina: M. Ovisi o: SRV-V16-TEMA-PRIJEDLOG (samo redoslijed migracija). Putanje: nova migracija i `db/main/tests/248-thesis-committee.sql` (+ matrica), `server/contracts/routes/thesis-committee.ts` (novo), vektori `work.thesis-committee*.json`, `server/database/thesis-committee/**`, `server/http/thesis-committee/**`, `packages/test-fakes/dev-server/thesis-committee-routes.ts` (novo). Ne dira `institution.work_grant` ni `grant_can()`.
3. **SRV-V16-POPIS-FAKULTET** (M). Administrator fakulteta čita popis završnih i diplomskih radova svoje ustanove (za referadu): vrsta rada, mentor, student, stanje nakon predaje, datum obrane, stanje teme i veličina povjerenstva. Poredak je **datum obrane, pa ID** (bez rangiranja i bez ocjena). Samo čitanje; ne piše nigdje. **Nova ruta:** `institution.thesis-overview.get` `GET /api/v1/institution/thesis-overview?stage=<none|submitted_to_office|defense_scheduled|defended>&limit=<1–200>` (administrator) → `{ works: [{ documentId|null, workType, mentorName|null, studentName|null, stage, defenseAt|null, topicState, committeeSize }] }`; ne-administrator 403; druga ustanova se ne vidi. Veličina: M. Ovisi o: SRV-V16-POVJERENSTVO-ZAPIS (redoslijed migracija, `committeeSize`) i SRV-V16-TEMA-PRIJEDLOG (`topicState`). Putanje: nova migracija (funkcija čitanja) i `db/main/tests/249-thesis-overview.sql` (+ matrica), `server/contracts/routes/thesis-overview.ts` (novo), vektor `institution.thesis-overview.get.json`, `server/database/thesis-overview/**`, `server/http/thesis-overview/**`, `packages/test-fakes/dev-server/thesis-overview-routes.ts` (novo).

### Web

4. **WEB-V16-KOSTUR** (S). Zajednički odjeljak „Završni rad” za studenta i mentora: `ThesisPanel` prima `documentId` i ulogu, prikazuje registrirane odjeljke (`import.meta.glob`), svaki odjeljak ima stanja učitavanje / greška / prazno kao zasebna (greška nije „nema podataka”). Montiranje na dva mjesta: studentska kartica Mentor (`host/editor/right/MentorMount.tsx`, jedan redak) i mentorova kartica rada (`host/teacher/mentorships/OpenMentorshipCard.tsx`, jedan redak). Prikaz samo za rad u mentorstvu (inače se ne prikazuje). Nema API-ja. Veličina: S. Ovisi o: ništa. Putanje: `packages/app/src/host/thesis/{ThesisPanel.tsx,sections.ts,model.ts,messages.hr.ts,thesis-panel.test.ts}`; montiranje: `host/editor/right/MentorMount.tsx`, `host/teacher/mentorships/OpenMentorshipCard.tsx`.
5. **WEB-V16-OBRASCI** (M). Odjeljak „Obrasci i suglasnost”: popis obrazaca rada sa stanjem (`work.thesis-forms.get`), student prebacuje `not_submitted ↔ submitted`, mentor postavlja svako stanje (`work.thesis-form.put`; prihvaćeni obrazac studentu je samo za čitanje, 403/409 prikazani kao poruka); suglasnost mentora: stanje, komentar, povijest (`work.mentor-consent.get/.put`), mentor daje i povlači, student vidi isto. Napomena „izjava o izvornosti” je samo naziv službenog obrasca, ne zaključak o autorstvu. Nema novih polja. Test: student ne vidi gumb suglasnosti; 404 za tuđi rad je zasebno stanje; isto stanje dvaput daje poruku, ne grešku. Veličina: M. Ovisi o: WEB-V16-KOSTUR. Putanje: `packages/app/src/host/thesis/forms/{section.tsx,read.ts,actions.ts,messages.hr.ts,forms.test.ts}`.
6. **WEB-V16-OBRANA** (M). Odjeljak „Nakon predaje i obrana”: stanje (`work.thesis-stage.get`) kao pregled koraka (predano referadi, zakazana obrana, obranjeno) i **termin obrane** (datum i vrijeme `defenseAt`); mentor postavlja stanje i datum kroz obrazac s provjerom (datum obavezan samo za „zakazana obrana”, zabranjen za ostala stanja; ispravak je dopušten), student samo čita. Mjesto obrane nije u ugovoru i ne prikazuje se (§5). Nema novih polja. Test: obrazac ne šalje `defenseAt` uz `none`; student nema kontrole; 503 ≠ „nema podataka”. Veličina: M. Ovisi o: WEB-V16-KOSTUR. Putanje: `packages/app/src/host/thesis/stage/{section.tsx,read.ts,actions.ts,messages.hr.ts,stage.test.ts}`.
7. **WEB-V16-TEMA-STUDENT** (M). Student predlaže temu: obrazac (naslov do 200, opis do 1000 znakova, brojač), prikaz stanja (predloženo, odobreno, vraćeno s komentarom mentora), ponovni prijedlog nakon vraćanja, povijest verzija. Podaci iz `work.thesis-topic.get/.put`. Nakon `approved` obrazac je zaključan i piše „Tema je odobrena”. Test: prazan i predugačak naslov; nakon odobrenja nema slanja; 409 se prikazuje kao „mentor je u međuvremenu odlučio”. Veličina: M. Ovisi o: SRV-V16-TEMA-PRIJEDLOG, WEB-V16-KOSTUR. Putanje: `packages/app/src/host/thesis/topic-student/{section.tsx,read.ts,actions.ts,messages.hr.ts,topic-student.test.ts}`.
8. **WEB-V16-TEMA-MENTOR** (M). Mentor čita prijedlog teme i odlučuje: „Odobri” ili „Vrati na doradu” (komentar obavezan za vraćanje), vidi povijest verzija; odobrenu temu može vratiti uz razlog. Podaci iz `work.thesis-topic.get` i `work.thesis-topic-decision.post`. Test: vraćanje bez komentara ne šalje zahtjev; odluka na staroj verziji (409) osvježava prikaz; student nema kontrole. Veličina: M. Ovisi o: SRV-V16-TEMA-PRIJEDLOG, WEB-V16-KOSTUR. Putanje: `packages/app/src/host/thesis/topic-mentor/{section.tsx,read.ts,actions.ts,messages.hr.ts,topic-mentor.test.ts}`.
9. **WEB-V16-ETAPE-ADMIN** (M). Administrator uređuje predložak etapa ustanove: popis etapa (naziv do 200, rok u danima 1 do 1095, što etapa šalje: tekst teme ili trenutačnu verziju), najviše 20 etapa, prekidač „završna etapa traži odobrenje”, povijest verzija; spremanje s `expectedVersion` (konflikt prikazan kao „predložak je u međuvremenu promijenjen”). Podaci iz `institution.milestone-template.get/.put`. Test: više od 20 etapa i rok izvan raspona odbijeni prije slanja; konflikt; ne-administrator nema rutu. Veličina: M. Ovisi o: ništa. Putanje: `packages/app/src/host/admin/milestone-template/{MilestoneTemplatePage.tsx,read.ts,model.ts,messages.hr.ts,milestone-template.test.ts}`; montiranje: po jedan redak u `packages/app/src/routes.ts` i `packages/app/src/i18n/shell.ts` (prijedlog puta `/ustanova/etape`; provjeriti nazive u `routes.ts`).
10. **WEB-V16-ETAPE-STUDENT** (M). Student vidi etape svojeg rada s rokom i stanjem (nije predano, predano, vraćeno na doradu s komentarom i novim rokom, odobreno) i predaje etapu (`work.milestone-states.get`, `work.milestones.submit.post`); predaja traži potvrdu; već predana etapa nema gumba. Test: dvostruki klik šalje jednu predaju; 409 prikazan kao poruka; vraćena etapa pokazuje komentar. Veličina: M. Ovisi o: WEB-V16-KOSTUR (prije početka provjeriti PR #631 radi preklapanja s `MentorCard`). Putanje: `packages/app/src/host/thesis/stages-student/{section.tsx,read.ts,actions.ts,messages.hr.ts,stages-student.test.ts}`.
11. **WEB-V16-ETAPE-MENTOR** (M). Mentor za predanu etapu odobrava (neobavezna kratka poruka do 1000 znakova) ili vraća na doradu (komentar obavezan, najviše 2000, neobavezan novi rok) i mijenja rok etape (`work.milestones.approve.post`, `work.milestones.request-revision.post`, `work.milestones.patch`). Plan i dodavanje etapa već postoje u `WorkPlan.tsx` i ostaju neizmijenjeni. Test: vraćanje bez komentara ne šalje; odobravanje etape koja nije predana (409) prikazano porukom; student nema kontrole. Veličina: M. Ovisi o: WEB-V16-KOSTUR. Putanje: `packages/app/src/host/thesis/stages-mentor/{section.tsx,read.ts,actions.ts,messages.hr.ts,stages-mentor.test.ts}`.
12. **WEB-V16-POVJERENSTVO** (M). Odjeljak „Povjerenstvo” u kartici rada (student, mentor čitaju: ime i uloga, bez ikakvog prikaza rada) i komponenta `CommitteeEditor` za administratora (odabir članova iz potvrđenih nastavnika, jedan predsjednik, najviše 5). Napomena u sučelju: povjerenstvo u ovoj verziji **ne dobiva pristup tekstu rada**. Podaci iz `work.thesis-committee.get/.put`. Test: više od jednog predsjednika i više od 5 članova odbijeno prije slanja; student i mentor nemaju kontrole; 404 zasebno stanje. Veličina: M. Ovisi o: SRV-V16-POVJERENSTVO-ZAPIS, WEB-V16-KOSTUR. Putanje: `packages/app/src/host/thesis/committee/{section.tsx,CommitteeEditor.tsx,read.ts,actions.ts,messages.hr.ts,committee.test.ts}`.
13. **WEB-V16-POPIS-FAKULTET** (M). Stranica administratora „Završni i diplomski radovi”: tablica iz `institution.thesis-overview.get` (vrsta, mentor, student, faza, datum obrane, stanje teme, povjerenstvo), filtar po fazi, poredak po datumu obrane (bez rangiranja), redak otvara `CommitteeEditor` iz zadatka 12; prazno, učitavanje i greška zasebno. Test: filtar šalje samo dopuštene faze; nema stupca ocjene; ne-administrator nema rutu. Veličina: M. Ovisi o: SRV-V16-POPIS-FAKULTET, WEB-V16-POVJERENSTVO. Putanje: `packages/app/src/host/admin/thesis-overview/{ThesisOverviewPage.tsx,read.ts,model.ts,messages.hr.ts,thesis-overview.test.ts}`; montiranje: po jedan redak u `packages/app/src/routes.ts` i `packages/app/src/i18n/shell.ts` (prijedlog puta `/ustanova/zavrsni-radovi`).
14. **WEB-V16-E2E** (S). Playwright tok na lokalnom stogu (lažni OIDC, izmišljeni račun): student predlaže temu → mentor je vraća s komentarom → student ponovno predlaže → mentor odobrava → student predaje etapu → mentor je odobrava → obrasci i suglasnost → administrator imenuje povjerenstvo → mentor zakazuje obranu i student vidi datum; axe na 1250 i 400 px; tuđi rad → 404. Veličina: S. Ovisi o: WEB-V16-OBRASCI, WEB-V16-OBRANA, WEB-V16-TEMA-STUDENT, WEB-V16-TEMA-MENTOR, WEB-V16-ETAPE-STUDENT, WEB-V16-ETAPE-MENTOR, WEB-V16-POVJERENSTVO. Putanje: `packages/app/e2e/val16-razlika.spec.ts` (novo).

## 4. Redoslijed i preklapanja

```
SRV-TEMA-PRIJEDLOG ─┬→ SRV-POVJERENSTVO-ZAPIS → SRV-POPIS-FAKULTET
                    ├→ WEB-TEMA-STUDENT ┐
                    └→ WEB-TEMA-MENTOR  │
WEB-KOSTUR ─┬→ OBRASCI ──────────────────┤
            ├→ OBRANA ───────────────────┤
            ├→ ETAPE-STUDENT ────────────┼→ WEB-E2E
            ├→ ETAPE-MENTOR ─────────────┤
            └→ POVJERENSTVO (+SRV-POVJERENSTVO-ZAPIS) → POPIS-FAKULTET (+SRV-POPIS-FAKULTET)
WEB-ETAPE-ADMIN (neovisno)
```

- Nijedan SRV zadatak ne dijeli datoteku ugovora s drugim (tri nove datoteke); migracije idu redom (S-B).
- Nijedan WEB zadatak ne dijeli datoteku osim montiranja: dva retka u zadatku 4, po dva retka (`routes.ts`, `i18n/shell.ts`) u zadacima 9 i 13.
- Prvi val (bez ovisnosti): SRV-V16-TEMA-PRIJEDLOG, WEB-V16-KOSTUR, WEB-V16-ETAPE-ADMIN.

## 5. Otvoreno i granice

- **Pohrana u Dabar:** isključena (čeka dogovor sa Srcem i ustanovom).
- **U-1 (što povjerenstvo smije vidjeti)** i izmjena Ustava v1.4 / D-154 / D-238: dok nisu riješeni, povjerenstvo je samo popis; **pristup tekstu povjerenstva i komentora** (HTTP nad `institution.grant_work_access`) nije u ovom valu.
- **Vanjski članovi povjerenstva** (osobe bez računa ustanove) nisu izraživi bez osobnog podatka izvan sustava; pretpostavka: samo nastavnici ustanove. Odluka vlasnika/FPZG-a.
- **Mjesto obrane** i drugi podaci termina nisu u `ThesisStage`; dodavanje polja traži odluku orkestratora (`contracts:breaking`).
- **Obavijest studentu o terminu obrane** nema vrste u `notifications.*`; izvan vala (otvoreni SRV zadatak po odluci orkestratora).
- **Blokada predaje bez suglasnosti** (PR-1 u `docs/contracts/thesis-v1.md`) ostaje zapisan prekidač; put predaje se ne dira.
- **Odnos prijave teme i obrasca `prijava-teme`:** namjerno odvojeni (odobrenje teme ne mijenja stanje obrasca); spajanje je odluka vlasnika.
- **Odnos uloga** mentor/nastavnik (D-154, D-204) i opoziv uloge mentoru ostaju otvoreni (PLAN-MIGRACIJE otvorena pitanja 12).
- **Ulaz studenta u rad:** `mentorship.student-mentorships.get` vraća `assignmentId`; `documentId` za rute `work.*` student dobiva iz otvorenog rada (usporedi PR #620, INT-31). Zadatak 4 utvrđuje točan izvor.
- **Neutvrđeno pri pisanju:** je li PR #631 već pokrio predaju etape u kartici Mentor (provjerava pisac zadataka 10 i 11); nazivi ruta stranica administratora u `src/routes.ts`; podržava li `import.meta.glob` lint pravila hosta.

## 6. Tablica za orkestratora

| ID | r | deps | paths |
|---|---|---|---|
| SRV-V16-TEMA-PRIJEDLOG | M | - | `db/main/migrations/<iza vrha>_thesis_topic.sql`, `db/main/tests/247-thesis-topic.sql`, `server/contracts/routes/thesis-topic.ts`, `server/contracts/vectors/work.thesis-topic*.json`, `server/database/thesis-topic/**`, `server/http/thesis-topic/**`, `packages/test-fakes/dev-server/thesis-topic-routes.ts` + zajednički retci |
| SRV-V16-POVJERENSTVO-ZAPIS | M | SRV-V16-TEMA-PRIJEDLOG | nova migracija, `db/main/tests/248-thesis-committee.sql`, `server/contracts/routes/thesis-committee.ts`, vektori, `server/database/thesis-committee/**`, `server/http/thesis-committee/**`, `packages/test-fakes/dev-server/thesis-committee-routes.ts` + zajednički retci |
| SRV-V16-POPIS-FAKULTET | M | SRV-V16-POVJERENSTVO-ZAPIS, SRV-V16-TEMA-PRIJEDLOG | nova migracija, `db/main/tests/249-thesis-overview.sql`, `server/contracts/routes/thesis-overview.ts`, vektor, `server/database/thesis-overview/**`, `server/http/thesis-overview/**`, `packages/test-fakes/dev-server/thesis-overview-routes.ts` + zajednički retci |
| WEB-V16-KOSTUR | S | - | `packages/app/src/host/thesis/{ThesisPanel.tsx,sections.ts,model.ts,messages.hr.ts}` + test; `host/editor/right/MentorMount.tsx`, `host/teacher/mentorships/OpenMentorshipCard.tsx` (po 1 redak) |
| WEB-V16-OBRASCI | M | WEB-V16-KOSTUR | `packages/app/src/host/thesis/forms/**` |
| WEB-V16-OBRANA | M | WEB-V16-KOSTUR | `packages/app/src/host/thesis/stage/**` |
| WEB-V16-TEMA-STUDENT | M | SRV-V16-TEMA-PRIJEDLOG, WEB-V16-KOSTUR | `packages/app/src/host/thesis/topic-student/**` |
| WEB-V16-TEMA-MENTOR | M | SRV-V16-TEMA-PRIJEDLOG, WEB-V16-KOSTUR | `packages/app/src/host/thesis/topic-mentor/**` |
| WEB-V16-ETAPE-ADMIN | M | - | `packages/app/src/host/admin/milestone-template/**`; `packages/app/src/routes.ts`, `packages/app/src/i18n/shell.ts` (po 1 redak) |
| WEB-V16-ETAPE-STUDENT | M | WEB-V16-KOSTUR | `packages/app/src/host/thesis/stages-student/**` |
| WEB-V16-ETAPE-MENTOR | M | WEB-V16-KOSTUR | `packages/app/src/host/thesis/stages-mentor/**` |
| WEB-V16-POVJERENSTVO | M | SRV-V16-POVJERENSTVO-ZAPIS, WEB-V16-KOSTUR | `packages/app/src/host/thesis/committee/**` |
| WEB-V16-POPIS-FAKULTET | M | SRV-V16-POPIS-FAKULTET, WEB-V16-POVJERENSTVO | `packages/app/src/host/admin/thesis-overview/**`; `packages/app/src/routes.ts`, `packages/app/src/i18n/shell.ts` (po 1 redak) |
| WEB-V16-E2E | S | WEB-V16-OBRASCI, WEB-V16-OBRANA, WEB-V16-TEMA-STUDENT, WEB-V16-TEMA-MENTOR, WEB-V16-ETAPE-STUDENT, WEB-V16-ETAPE-MENTOR, WEB-V16-POVJERENSTVO | `packages/app/e2e/val16-razlika.spec.ts` |
