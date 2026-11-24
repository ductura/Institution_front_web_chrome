# Val 18: razlika (V18-PREGLED `val18-razlika`: upitnici i kvalitativno kodiranje)

Datum: 24. 11. 2026. Pisac: `claude:wv18pregled:frontend`. Nalog: orkestrator, Ductus#2055 (komentar 7147315835), po odluci vlasnika („Može, idemo na sve valove”; `ductura/.github` `docs/plan/NOVE-FUNKCIJE.md` t. 8, PR #85; `PLAN-MIGRACIJE.md` val 18). **Samo dokumentacija; kod se ne mijenja.** Oblik po uzoru na `docs/nalazi/val19-razlika.md`.

Oznake: nalazi **V18-n**, otvorena pitanja **OP-V18-n**, zadaci `SRV-V18-<NAZIV>` i `WEB-V18-<NAZIV>`.

## 0. Izvori i ograničenja

| Repo | Grana | SHA |
|---|---|---|
| WEB `ductura/Institution_front_web_chrome` | `migracija/kopija-ductus-front` | `ff7d6798efbe1e0e5f87629ef79e5df5a2a6f5b3` (#643) |
| SRV `ductura/Institution_server` (javno) | `migracija/kopija-ductus-backend` | `abf94a9431fddc85631570b8d258816384bf18de` (#702) |

Pročitano: `packages/app/src/host/` (student, teacher), `src/client/`, `locales/hr.ts`, `docs/nalazi/*`, `docs/plan/PLAN-MIGRACIJE.md` (val 15, 18, 21, „Proširenja nakon pilota”), SRV `server/contracts/routes/*.ts` (popis svih datoteka po nazivu, relevantne u cijelosti), `server/domain/`, `db/main/migrations/` (zadnja `20261218100000_origin_segments.sql`), `db/main/tests/` (zadnji `246-origin-segments.sql`), `docs/contracts/`. Kanonski opis (Ductus#2028, c.7008147932): „Zajednička pravila” i „Trake”; zadatka V18-PREGLED u njemu nema, opis je iz naloga.

Izričito nije učinjeno: aplikacija ni poslužitelj nisu pokrenuti (nema baze ni Dockera), sve je iz čitanja koda i ugovora; `NOVE-FUNKCIJE.md` nije čitan (oblak nema pristup `ductura/.github`); Ustav, PRODUCT §5 i rječnik zabranjenih izraza nisu čitani u izvorniku; nisu provjereni PR-ovi otvoreni nakon gornjih SHA-ova. Svi primjeri su izmišljeni.

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
| Zajednički retci gradnje | `server/contracts/routes/index.ts`, `inventory.ts`, `contracts.test.ts`, `tests/contracts/contract-only.test.ts`, `server/http/index.ts`, `server/database/index.ts`, `server/domain/index.test.ts`, `db/main/migrations.sum`, `db/main/tests/030-institution-access-matrix.sql`, `packages/test-fakes/dev-server`, `tests/db/logout-old-cookie.integration.test.ts`, `db/main/local/seed.sql` | po pravilima iz naloga |
| Primjer ugovora s odlukama | `docs/contracts/origin-segments-v1.md`, `provenance-share-v1.md`, `thesis-v1.md` | uzorak dokumenta ugovora za izvoz |
| Pretpostavka plana | `PLAN-MIGRACIJE.md` r. 81: „Upitnik šalje podatke izravno u statistički servis”; r. 91: servis se otvara tek kad val 15 krene | taj servis ne postoji; v. V18-5 |

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

Veličina: S ≤ 100, M ≤ 250, L ≤ 400 redaka koda. Generirane datoteke, `migrations.sum` i izvadci ugovora ne broje se. Zajednički retci iz naloga (`server/http/index.ts`, `server/database/index.ts`, `server/contracts/routes/index.ts`, `inventory.ts` i fiksni testovi, `packages/test-fakes/dev-server`, `tests/db/logout-old-cookie.integration.test.ts`, `server/domain/index.test.ts`; u WEB-u `routes.ts`, `pages.tsx`, `ljuska-po-ekranu.ts`, `messages.hr` svoja sekcija) dodaje svaki zadatak za sebe, a konflikt se rješava spajanjem baze. Svaki SRV zadatak ima vlastitu datoteku ugovora u `server/contracts/routes/` i vlastitu `docs/contracts/` datoteku; nijedna datoteka ugovora nije u dva zadatka. Migracije idu strogo redom (promjena vrha baze: `git ls-tree --name-only origin/<baza> db/main/migrations/ | tail -1`), pa KODIRANJE-BAZA ovisi o UPITNIK-BAZA.

### Upitnici

1. **SRV-V18-UPITNIK-BAZA** (L). Migracija `<iza vrha baze>_questionnaire.sql`: `questionnaire` (kolegij, autor, naslov, stanje `draft|open|closed`), `questionnaire_question` (poredak, vrsta zatvoren skup `single|multiple|scale|number|text`, tekst, opcije/skala), `questionnaire_response` (**bez osobe**, samo datum), `questionnaire_answer`, `questionnaire_participation` (upitnik, osoba, jednokratno). RLS i `GRANT` samo potrebnoj ulozi; pgTAP `247-questionnaire.sql` i retci u `030-institution-access-matrix.sql` uključujući provjeru da sudjelovanje i odgovor nisu spojivi. Domena `server/domain/questionnaire/` (provjera odgovora prema definiciji, izračun oblika izvoza) i adapter `server/database/questionnaire.ts`. Nova polja i rute: nema (ugovor je zadatak 2). **Paths:** `db/main/migrations/*_questionnaire.sql`, `db/main/migrations.sum`, `db/main/tests/247-questionnaire.sql`, `db/main/tests/030-institution-access-matrix.sql` (retci), `server/domain/questionnaire/**`, `server/domain/index.test.ts` (redak), `server/database/questionnaire.ts`, `server/database/index.ts` (redak). **Ovisi:** ništa.
2. **SRV-V18-UPITNIK-RUTE** (L). Ugovor i HTTP adapter. Autor (`course_teacher`): `questionnaires.list.get` `GET /api/v1/courses/{courseId}/questionnaires`, `questionnaires.post` `POST …/questionnaires` (`{title, questions[]}`), `questionnaire.get` `GET /api/v1/questionnaires/{id}`, `questionnaire.patch` (samo `draft`), `questionnaire-open.post`, `questionnaire-close.post`, `questionnaire.delete` (samo `draft`), `questionnaire-manual-response.post` `POST …/{id}/responses/manual` (ručni unos izmišljenih/papirnatih odgovora, bez osobe). Ispunjavanje (`student_enrolled`): `my-questionnaires.get` `GET /api/v1/me/questionnaires`, `questionnaire-form.get` `GET …/{id}/form`, `questionnaire-response.post` `POST …/{id}/responses` (jednom; drugi put 409). Nova polja: `id`, `courseId`, `title`, `state`, `questions[{id, order, kind, text, options[{code, label}], scale{min,max}}]`, `answers[{questionId, value}]`, `participated` (bool). Nepoznato, tuđe i zatvoreno ispunjavanje: isti 404/409 po katalogu grešaka. **Paths:** `server/contracts/routes/questionnaires.ts`, `server/http/questionnaires.ts`, `docs/contracts/questionnaire-v1.md`, zajednički retci i `packages/test-fakes/dev-server` handleri. **Ovisi:** 1.
3. **SRV-V18-UPITNIK-IZVOZ** (M). `questionnaire.export.get` `GET /api/v1/questionnaires/{id}/export` (`course_teacher` autor): odgovor `{schema: "questionnaire-export-v1", questionnaireId, variables[{questionId, order, kind, label, options[]}], rows[{n, values{questionId: vrijednost|null}}], responseCount, includesText: false}`; `n` je redni broj po sažetku identifikatora odgovora, ne po vremenu; slobodni tekst samo uz upit `includeText=true`; ispod `QUESTIONNAIRE_EXPORT_MIN_RESPONSES` odgovor je 409 s kodom iz kataloga. Izvoz se bilježi u zapisnik pristupa autora. Dokument ugovora s primjerom izmišljenih podataka i izjavom o ponovljivosti (isti ulaz → iste bajtove). **Paths:** `server/contracts/routes/questionnaire-export.ts`, `server/http/questionnaire-export.ts`, `docs/contracts/questionnaire-export-v1.md`, zajednički retci. **Ovisi:** 2.

### Kvalitativno kodiranje

4. **SRV-V18-KODIRANJE-BAZA** (L). Migracija `<iza zadatka 1>_qualitative_coding.sql`: `qual_material` (vlasnik student, naslov, vrsta `interview|note`, tekst ≤ 100 000, zaključan nakon prvog segmenta), `qual_code` (naziv ≤ 80, opis ≤ 500, poredak), `qual_segment` (gradivo, kod, odlomak, pomaci, citat 1–500, napomena ≤ 1000). RLS: samo vlasnik; pgTAP `248-qualitative-coding.sql` i matrica (nastavnik i drugi student ne vide ništa). Domena `server/domain/qualitative-coding/` (provjera sidra naspram teksta, pravila šifrarnika) i adapter `server/database/qualitative-coding.ts`. **Paths:** `db/main/migrations/*_qualitative_coding.sql`, `db/main/migrations.sum`, `db/main/tests/248-qualitative-coding.sql`, `db/main/tests/030-institution-access-matrix.sql` (retci), `server/domain/qualitative-coding/**`, `server/domain/index.test.ts` (redak), `server/database/qualitative-coding.ts`, `server/database/index.ts` (redak). **Ovisi:** 1 (redoslijed migracija).
5. **SRV-V18-KODIRANJE-GRADIVO** (M). Ugovor `qualitative-materials.ts` (`student`): `qual-materials.get` `GET /api/v1/student/qual/materials`, `qual-materials.post` (`{title, kind, text}`), `qual-material.get` `GET …/materials/{id}` (tekst i brojač segmenata), `qual-material.delete` (briše i segmente). Nova polja: `id`, `title`, `kind`, `text`, `segmentCount`, `locked`. Nema polja koje poziva pomoćnika. **Paths:** `server/contracts/routes/qualitative-materials.ts`, `server/http/qualitative-materials.ts`, `docs/contracts/qualitative-materials-v1.md`, zajednički retci. **Ovisi:** 4.
6. **SRV-V18-KODIRANJE-KODOVI** (L). Ugovor `qualitative-codes.ts` (`student`): šifrarnik `qual-codes.get|post`, `qual-code.patch|delete` (brisanje koda briše njegove segmente, uz upit potvrde), segmenti `qual-segments.get` `GET …/materials/{id}/segments`, `qual-segments.post` (`{codeId, anchor{paragraph, start, end, quote}, memo?}`; 422 ako citat ne odgovara tekstu), `qual-segment.delete`. Nova polja: `code{id,name,description,order}`, `segment{id,codeId,anchor,memo}`. Redoslijed odgovora je redoslijed šifrarnika, nikad po broju. **Paths:** `server/contracts/routes/qualitative-codes.ts`, `server/http/qualitative-codes.ts`, `docs/contracts/qualitative-codes-v1.md`, zajednički retci. **Ovisi:** 5.
7. **SRV-V18-KODIRANJE-IZVOZ** (M). `qual.export.get` `GET /api/v1/student/qual/export` (opcionalno `materialId`): `{schema: "qualitative-export-v1", codebook[{code, name, description}], segments[{material, code, paragraph, start, end, quote, memo}], counts[{code, material, n}]}`. Redoslijed po šifrarniku pa po gradivu, nikad po `n`. **Paths:** `server/contracts/routes/qualitative-export.ts`, `server/http/qualitative-export.ts`, `docs/contracts/qualitative-export-v1.md`, zajednički retci. **Ovisi:** 6.
8. **SRV-V18-DEMO-PODACI** (S). Izmišljeni seed: upitnik „Izmišljeno istraživanje: navike kompostiranja” s osam pitanja i 12 izmišljenih odgovora u `demo-fakultet`, jedan student s dva izmišljena gradiva (`Intervju A`, `Bilješka A`) i šifrarnikom od šest kodova. Nijedno ime ni tekst nisu stvarni. **Paths:** `db/main/local/seed.sql` (odjeljak) i, ako traži izmišljene račune, `db/main/local/lazni-oidc-racuni.json`. **Ovisi:** 1, 4.

### Web

9. **WEB-V18-UPITNIK-AUTOR** (L). Nastavnik: popis upitnika kolegija, izrada i uređivanje pitanja (vrste prema ugovoru), objava i zatvaranje, ručni unos izmišljenih odgovora. Port s probnim odgovorom u testu. Stanje učitavanja i greške nije „nema podataka”. **Paths:** `packages/app/src/host/teacher/questionnaire/**` (nova mapa), `routes.ts`, `pages.tsx`, `ljuska-po-ekranu.ts`, sekcija `messages.hr`. **Ovisi:** 2 (izvadak ugovora).
10. **WEB-V18-UPITNIK-ISPUNJAVANJE** (M). Student: popis otvorenih upitnika svojih kolegija, obrazac, trajna napomena „odgovori se ne povezuju s vašim imenom”, „već ispunjeno”, potvrda nakon odgovora poslužitelja. **Paths:** `packages/app/src/host/student/questionnaire/**`, zajednički retci kao gore. **Ovisi:** 2.
11. **WEB-V18-UPITNIK-IZVOZ** (M). Nastavnik: broj odgovora, objašnjenje najmanjeg broja, odabir slobodnog teksta uz potvrdu, preuzimanje JSON-a i CSV-a (CSV gradi web iz JSON-a; isti zapis za isti ulaz). Nema grafikona ni usporedbe osoba. **Paths:** `packages/app/src/host/teacher/questionnaire-export/**`, zajednički retci. **Ovisi:** 3, 9 (ulazna točka s ekrana autora).
12. **WEB-V18-KODIRANJE-GRADIVO** (M). Student: popis gradiva, dodavanje (upis ili lijepljenje teksta), pregled, brisanje uz potvrdu. Nema prijenosa zvuka. **Paths:** `packages/app/src/host/student/qual-materials/**`, zajednički retci. **Ovisi:** 5.
13. **WEB-V18-KODIRANJE-OZNAKE** (L). Student: šifrarnik (dodavanje, preimenovanje, redoslijed), označavanje odlomka u gradivu i dodjela koda, pregled označenog, uklanjanje. Bez prijedloga koda i bez ikakvog poziva pomoćnika. **Paths:** `packages/app/src/host/student/qual-coding/**`, zajednički retci. **Ovisi:** 6, 12 (ulaz iz gradiva).
14. **WEB-V18-KODIRANJE-IZVOZ** (S). Student: preuzimanje šifrarnika i označenih odlomaka kao JSON i CSV; brojači po kodu u redoslijedu šifrarnika. **Paths:** `packages/app/src/host/student/qual-export/**`, zajednički retci. **Ovisi:** 7, 13.

## 6. Tablica za orkestratora

| ID | r | deps | paths |
|---|---|---|---|
| SRV-V18-UPITNIK-BAZA | L | – | `db/main/migrations/*_questionnaire.sql`, `db/main/migrations.sum`, `db/main/tests/247-questionnaire.sql`, `server/domain/questionnaire/**`, `server/database/questionnaire.ts` |
| SRV-V18-UPITNIK-RUTE | L | SRV-V18-UPITNIK-BAZA | `server/contracts/routes/questionnaires.ts`, `server/http/questionnaires.ts`, `docs/contracts/questionnaire-v1.md` |
| SRV-V18-UPITNIK-IZVOZ | M | SRV-V18-UPITNIK-RUTE | `server/contracts/routes/questionnaire-export.ts`, `server/http/questionnaire-export.ts`, `docs/contracts/questionnaire-export-v1.md` |
| SRV-V18-KODIRANJE-BAZA | L | SRV-V18-UPITNIK-BAZA | `db/main/migrations/*_qualitative_coding.sql`, `db/main/migrations.sum`, `db/main/tests/248-qualitative-coding.sql`, `server/domain/qualitative-coding/**`, `server/database/qualitative-coding.ts` |
| SRV-V18-KODIRANJE-GRADIVO | M | SRV-V18-KODIRANJE-BAZA | `server/contracts/routes/qualitative-materials.ts`, `server/http/qualitative-materials.ts`, `docs/contracts/qualitative-materials-v1.md` |
| SRV-V18-KODIRANJE-KODOVI | L | SRV-V18-KODIRANJE-GRADIVO | `server/contracts/routes/qualitative-codes.ts`, `server/http/qualitative-codes.ts`, `docs/contracts/qualitative-codes-v1.md` |
| SRV-V18-KODIRANJE-IZVOZ | M | SRV-V18-KODIRANJE-KODOVI | `server/contracts/routes/qualitative-export.ts`, `server/http/qualitative-export.ts`, `docs/contracts/qualitative-export-v1.md` |
| SRV-V18-DEMO-PODACI | S | SRV-V18-UPITNIK-BAZA, SRV-V18-KODIRANJE-BAZA | `db/main/local/seed.sql`, `db/main/local/lazni-oidc-racuni.json` |
| WEB-V18-UPITNIK-AUTOR | L | SRV-V18-UPITNIK-RUTE | `packages/app/src/host/teacher/questionnaire/**` |
| WEB-V18-UPITNIK-ISPUNJAVANJE | M | SRV-V18-UPITNIK-RUTE | `packages/app/src/host/student/questionnaire/**` |
| WEB-V18-UPITNIK-IZVOZ | M | SRV-V18-UPITNIK-IZVOZ, WEB-V18-UPITNIK-AUTOR | `packages/app/src/host/teacher/questionnaire-export/**` |
| WEB-V18-KODIRANJE-GRADIVO | M | SRV-V18-KODIRANJE-GRADIVO | `packages/app/src/host/student/qual-materials/**` |
| WEB-V18-KODIRANJE-OZNAKE | L | SRV-V18-KODIRANJE-KODOVI, WEB-V18-KODIRANJE-GRADIVO | `packages/app/src/host/student/qual-coding/**` |
| WEB-V18-KODIRANJE-IZVOZ | S | SRV-V18-KODIRANJE-IZVOZ, WEB-V18-KODIRANJE-OZNAKE | `packages/app/src/host/student/qual-export/**` |

Zajednički retci (ne računaju se kao preklapanje; svaki zadatak dodaje samo svoj redak): SRV `server/contracts/routes/index.ts`, `inventory.ts`, `contracts.test.ts`, `server/contracts/fake-server.integration.test.ts`, `tests/contracts/contract-only.test.ts`, `server/http/index.ts`, `server/database/index.ts`, `server/domain/index.test.ts`, `packages/test-fakes/dev-server`, `tests/db/logout-old-cookie.integration.test.ts`, `db/main/tests/030-institution-access-matrix.sql`; WEB `packages/app/src/routes.ts`, `host/pages.tsx`, `host/ljuska-po-ekranu.ts`, `locales/hr.ts` (svoja sekcija). Migracije: `UPITNIK-BAZA` prije `KODIRANJE-BAZA`; verziju svake odrediti iza vrha baze neposredno prije commita.
