# Val 17 „rani početak”: razlika između plana i baza migracije

Zadatak V17-PREGLED `val17-razlika`. Plan: `ductura/.github`, `docs/plan/NOVE-FUNKCIJE.md`, „Val 17: rani početak” (PR plan/val17-rani-pocetak) i `PLAN-MIGRACIJE.md`, val 17. Ovaj dokument je samo pregled; kod se ne mijenja.

## 0. Izvori i ograničenja

Pročitano (stanje 24. 11. 2026.):
- WEB baza `migracija/kopija-ductus-front` (HEAD `6060c681`): `packages/app/src/host/teacher/comment-bank/`, `.../teacher/comments/`, `.../teacher/assignment-form/`, `.../teacher/pre-submit/`, `.../editor/rules/` (`profiles.ts`, `RulesHost.tsx`), `.../editor/work/consult/ConsultCriteria.tsx`, `.../editor/export/`, `src/client/teacher-working-criteria.ts`, `src/client/text-check-config.ts`, `src/domain/citation/`, `config/faculties/fpzg/citation.json`, `src/client/migration-contracts.generated.json`.
- SRV baza `migracija/kopija-ductus-backend` (HEAD `11b6a58c`, klon javnog `ductura/Institution_server`): `server/contracts/routes/` (`comments.ts`, `teacher-working-criteria.ts`, `milestone-template.ts`, `text-check-config.ts`, `faculty-rules.ts`, `institution.ts`, `student.ts`), `server/http/comments|teacher-working-criteria|milestone-template|text-check-config/`, `server/database/milestone-template|teacher-working-criteria/`, `server/domain/settings/lekta-profiles.ts`, `text-check-rules.ts`, `server/domain/citation/`.

Nije učinjeno: plan `NOVE-FUNKCIJE.md` nije čitan (oblak nema pristup `ductura/.github`); četiri dijela vala 17 uzeta su iz naloga orkestratora. Aplikacija i server nisu pokretani, baza ni Docker nisu korišteni; sve je izvedeno iz izvornog koda i ugovora. Ako plan traži nešto što ovdje nije, dodaje se naknadno.

## 1. Što već postoji

### 1.1 Kriteriji ocjenjivanja (rubrika) i ručno označavanje razine

| Što | Gdje | Stanje |
|---|---|---|
| Šest radnih kriterija mentora (`topic`, `structure`, `sources`, `method`, `language`, `formatting`), razina 0/1/2 + bilješka do 2000 znakova | SRV `server/contracts/routes/teacher-working-criteria.ts`, `server/http/teacher-working-criteria/`, `server/database/teacher-working-criteria/`; rute `teacher.working-criteria.get` (GET `/api/v1/teacher/works/{documentId}/working-criteria`) i `teacher.working-criterion.put` (PUT `.../working-criteria/{criterionId}`) | Montirano (SRV-1107). Privatna bilješka nastavnika autora: student, drugi nastavnik i nepoznat rad čitaju 404. Nema broja, zbroja ni ocjene. |
| Klijent i kartica | WEB `src/client/teacher-working-criteria.ts`, `packages/app/src/host/editor/work/consult/ConsultCriteria.tsx` (+ `consult-model.ts`), stari `src/components/editor/mentor/working-criteria/` | Radi s fiksnih šest kriterija; kartica kaže „nedostupno” dok nema poziva. |
| Rubrika po zadatku (definira nastavnik) | nema | **Ne postoji.** `institution.course-assignments.post` (SRV `institution.ts`, POST `/api/v1/institution/courses/{courseId}/assignments`) nema polje kriterija; `student.assignment-requirements.get` daje samo raspon riječi. |
| Student vidi kriterije prije predaje | nema | **Ne postoji.** Server izričito kaže da student ne čita kriterij (`student-work.ts`: „nothing of a teacher (…criteria)”). |

Nesklad za rješavanje: komentar u `ConsultCriteria.tsx` navodi odluku 22. 11. „kriteriji vidljivi studentu” (WEB-2122), a ugovor `teacher.working-criteria.get` je samo za nastavnika autora. Val 17 zato uvodi rubriku zadatka kao zasebnu, studentu vidljivu stvar, a postojećih šest radnih kriterija ostavlja kao privatnu bilješku (i kao zadanu rubriku kad je zadatak nema).

### 1.2 Banka komentara nastavnika

| Što | Gdje | Stanje |
|---|---|---|
| Banka: čitanje, spremanje, brisanje | SRV `server/contracts/routes/comments.ts`: `teacher.comment-bank.get` (GET `/api/v1/teacher/comment-bank`), `.post` (POST istog puta, `{text, kind}`, kind `must|sugg|q|praise`, do 200 unosa, 4 KiB), `.delete` (DELETE `/api/v1/teacher/comment-bank/{entryId}`); `server/http/comments/index.ts` | Montirano. Banka pripada autoru (D-130), nije dio nijednog prikaza rada. |
| Odgođeni komentari uz banku | `work.comment-drafts.get|post`, `work.comment-draft.delete`, `work.comments.publish.post`, `work.comments.publish-selected.post` | Montirano. |
| UI banke | WEB `packages/app/src/host/teacher/comment-bank/` (`CommentBank.tsx`, `port.ts` stvarni port, `fake-port.ts`, `model.ts`), montirano u `host/teacher/work/pages.tsx:200` | Radi: popis, dodavanje, brisanje. |
| Uređivanje unosa, oznaka/pretraga, umetanje u komentar | nema | **Ne postoji.** Ruta PUT za unos ne postoji; banka nije povezana s pisanjem komentara (`host/teacher/comments/TeacherCommentsPanel.tsx`). |

### 1.3 Fakultetski predlošci rada

| Što | Gdje | Stanje |
|---|---|---|
| Predložak etapa (ne dokumenta) | SRV `server/contracts/routes/milestone-template.ts` (SRV-1521): `institution.milestone-template.get|put`, `work.milestone-plan.apply-template.post`; `server/http/milestone-template/` | Montirano; administrator ustanove, verzionirano samo dodavanjem. U WEB-u nema ekrana. |
| Pravila fakulteta po vrsti rada | SRV `server/contracts/routes/faculty-rules.ts`: `institution.faculty-rules.get|post` (AI politika, svrhe, profil dokaza, uvoz) | Montirano; nema oblika rada. |
| Profili Lekte | SRV `server/domain/settings/lekta-profiles.ts` (samo popis ID-eva iz katedra-packa), WEB `packages/app/src/host/editor/rules/profiles.ts` (izmišljeni profili: raspon riječi, minimum izvora, font, odjeljci) | Samo imena/izmišljeni profili; paket Lekte „nedostupno” do Q-11. |
| Citatni stil FPZG | `config/faculties/fpzg/citation.json`, WEB `src/domain/citation/`, SRV `server/domain/citation/` (+ `fpzg/`) | Postoji (D-83). |
| Predložak dokumenta (naslovna, kostur odjeljaka) koji student dobiva pri početku rada | nema | **Ne postoji.** M5.4: opća naslovnica u valu 1, predložak iz paketa poslije. |

### 1.4 Provjera formata prije predaje (proširenje M4 Lekte)

| Što | Gdje | Stanje |
|---|---|---|
| Tekstne provjere (12 id-eva: `paste`, `claim`, `long`, `colloq`, `absolute`, `first`, `passive`, `term`, `abbr`, `trans`, `short`, `hole`) | SRV `server/domain/settings/text-check-rules.ts`; ruta `student.text-check-config.get` (GET `/api/v1/student/assignments/{assignmentId}/text-check-config` → `{enabledCheckIds, lektaProfileId}`); WEB `src/client/text-check-config.ts` | Montirano; provjere se rade lokalno u pregledniku. |
| Raspon riječi zadatka | `student.assignment-requirements.get` (GET `.../requirements`) | Postoji. |
| Proba predaje / pretpredajna ploča | WEB `packages/app/src/host/teacher/pre-submit/`, `host/editor/mentor/`, `host/editor/export/PreparationControl.tsx`, `chapter-length/` | Postoje dijelovi (duljina poglavlja, priprema izvoza); nema jedne provjere oblika. |
| Provjera oblika nad dokumentom (odjeljci, minimum izvora, font, razmak, naslovna) iz profila | nema | **Ne postoji.** `profiles.ts` ima brojke, ali ih nijedan kod ne provjerava nad dokumentom; Lekta paket nedostupan (Q-11). |

## 2. Zadaci koji nedostaju

Odluke: rubrika zadatka je zasebna od privatnih radnih kriterija (1.1); razine rubrike su nastavnikova ručna oznaka bez broja, zbroja, ocjene i rangiranja; student vidi rubriku prije predaje, ali ne i oznake razina u ovom valu (otvoreno, v. 4). Provjera formata je savjetodavna i ne blokira predaju. Svaki SRV zadatak ima vlastitu datoteku ugovora; zajedničke retke (`routes/index.ts`, `inventory.ts`, `server/http/index.ts`, fiksni testovi, lažni dev server) dodaje po pravilima za SRV pisce. Svaki zadatak ≤ ~400 redaka koda.

1. **SRV-V17-RUBRIC-DEF** (L). Rubrika po zadatku: popis do 12 kriterija `{id, title ≤120, levels[3]{label ≤80, descriptor ≤400}}`, verzionirana samo dodavanjem; student čita rubriku svog zadatka. Nova tablica `assignment_rubric_versions` (RLS, pgTAP matrica), migracija iza vrha baze. Nova polja/rute: `teacher.assignment-rubric.get` GET i `.put` PUT `/api/v1/teacher/assignments/{assignmentId}/rubric` (`{expectedVersion, criteria[]}`, 409 pri neskladu), `student.assignment-rubric.get` GET `/api/v1/student/assignments/{assignmentId}/rubric` (404 za tuđi/neupisan zadatak; `{version, criteria[]}`, a bez rubrike zadane šest kriterija iz `WORKING_CRITERION_IDS`). Sve u novoj datoteci `server/contracts/routes/assignment-rubric.ts`. Ovisi: ništa.
2. **SRV-V17-RUBRIC-LEVEL** (M). Nastavnikova oznaka razine po kriteriju na radu, vezana uz verziju rubrike; nema broja, zbroja, ocjene ni poretka u odgovoru. Nova tablica `work_rubric_levels` (RLS, pgTAP). Rute: `teacher.work-rubric.get` GET `/api/v1/teacher/works/{documentId}/rubric` (`{rubricVersion, marks[]{criterionId, level 0|1|2|null, note|null}}`), `teacher.work-rubric-mark.put` PUT `.../rubric/{criterionId}` (`{level, note}`). Samo nastavnik rada; student, drugi nastavnik i nepoznat rad 404. Nova datoteka `server/contracts/routes/work-rubric.ts`. Ovisi: SRV-V17-RUBRIC-DEF (verzije kriterija).
3. **SRV-V17-BANK-EDIT** (S). Uređivanje unosa banke i oznaka. Nova ruta `teacher.comment-bank-entry.put` PUT `/api/v1/teacher/comment-bank/{entryId}` (`{text, kind, label?}`, tuđi/nepostojeći unos 404) i opcionalno polje `label` (≤40 znakova, `null` = bez) u `BankEntry` i POST tijelu. Migracija: stupac `label`. Jedini zadatak koji dira `server/contracts/routes/comments.ts` (i `server/http/comments/index.ts`). Ovisi: ništa.
4. **SRV-V17-TEMPLATE-ADMIN** (L). Fakultetski predložak rada po vrsti rada, verzioniran samo dodavanjem (kao `milestone-template`): naslovna (polja iz popisa: naslov, autor, mentor, kolegij, datum) i kostur odjeljaka `sections[]{title ≤120, hint ≤400}` do 30, plus `citationStyle`. Nova tablica `institution_work_template_versions` (RLS, pgTAP). Rute: `institution.work-template.get` GET `/api/v1/institution/work-templates/{workType}` i `institution.work-template.put` PUT istog puta (`{expectedVersion, titlePage[], sections[], citationStyle}`); samo administrator ustanove. Nova datoteka `server/contracts/routes/work-template.ts`. Ovisi: ništa.
5. **SRV-V17-TEMPLATE-ASSIGN** (M). Zadatak dobiva predložak pri objavi; student čita kostur pri početku rada. Rute: `teacher.assignment-template.put` PUT `/api/v1/teacher/assignments/{assignmentId}/template` (`{useInstitutionTemplate: boolean}`; zamrzava trenutačnu verziju na zadatak) i `student.assignment-template.get` GET `/api/v1/student/assignments/{assignmentId}/template` (`{version, titlePage[], sections[], citationStyle}` ili 404). Nova datoteka `server/contracts/routes/assignment-template.ts`; nova tablica veze `assignment_template_pin` (RLS, pgTAP). Ovisi: SRV-V17-TEMPLATE-ADMIN (migracija i tipovi).
6. **SRV-V17-FORMAT-RULES** (M). Pravila oblika po zadatku za provjeru: `{wordMin, wordMax, minSources, requiredSections[], citationStyle, font?, size?, spacing?}`, iz raspona riječi zadatka, kostura predloška (zadatak 5) i, kad paket Lekte postane dostupan (Q-11), iz profila; do tada polja iz Lekte su `null`. Ruta `student.assignment-format-rules.get` GET `/api/v1/student/assignments/{assignmentId}/format-rules` (404 za tuđi zadatak). Nova datoteka `server/contracts/routes/format-rules.ts`; bez nove tablice. Ovisi: SRV-V17-TEMPLATE-ASSIGN (tip kostura).
7. **WEB-V17-RUBRIC-FORM** (M). Obrazac rubrike u nastavnikovu obrascu zadatka (do 12 kriterija, tri razine). Nove datoteke `packages/app/src/host/teacher/rubric/` (`RubricField.tsx`, `rubric-model.ts`, `port.ts`, `messages.hr.ts`, testovi); jedan redak montiranja u `host/teacher/assignment-form/AssignmentForm.tsx` (jedini zadatak vala koji ga dira do WEB-V17-TEMPLATE-PICK). Ovisi: SRV-V17-RUBRIC-DEF (izvadak ugovora).
8. **WEB-V17-RUBRIC-STUDENT** (S). Student vidi rubriku zadatka prije predaje (bez oznaka razina): kartica „Kriteriji ocjenjivanja” samo na ploči zadatka (pretpredajni korak `BeforeSubmitStep.tsx` drži WEB-V17-FORMAT-CHECK i ovdje se ne dira). Nova mapa `packages/app/src/host/student/rubric/`; mont u `host/student/work.tsx` jednim retkom. Stanja učitavanje/greška/prazno razdvojena. Ovisi: SRV-V17-RUBRIC-DEF.
9. **WEB-V17-RUBRIC-MARK** (M). Nastavnik označava razinu po kriteriju na radu (bez broja i rangiranja); zamjenjuje privatnih šest kriterija u kartici kad rubrika postoji. Nova mapa `packages/app/src/host/teacher/work/rubric/` (`RubricMarks.tsx`, model, port); jedan redak u `host/teacher/work/pages.tsx`. Ne dira `ConsultCriteria.tsx` ni `src/client/teacher-working-criteria.ts`. Ovisi: SRV-V17-RUBRIC-LEVEL, WEB-V17-RUBRIC-FORM (zajednički model kriterija: uvoz, ne izmjena).
10. **WEB-V17-BANK-INSERT** (M). Banka u pisanju komentara: pretraga po tekstu/vrsti/oznaci, umetanje unosa u komentar, uređivanje unosa i oznake. Datoteke `packages/app/src/host/teacher/comment-bank/` (port, model, `CommentBank.tsx`, poruke) i `host/teacher/comments/TeacherCommentsPanel.tsx` (prop „umetni”); drugi zadatak ih ne dira. Ovisi: SRV-V17-BANK-EDIT.
11. **WEB-V17-TEMPLATE-ADMIN** (M). Ekran administratora: uređivanje predloška po vrsti rada (naslovna, odjeljci, stil), verzije. Nova mapa `packages/app/src/host/admin/work-template/`; jedan redak montiranja u `host/admin/faculty-settings/routes.tsx`. Ovisi: SRV-V17-TEMPLATE-ADMIN.
12. **WEB-V17-TEMPLATE-PICK** (S). Nastavnik u obrascu zadatka uključuje fakultetski predložak i vidi kostur. Nova datoteka `packages/app/src/host/teacher/assignment-form/TemplateField.tsx` + test; jedan redak u `AssignmentForm.tsx`. Ovisi: SRV-V17-TEMPLATE-ASSIGN, WEB-V17-RUBRIC-FORM (isti `AssignmentForm.tsx`, slijedno).
13. **WEB-V17-TEMPLATE-START** (M). Pri početku rada student dobiva predložak: naslovna i prazni odjeljci (naslovi + pomoćni tekst) u shemi editora v1 (samo naslovi i odlomci; v3 kroz PIL-K-SHEMA-V3). Postojeća mapa `packages/app/src/host/student/start-work/`; nove datoteke `template.ts`, `template-port.ts`, `template.test.ts`, a u postojećoj `StartWork.tsx` jedan redak (model i port; jedan redak u postojećoj `StartWork.tsx`), bez diranja `src/components/editor/`. Ovisi: SRV-V17-TEMPLATE-ASSIGN.
14. **WEB-V17-FORMAT-CHECK** (L). Provjera oblika nad dokumentom prije predaje, savjetodavna, ne blokira: raspon riječi, minimum izvora, obvezni odjeljci, stil navođenja (`src/domain/citation/`), pokazuje odstupanja po stavci; font/razmak samo kad pravila stignu iz Lekte (inače „nedostupno”). Nova mapa `packages/app/src/host/editor/format-check/` (čista funkcija `checkFormat(doc, rules)`, ploča, port, poruke) i jedan redak u `host/student/submission/summary/BeforeSubmitStep.tsx`. Ovisi: SRV-V17-FORMAT-RULES, WEB-V17-TEMPLATE-START (nije nužno za kod; samo isti podatak o odjeljcima).

## 3. Tablica za orkestratora

| ID | r | deps | paths |
|---|---|---|---|
| SRV-V17-RUBRIC-DEF | L | – | `server/contracts/routes/assignment-rubric.ts`, `server/http/assignment-rubric/**`, `server/database/assignment-rubric/**`, `db/main/migrations/<nova>`, `db/main/tests/030-institution-access-matrix.sql` (retci) |
| SRV-V17-RUBRIC-LEVEL | M | SRV-V17-RUBRIC-DEF | `server/contracts/routes/work-rubric.ts`, `server/http/work-rubric/**`, `server/database/work-rubric/**`, migracija, pgTAP retci |
| SRV-V17-BANK-EDIT | S | – | `server/contracts/routes/comments.ts`, `server/http/comments/**`, migracija (`label`), pgTAP retci |
| SRV-V17-TEMPLATE-ADMIN | L | – | `server/contracts/routes/work-template.ts`, `server/http/work-template/**`, `server/database/work-template/**`, migracija, pgTAP retci |
| SRV-V17-TEMPLATE-ASSIGN | M | SRV-V17-TEMPLATE-ADMIN | `server/contracts/routes/assignment-template.ts`, `server/http/assignment-template/**`, `server/database/assignment-template/**`, migracija, pgTAP retci |
| SRV-V17-FORMAT-RULES | M | SRV-V17-TEMPLATE-ASSIGN | `server/contracts/routes/format-rules.ts`, `server/http/format-rules/**` |
| WEB-V17-RUBRIC-FORM | M | SRV-V17-RUBRIC-DEF | `packages/app/src/host/teacher/rubric/**`, `host/teacher/assignment-form/AssignmentForm.tsx` (1 redak) |
| WEB-V17-RUBRIC-STUDENT | S | SRV-V17-RUBRIC-DEF | `packages/app/src/host/student/rubric/**`, `host/student/work.tsx` (1 redak) |
| WEB-V17-RUBRIC-MARK | M | SRV-V17-RUBRIC-LEVEL, WEB-V17-RUBRIC-FORM | `packages/app/src/host/teacher/work/rubric/**`, `host/teacher/work/pages.tsx` (1 redak) |
| WEB-V17-BANK-INSERT | M | SRV-V17-BANK-EDIT | `packages/app/src/host/teacher/comment-bank/**`, `host/teacher/comments/TeacherCommentsPanel.tsx` |
| WEB-V17-TEMPLATE-ADMIN | M | SRV-V17-TEMPLATE-ADMIN | `packages/app/src/host/admin/work-template/**`, `host/admin/faculty-settings/routes.tsx` (1 redak) |
| WEB-V17-TEMPLATE-PICK | S | SRV-V17-TEMPLATE-ASSIGN, WEB-V17-RUBRIC-FORM | `packages/app/src/host/teacher/assignment-form/TemplateField.tsx`, `AssignmentForm.tsx` (1 redak) |
| WEB-V17-TEMPLATE-START | M | SRV-V17-TEMPLATE-ASSIGN | `packages/app/src/host/student/start-work/template.ts`, `template-port.ts`, `template.test.ts`, `StartWork.tsx` (1 redak) |
| WEB-V17-FORMAT-CHECK | L | SRV-V17-FORMAT-RULES | `packages/app/src/host/editor/format-check/**`, `host/student/submission/summary/BeforeSubmitStep.tsx` (1 redak) |

Zajednički izvadak ugovora (`src/client/migration-contract*.generated.*`) dopunjuje orkestrator iz SRV baze prije svakog WEB zadatka; WEB pisci ga ne uređuju ručno. Migracije SRV zadataka idu strogo redom iza vrha baze (RUBRIC-DEF, BANK-EDIT, TEMPLATE-ADMIN mogu paralelno, svaka s vlastitom verzijom; TEMPLATE-ASSIGN i RUBRIC-LEVEL iza njih).

## 4. Pretpostavke i otvoreno

Pretpostavke (odlučeno po planu, bez pitanja): rubrika zadatka je zasebna od privatnih radnih kriterija; tri razine kao u postojećem ugovoru (0/1/2) bez bodova; provjera formata savjetodavna; stil i izgled rade se centralno. Putanje WEB zadataka su u hostu (`packages/app/src/host/`), ne u `src/app`.

Otvoreno (za vlasnika/orkestratora): (a) smije li student vidjeti oznake razina na svom radu i kada (nakon objave komentara ili vraćanja na doradu); u ovom pregledu nije planirano; (b) sadržaj polja Lekte (font, razmak, naslovna iz paketa) čeka Q-11; (c) nesklad opisa WEB-2122 („vidljivo studentu”) i ugovora `teacher.working-criteria.get` (samo nastavnik) iz 1.1; (d) plan `NOVE-FUNKCIJE.md` nije bio dostupan oblaku, pa broj i podjelu dijelova vala 17 treba provjeriti prema njemu.

## Trag

- Base SHA: `6060c681c04714d1b95ea3ec152107f0e51217c5` (`origin/migracija/kopija-ductus-front`); SRV baza `11b6a58cc6e26f8d4cf12bf3e16e6bfba6d7565b`.
- Pokrenute provjere: nijedna (samo dokumentacija).
- Nepokrenuto: typecheck, testovi, build.
- Sljedeći korak: neovisni pregled; zatim orkestrator raspoređuje zadatke iz tablice.
