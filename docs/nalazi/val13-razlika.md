# Val 13: razlika (V13-PREGLED `val13-razlika`)

Datum: 24. 11. 2026. Pisac: `claude:wv13pregled:frontend`. Nalog: orkestrator, Ductus#2055 (komentar 7147313004), po NOVE-FUNKCIJE t. 8 (odluka vlasnika) i PLAN-MIGRACIJE val 13. **Samo dokumentacija; kod se ne mijenja.**

Pregledane baze:

| Repo | Grana | SHA |
|---|---|---|
| WEB `ductura/Institution_front_web_chrome` | `migracija/kopija-ductus-front` | `ff7d6798efbe1e0e5f87629ef79e5df5a2a6f5b3` |
| SRV `ductura/Institution_server` (javno) | `migracija/kopija-ductus-backend` | `abf94a9431fddc85631570b8d258816384bf18de` |

Prije svakog SRV zadatka provjeri vrh baze (`git ls-tree`), osobito za migracije (D-91).

## 1. Opseg vala 13

Vlastiti editor slajdova, bez novog repoa (plan, val 13: „isti temelji kao tekstni editor: lokalni dnevnik, revizija, potpis, predaja, potvrda i izvoz `.pptx`, PDF”):

1. model slajda i paket u webu;
2. lokalni dnevnik, revizija, potpis, predaja i potvrda kao kod tekstnog editora (polje `documentKind`, ako postoji);
3. izvoz `.pptx` i PDF;
4. pregled kod nastavnika.

Pravila za sve zadatke ispod: bez rangiranja studenata i bez automatskih sankcija; samo izmišljeni podaci; podaci samo kroz `/api/v1`; komponente iz `@ductura/ui`; vizualni smjer „papir i grafit”; tekst sučelja na hrvatskom; prijava samo AAI@EduHr; bez plaćenog API-ja i tuđih servisa (izvoz se radi postojećim lokalnim alatima servera, bez novog servisa); aplikacija živi **isključivo** u `packages/app/src/host/`.

## 2. Što već postoji

Pretraga `documentKind`, `document_kind`, `slide`, `pptx` u WEB-u i SRV-u: **0 stvarnih pogodaka** (ostaje samo plan i nepovezane riječi poput „slider”). **Polje `documentKind` ne postoji**; svaki rad je danas tekstni dokument.

### 2.1 Model dokumenta

| Stavka | Putanja | Napomena |
|---|---|---|
| Kanonski dokument (SRV) | `server/domain/document/{schema,validate,snapshot,revision-zero,edit-step,equality,normalize}.ts` | `schemaVersion` 1 do 4 (`DOCUMENT_SCHEMA_VERSION*`), popis blokova po verziji u jednoj `Map` (`DOCUMENT_BLOCK_TYPES_BY_VERSION`); sve su verzije **tekstni** dokument (`nodes`, `sources`, `cover`); zatvoren skup ključeva, nepoznato polje odbijeno (B-8); granica 2 MiB (`MAX_DOCUMENT_SNAPSHOT_BYTES`) |
| Ugovor sheme | `docs/contracts/document-schema-v3.md`, `document-schema-v4.md` | verzija je u bajtovima koji se sažimaju; „rad ima jednu verziju od revizije nula do predaje” |
| Model u klijentu (WEB) | `packages/editor-core/src/document/{document,json,diff,forensics,citation,text}` | zrcalo servera; kanonski JCS |
| Vrsta rada | SRV `institution.assignment.work_type` (`short_paper, essay, seminar_paper, bachelor_thesis, master_thesis, ...`, migracija `20261010200000_institution_assignment.sql`; `server/contracts/routes/faculty-rules.ts`) | to je vrsta **zadatka** (pravila fakulteta), ne vrsta dokumenta; slajd nije u popisu |
| Slajd, raspored slajda, bilješke govornika | **ne postoji** | ni tipovi ni validator ni koraci |

### 2.2 Lokalni dnevnik, revizija, potpis, predaja, potvrda

| Stavka | Putanja | Napomena |
|---|---|---|
| Lokalni dnevnik (Dexie) | `packages/editor-core/src/journal/atomic-dexie-journal.ts` (+ testovi odjave, dokaza, predaje) | vezan uz tekstni dokument i korake `ductus-edit-steps-v*` |
| Sinkronizacija | `packages/editor-core/src/{sync,serverSync}` | SYNCED samo uz potpisanu potvrdu |
| Otvaranje i spremanje na poslužitelju | `evidence.open.post`, `evidence.commit.post` (`server/contracts/routes/evidence.ts`) | odgovor `open` ima `schemaVersion` ∈ {1,2,3} (v4 u uniji ugovora **nije** naveden), `revisionZeroHash`, `document` (base64 JCS), `receiptKeys`; `commit` prima točno jedan segment i dokument, potpis Ed25519 (200) ili `pending_signature` (202); nema polja vrste dokumenta |
| Predaja | `submission.submit.post`, `submission.submit-second.post`, `student.submission-withdrawal.*`, `student.submission-history.get` (`evidence.ts`, `submissions.ts`) | potpisana potvrda predaje (`ductus-submission-receipt-v2`) |
| Rekonstrukcija i replay | `evidence.replay.post`, SRV `server/evidence/evidence-reconstruction.ts`, `submission-reconstruction.ts` | gradi tekstni dokument iz segmenata |
| Zapis i povijest verzija | `work.versions.get`, `work.version.get`, `work.restore.post`, `work.compare.get` (`versions.ts`, `time-machine.ts`, `work-compare.ts`) | usporedba je tekstna |
| Potvrda u PDF-u | `student.receipt-pdf.get`, `teacher.receipt-pdf.get` (`receipt-pdf.ts`) | ne ovisi o vrsti dokumenta |
| Paket predaje, prenosivi zapis | `server/downloads/submission-package/`, `server/downloads/portable-record/`; rute `submission-package.ts`, `portable-record.ts` | grade se iz snimke tekstnog dokumenta |
| WEB student | `packages/app/src/host/student/work.tsx`, `host/student/work/**`, `host/student/submission/**`, `host/editor/save-status/**` | jedan editor (Tiptap/ProseMirror shema) |

Nedostaje: bilo kakvo granjanje po vrsti dokumenta na otvaranju, u validatoru commita, u rekonstrukciji, u usporedbi i u paketu predaje.

### 2.3 Izvoz

| Stavka | Putanja | Napomena |
|---|---|---|
| DOCX | `server/downloads/export/{model,docx,work-docx}.ts`, ruta `work.export.get` (`work-export-docx.ts`: `GET /api/v1/works/{documentId}/export?format=docx&versionId=`) | deterministički (ZIP bez sažimanja, fiksno vrijeme), iz zamrznutog `ExportSnapshot` (`server/domain/export-snapshot`) |
| ZIP | `server/downloads/export/zip.ts` (`writeZip`) | deterministički; može nositi OOXML (`.pptx` je ZIP) |
| PDF | `server/downloads/export/pdf/{snapshot-pdf,libreoffice}.ts`, ruta `work.export-pdf.get` (`work-export.ts`: `GET /api/v1/assignments/{assignmentId}/works/{documentId}/export/pdf`) | DOCX → PDF kroz LibreOffice (Gotenberg na lokalnoj adresi, bez mreže); PDF/A-2u samo uz potvrdu veraPDF-a. `work.export.get?format=pdf` vraća 422 (nije spremno), PDF ide drugom rutom |
| `.pptx` | **ne postoji** | |
| WEB | `packages/app/src/host/editor/export/{PdfExport,preparation,pdf}.ts*`, `host/teacher/work/review/ExportPanel.tsx` | gumbi za PDF i pripremu tekstnog rada |

### 2.4 Pregled kod nastavnika

| Stavka | Putanja | Napomena |
|---|---|---|
| Čitanje rada | `teacher.work.get` (`teacher-work.ts`, bez teksta rada), `live.document.get` (`live.ts`), `work.version.get` | vraćaju tekstni dokument |
| Pregled i ponavljanje procesa | WEB `host/teacher/work/pages.tsx`, `host/teacher/work/review/**`, `host/teacher/n09/ReplayPage.tsx` | prikazuju tekst, komentare i proces teksta |
| Predaje, ocjena, povijest | `host/teacher/submissions/**` | ne ovisi o vrsti |
| Prikaz slajdova | **ne postoji** | |

## 3. Odluke i pretpostavke

- **Model:** novi, zasebni **kanonski dokument slajdova** (`documentKind: "slides"`, `schemaVersion` brojeći od 1 u svojoj liniji), ne proširenje tekstnih shema 1 do 4. Time se tekstni radovi ostaju bajt-jednaki (invarijanta ugovora v4). Sadržaj: `slides[]` s `id`, rasporedom iz zatvorenog popisa (naslovni, naslov i sadržaj, dva stupca, samo slika), blokovima (tekst: odlomak, popis, naslov; slika kroz postojeće privitke s hashom), bilješkama govornika; zatvoren skup ključeva, cijeli brojevi, JCS, ograničenja (broj slajdova, blokova, veličina snimke).
- **`documentKind` je dio revizije nula** (kao `schemaVersion`): određuje se pri pokretanju rada iz zadatka, nikad se ne mijenja, a server je uvijek šalje u odgovoru `evidence.open`. Zadatak (`institution.assignment`) dobiva stupac vrste dokumenta sa zadanim `text`; klijent bez polja tretira rad kao tekstni.
- **Koraci:** novi format koraka za slajdove (`ductus-slide-steps-v1`): dodaj/ukloni/premjesti slajd, promijeni raspored, postavi/ukloni blok, tekstualni korak u bloku, postavi bilješku. Potpis, lanac segmenata, SYNCED samo uz potpis i predaja koriste postojeći put bez izmjene formata potvrde.
- **Izvoz:** `.pptx` gradi se lokalno kao deterministički OOXML ZIP (`writeZip`), PDF iz tog `.pptx` kroz isti lokalni LibreOffice/Gotenberg (bez tuđih servisa). Nova ruta u novoj datoteci ugovora, ne širenje `work.export.get`.
- **Nastavnik:** čitanje bez izmjene, bez rangiranja i bez oznaka; usporedba i ponavljanje po reviziji kao jedini prikaz procesa.
- **Kritično:** zadaci koji diraju kanonski model, validator commita i rekonstrukciju su `Risk: critical` (kao PIL-K-SHEMA-V3); krug ih ne spaja automatski, nego tek uz presudu ODOBRENO.
- **Nije u opsegu:** animacije, prijelazi, ugrađeni video/zvuk, zajednički rad uživo, predlošci fakulteta, uvoz `.pptx`. Paket predaje i prenosivi zapis za slajdove (`server/downloads/submission-package`, `portable-record`) nisu u 14 zadataka: ostaju otvoreni za idući krug (§5).

## 4. Zadaci koji nedostaju (14)

Oznake: S ≤ ~120 redaka koda, M ≤ ~400. **Ugovori servera prije weba:** SRV-V13-UGOVOR-VRSTA i SRV-V13-RUTA-IZVOZ; izvadak ugovora u WEB-u (`src/client/migration-contract*.generated.*`) dopunjuje orkestrator, pisac ga ne uređuje ručno. **Datoteke ugovora:** svaka datoteka ugovora ima točno jednog vlasnika: `server/contracts/routes/evidence.ts`, `assignments.ts`, `live.ts`, `time-machine.ts` (samo SRV-V13-UGOVOR-VRSTA) i nova `work-export-slides.ts` (samo SRV-V13-RUTA-IZVOZ). Zajedničke točke (po jedan redak, svaka u jednom zadatku): `server/contracts/routes/index.ts` i `server/http/index.ts` (RUTA-IZVOZ), `server/domain/index.test.ts` (UGOVOR-SLAJD), `server/database/index.ts` (EVIDENCE-SLAJD ako treba), `host/student/work.tsx` (WEB-V13-UREDNIK), `host/teacher/work/pages.tsx` (WEB-V13-NASTAVNIK).

### Server

1. **SRV-V13-UGOVOR-SLAJD** (M, critical). Ugovor `docs/contracts/slides-v1.md` i čista domena: tipovi, validator (zatvoren skup, cijeli brojevi, granice, hash slike), snimka (JCS), revizija nula, jednakost. Golden vektori. Nema API-ja. Nova polja: nema. Veličina: M. Ovisi o: ništa. Putanje: `docs/contracts/slides-v1.md`, `server/domain/slides/{schema,validate,snapshot,revision-zero,index}.ts` + testovi i `server/domain/slides/golden-vectors-v1.json`; `server/domain/index.test.ts` (1 redak).
2. **SRV-V13-KORACI-SLAJD** (M, critical). Format koraka `ductus-slide-steps-v1` (dodaj, ukloni, premjesti slajd; raspored; postavi/ukloni blok; tekstni korak; bilješka), primjena koraka na snimku i svojstveni testovi (redoslijed, idempotencija, nepoznat korak odbijen). Nema API-ja. Veličina: M. Ovisi o: SRV-V13-UGOVOR-SLAJD. Putanje: `server/domain/slides/{steps,apply}.ts` + `steps.test.ts`, `steps.property.test.ts`.
3. **SRV-V13-MIG-VRSTA** (S). Migracija: stupac vrste dokumenta zadatka (`text` | `slides`, zadano `text`, CHECK), čitanje kroz postojeće funkcije, `start` rada upisuje vrstu u reviziju nula; RLS bez promjene pristupa, pgTAP retci za oba ishoda i tuđi zadatak. Nova polja API-ja: nema (samo baza). Veličina: S. Ovisi o: ništa. Putanje: `db/main/migrations/<verzija iza vrha baze>_assignment_document_kind.sql`, `db/main/migrations.sum` (generirano), `db/main/tests/030-institution-access-matrix.sql` (retci).
4. **SRV-V13-UGOVOR-VRSTA** (M, critical). Jedini vlasnik ugovora vrste: `documentKind: "text" | "slides"` u zadatku (stvaranje i čitanje), u odgovoru `evidence.open.post` (obavezno), u `live.document.get` i `work.version.get` (obavezno u odgovoru; nepoznata vrijednost = 422). `schemaVersion` u `open` ostaje za tekstne radove; za slajdove se šalje `slidesSchemaVersion`. Nove rute: nema. Vektori i generirani ugovori se regeneriraju. Veličina: M. Ovisi o: SRV-V13-MIG-VRSTA, SRV-V13-UGOVOR-SLAJD. Putanje: `server/contracts/routes/{evidence,assignments,live,time-machine}.ts`, `server/contracts/vectors/*.json`, `server/contracts/generated/**`, `openapi/v1.json`, rukovatelji koji ta polja pune (`server/http/**` samo za ta polja) + testovi.
5. **SRV-V13-EVIDENCE-SLAJD** (M, critical). Grananje po vrsti pri `evidence.commit.post`, `evidence.replay.post` i rekonstrukciji: za `slides` validira se segment i dokument validatorom i koracima slajdova, jednak potpis, lanac i potvrda; tekstni put netaknut. Odbijanje: korak tekstnog formata na slajdovima (422 `document_mismatch`), slajdovi na tekstnom radu, tuđi rad (404). Nema novih ruta ni polja (polja daje UGOVOR-VRSTA). Veličina: M. Ovisi o: SRV-V13-KORACI-SLAJD, SRV-V13-UGOVOR-VRSTA. Putanje: `server/evidence/slides/{commit-dispatch,reconstruct}.ts` + testovi (nova mapa); jedan redak u `server/evidence/ingest/` gdje se bira validator (točnu datoteku utvrđuje pisac pri radu i navodi u PR-u).
6. **SRV-V13-IZVOZ-PPTX** (M). Iz zamrznute snimke slajdova gradi se deterministički `.pptx` (OOXML: prezentacija, slajdovi, rasporedi, bilješke, slike s provjerom hasha; `writeZip`), isti ulaz daje iste bajtove. Rječnik izvoza iz kataloga poruka. Nema API-ja. Veličina: M. Ovisi o: SRV-V13-UGOVOR-SLAJD. Putanje: `server/downloads/export/slides-model.ts`, `server/downloads/export/pptx.ts`, `server/downloads/export/pptx.test.ts`; `locales/hr.ts` i `locales/en.ts` samo svoj odjeljak.
7. **SRV-V13-IZVOZ-PDF-SLAJD** (M). PDF iz izrađenog `.pptx` kroz isti lokalni pretvarač kao DOCX (`localPdfConverter`), bez nove mrežne ovisnosti; PDF/A oznaka samo uz potvrdu veraPDF-a kao i sada. Istek i greška pretvorbe kao zasebna stanja. Nema API-ja. Veličina: M. Ovisi o: SRV-V13-IZVOZ-PPTX. Putanje: `server/downloads/export/pdf/slides-pdf.ts`, `server/downloads/export/pdf/slides-pdf.test.ts`.
8. **SRV-V13-RUTA-IZVOZ** (S). Nova ruta `work.export-slides.get`: `GET /api/v1/works/{documentId}/export-slides?format=pptx|pdf&versionId=` (isti pristup kao `work.export.get`: vlasnik ili nastavnik kolegija; nastavnikovo čitanje piše u dnevnik pristupa); zaglavlja `x-export-snapshot-sha256` i `content-disposition`; tuđi, nepoznat i netekstni-slajdovski rad i nepoznata verzija: 404; `format` izvan popisa: 422. Veličina: S. Ovisi o: SRV-V13-IZVOZ-PPTX, SRV-V13-IZVOZ-PDF-SLAJD, SRV-V13-UGOVOR-VRSTA. Putanje: `server/contracts/routes/work-export-slides.ts` (novo, jedini vlasnik), `server/contracts/vectors/work.export-slides.get.json`, `server/http/work-export-slides/index.ts`, generirano; po jedan redak u `server/contracts/routes/index.ts` i `server/http/index.ts`; retci u `server/contracts/contracts.test.ts`, `tests/contracts/contract-only.test.ts`, `tests/db/logout-old-cookie.integration.test.ts` i lažni dev server (`packages/test-fakes/dev-server`) po uputi o fiksnim testovima.

### Web

9. **WEB-V13-MODEL-KLIJENT** (M, critical). Zrcalo modela slajdova u klijentu: tipovi, validator, JCS snimka, primjena koraka, čitanje `documentKind` iz odgovora `open`; paritetni test s golden vektorima servera (isti bajtovi i hash). Nema API-ja. Veličina: M. Ovisi o: SRV-V13-KORACI-SLAJD (vektori), SRV-V13-UGOVOR-VRSTA (izvadak). Putanje: `packages/editor-core/src/slides/{model,validate,steps,json,index}.ts` + testovi i `golden-vectors-v1.json` (kopija); izvoz kroz novi `./slides` u `packages/editor-core/package.json` (1 redak).
10. **WEB-V13-UREDNIK** (M). Platno slajda i popis slajdova: dodaj/ukloni/premjesti slajd, odabir rasporeda, uređivanje teksta u okviru, bilješke govornika, poništi/ponovi; samo komponente iz `@ductura/ui`, izgled „papir i grafit”. Svaka izmjena je korak (`ductus-slide-steps-v1`). Stanja: učitavanje, greška (ne „nema podataka”), rad predan (samo čitanje). Pri `documentKind: "slides"` stranica rada prikazuje ovaj editor, inače postojeći. Nema API-ja. Veličina: M. Ovisi o: WEB-V13-MODEL-KLIJENT. Putanje: `packages/app/src/host/slides/editor/{SlideEditor,SlideCanvas,SlideList,NotesField,messages.hr}.ts*` + testovi; `host/student/work.tsx` (1 redak grananja po vrsti).
11. **WEB-V13-DNEVNIK-SINKRONIZACIJA** (M, critical). Lokalni dnevnik, revizije i spremanje slajdova kroz postojeći dnevnik i `serverSync` (isti način, druga vrsta dokumenta): `evidence.open` s `start`, commit segmenta, SYNCED samo uz potpisanu potvrdu, druga kartica blokirana, odjava briše lokalni dnevnik, stanje „Spremljeno na uređaju” bez mreže. Bez obilaženja tipova generiranog klijenta. Nema novih ruta. Veličina: M. Ovisi o: WEB-V13-MODEL-KLIJENT, SRV-V13-EVIDENCE-SLAJD. Putanje: `packages/app/src/host/slides/sync/{slides-saver,use-slides-session,recovery}.ts` + testovi; uski dodaci u `packages/editor-core/src/journal/**` samo ako dnevnik ne podržava drugi tip dokumenta (navesti u PR-u pod „Pretpostavke”).
12. **WEB-V13-PREDAJA** (M). Predaja slajdova na isti način kao tekst: provjera zahtjeva zadatka (broj slajdova), izjava, `submission.submit.post`, potvrda s potpisom i zasebno stanje „predano”; povlačenje i povijest predaja kao za tekst. Nema novih ruta. Veličina: M. Ovisi o: WEB-V13-DNEVNIK-SINKRONIZACIJA. Putanje: `packages/app/src/host/slides/submit/{SlidesSubmit,requirements,messages.hr}.ts*` + testovi.
13. **WEB-V13-IZVOZ** (M). Gumbi „Preuzmi .pptx” i „Preuzmi PDF” za slajdove studenta i nastavnika kroz `work.export-slides.get`; stanja priprema/spremno/greška/isteklo, ime datoteke iz naslova, prikaz sažetka snimke (`x-export-snapshot-sha256`); bez izvoza dok server nije potvrdio zadnju reviziju. Nova polja: nema (čita ruta iz RUTA-IZVOZ). Veličina: M. Ovisi o: SRV-V13-RUTA-IZVOZ, WEB-V13-UREDNIK. Putanje: `packages/app/src/host/slides/export/{SlidesExport,export-model,messages.hr}.ts*` + testovi.
14. **WEB-V13-NASTAVNIK-PREGLED** (M). Nastavnik čita slajdove rada (samo čitanje): popis i prikaz slajda s bilješkama, odabir revizije, ponavljanje procesa po reviziji, usporedba dviju revizija na razini slajdova (dodano/uklonjeno/promijenjeno; bez ocjenjivanja i bez oznaka). Čita `live.document.get` i `work.version.get` s poljem `documentKind`; tuđi rad 404. Uključen izvoz iz WEB-V13-IZVOZ. Veličina: M. Ovisi o: WEB-V13-MODEL-KLIJENT, WEB-V13-IZVOZ, SRV-V13-UGOVOR-VRSTA. Putanje: `packages/app/src/host/teacher/slides/{SlidesReview,SlideDiff,model,messages.hr}.ts*` + testovi; `host/teacher/work/pages.tsx` (1 redak grananja po vrsti).

Završni e2e (`e2e/val13-razlika.spec.js`: student stvara slajdove, sinkronizira, predaje, izvozi; nastavnik čita; axe 1250 i 400 px) ide kao dio WEB-V13-NASTAVNIK-PREGLED ili kao 15. zadatak ako orkestrator odluči za zaseban (ovaj popis drži najviše 14).

## 5. Redoslijed i preklapanja

```
SRV-UGOVOR-SLAJD ─┬→ SRV-KORACI-SLAJD ─┬→ SRV-EVIDENCE-SLAJD ──→ WEB-DNEVNIK-SINKRONIZACIJA → WEB-PREDAJA
                  │                    └→ WEB-MODEL-KLIJENT ─┬→ WEB-UREDNIK ─┬→ WEB-IZVOZ ─┐
                  ├→ SRV-IZVOZ-PPTX → SRV-IZVOZ-PDF-SLAJD → SRV-RUTA-IZVOZ ────┘             ├→ WEB-NASTAVNIK-PREGLED
SRV-MIG-VRSTA ───→ SRV-UGOVOR-VRSTA (ugovor prije weba) ───────────────────────────────────────┘
```

- Prvi val (bez ovisnosti): SRV-V13-UGOVOR-SLAJD, SRV-V13-MIG-VRSTA.
- Dvije datoteke ugovora u istom zadatku imaju samo UGOVOR-VRSTA (jedan vlasnik); RUTA-IZVOZ ima novu datoteku.
- Zajedničke točke svaka u jednom zadatku (popis u §4); konflikt rješava spajanjem baze onaj koji dolazi kasnije.

## 6. Otvoreno i granice

- **Paket predaje i prenosivi zapis za slajdove** (`server/downloads/submission-package`, `portable-record`) i **usporedba** `work.compare.get` za slajdove na serveru nisu u 14 zadataka; WEB nastavnik gradi usporedbu u klijentu iz dviju snimaka. Prijedlog za idući krug: SRV-V13-PAKET.
- **Točno mjesto grananja validatora** u `server/evidence/ingest/**` utvrđuje pisac SRV-V13-EVIDENCE-SLAJD; datoteka nije potvrđena ovim pregledom.
- **Točna ruta stvaranja zadatka** i ime ključa vrste u `server/contracts/routes/assignments.ts` utvrđuje pisac UGOVOR-VRSTA (pretraga `workType` u toj datoteci nije dala pogodak; vrsta rada živi u `faculty-rules.ts`).
- **Hoće li `contracts:breaking` odbiti obavezno polje `documentKind` u odgovorima:** ako da, gradi na postojećem ugovoru uz polje kao neobavezno za tekstne radove i upiši pod „Otvoreno za vlasnika”.
- **Granice veličine i broja slajdova, popis rasporeda i tekst obavijesti** postavlja ugovor `slides-v1.md`; vlasnik potvrđuje u pregledu ugovora (odluka vlasnika).
- Sa stvarnim studentima ništa ne ide prije pilota; do tada samo izmišljeni podaci.

## 7. Tablica za orkestratora

| ID | r | deps | paths |
|---|---|---|---|
| SRV-V13-UGOVOR-SLAJD | M | - | `docs/contracts/slides-v1.md`, `server/domain/slides/{schema,validate,snapshot,revision-zero,index}.ts` + testovi + golden, `server/domain/index.test.ts` (1 redak) |
| SRV-V13-KORACI-SLAJD | M | SRV-V13-UGOVOR-SLAJD | `server/domain/slides/{steps,apply}.ts` + testovi |
| SRV-V13-MIG-VRSTA | S | - | `db/main/migrations/<iza vrha>_assignment_document_kind.sql`, `db/main/migrations.sum`, `db/main/tests/030-institution-access-matrix.sql` (retci) |
| SRV-V13-UGOVOR-VRSTA | M | SRV-V13-MIG-VRSTA, SRV-V13-UGOVOR-SLAJD | `server/contracts/routes/{evidence,assignments,live,time-machine}.ts` (jedini vlasnik), vektori, generirano, `server/http/**` (samo polja) |
| SRV-V13-EVIDENCE-SLAJD | M | SRV-V13-KORACI-SLAJD, SRV-V13-UGOVOR-VRSTA | `server/evidence/slides/**`, 1 redak u `server/evidence/ingest/**` |
| SRV-V13-IZVOZ-PPTX | M | SRV-V13-UGOVOR-SLAJD | `server/downloads/export/{slides-model,pptx}.ts` + test, `locales/*` (svoj odjeljak) |
| SRV-V13-IZVOZ-PDF-SLAJD | M | SRV-V13-IZVOZ-PPTX | `server/downloads/export/pdf/slides-pdf.ts` + test |
| SRV-V13-RUTA-IZVOZ | S | SRV-V13-IZVOZ-PPTX, SRV-V13-IZVOZ-PDF-SLAJD, SRV-V13-UGOVOR-VRSTA | `server/contracts/routes/work-export-slides.ts` (novo), vektori, `server/http/work-export-slides/index.ts`, generirano, `server/contracts/routes/index.ts` i `server/http/index.ts` (po 1 redak), fiksni testovi ruta, `packages/test-fakes/dev-server` |
| WEB-V13-MODEL-KLIJENT | M | SRV-V13-KORACI-SLAJD, SRV-V13-UGOVOR-VRSTA | `packages/editor-core/src/slides/**`, `packages/editor-core/package.json` (izvoz, 1 redak) |
| WEB-V13-UREDNIK | M | WEB-V13-MODEL-KLIJENT | `packages/app/src/host/slides/editor/**`, `host/student/work.tsx` (1 redak) |
| WEB-V13-DNEVNIK-SINKRONIZACIJA | M | WEB-V13-MODEL-KLIJENT, SRV-V13-EVIDENCE-SLAJD | `packages/app/src/host/slides/sync/**` (+ uski dodaci `packages/editor-core/src/journal/**` ako treba) |
| WEB-V13-PREDAJA | M | WEB-V13-DNEVNIK-SINKRONIZACIJA | `packages/app/src/host/slides/submit/**` |
| WEB-V13-IZVOZ | M | SRV-V13-RUTA-IZVOZ, WEB-V13-UREDNIK | `packages/app/src/host/slides/export/**` |
| WEB-V13-NASTAVNIK-PREGLED | M | WEB-V13-MODEL-KLIJENT, WEB-V13-IZVOZ, SRV-V13-UGOVOR-VRSTA | `packages/app/src/host/teacher/slides/**`, `host/teacher/work/pages.tsx` (1 redak), `e2e/val13-razlika.spec.js` |

Neutvrđeno pri pisanju: datoteka grananja validatora u `server/evidence/ingest/**`, točna ruta i polje stvaranja zadatka te ponašanje `contracts:breaking` za obavezno polje `documentKind` (vidi §6).
