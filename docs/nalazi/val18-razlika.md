# Val 18: razlika (V18-PREGLED `val18-razlika`: upitnici i kvalitativno kodiranje)

Datum: 24. 11. 2026. Pisac: `claude:wv18pregled:frontend`. Nalog: orkestrator, Ductus#2055 (komentar 7147315835), po odluci vlasnika („Može, idemo na sve valove”; `ductura/.github` `docs/plan/NOVE-FUNKCIJE.md` t. 8, PR #85; `PLAN-MIGRACIJE.md` val 18). **Samo dokumentacija; kod se ne mijenja.** Oblik po uzoru na `docs/nalazi/val19-razlika.md`.

Oznake: nalazi **V18-n**, otvorena pitanja **OP-V18-n**, zadaci `SRV-V18-<NAZIV>` i `WEB-V18-<NAZIV>`.

## 0. Izvori i ograničenja

| Repo | Grana | SHA |
|---|---|---|
| WEB `ductura/Institution_front_web_chrome` | `migracija/kopija-ductus-front` | `ff7d6798efbe1e0e5f87629ef79e5df5a2a6f5b3` (#643) |
| SRV `ductura/Institution_server` (javno) | `migracija/kopija-ductus-backend` | `abf94a9431fddc85631570b8d258816384bf18de` (#702) |

Pročitano: `packages/app/src/host/` (student, teacher), `src/client/`, `locales/hr.ts`, `docs/nalazi/*`, `docs/plan/PLAN-MIGRACIJE.md` (val 15, 18, 21, „Proširenja nakon pilota”), SRV `server/contracts/routes/*.ts` (popis svih datoteka po nazivu, relevantne u cijelosti), `server/domain/`, `db/main/migrations/` (zadnja `20261218100000_origin_segments.sql`), `db/main/tests/` (zadnji `246-origin-segments.sql`), `docs/contracts/`. Kanonski opis (Ductus#2028, c.7008147932): „Zajednička pravila” i „Trake”; zadatka V18-PREGLED u njemu nema, opis je iz naloga.

Izričito nije učinjeno: aplikacija ni poslužitelj nisu pokrenuti (nema baze ni Dockera), sve je iz čitanja koda i ugovora; `NOVE-FUNKCIJE.md` nije čitan (oblak nema pristup `ductura/.github`); navodi iz `PLAN-MIGRACIJE.md` (val 18 r. 81, r. 91) su iz **SRV kopije** `docs/plan/PLAN-MIGRACIJE.md`, WEB kopija nema redak vala 18; Ustav, PRODUCT §5 i rječnik zabranjenih izraza nisu čitani u izvorniku; nisu provjereni PR-ovi otvoreni nakon gornjih SHA-ova. Svi primjeri su izmišljeni.

Pravila za sve zadatke (ne pitaju se ponovno): prijava samo AAI@EduHr (D-09, D-16); bez rangiranja studenata i bez automatskih sankcija; samo izmišljeni podaci, stvarni ispitanici tek po DPIA-i; bez plaćenog API-ja i tuđih servisa; nema statističkog servisa (val 15 ne postoji, izvoz je samo priprema); AI ne kodira (vidi V18-3); tuđe, nepoznato i neispravno je isti 404 (C-23); tekst sučelja na hrvatskom; podaci samo kroz `/api/v1`; komponente iz `@ductura/ui`; aplikacija samo u `packages/app/src/host/`.

## 1. Sažetak razlike

| Funkcija | Što već postoji | Što nedostaje |
|---|---|---|
| 1. Izrada i ispunjavanje upitnika | ništa vlastito. Pretraga `upitnik`, `questionnaire`, `survey` u SRV i WEB daje samo nepovezane pogotke (riječ u testu pregleda teksta, tekst zabrane AI-ja) | **sve**: upitnik, pitanja, objava, ispunjavanje, jednokratnost, ekrani |
| 2. Izvoz odgovora (priprema za val 15) | izvoz je rađen samo za rad (`work.export.get` DOCX, `work.export-pdf.get`), Merlin (`teacher.merlin-*`), predaju i podatke studenta; nijedan ne nosi tablicu odgovora | **sve**: oblik `questionnaire-export-v1`, ruta, zadržavanje privatnosti, preuzimanje |
| 3. Kvalitativno kodiranje intervjua i bilješki | privatne bilješke uz izvor (`work.source-notes.*`), bilješke mentora (`mentorship.notes.*`), komentari sa sidrom u tekstu rada (`collaboration.comments.post`), priprema razgovora o radu (`work.interview.*`, N-14) | **sve vlastito**: gradivo za kodiranje (tekst intervjua), šifrarnik kodova, označeni odlomci, izvoz kodiranja |

## 2. Što već postoji

### 2.1 Baza WEB (`migracija/kopija-ductus-front`)

| Područje | Putanje | Napomena za val 18 |
|---|---|---|
| Uzorak ekrana s portom | `host/teacher/provenance/` (`ProvenanceMap.tsx`, `model.ts`, `contract.ts`, `no-direct-api.test.ts`, `messages.hr.ts`), `host/student/interview/` (`port.ts`, `fake-port.ts`, `model.ts`, `StudentInterview.tsx`, `no-direct-api.test.ts`), `host/student/portfolio/` (`PortfolioExport.tsx`, `port.ts`) | oblik novih ekrana: stranica, `model.ts`, `port.ts`, `fake-port.ts`, `messages.hr.ts`, test `no-direct-api` |
| Preuzimanje datoteke | `host/student/portfolio/PortfolioExport.tsx` (izvoz za portfelj: PDF po predanoj verziji), `host/editor/export/PdfExport` | obrazac gumba „Preuzmi” za izvoz; za JSON/CSV ne postoji klijentski pisac datoteke |
| Privatne bilješke uz izvor | `host/student/read/`, `host/editor/right/` (izvori i bilješke) | polazište izgleda; **ne diraju se** |
| Ruta i okvir | `packages/app/src/routes.ts`, `host/pages.tsx`, `host/ljuska-po-ekranu.ts` (`SCREEN_FRAMES`) | zajednički retci za svaku novu stranicu |
| Klijent ugovora | `src/client/api.ts` (`callMigrationRoute`), `migration-contracts.generated.json` i srodni izvadak | izvadak ne uređuje pisac; orkestrator ga dopunjuje iz SRV baze. **U izvatku nema** nijedne operacije za upitnik ni kodiranje; WEB zadaci čekaju (`drzi=izvadak-srv-n`) |
| Postojeća pravila u tekstu | `host/student/i18n/messages.hr.ts` r. 135 (isti tekst u `src/lib/i18n/messages.hr.ts`) | pomoćnik ne smije „generirati i kodirati kvalitativne i kvantitativne podatke” osim ako to nastavnik izričito zada |

### 2.2 Baza SRV (`migracija/kopija-ductus-backend`)

| Područje | Putanje i rute | Napomena za val 18 |
|---|---|---|
| Klase pristupa ruta | `access`: `course_teacher` (75 ruta), `student_enrolled` (28), `student` (7), `student_owner` (34), `signed_in` (36), `teacher` (12) | autor upitnika `course_teacher`, ispunjavanje `student_enrolled`, kodiranje `student`; nova klasa se ne uvodi |
| Sidro u tekstu | `server/contracts/routes/collaboration.ts` (`TextAnchor`: `nodeId`, `quote` 1–500, `prefix`/`suffix` ≤ 64, `startHint`, `endHint`) | uzorak sidra za označeni odlomak; kod gradiva sidro je odlomak i pomak, ne čvor dokumenta |
| Bilješke | `mentor-notes.ts` (`mentorship.notes.get|post`, tijelo 1–4000 znakova, privatno mentoru), `source-notebook.ts` (`work.source-notes.get|post|patch|delete`, najviše 100 po izvoru) | uzorak privatnog zapisa; **nisu** gradivo za kodiranje (vezane uz mentorstvo i izvor) |
| Razgovor o radu | `work-interview.ts` (`work.interview.get`, `…-questions.post|delete`, `…-invite.post`, `…-appointment.put`, `…-held.post`, `…-explanations.post`, `…-notes.post`) | to je priprema razgovora nastavnika sa studentom o njegovu radu (SRV-1530): **nije** istraživački intervju i ne smije se miješati s val 18; schema namjerno nema ishod ni sumnju |
| Izvozi | `work-export-docx.ts` (`work.export.get`), `work-export.ts` (`work.export-pdf.get`), `merlin-roster.ts` (`teacher.merlin-roster.get`, `…-csv.get`), `student-data-export.ts`, `portable-record.ts`, `downloads.ts`; `server/domain/export-snapshot/` | **format ugovora nema tekstualno tijelo**: CSV ruta Merlina deklarira samo zaglavlja (komentar u `merlin-roster.ts` r. 15–17, otvorena stavka formata). Zato izvoz vala 18 vraća JSON, a CSV gradi web (V18-6) |
| Zajednički retci gradnje | `server/contracts/routes/index.ts`, `server/contracts/inventory.ts`, `server/contracts/contracts.test.ts`, `tests/contracts/contract-only.test.ts`, `server/http/index.ts`, `server/database/index.ts`, `server/domain/index.test.ts`, `db/main/migrations.sum`, `db/main/tests/030-institution-access-matrix.sql`, `packages/test-fakes/dev-server`, `tests/db/logout-old-cookie.integration.test.ts`, `db/main/local/seed.sql` | po pravilima iz naloga |
| Primjer ugovora s odlukama | `docs/contracts/origin-segments-v1.md`, `provenance-share-v1.md`, `thesis-v1.md` | uzorak dokumenta ugovora za izvoz |
| Pretpostavka plana | SRV kopija `PLAN-MIGRACIJE.md` r. 81: „Upitnik šalje podatke izravno u statistički servis”; r. 91: servis se otvara tek kad val 15 krene | taj servis ne postoji; v. V18-5 |

## 3. Nalazi razlike

**V18-1. Odgovori ne smiju imati ime.** Ispitanik se prijavljuje samo AAI@EduHr (D-09), pa upitnik ne može doći do vanjskih ispitanika, a tko je ispunio ne smije biti vezan uz sadržaj odgovora. Prijedlog: dvije odvojene tablice: **sudjelovanje** (upitnik, osoba; samo za jednokratnost) i **odgovori** (bez osobe; datum bez vremena). Veza se ne može čitati kroz RLS ni kroz izvoz. Ostaje rizik povezivanja po redoslijedu; ublažava ga izvoz u poretku po sažetku identifikatora, ne po vremenu (V18-4).

**V18-2. Autor upitnika je nastavnik kolegija, ne student.** Studentsko anketiranje drugih studenata traži etičko odobrenje i DPIA (OP-V18-3). U ovom valu nastavnik (`course_teacher`) izrađuje upitnik za svoj kolegij, a upisani studenti ga ispunjavaju. Student kodira vlastito gradivo (V18-7).

**V18-3. AI ne kodira.** Tekst u `messages.hr.ts` zabranjuje pomoćniku „generiranje i kodiranje kvalitativnih podataka”. Zato nema prijedloga kodova, automatskog označavanja ni sažimanja gradiva; šifrarnik i oznake piše samo osoba. Ni jedna ruta vala 18 ne zove pomoćnika.

**V18-4. Izvoz je priprema za val 15, bez servisa.** `questionnaire-export-v1` je JSON s opisom varijabli i retcima odgovora; isti ulaz daje iste bajtove (ponovljivost, plan val 15). Slobodni tekst je izvan izvoza dok autor izričito ne potvrdi (može identificirati). Uvjet najmanjeg broja odgovora (OP-V18-4). Nikad izvoz po ispitaniku s ocjenom, rang ili zbroj bodova osobe.

**V18-5. „Šalje podatke izravno u statistički servis” nije moguće ni dopušteno sada.** Servis i repo ne postoje (plan r. 91), a tuđi servis zahtijeva pristanak. Val 18 radi samo izvoz; slanje ostaje za val 15 i ne ulazi ni u jedan zadatak.

**V18-6. CSV gradi web.** Ugovorni format nema tekstualno tijelo (§2.2, redak „Izvozi”), pa SRV vraća JSON, a web iz njega piše CSV (UTF-8, jedan redak po ispitaniku, stupac po pitanju, prazno = bez odgovora). Isto za izvoz kodiranja.

**V18-7. Gradivo kodiranja je novo.** Postojeće bilješke su vezane uz mentorstvo ili izvor i imaju gornju granicu od nekoliko tisuća znakova. Gradivo je zaseban zapis (naslov, vrsta intervju | bilješka, tekst do 100 000 znakova, upisan ili zalijepljen; **bez zvuka i bez automatskog prepisa**), nepromjenjiv nakon prvog kodiranja (izmjena je novo gradivo). Sidro označenog odlomka: odlomak, pomak početka i kraja, citat 1–500 znakova (po uzorku `TextAnchor`).

**V18-8. Redoslijed kodova nikad po učestalosti.** Šifrarnik se ispisuje redoslijedom koji je odredio autor; zbrojevi po kodu postoje kao opis, bez poretka po broju, bez „najčešće” i bez usporedbe materijala.

**V18-9. Kodiranje je privatno vlasniku.** Nastavnik i mentor ga ne čitaju (OP-V18-5 o dijeljenju). Izvoz čita samo vlasnik. Tuđe je 404.

## 4. Otvorena pitanja (ne blokiraju zadatke; zapisane su pretpostavke)

- **OP-V18-1.** Pravna snaga i DPIA za stvarne ispitanike: do odluke samo izmišljeni podaci; seed i testovi koriste `demo-*`.
- **OP-V18-2.** Naziv ustanovnog tijela koje odobrava istraživanje (etičko povjerenstvo) i treba li upitnik imati polje „odobrenje”. Pretpostavka: nema polja u ovom valu.
- **OP-V18-3.** Studentski upitnici (autor student, ispitanici studenti): odgođeno do etičkog odobrenja; ide kao zaseban zadatak ako vlasnik odobri.
- **OP-V18-4.** Najmanji broj odgovora za izvoz. Pretpostavka: imenovana konstanta `QUESTIONNAIRE_EXPORT_MIN_RESPONSES = 5`; vlasnik potvrđuje vrijednost.
- **OP-V18-5.** Dijeljenje kodiranja s nastavnikom ili mentorom (samo čitanje). Pretpostavka: nema.
- **OP-V18-6.** Kodiranje dvoje kodera i mjera slaganja: izvan vala 18.
- **OP-V18-7.** Slanje u statistički servis (val 15): kad servis i licenca postoje.

## 5. Popis zadataka (14)

Veličina: S ≤ 100, M ≤ 250, L ≤ 400 redaka koda. Procjena po usporedivom ugovoru `work-interview` (7 operacija ≈ 235 redaka ugovora + 191 redak adaptera, bez testova): **najviše 5 operacija po zadatku** (ugovor + adapter + testovi ≈ 400). Generirane datoteke, `migrations.sum` i izvadci ugovora ne broje se. Imena operacija slijede konvenciju SRV baze `<domena>.<resurs>.<metoda>` (`teacher.*`, `student.*`), putanje prefiks po ulozi `/api/v1/teacher/…` i `/api/v1/student/…`.

Zajednički retci koje svaki zadatak dodaje samo za sebe (po pravilima iz naloga): SRV `server/contracts/routes/index.ts`, `server/contracts/inventory.ts`, `server/contracts/contracts.test.ts`, `server/contracts/fake-server.integration.test.ts`, `tests/contracts/contract-only.test.ts`, `server/http/index.ts`, `server/database/index.ts`, `server/domain/index.test.ts`, `packages/test-fakes/dev-server`, `tests/db/logout-old-cookie.integration.test.ts`, `db/main/tests/030-institution-access-matrix.sql`; WEB `packages/app/src/routes.ts`, `packages/app/src/host/pages.tsx`, `packages/app/src/host/ljuska-po-ekranu.ts`, `locales/hr.ts` (svoja sekcija). Svaki SRV zadatak s rutama ima vlastitu datoteku ugovora u `server/contracts/routes/` i vlastiti `docs/contracts/` dokument; nijedna datoteka ugovora nije u dva zadatka. Migracije idu strogo redom (vrh baze: `git ls-tree --name-only origin/<baza> db/main/migrations/ | tail -1`), pa KODIRANJE-BAZA ovisi o UPITNIK-BAZA.

### Upitnici

1. **SRV-V18-UPITNIK-BAZA** (L). Migracija `<iza vrha baze>_questionnaire.sql`: `questionnaire` (kolegij, autor, naslov, stanje `draft|open|closed`), `questionnaire_question` (poredak, vrsta zatvoren skup `single|multiple|scale|number|text`, tekst, opcije/skala), `questionnaire_response` (**bez osobe**, samo datum), `questionnaire_answer`, `questionnaire_participation` (upitnik, osoba, jednokratno). RLS i `GRANT` samo potrebnoj ulozi; pgTAP `247-questionnaire.sql` i retci u matrici, uključujući provjeru da sudjelovanje i odgovor nisu spojivi. Domena `server/domain/questionnaire/` (provjera odgovora prema definiciji, oblik izvoza), adapter `server/database/questionnaire.ts` i izmišljeni seed upitnika „Izmišljeno istraživanje: navike kompostiranja” (osam pitanja, 12 izmišljenih odgovora, `demo-fakultet`). Rute: nema. **Paths:** `db/main/migrations/*_questionnaire.sql`, `db/main/migrations.sum`, `db/main/tests/247-questionnaire.sql`, `db/main/tests/030-institution-access-matrix.sql` (retci), `server/domain/questionnaire/**`, `server/database/questionnaire.ts`, `db/main/local/seed.sql` (odjeljak upitnika). **Ovisi:** ništa.
2. **SRV-V18-UPITNIK-AUTOR** (M). Ugovor `teacher` / `course_teacher`, 5 operacija: `teacher.questionnaires.get` `GET /api/v1/teacher/courses/{courseId}/questionnaires`; `teacher.questionnaires.post` `POST` isti put (`{title, questions[]}`); `teacher.questionnaire.get` `GET /api/v1/teacher/questionnaires/{id}`; `teacher.questionnaire.patch` `PATCH` isti put (samo `draft`); `teacher.questionnaire-state.post` `POST …/{id}/state` (`{state: "open"|"closed"}`, jednosmjerno). Nova polja: `id`, `courseId`, `title`, `state`, `questions[{id, order, kind, text, options[{code, label}], scale{min, max}}]`. Brisanja nema (zatvoreni upitnik ostaje). **Paths:** `server/contracts/routes/questionnaires.ts`, `server/http/questionnaires.ts`, `docs/contracts/questionnaire-v1.md`. **Ovisi:** 1.
3. **SRV-V18-UPITNIK-ISPUNJAVANJE** (M). Ugovor `questionnaire-responses.ts`, 4 operacije: `student.questionnaires.get` `GET /api/v1/student/questionnaires` (otvoreni upitnici kolegija u koje je student upisan, `student_enrolled`); `student.questionnaire.get` `GET /api/v1/student/questionnaires/{id}` (obrazac); `student.questionnaire-responses.post` `POST …/{id}/responses` (`{answers[{questionId, value}]}`, jednom, drugi put 409; zatvoren upitnik 404 po katalogu); `teacher.questionnaire-manual-responses.post` `POST /api/v1/teacher/questionnaires/{id}/responses/manual` (ručni unos izmišljenih ili papirnatih odgovora, bez osobe, `course_teacher`). Nova polja: `participated`, `answers[]`. Tuđe, nepoznato i neispravno je isti 404. **Paths:** `server/contracts/routes/questionnaire-responses.ts`, `server/http/questionnaire-responses.ts`, `docs/contracts/questionnaire-responses-v1.md`. **Ovisi:** 1.
4. **SRV-V18-UPITNIK-IZVOZ** (S). `teacher.questionnaire-export.get` `GET /api/v1/teacher/questionnaires/{id}/export` (`course_teacher` autor): `{schema: "questionnaire-export-v1", questionnaireId, variables[{questionId, order, kind, label, options[]}], rows[{n, values{questionId: vrijednost|null}}], responseCount, includesText: false}`; `n` je redni broj po sažetku identifikatora odgovora, ne po vremenu; slobodni tekst samo uz upit `includeText=true`; ispod `QUESTIONNAIRE_EXPORT_MIN_RESPONSES` odgovor je 409 s kodom iz kataloga. Izvoz se bilježi u zapisnik pristupa autora. Dokument ugovora s izmišljenim primjerom i izjavom o ponovljivosti. **Paths:** `server/contracts/routes/questionnaire-export.ts`, `server/http/questionnaire-export.ts`, `docs/contracts/questionnaire-export-v1.md`. **Ovisi:** 3.

### Kvalitativno kodiranje

5. **SRV-V18-KODIRANJE-BAZA** (L). Migracija `<iza zadatka 1>_qualitative_coding.sql`: `qual_material` (vlasnik student, naslov, vrsta `interview|note`, tekst ≤ 100 000, zaključan nakon prvog segmenta), `qual_code` (naziv ≤ 80, opis ≤ 500, poredak), `qual_segment` (gradivo, kod, odlomak, pomaci, citat 1–500, napomena ≤ 1000). RLS: samo vlasnik; pgTAP `248-qualitative-coding.sql` i matrica (nastavnik i drugi student ne vide ništa). Domena `server/domain/qualitative-coding/` (provjera sidra naspram teksta, pravila šifrarnika), adapter `server/database/qualitative-coding.ts` i izmišljeni seed (dva gradiva `Intervju A` i `Bilješka A`, šest kodova). **Paths:** `db/main/migrations/*_qualitative_coding.sql`, `db/main/migrations.sum`, `db/main/tests/248-qualitative-coding.sql`, `db/main/tests/030-institution-access-matrix.sql` (retci), `server/domain/qualitative-coding/**`, `server/database/qualitative-coding.ts`, `db/main/local/seed.sql` (odjeljak kodiranja). **Ovisi:** 1 (redoslijed migracija i seeda).
6. **SRV-V18-KODIRANJE-GRADIVO** (M). Ugovor `student`, 4 operacije: `student.qual-materials.get` `GET /api/v1/student/qual/materials`, `student.qual-materials.post` (`{title, kind, text}`), `student.qual-material.get` `GET …/materials/{id}` (tekst, `segmentCount`, `locked`), `student.qual-material.delete` (briše i segmente). Nema polja koje poziva pomoćnika. **Paths:** `server/contracts/routes/qualitative-materials.ts`, `server/http/qualitative-materials.ts`, `docs/contracts/qualitative-materials-v1.md`. **Ovisi:** 5.
7. **SRV-V18-KODIRANJE-SIFRARNIK** (M). Ugovor `student`, 4 operacije: `student.qual-codes.get` `GET /api/v1/student/qual/codes`, `student.qual-codes.post`, `student.qual-code.patch`, `student.qual-code.delete` `…/codes/{id}` (briše i segmente koda, uz upit potvrde). Polja: `code{id, name, description, order}`. Odgovor je u redoslijedu šifrarnika, nikad po broju. **Paths:** `server/contracts/routes/qualitative-codes.ts`, `server/http/qualitative-codes.ts`, `docs/contracts/qualitative-codes-v1.md`. **Ovisi:** 5.
8. **SRV-V18-KODIRANJE-OZNAKE** (M). Ugovor `student`, 4 operacije: `student.qual-segments.get` `GET /api/v1/student/qual/materials/{id}/segments`, `student.qual-segments.post` (`{codeId, anchor{paragraph, start, end, quote}, memo?}`; 422 ako citat ne odgovara tekstu), `student.qual-segment.delete` `DELETE /api/v1/student/qual/segments/{id}`, `student.qual-export.get` `GET /api/v1/student/qual/export` (opcionalno `materialId`): `{schema: "qualitative-export-v1", codebook[{code, name, description}], segments[{material, code, paragraph, start, end, quote, memo}], counts[{code, material, n}]}`, redoslijed po šifrarniku pa po gradivu, nikad po `n`. **Paths:** `server/contracts/routes/qualitative-segments.ts`, `server/http/qualitative-segments.ts`, `docs/contracts/qualitative-segments-v1.md`, `docs/contracts/qualitative-export-v1.md`. **Ovisi:** 6, 7.

### Web

9. **WEB-V18-UPITNIK-AUTOR** (L). Nastavnik: popis upitnika kolegija, izrada i uređivanje pitanja, objava i zatvaranje, ručni unos izmišljenih odgovora. Port s probnim odgovorom u testu; učitavanje i greška nisu „nema podataka”. **Paths:** `packages/app/src/host/teacher/questionnaire/**`. **Ovisi:** 2, 3 (izvadak ugovora).
10. **WEB-V18-UPITNIK-ISPUNJAVANJE** (M). Student: popis otvorenih upitnika, obrazac, trajna napomena „odgovori se ne povezuju s vašim imenom”, „već ispunjeno”, potvrda nakon odgovora poslužitelja. **Paths:** `packages/app/src/host/student/questionnaire/**`. **Ovisi:** 3.
11. **WEB-V18-UPITNIK-IZVOZ** (M). Nastavnik: broj odgovora, objašnjenje najmanjeg broja, slobodni tekst uz potvrdu, preuzimanje JSON-a i CSV-a (CSV gradi web iz JSON-a). Bez grafikona i usporedbe osoba. **Paths:** `packages/app/src/host/teacher/questionnaire-export/**`. **Ovisi:** 4, 9.
12. **WEB-V18-KODIRANJE-GRADIVO** (M). Student: popis gradiva, dodavanje (upis ili lijepljenje), pregled, brisanje uz potvrdu. Bez zvuka. **Paths:** `packages/app/src/host/student/qual-materials/**`. **Ovisi:** 6.
13. **WEB-V18-KODIRANJE-OZNAKE** (L). Student: šifrarnik (dodavanje, preimenovanje, redoslijed), označavanje odlomka i dodjela koda, pregled i uklanjanje označenog. Bez prijedloga koda i poziva pomoćnika. **Paths:** `packages/app/src/host/student/qual-coding/**`. **Ovisi:** 7, 8, 12.
14. **WEB-V18-KODIRANJE-IZVOZ** (S). Student: preuzimanje šifrarnika i označenih odlomaka kao JSON i CSV; brojači u redoslijedu šifrarnika. **Paths:** `packages/app/src/host/student/qual-export/**`. **Ovisi:** 8, 13.

## 6. Tablica za orkestratora

| ID | r | deps | paths |
|---|---|---|---|
| SRV-V18-UPITNIK-BAZA | L | – | `db/main/migrations/*_questionnaire.sql`, `db/main/migrations.sum`, `db/main/tests/247-questionnaire.sql`, `server/domain/questionnaire/**`, `server/database/questionnaire.ts`, `db/main/local/seed.sql` |
| SRV-V18-UPITNIK-AUTOR | M | SRV-V18-UPITNIK-BAZA | `server/contracts/routes/questionnaires.ts`, `server/http/questionnaires.ts`, `docs/contracts/questionnaire-v1.md` |
| SRV-V18-UPITNIK-ISPUNJAVANJE | M | SRV-V18-UPITNIK-BAZA | `server/contracts/routes/questionnaire-responses.ts`, `server/http/questionnaire-responses.ts`, `docs/contracts/questionnaire-responses-v1.md` |
| SRV-V18-UPITNIK-IZVOZ | S | SRV-V18-UPITNIK-ISPUNJAVANJE | `server/contracts/routes/questionnaire-export.ts`, `server/http/questionnaire-export.ts`, `docs/contracts/questionnaire-export-v1.md` |
| SRV-V18-KODIRANJE-BAZA | L | SRV-V18-UPITNIK-BAZA | `db/main/migrations/*_qualitative_coding.sql`, `db/main/migrations.sum`, `db/main/tests/248-qualitative-coding.sql`, `server/domain/qualitative-coding/**`, `server/database/qualitative-coding.ts`, `db/main/local/seed.sql` |
| SRV-V18-KODIRANJE-GRADIVO | M | SRV-V18-KODIRANJE-BAZA | `server/contracts/routes/qualitative-materials.ts`, `server/http/qualitative-materials.ts`, `docs/contracts/qualitative-materials-v1.md` |
| SRV-V18-KODIRANJE-SIFRARNIK | M | SRV-V18-KODIRANJE-BAZA | `server/contracts/routes/qualitative-codes.ts`, `server/http/qualitative-codes.ts`, `docs/contracts/qualitative-codes-v1.md` |
| SRV-V18-KODIRANJE-OZNAKE | M | SRV-V18-KODIRANJE-GRADIVO, SRV-V18-KODIRANJE-SIFRARNIK | `server/contracts/routes/qualitative-segments.ts`, `server/http/qualitative-segments.ts`, `docs/contracts/qualitative-segments-v1.md`, `docs/contracts/qualitative-export-v1.md` |
| WEB-V18-UPITNIK-AUTOR | L | SRV-V18-UPITNIK-AUTOR, SRV-V18-UPITNIK-ISPUNJAVANJE | `packages/app/src/host/teacher/questionnaire/**` |
| WEB-V18-UPITNIK-ISPUNJAVANJE | M | SRV-V18-UPITNIK-ISPUNJAVANJE | `packages/app/src/host/student/questionnaire/**` |
| WEB-V18-UPITNIK-IZVOZ | M | SRV-V18-UPITNIK-IZVOZ, WEB-V18-UPITNIK-AUTOR | `packages/app/src/host/teacher/questionnaire-export/**` |
| WEB-V18-KODIRANJE-GRADIVO | M | SRV-V18-KODIRANJE-GRADIVO | `packages/app/src/host/student/qual-materials/**` |
| WEB-V18-KODIRANJE-OZNAKE | L | SRV-V18-KODIRANJE-SIFRARNIK, SRV-V18-KODIRANJE-OZNAKE, WEB-V18-KODIRANJE-GRADIVO | `packages/app/src/host/student/qual-coding/**` |
| WEB-V18-KODIRANJE-IZVOZ | S | SRV-V18-KODIRANJE-OZNAKE, WEB-V18-KODIRANJE-OZNAKE | `packages/app/src/host/student/qual-export/**` |

Zajednički retci (popis u §5) ne računaju se kao preklapanje. `db/main/local/seed.sql` drže oba BAZA zadatka u svojim odjeljcima, serijalizirano ovisnošću; verziju svake migracije odrediti iza vrha baze neposredno prije commita.
