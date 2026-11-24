# Val 14 „tablice”: razlika između plana i baza migracije

Zadatak V14-PREGLED `val14-razlika`. Plan: `ductura/.github`, `docs/plan/NOVE-FUNKCIJE.md` t. 8 (PR #85) i `PLAN-MIGRACIJE.md`, val 14 (vlastiti editor tablica). Ovaj dokument je samo pregled; kod se ne mijenja.

## 0. Izvori i ograničenja

Pročitano (stanje 24. 11. 2026.):
- WEB baza `migracija/kopija-ductus-front` (HEAD `ff7d679`): `packages/editor-core/src/document/document/` (`schema.ts`, `validate-table-v4.ts`, `edit-step.ts`), `packages/editor-core/src/editor/extensions-v4.ts`, `.../journal/`, `.../serverSync/`, `src/components/editor/rich/table-image/` (`table-ops.ts`, `TableBar.tsx`), `src/components/editor/rich/blocks/` (formule LaTeX), `packages/app/src/host/editor/`, `packages/app/src/host/student/`, `src/client/merlin-export.ts`.
- SRV baza `migracija/kopija-ductus-backend` (HEAD `abf94a9`, klon javnog `ductura/Institution_server`): `server/domain/document/` (`schema.ts`, `validate-table-v4.ts`, `word-count.ts`), `server/downloads/export/` (`docx.ts`, `work-docx.ts`, `zip.ts`, `README.md`), `server/downloads/merlin/roster/csv.ts`, `server/contracts/routes/` (`evidence.ts`, `work-export.ts`, `work-export-docx.ts`, `submissions.ts`, `submission-package.ts`, `student-work.ts`, `teacher-work.ts`), `server/evidence/`.

Nije učinjeno: `NOVE-FUNKCIJE.md` nije čitan (oblak nema pristup `ductura/.github`); opis vala 14 uzet je iz naloga orkestratora (četiri dijela: model i paket, formule, dnevnik/revizija/potpis/predaja/potvrda, izvoz). Aplikacija i server nisu pokretani, baza ni Docker nisu korišteni; sve je izvedeno iz izvornog koda i ugovora. Ako plan traži nešto što ovdje nije, dodaje se naknadno.

## 1. Što već postoji

### 1.1 Model tablice i paket u webu

| Što | Gdje | Stanje |
|---|---|---|
| Tablica kao blok u tekstnom dokumentu v4 | WEB `packages/editor-core/src/document/document/schema.ts` (`TableNode`: `rows: string[][]`, `header`, `stripes`, `landscape`, `headerFill`, `cellFills`, `merges`, `title`, `source`); SRV `server/domain/document/validate-table-v4.ts` (isti validator) | Postoji. Sve su ćelije **tekst** (do 1000 točaka koda, do 3000 ćelija po tablici). Nema tipa ćelije, broja, formule ni više listova. |
| Uređivanje tablice u editoru | WEB `src/components/editor/rich/table-image/table-ops.ts` (dodaj/obriši redak i stupac, zaglavlje, pruge, spajanje, boje), `TableBar.tsx`; čvor `table` u `packages/editor-core/src/editor/extensions-v4.ts` (blok-atom); korak uređivanja `table` u `edit-step.ts` | Postoji kao blok u tekstu rada. Nije samostalan dokument. |
| Vrsta dokumenta (`documentKind`) | nigdje | **Ne postoji** (nula pojavljivanja u WEB-u, SRV kodu, migracijama i OpenAPI-ju). Zadatak, rad i potvrda ne znaju razliku tekst/tablica. |
| Mreža ćelija s tipkovnicom, odabirom raspona, formula trakom | nema | **Ne postoji.** `TableBar` radi nad ćelijom unutar teksta; nema `role="grid"` zaslona. |
| Paket u webu | `packages/editor-core` (model, dnevnik, sync), `packages/app/src/host/editor/` (ekrani), `@ductura/ui` | Okvir postoji; za tablice nema mape ni ulaza. |

### 1.2 Determinističke formule

| Što | Gdje | Stanje |
|---|---|---|
| Formule kao LaTeX (matematički zapis) | WEB `src/components/editor/rich/blocks/` (`FormulaDialog.tsx`, `formula-templates.ts`, `katex-render.ts`), `packages/app/src/host/editor/stem/latex.ts`; čvor `formula` (`tex`) i `inlineFormula` | Postoji, ali je **samo prikaz**: ništa se ne računa. |
| Račun nad ćelijama (SUM, prosjek, IF, reference A1, ciklusi, greške) | nema | **Ne postoji** ni u webu ni u serveru. |
| Zlatni vektori i svojstveni testovi za dokument | WEB `packages/editor-core/src/document/document/golden-vectors-v3.json`, `golden-v4-fixture.jcs.txt`; SRV `server/domain/document/golden-vectors-v4.json` | Postoje za tekstni dokument; uzor za vektore formula (isti JSON u oba repoa). |

### 1.3 Dnevnik, revizija, potpis, predaja, potvrda

| Što | Gdje | Stanje |
|---|---|---|
| Lokalni dnevnik i spremanje | WEB `packages/editor-core/src/journal/` (`atomic-dexie-journal.ts`, `local-document-saver.ts`) | Radi za tekstni dokument i korake iz `edit-step.ts`; nema koraka za ćelije. |
| Sinkronizacija i potvrda | WEB `packages/editor-core/src/serverSync/` (`bootstrap.ts`, `checkpoints.ts`, `receipt-bridge.ts`, `work-opening.ts`); SRV rute `evidence.open.post` (POST `/api/v1/evidence/open`), `evidence.commit.post` (`/api/v1/evidence/commit`), `evidence.replay.post` (`/api/v1/evidence/replay`) u `server/contracts/routes/evidence.ts`; `server/evidence/`, `server/domain/forensics/` | Radi; SYNCED samo uz potpisanu potvrdu. Zapisuju se koraci uređivanja teksta; ponovno izvođenje (replay) i JCS sažetak poznaju samo tekstni oblik. |
| Predaja i potvrda predaje | SRV `submission.submit.post` (POST `/api/v1/submission`), `submission.submit-second.post` (`/api/v1/submission/v2`) u `evidence.ts`; `submissions.ts` (povlačenje, povijest); `submission-package.ts` (`student.submission-package-link.post`, `student.submission-package.get`) | Postoji; potvrda i paket ne nose vrstu dokumenta. |
| Revizije i usporedba | SRV `server/domain/document/` (`snapshot.ts`, `equality.ts`), `work.compare.get` | Samo tekst; usporedba tablice po ćelijama ne postoji. |
| Nastavnikov pregled rada | SRV `teacher.work.get` (GET `/api/v1/teacher/works/{documentId}`) | Vraća tekstni dokument; za tablicu nema prikaza. |

### 1.4 Izvoz .xlsx i CSV

| Što | Gdje | Stanje |
|---|---|---|
| DOCX izvoz rada | SRV `server/downloads/export/` (`docx.ts`, `work-docx.ts`), ruta `work.export.get` (GET `/api/v1/works/{documentId}/export`); README: „Tablica, slika (…) čekaju validator SRV-10A 2/2” | Postoji za tekst; tablica u DOCX-u je otvorena stavka. |
| PDF izvoz | `work.export-pdf.get` (GET `/api/v1/assignments/{assignmentId}/works/{documentId}/export/pdf`); WEB `host/editor/export/PdfExport.tsx` | Postoji za tekst. |
| Deterministički ZIP | SRV `server/downloads/export/zip.ts` (`writeZip`, bez sažimanja, fiksno vrijeme; koristi ga Merlin paket) | Postoji; temelj za OOXML (.xlsx je ZIP) bez nove ovisnosti. |
| CSV | SRV `server/downloads/merlin/roster/csv.ts` (`merlinRosterCsv`), ruta `teacher.merlin-roster-csv.get`; WEB `src/client/merlin-export.ts` | Postoji samo za popis za Merlin; nema općeg CSV pisača ni zaštite od ubrizgavanja formule u Excelu. |
| .xlsx izvoz | nema | **Ne postoji.** |

## 2. Odluke ovog pregleda (zapisati i u PR-ove zadataka)

1. Tablica kao rad je **zasebna vrsta dokumenta** `documentKind: "text" | "spreadsheet"` (zadano `text`, postojeći radovi se ne mijenjaju). Tablica-blok unutar teksta ostaje kakva jest.
2. Model: `SheetDocument` v1 `{schemaVersion: 1, kind: "spreadsheet", sheets[{id, name ≤ 31, rows ≤ 200, columns ≤ 26, cells: {"A1": {value, formula?}}}]}`; ćelija je tekst, broj ili prazno; ukupno ≤ 3000 ispunjenih ćelija (kao `MAX_TABLE_CELLS`). Do 5 listova. Kanonski JCS sažetak kao za tekst.
3. Formule su **čiste i determinističke**: `+ − * /`, usporedbe, reference A1 i rasponi, `SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `ROUND`, `ABS`, `IF`. Bez `NOW`, `RAND`, vanjskih podataka, mreže i makroa. Greške su vrijednosti (`#DIV/0!`, `#REF!`, `#CIRC!`, `#NAME?`, `#VALUE!`). Decimalni račun `x.xxxxxxxxxxxxxxxx` zaokružen na 15 znamenki, bez ovisnosti o lokalizaciji. Isti zlatni vektori u SRV i WEB.
4. Dnevnik bilježi **korake nad ćelijama** (postavi vrijednost/formulu, dodaj/obriši redak/stupac, preimenuj list), ne pritisnute tipke. SYNCED samo uz potpisanu potvrdu, kao za tekst. Rezultat formule se ne pohranjuje kao istina: server ga ponovno računa pri izvozu i pri provjeri.
5. Predaja i potvrda nose `documentKind`; sažetak procesa za tablicu je jednak po obliku (broj koraka, trajanje), bez ocjene, ranga i automatske sankcije.
6. Izvoz: **CSV** (UTF-8 s BOM-om, razdjelnik `;` zbog hrvatskog Excela, prvi list, izračunate vrijednosti; ćelija koja počinje s `=`, `+`, `-`, `@`, tabulatorom ili CR dobiva prefiks `'`) i **.xlsx** (OOXML kroz `writeZip`, bez sažimanja, fiksno vrijeme, formule i izračunate vrijednosti, bez vanjskih biblioteka). Dostupno studentu vlasniku i nastavniku zadatka, uz isti pristup kao `work.export.get` (tuđe = 404).
7. Bez plaćenog API-ja i tuđih servisa; svi primjeri izmišljeni (`demo-*`).

## 3. Zadaci koji nedostaju

Najviše 14, svaki ≤ ~400 redaka koda. Redoslijed: server ugovor prije weba. Svaki SRV zadatak ima vlastitu datoteku ugovora; zajedničke retke (`routes/index.ts`, `inventory.ts`, `server/http/index.ts`, fiksni testovi, lažni dev server, pgTAP matrica) dodaje po pravilima za SRV pisce. `server/contracts/routes/evidence.ts` dira samo SRV-V14-SHEET-EVIDENCE.

1. **SRV-V14-KIND** (M). Vrsta dokumenta po zadatku. Nova tablica `assignment_document_kind (assignment_id, kind, set_at)` s RLS-om i pgTAP retcima, samo dodavanje do prve predaje; migracija iza vrha baze (`git ls-tree --name-only origin/<baza> db/main/migrations/ | tail -1`). Rute: `teacher.assignment-document-kind.put` PUT `/api/v1/teacher/assignments/{assignmentId}/document-kind` (`{kind: "text"|"spreadsheet"}`, 409 ako postoji predaja, tuđi zadatak 404) i `student.assignment-document-kind.get` GET istog puta pod `/api/v1/student/assignments/{assignmentId}/document-kind` (`{kind}`, 404 za neupisan zadatak). Nova datoteka `server/contracts/routes/document-kind.ts`; ne dira `assignments.ts`. Ovisi: ništa.
2. **SRV-V14-SHEET-MODEL** (M). Čista domena: `SheetDocument` v1, validator s granicama iz odluke 2, JCS sažetak, jednakost, broj ispunjenih ćelija; odbijanje nepoznatih polja (kao B-8). Nova mapa `server/domain/sheet/` (`schema.ts`, `validate.ts`, `index.ts`, testovi, `golden-vectors.json`); bez rute i tablice, jedan redak u `server/domain/index.test.ts`. Ovisi: ništa.
3. **SRV-V14-SHEET-FORMULAS** (L). Parser i računalo formula iz odluke 3: reference i rasponi, redoslijed izračuna, detekcija ciklusa, kodovi grešaka; testovi: tablica vektora (`formula-vectors.json`), svojstveni testovi (isti ulaz, isti izlaz; premještanje redaka ne mijenja zbroj), negativni (dubina izraza, duljina formule ≤ 500 znakova, 10 000 ćelija u rasponu odbijeno). Nova mapa `server/domain/sheet/formula/`; bez rute. Ovisi: SRV-V14-SHEET-MODEL (tipovi).
4. **SRV-V14-SHEET-EVIDENCE** (L). Evidencija za tablicu: koraci uređivanja ćelija u `evidence.open/commit/replay` i JCS sažetak `SheetDocument`; potvrda i odgovor `evidence.open.post` dobivaju polje `documentKind` (`"text"` zadano, pa postojeći vektori ostaju valjani). Nove datoteke `server/domain/sheet/edit-step.ts` (+ vektori) i `server/evidence/sheet/` (razvrstavanje po vrsti, jedan redak u postojećem ulazu); jedini zadatak vala koji dira `server/contracts/routes/evidence.ts` (dodaje polje i vektore, `contracts:breaking` mora ostati zelen: polje je opcionalno). Negativni: tuđi rad 404, korak nepoznate vrste odbijen, tekstni korak na tablici odbijen. Ovisi: SRV-V14-KIND, SRV-V14-SHEET-MODEL.
5. **SRV-V14-SHEET-SUBMIT** (M). Predaja i potvrda za tablicu: `submission.submit.post` i paket predaje (`student.submission-package.get`) preuzimaju `documentKind` iz zapisa rada; sažetak procesa i potvrda ga prikazuju; ponovno računanje formula pri predaji upisuje samo oznaku „izračun usklađen” (bez ocjene). Datoteke: `server/evidence/submission/**` i `server/downloads/submission-package/**` (samo dodatak polja); **ne dira** ugovore (polje je već u SRV-V14-SHEET-EVIDENCE). Ovisi: SRV-V14-SHEET-EVIDENCE.
6. **SRV-V14-SHEET-CSV** (S). Izvoz CSV iz odluke 6. Novi `server/downloads/export/sheet-csv.ts` (+ test, uključujući `=cmd|...`, `@SUM`, ćelije s `;`, `"` i novim redom), ruta `work.export-sheet-csv.get` GET `/api/v1/works/{documentId}/export/csv` (`?sheet=<id>`, zadano prvi list; 404 za tuđi i tekstni rad; zaglavlje `Content-Disposition`), nova datoteka `server/contracts/routes/work-export-sheet-csv.ts`. Ovisi: SRV-V14-SHEET-FORMULAS, SRV-V14-KIND.
7. **SRV-V14-SHEET-XLSX** (L). Izvoz .xlsx: `server/downloads/export/sheet-xlsx.ts` (`[Content_Types].xml`, `xl/workbook.xml`, `xl/worksheets/sheetN.xml`, `xl/styles.xml`, dijeljeni nizovi; formula `<f>` + zatvorena vrijednost `<v>`; ista datoteka dva puta = isti bajtovi), ruta `work.export-sheet-xlsx.get` GET `/api/v1/works/{documentId}/export/xlsx`, nova datoteka `server/contracts/routes/work-export-sheet-xlsx.ts`. Test otvaranja: struktura ZIP-a i XML dobro oblikovan (bez Excela u CI-ju); `writeZip` se samo uvozi. Ovisi: SRV-V14-SHEET-FORMULAS, SRV-V14-KIND.
8. **WEB-V14-SHEET-CORE** (L). Model i račun u webu: kopija domene iz SRV-a (model, validator, formule) u `packages/editor-core/src/sheet/` (`model.ts`, `validate.ts`, `formula/`, `ops.ts` za dodaj/obriši redak i stupac, `golden-vectors.json` i `formula-vectors.json` **bajt-za-bajt isti** kao u SRV-u, test pariteta). Bez UI-ja i bez promjene postojećih datoteka editor-corea osim jednog retka izvoza u `packages/editor-core/src/index.ts`. Risk critical (putanja editor-core). Ovisi: SRV-V14-SHEET-MODEL, SRV-V14-SHEET-FORMULAS (vektori; spajanjem baze).
9. **WEB-V14-SHEET-GRID** (L). Mreža ćelija: `role="grid"`, tipkovnica (strelice, Enter, Tab, F2, Esc, Ctrl+Z), odabir raspona, traka formule, prikaz grešaka, listovi (kartice), stanja učitavanje/greška/prazno razdvojena; komponente iz `@ductura/ui`, bez vlastitih boja. Nova mapa `packages/app/src/host/editor/sheet/` (`SheetGrid.tsx`, `FormulaBar.tsx`, `SheetTabs.tsx`, `grid-model.ts`, `messages.hr.ts`, testovi, axe na 1250 i 400 px u `packages/app/e2e/sheet-grid.spec.ts`). Čitanje/pisanje kroz port koji WEB-V14-SHEET-JOURNAL spaja. Ovisi: WEB-V14-SHEET-CORE.
10. **WEB-V14-SHEET-JOURNAL** (L). Dnevnik i sinkronizacija za tablicu: koraci nad ćelijama u lokalnom dnevniku (Dexie), commit kroz `serverSync`, SYNCED samo uz potpisanu potvrdu, druga kartica i odjava kao za tekst, ponovno otvaranje daje isti dokument. Nove datoteke `packages/editor-core/src/sheet/steps.ts`, `packages/editor-core/src/journal/sheet-saver.ts` i `packages/editor-core/src/serverSync/sheet-sync.ts` (+ testovi: offline, redoslijed, sukob); u postojećim `local-document-saver.ts` i `serverSync/bootstrap.ts` samo po jedan redak razvrstavanja po `documentKind`. Risk critical. Ovisi: WEB-V14-SHEET-CORE, SRV-V14-SHEET-EVIDENCE.
11. **WEB-V14-KIND-FIELD** (S). Nastavnik u obrascu zadatka bira vrstu („Tekst” / „Tablica”), zaključano nakon prve predaje. Nova datoteka `packages/app/src/host/teacher/assignment-form/DocumentKindField.tsx` + port + test, jedan redak u `AssignmentForm.tsx`. Ovisi: SRV-V14-KIND.
12. **WEB-V14-SHEET-PAGE** (M). Početak rada i otvaranje stranice rada razvrstavaju po `documentKind`: tablica otvara `SheetGrid`, tekst editor kao dosad; pri pogrešci čitanja vrste prikaz „nedostupno”, ne „tekst”. Nova datoteka `packages/app/src/host/editor/sheet/SheetPage.tsx` + `kind-port.ts`; po jedan redak u `host/student/start-work/StartWork.tsx` i ulazu stranice rada. E2E `packages/app/e2e/sheet-student.spec.ts` (prijava lažnim OIDC-om kao `demo-student`, upis formule, osvježenje, isti zbroj). Ovisi: WEB-V14-SHEET-GRID, WEB-V14-SHEET-JOURNAL, WEB-V14-KIND-FIELD.
13. **WEB-V14-SHEET-SUBMIT** (M). Predaja tablice: korak sažetka prije predaje i prikaz potvrde pokazuju vrstu i broj listova/ćelija, bez ocjene i ranga; nastavnikov pregled rada za tablicu (samo čitanje mreže, bez uređivanja). Nova mapa `packages/app/src/host/student/submission/sheet/` i `packages/app/src/host/teacher/work/sheet/`; po jedan redak u `submission/summary/BeforeSubmitStep.tsx` i `teacher/work/pages.tsx`. Ovisi: SRV-V14-SHEET-SUBMIT, WEB-V14-SHEET-GRID.
14. **WEB-V14-SHEET-EXPORT** (S). Gumbi „Izvezi CSV” i „Izvezi .xlsx” uz stanja preuzimanja i greške. Nova mapa `packages/app/src/host/editor/sheet-export/` (`SheetExport.tsx`, `port.ts`, poruke, test), jedan redak montiranja u `SheetPage.tsx` (ili slijedno nakon WEB-V14-SHEET-PAGE). Ovisi: SRV-V14-SHEET-CSV, SRV-V14-SHEET-XLSX, WEB-V14-SHEET-PAGE.

## 4. Tablica za orkestratora

| ID | r | deps | paths |
|---|---|---|---|
| SRV-V14-KIND | M | – | `server/contracts/routes/document-kind.ts`, `server/http/document-kind/**`, `server/database/document-kind/**`, `db/main/migrations/<nova>`, pgTAP retci |
| SRV-V14-SHEET-MODEL | M | – | `server/domain/sheet/{schema,validate,index}.ts`, `server/domain/sheet/golden-vectors.json` |
| SRV-V14-SHEET-FORMULAS | L | SRV-V14-SHEET-MODEL | `server/domain/sheet/formula/**` |
| SRV-V14-SHEET-EVIDENCE | L | SRV-V14-KIND, SRV-V14-SHEET-MODEL | `server/contracts/routes/evidence.ts`, `server/domain/sheet/edit-step.ts`, `server/evidence/sheet/**` |
| SRV-V14-SHEET-SUBMIT | M | SRV-V14-SHEET-EVIDENCE | `server/evidence/submission/**`, `server/downloads/submission-package/**` |
| SRV-V14-SHEET-CSV | S | SRV-V14-SHEET-FORMULAS, SRV-V14-KIND | `server/contracts/routes/work-export-sheet-csv.ts`, `server/downloads/export/sheet-csv.ts`, `server/http/export/sheet-csv*` |
| SRV-V14-SHEET-XLSX | L | SRV-V14-SHEET-FORMULAS, SRV-V14-KIND | `server/contracts/routes/work-export-sheet-xlsx.ts`, `server/downloads/export/sheet-xlsx.ts`, `server/http/export/sheet-xlsx*` |
| WEB-V14-SHEET-CORE | L | SRV-V14-SHEET-MODEL, SRV-V14-SHEET-FORMULAS | `packages/editor-core/src/sheet/**` (osim `steps.ts`), `packages/editor-core/src/index.ts` (redak) |
| WEB-V14-SHEET-GRID | L | WEB-V14-SHEET-CORE | `packages/app/src/host/editor/sheet/{SheetGrid,FormulaBar,SheetTabs}.tsx`, `grid-model.ts`, `messages.hr.ts`, `packages/app/e2e/sheet-grid.spec.ts` |
| WEB-V14-SHEET-JOURNAL | L | WEB-V14-SHEET-CORE, SRV-V14-SHEET-EVIDENCE | `packages/editor-core/src/sheet/steps.ts`, `packages/editor-core/src/journal/sheet-saver.ts`, `packages/editor-core/src/serverSync/sheet-sync.ts` (+ po jedan redak u `local-document-saver.ts`, `serverSync/bootstrap.ts`) |
| WEB-V14-KIND-FIELD | S | SRV-V14-KIND | `packages/app/src/host/teacher/assignment-form/DocumentKindField.tsx` (+ redak u `AssignmentForm.tsx`) |
| WEB-V14-SHEET-PAGE | M | WEB-V14-SHEET-GRID, WEB-V14-SHEET-JOURNAL, WEB-V14-KIND-FIELD | `packages/app/src/host/editor/sheet/SheetPage.tsx`, `kind-port.ts`, `packages/app/e2e/sheet-student.spec.ts` (+ redak u `StartWork.tsx`) |
| WEB-V14-SHEET-SUBMIT | M | SRV-V14-SHEET-SUBMIT, WEB-V14-SHEET-GRID | `packages/app/src/host/student/submission/sheet/**`, `packages/app/src/host/teacher/work/sheet/**` (+ redci u `BeforeSubmitStep.tsx`, `pages.tsx`) |
| WEB-V14-SHEET-EXPORT | S | SRV-V14-SHEET-CSV, SRV-V14-SHEET-XLSX, WEB-V14-SHEET-PAGE | `packages/app/src/host/editor/sheet-export/**` (+ redak u `SheetPage.tsx`) |

Redoslijed: val A (paralelno) SRV-V14-KIND, SRV-V14-SHEET-MODEL → SRV-V14-SHEET-FORMULAS → SRV-V14-SHEET-EVIDENCE → SRV-V14-SHEET-SUBMIT, SRV-V14-SHEET-CSV, SRV-V14-SHEET-XLSX; WEB-V14-SHEET-CORE nakon formula; zatim GRID, JOURNAL, KIND-FIELD → PAGE → SUBMIT, EXPORT. Datoteke koje dira više zadataka (po jedan redak): `AssignmentForm.tsx` (KIND-FIELD), `StartWork.tsx` i `SheetPage.tsx` (PAGE, EXPORT slijedno), `local-document-saver.ts`, `serverSync/bootstrap.ts` (samo JOURNAL), `BeforeSubmitStep.tsx` i `pages.tsx` (samo WEB-V14-SHEET-SUBMIT).

## 5. Otvoreno

- Sažetak procesa za tablicu (što se mjeri) i hoće li nastavnik vidjeti dnevnik koraka ćelija jednako kao za tekst: odluka vlasnika, do tada samo broj koraka i trajanje (bez ocjene i ranga).
- DOCX/PDF izvoz tablice-bloka u tekstu ostaje otvoren (SRV-10A 2/2); ne ulazi u val 14.
- Pravo na usporedbu dvije revizije tablice po ćelijama (`work.compare.get`) nije u ovom valu.
- Zaključavanje izvora za .xlsx (zaštita lista, makroi) nije u opsegu: makroi su izričito isključeni.
