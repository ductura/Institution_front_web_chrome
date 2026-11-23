# Nove funkcije, dio 4: Nastavnik, kolegiji i zadaci (popis i početna, kolegiji i kod za upis, studenti i nastavnici, stvaranje i uređivanje zadatka, pravila uporabe AI alata, obavijest i verzije obavijesti, objava, zbirni pregled i popis studenata po zadatku, dorada, produljenja roka, izvoz)

Zadatak NF-4 `nove-funkcije-nastavnik-zadaci`. Dodao ga je orkestrator 23. 11. 2026. po planu „Nove funkcije: pregled dio po dio” (plan u `ductura/.github` oblak ne vidi, pa je opis zadatka iz naloga). Oblik i razina detalja po uzoru na `docs/nalazi/nove-funkcije-1-student-zadaci.md`, `nove-funkcije-2-radni-prostor-editor.md` i `nove-funkcije-3-predaja.md`. Ovaj dokument je samo pregled; kod se ne mijenja. Pregled rada, sažetak, karta podrijetla i reprodukcija su dio 5; mentorstvo je dio 6; ovdje su samo spomenuti kad dodiruju ovaj dio.

Oznake: nalazi **G-n**, prijedlozi **NZ-n** (da se ne miješaju s P-n iz dijelova 1 i 2 ni PR-n iz dijela 3). Odluke iz dijelova 1 do 3 se ne ponavljaju kao pitanja, nego se na njih nadovezuje (vidi §0).

## 0. Izvori, način pregleda i ograničenja

Pročitano:
- prototip: `docs/prototip/INVENTAR-nastavnik.md` (ekrani N-01 do N-05, N-13, N-16 do N-18, dijalozi `dk-h`, `do-h`, `dd-h`; §3 radnje, §4 podaci, §7 nejasno), `docs/prototip/Ductura_nastavnik.html` i `Ductura_nastavnik_kartice.html` samo za nazive, redoslijed i stanja; Danielovi odgovori `docs/prototip/ODGOVORI-DANIEL-2026-11-19.md` (A-7 kolegij izrađuje administrator, A-10 ekrani izvan prototipa se zadržavaju, C-15 do C-17, B-4, B-6);
- revizija `docs/nalazi/paritet-nastavnik-2.md` (dijelovi A i D te objedinjeni prijedlozi; mjereno 23. 11. 2026., scenarij VIZ „puno” za ekrane koje taj scenarij pokriva) te dijelovi 1 do 3 ove serije (`nove-funkcije-1-student-zadaci.md` P-7, P-16, P-17; `nove-funkcije-3-predaja.md` PR-14, PR-15, PR-17, PR-20; `nove-funkcije-2-radni-prostor-editor.md` stavke o asistentu i pravilu alata);
- aplikacija (host) `packages/app/src/host/teacher/`: `overview.tsx`, `assignment-card/`, `assignment-facts/`, `assignment-form/`, `assignment/`, `publish/`, `n04/` (popis studenata), `n17/` (zbirni), `n13/` (produljenje), `merlin/` (izvoz), `revision/` (dorada), `submissions/` (uključujući `history/WithdrawalSwitch.tsx` i `bulk/`), `teaching-team/`, `assignment-copy/`, `ai-declaration/`, `shell/`, `toast/`; samo kao izvor teksta i ponašanja, ne kao zadatak za mijenjanje;
- ugovori u izvatku `src/client/migration-contracts.generated.json` za ovaj dio: `teacher.courses.get`, `teacher.course-students.get`, `teacher.assignment-overview.get`, `teacher.assignment-submissions.post`, `teacher.submissions.get`, `institution.course-assignments.post`, `institution.assignment-versions.post`, `institution.assignment.get`, `institution.course-groups.get|post`, `institution.teaching-team*.get|post`, `institution.course-group-teachers.post`, `institution.enrollment-code.post`, `institution.enrollment-code-state.get`, `institution.enrollment-code-revocation.post`, `institution.acknowledgment.post`, `teacher.deadline-extension.post`, `teacher.deadline-extensions.get`, `teacher.submission-withdrawal.get|post`, `teacher.declaration-required.get|put`, `teacher.assignment-copy.post`, `work.return-for-revision.post`, `collaboration.revision-requests.post`, `course.aggregate.get`, `teacher.merlin-*`, `teacher.submissions-bulk*`.

Što nije učinjeno, izričito:
- **aplikacija nije pokrenuta** s lažnim poslužiteljem (scenarij VIZ „puno”) u ovoj sesiji. Ponašanje je izvedeno iz izvornog koda, kataloga poruka, ugovora i žive provjere iz `paritet-nastavnik-2.md` (23. 11. 2026., Chromium 1280 px). Gdje stavka ovisi o stvarnom prikazu (razmak, odsijecanje, veličina cilja, redoslijed Tab, čitač zaslona, mobitel), označena je „provjeriti u pregledniku”. Revizija izričito navodi da scenarij „puno” nema `teacher.access.get`, pa ekrani rada ondje ne prolaze; to ne utječe na popis, zbirni, produljenje i izvoz, ali znači da dio ovog dokumenta nije potvrđen klikom;
- **plan `NOVE-FUNKCIJE.md` iz `ductura/.github` nije čitan** (oblak nema pristup). Sadržaj dijela 4 uzet je iz naloga orkestratora. Ako plan traži temu koje ovdje nema, upisat će se naknadno;
- **kasniji PR-ovi nisu provjereni.** Revizija je od 23. 11.; prije otvaranja zadatka po bilo kojem nalazu provjeriti da nije već riješen u novijoj grani;
- nije provjeravan nastavnički prikaz predanog rada (dio 5), baza, Docker ni pravi poslužitelj; ono što poslužitelj stvarno obrađuje (npr. obavijest pri objavi) nije provjereno, nego samo što ugovor dopušta;
- opisi sličnih alata u dijelu 3 su iz općeg poznavanja takvih alata, ne iz uživo provjere njihovih trenutačnih verzija; ništa se ne kopira (ni izgled ni tekst);
- svi primjeri su izmišljeni (kolegij „Uvod u medije”, „Student A”, „Nastavnik A”); nijedna stvarna osoba ni rad.

Odluke na koje se nadovezuje (ne pitaju se ponovno):
- **Dijelovi 1 do 3: sve je u pilotu** (Daniel, 23. 11.). Nastavnička strana stavki: NF-1 **P-7** (povijest produljenja s razlogom), **P-16** (verzije obavijesti i usporedba), **P-17** (obavijest e-poštom ili push); NF-3 odluka 3: **zadatak smije zabraniti predaju nakon roka, a nastavnik iznimno smije odobriti kasnu predaju pojedinom studentu**; NF-3 **PR-20**: pitanje nastavnika uz izjavu je u pilotu.
- **Asistent (OC-1) u pilotu isključen**, prekidač u `config/faculties`, mijenja se samo vlasnikovim PR-om; Q-10 odgođen, ne bira se pružatelj ni model. Pravila uporabe alata dolaze iz zadatka (`aiPolicy`, `aiPurposes`, `externalToolsAllowed`, `aiSummaryOnly`), a izjava (declaration-v1, #499) je verzionirani obrazac fakulteta s `humanHelp {kind,text}`.
- A-7: kolegij izrađuje administrator fakulteta; nastavnik dodaje zadatak postojećem kolegiju. Jedan obrazac zadatka u odjeljcima, ne čarobnjak (2146). Rok dorade obavezan (2151). Obavijest pri objavi samo u aplikaciji (2147) — vidi §3.2 i pitanje 1 o odnosu s P-17. Toast 3200 ms tek nakon potvrde poslužitelja (2164). Kriteriji ocjene vidljivi studentu (2122). CSV ima 8 stupaca. Razlog produljenja bira se s popisa, bez slobodnog teksta, vidi ga nastavnik i taj student (ADR Q-5 do 30. 11. 2026., gradnja ga ne čeka, C-15).
- P-D1, P-D3, P-D4 (probni zadatak, povlačenje samo dok rok traje i nastavnik ga smije isključiti — zadano uključeno, kopiranje zadatka), P-D2 (skupno preuzimanje predaja) u pilotu; podudaranje s pomoćnikom uključeno, uvijek uz napomenu „nije dokaz autorstva”; postotci sličnosti i oznake „za pregled” ne ulaze u ovaj dio.

Ograničenja plana koja vrijede za sve prijedloge: rok funkcija pilota 15. 1. 2027. se ne pomiče; prijava samo AAI@EduHr (D-09, D-16); server se ne izmišlja (uz svaki prijedlog stoji postoji li operacija u izvatku ili treba novo polje); prototip ostaje izvor istine; PRODUCT §5 i rječnik zabranjenih izraza vrijede za svaki tekst; sa stvarnim studentima ništa do pravnog mišljenja i DPIA, pilot je s izmišljenim podacima.

---

## 1. Tok korisnika od početka do kraja

Rute u hostu (iz revizije i koda): `/nastavnik` (Moji kolegiji; `/nastavnik/kolegiji` preusmjerava), `/nastavnik/zadatak/novi` (odabir kolegija pa obrazac), `/nastavnik/zadatak/{id}/uredi` (nova verzija zadatka), `/nastavnik/zadatak/{id}/predaje`, `/nastavnik/zadatak/{id}/produljenje`, `/nastavnik/zadatak/{id}/merlin`, `/nastavnik/kolegiji/{id}/studenti`, `/nastavnik/kolegiji/{id}/zbirno`, `/nastavnik/zbirni`, `/nastavnik/brz-put?zadatak=…`. Ljuska: bočna traka s četiri stavke (Moji kolegiji, Brz put, Radovi uz mentora, Zbirni), „Izbornik” ispod 800 px, tema, odjava s dijalogom potvrde, zvono obavijesti.

### 1.1 Prijava i početna

1. Nastavnik se prijavljuje isključivo AAI@EduHr (D-09, D-16). Račun bez dodijeljene uloge vidi stanje „bez uloge”; ulogu daje administrator fakulteta (A-5), ne nastavnik.
2. Nakon prijave početna je „Moji kolegiji” (`/nastavnik`): zaglavlje s opisom, gumb „Novi kolegij i zadatak” (u hostu vodi na odabir **postojećeg** kolegija, A-7), kartica po kolegiju.
3. Stanja ekrana: učitavanje („Učitavanje kolegija…” + kosturi), prazno („Još nemate kolegija” + isti gumb), greška („Pokušaj ponovno”), „prekinuto” (banner da objava zadatka nije potvrđena + „Provjeri popis zadataka”).

### 1.2 Kolegij: kartica, kod za upis, studenti, nastavnici

1. **Kartica kolegija** (`AssignmentCards.tsx`): Uloga (nositelj / suradnik), Upisano („1 student · Grupa A”), Kod za upis (stanje), Sljedeći rok; gumbi „Popis studenata”, „Dodaj zadatak”, „Produljenje roka”, „Zbirni pregled”, „Izvoz za Merlin”, „Novi kod za upis”. Suradnik vidi „suradnik” i „Izdaje nositelj kolegija.” bez gumba za pisanje.
2. **Kod za upis:** „Novi kod za upis” otvara dijalog `dk-h` „Izdati novi kod za upis?” (stari kod prestaje vrijediti) s „Izdaj novi kod” i „Odustani”; uspjeh: toast „Novi kod za upis je izdan.” (3200 ms, tek nakon odgovora poslužitelja), kod u kartici (`.code-once`: vidljiv samo sada, čuva se samo njegov sažetak). Rok valjanosti koda zadaje se automatski (`defaultValidUntil`), polje nije izloženo. Ugovori: `institution.enrollment-code.post` `{validUntil}`, `institution.enrollment-code-state.get`, `institution.enrollment-code-revocation.post`.
3. **Studenti i upisi** (N-04, `/nastavnik/kolegiji/{id}/studenti`): naslov „{Kolegij}: studenti”, filtar grupa („Svi (3)”, „Grupa A (1)”…), redak studenta s imenom, grupom i stanjem zadatka riječju („Predano.”), poveznica „Otvori seminarski rad” samo za seminarski rad s dokumentom; gumb „Zbirni pregled kolegija” (`course.aggregate.get`). Prazno: „Još se nitko nije upisao” + poveznica „Izdaj novi kod”.
4. **Nastavnici i mentori na kolegiju:** kartica „Nastavni tim i grupe” (`teaching-team/`, `institution.teaching-team*.get|post`, `institution.course-group-teachers.post`, `institution.teaching-group-members.put`) i kartica „Bilježi ritam tipkanja” (`CourseRhythm`) postoje u hostu bez prototipa (A-10: zadržati). Mentorstvo (zahtjevi, „Radovi uz mentora”) je dio 6.

### 1.3 Zadatak: stvaranje i uređivanje

1. „Dodaj zadatak” (ili „Novi kolegij i zadatak” pa odabir kolegija) otvara **jedan obrazac u četiri odjeljka** (`AssignmentForm.tsx`):
   - **zs-1 Osnovno:** „Naslov zadatka” (do 160 znakova), vrsta rada (Seminarski rad / Esej), opis; potvrdni okvir „Probni zadatak (bez ocjene)” (P-D1; probni zadatak dobiva oznaku „Probni” i napomenu „Probni zadatak se ne ocjenjuje”).
   - **zs-2 Rok i opseg:** „Otvara se”, „Rok” (Europe/Zagreb, `datetime-local`), najmanje i najviše riječi; Grupe (kvačica „svi upisani” je onemogućena i ne šalje se).
   - **zs-3 Pomoć (pravila uporabe AI alata):** tri radio opcije „kao kolegij / samo sažimanje / ne” (opcija „samo sažimanje” je onemogućena, „trenutačno nedostupan”), „Vanjski alati” da/ne (onemogućeno, ne šalje se), dodatno polje „Dopušten uvoz” (bez prototipa).
   - **zs-4 Što se bilježi:** statičan popis (P-01 30 min, P-02 200 znakova; „Ductura ne zna tko je tipkao.”).
2. Gumbi „Pregled i objava” i „Odustani”; pomoć „Ovim gumbom ništa se ne objavljuje…”. Greške: okvir „Obrazac ima pogreške: …” (`#wz-err`, fokusiran) + greška uz polje; ključ zahtjeva (`requestKey`) sprječava dvostruki zadatak.
3. **Pregled** (`taskReview`): sažetak polja (kolegij, naslov, vrsta, otvaranje, rok, opseg, grupe „svi upisani studenti”, AI, alati „nedostupno”), rečenica o obavijesti i produljenju, gumbi „Objavi zadatak” i „Natrag na obrazac”.
4. **Uređivanje objavljenog zadatka:** `/nastavnik/zadatak/{id}/uredi` (`AssignmentVersionForm`, `institution.assignment-versions.post` s `expectedVersion`) stvara **novu verziju**; prototip nema uređivanje objavljenog zadatka (kartice 18. 11.), a web ga ima; u hostu ga nijedna kartica ne povezuje (revizija, „Novo u appu”: „Predaje” i „Nova verzija” bez ulazne točke). Kopiranje zadatka (P-D4, `teacher.assignment-copy.post` `{courseId, opensAt, dueAt}`) postoji kao zasebna komponenta.
5. Ugovor `institution.course-assignments.post` prima i polja koja obrazac ne šalje: `groupIds`, `externalToolsAllowed`, `aiSummaryOnly`, `aiPurposes`, `evidenceProfile`.

### 1.4 Objava, obavijest studentima i verzije obavijesti

1. „Objavi zadatak” šalje zahtjev; stanja: „Objavljivanje…” (prototip: „Objava zadatka u tijeku…”), uspjeh (`PublishDone`: „Zadatak je objavljen. Upisani studenti vide ga u „Mojim zadacima”.” + „Na kolegije”), greška („Zadatak nije objavljen: poslužitelj je odbio objavu. Uneseni podaci ostaju u obrascu.”), prekinuto (ishod nepoznat, banner + „Provjeri popis zadataka”, podaci ostaju).
2. **Obavijest studentima** je u aplikaciji (2147). Student pri prvom otvaranju potvrđuje obavijest o zadatku (`institution.acknowledgment.post`); izmjena objavljenog zadatka stvara novu verziju obavijesti, pa student ponovno vidi stanje „promijenjeno” (NF-1, stanje `promijenjeno`). Nastavnik danas ne vidi ni sadržaj onoga što će student vidjeti, ni tko je obavijest potvrdio (osim modela `phase` u zbirnom koji nitko ne puni — G-9).
3. Rečenica u pregledu zadatka tvrdi da studenti dobivaju obavijest; je li je poslužitelj stvarno stvara, nije provjereno (revizija, „Nepotvrđeno”).

### 1.5 Zbirni pregled i popis studenata po zadatku

1. **Kartica zadatka na početnoj** (`AssignmentFacts`): „Otvorilo rad: X od Y…”, „Zbroj: …”, redovi studenata („Otvori rad” ili „Rad nije započet”), „Brz put kroz radove”.
2. **Popis predaja zadatka** (`/zadatak/{id}/predaje`, `TeacherSubmissions`): predaje s poveznicom na potvrdu, povijest predaja (`submissions/history`), prekidač povlačenja (`WithdrawalSwitch`, `teacher.submission-withdrawal.post {allowed}`, P-D3), skupno preuzimanje predaja (`bulk/BulkDownload`, P-D2). Probni zadatak: „Probni zadatak se ne ocjenjuje”.
3. **Zbirni** (N-17, `/nastavnik/zbirni`): jedna kartica po zadatku, meta redak („predano 3 (od toga 1 nakon roka), nije predano 1”), tablica sa 6 stupaca (Student, Stanje, Vrijeme predaje, Nakon roka, Stanje zapisa, Dorada). Zbirni po kolegiju: `/nastavnik/kolegiji/{id}/zbirno`.
4. **Dorada iz popisa:** „Čeka doradu, rok za doradu …” pri retku studenta (N-04) i stupac Dorada (N-17) u prototipu; u hostu nijedno ne dobiva podatak (G-10).

### 1.6 Dorada (nastavnička strana zahtjeva)

1. Na radu (i na potvrdi predaje) gumb „Zatraži doradu” samo za predan rad otvara `dd-h` „Zatražiti doradu?”: „Što treba doraditi” (obavezno, do 2000 znakova, „Upišite što treba doraditi.”) i „Rok za doradu” (obavezan, `DatePicker` do 23:59, prošli datum odbijen, „Upišite rok za doradu.”); „Pošalji zahtjev”, „Odustani”; uspjeh: toast „Zahtjev za doradu je poslan. Student ga vidi uz rad.” (`work.return-for-revision.post {comment, revisionDueAt}`).
2. Banner dorade ima četiri stanja (otvoren; student navodi da je proveden; prihvaćen; ponovno otvoren) s „Prihvati doradu” i „Ponovno otvori”.
3. Student dobiva obavijest (`notifications.returned-for-revision.list.get`, vidi dio 3, G-24) i novu predaju radi istim koracima; nastavnik u povijesti vidi predaju i povlačenje.

### 1.7 Produljenja roka i kasna predaja

1. **Produljenje** (N-13, `/nastavnik/zadatak/{id}/produljenje`): lede „Zadatak „X”, Kolegij A · rok … Produljenje pokrećete samo Vi; student ga ne traži kroz Ducturu.”; „Za koga” (jedan student / svi studenti zadatka (n)); student (select); „Novi rok” (Europe/Zagreb, mora biti kasniji od roka); „Razlog” s popisa (Opravdan razlog, Tehnička poteškoća, Dogovor s nastavnikom; „Produljenje za sve” samo uz „Svi”), bez slobodnog teksta; „Zabilježi produljenje” / „Odustani”. Ugovor `teacher.deadline-extension.post`: `{scope:"one", studentId, dueAt, reasonId}` ili `{scope:"all", dueAt, reasonId}`, `reasonId` ∈ justified, technical, agreement (+ „za sve”).
2. Ishodi: banner „Produljenje je zabilježeno. Student vidi novi rok uz zadatak. Razlog vidite samo Vi i taj student.”; „sukob” (student je predaju zatražio prije produljenja: „Produljenje ne mijenja tu predaju; bilježi se kao dopuna uz nju.”); popis „Produljeni rokovi” (tko, novi rok, stari rok, razlog, tko i kada) s napomenom da se zapis ne briše; razlog drugog nastavnika je skriven.
3. **Predaja nakon roka** (nastavnička strana; NF-3 odluka 3): danas je kasna predaja dopuštena ako je poslužitelj dopušta (student na koraku 4 vidi „predaja nakon roka”; `not_open` kad je zatvorena). **U obrascu zadatka nema postavke „zabrani predaju nakon roka”** niti ugovor `institution.course-assignments.post` ima takvo polje. Iznimno odobrenje pojedinom studentu danas se može izvesti samo kao produljenje roka za jednog studenta (`scope:"one"`), što mijenja rok, a ne bilježi „iznimku”.

### 1.8 Izvoz

1. **Izvoz za Merlin** (N-18, `/nastavnik/zadatak/{id}/merlin`): izbornik „Zadatak”, pregled CSV-a s 8 stupaca (Prezime, Ime, Predano, Vrijeme predaje, Nakon roka, Naziv datoteke u zipu, Otisak PDF, Otisak .docx), kartica „Otisci”, „Pripremi paket za Merlin” (traži paket pod ključem zahtjeva), „Preuzmi samo popis” (CSV: `teacher.merlin-roster-csv.get`), stanje „Paket se priprema…” (ponovno čitanje svake 3 s), „Paket je spreman… Poveznica vrijedi 24 h” + otisak paketa + „Preuzmi paket”, „Kopiraj otisak”; kartica „Vaši razlozi produljenja” (bez prototipa).
2. Skupno preuzimanje predaja (`teacher.submissions-bulk.get`, `teacher.submissions-bulk-link.post`) je zaseban put na popisu predaja zadatka; potvrda predaje (PDF) `teacher.receipt-pdf.get`.

---

## 2. Gdje zapinje

Provjereno u kodu ili reviziji (23. 11.) naznačeno je uz nalaz. Prije popravka provjeriti da nije riješeno u novijoj grani.

### 2.1 Koraci i tok

- **G-1 Slijepe ulice u navigaciji.** Brz put se otvara bez `?zadatak=`, pa uvijek piše „Odaberite zadatak u svojim kolegijima.” (izvođenje); poveznica „Brz put kroz radove” ne nosi zadatak; gumb „Dodaj zadatak” na praznom Zbirnom vodi na `/nastavnik/novi-zadatak` koje nema (postoji `/nastavnik/zadatak/novi`); banner „prekinuto” se vjerojatno nikad ne pojavi jer `/nastavnik/kolegiji` radi `redirect()` bez query-ja. Preuzeto iz revizije; provjeriti u pregledniku.
- **G-2 Produljenje i Izvoz s kartice vode samo na jedan zadatak.** „Produljenje roka” samo ako kolegij ima budući rok i samo na „sljedeći” zadatak; „Izvoz za Merlin” samo na prvi zadatak kolegija; zadatak s prošlim rokom nema ulaz u produljenje (a upravo je tada najpotrebnije). Preuzeto iz revizije.
- **G-3 Ulazi „Predaje” i „Nova verzija” ne postoje.** Rute `/predaje` i `/uredi` rade, ali nijedna kartica ih ne nosi (`CardTasks` se ne koristi). Nastavnik ne može doći do povlačenja, skupnog preuzimanja ni uređivanja zadatka bez ručnog URL-a. Revizija, „Novo u appu”.
- **G-4 Obrazac zadatka ne šalje polja koja ugovor ima.** Grupe (onemogućena kvačica „svi upisani”), vanjski alati (radio onemogućen) i „samo sažimanje” (opcija onemogućena) ne šalju se iako `institution.course-assignments.post` ima `groupIds`, `externalToolsAllowed`, `aiSummaryOnly`. Posljedica: nastavnik ne može ograničiti zadatak na grupu 2 i 4 (prototip to ima), pa pregled uvijek piše „svi upisani studenti”, a „Alati: nedostupno”. Točno značenje „samo sažimanje” nije odlučeno.
- **G-5 Pravila uporabe alata nastavnik postavlja „na slijepo”.** Izbor „kao kolegij / samo sažimanje / ne” ne pokazuje što će student stvarno vidjeti (obavijest o zadatku, kartica Asistent „uskoro”, izjava). Uz asistenta isključen (OC-1) opcija „samo sažimanje” je u pilotu bez posljedice, a obrazac to ne kaže. Nastavnik ne zna da student u pilotu pravilo čita samo na obavijesti (NF-2, G-18: pravilo nestaje u editoru).
- **G-6 Postavke predaje su razbacane ili ih nema.** Povlačenje (P-D3) je prekidač na popisu predaja zadatka, a ne postavka zadatka; „Izjava obavezna” (`teacher.declaration-required.put`) u hostu nema sučelja (nisam našao komponentu koja zove tu operaciju); zabrane predaje nakon roka nema nigdje. Nastavnik pri stvaranju zadatka ne vidi pravila predaje koja će student susresti.
- **G-7 Objava: nema toasta i ne vodi dalje.** Prikazuje se `Notice` s poveznicom „Na kolegije” (preusmjerava), a ne toast 3200 ms s povratkom; tekstovi `teacherToastHr.published`, `mentorshipApproved/Declined*` postoje, ali se nikad ne pozivaju. Učitavanje piše „Objavljivanje…” umjesto „Objava zadatka u tijeku…”. Revizija, PR-F.
- **G-8 Pregled prije objave ne pokazuje obavijest.** Pregled je popis polja, a ne ono što će student vidjeti; rečenica „studenti dobivaju obavijest” nije potvrđena na poslužitelju. Izmjena objavljenog zadatka (`/uredi`) ne kaže koje su izmjene „značajne” (rok, pravilo alata, opseg) i da će zbog njih student morati ponovno potvrditi obavijest; `expectedVersion` sprječava sukob, ali sukob nije objašnjen riječima nastavniku (provjeriti tekst u pregledniku).
- **G-9 Nastavnik ne vidi tko je potvrdio obavijest.** Model zbirnog ima stanja „obavijest nije potvrđena” i „u pisanju”, ali `phase` nitko ne postavlja (revizija N-17); izvođenje pokazuje samo „predano / nije predano”.
- **G-10 Popis studenata i zbirni su siromašni podacima.** N-04: redak je „Zadatak: Predano.” bez vremena, roka, verzije i stanja zapisa, a dorada se nikad ne vidi jer port ne puni `revision`; naziv zadatka je „Zadatak”. N-17: nijedno ime nije poveznica (`workHref` traži `documentId` koji `toRow` ne postavlja), stupac Dorada je uvijek „nedostupno”, vrijeme je u dugom obliku („20. prosinca 2026. u 22:14”). Revizija, PR-C i PR-D.
- **G-11 Skupno čitanje dorade ne postoji.** `collaboration.revision-requests.post` `list` radi po radu; zbirni i popis studenata ne mogu pokazati dorade bez N poziva. Paritet: „nema skupnog čitanja”.
- **G-12 Dva dijaloga za doradu i ulaz iz rada ne radi.** Na predaji se otvara stari „Vrati rad na doradu”, na radu novi `dd-h`; banner „Rad nije predan do roka…” (ulaz u produljenje iz rada) se ne vidi jer `WorkFrame` ne dobiva `deadlinePassed`. Revizija dio B/D (nije u opsegu dijela 4 osim ulaza u produljenje).
- **G-13 Produljenje: sukob se vidi tek nakon spremanja.** Banner „sukob” (student je već predao) stiže nakon spremanja, ne pri odabiru studenta; ne piše vrijeme predaje. „Produljenje za sve” se ne nudi uz jednog studenta (prototip da). Revizija dio D.
- **G-14 Razlog produljenja: nastavnik ne vidi što student vidi.** Student vidi `previousDueAt`, `dueAt`, `reasonId`, `scope` (NF-1 P-7; ruta `student.deadline-history.get` postoji, klijent je ne zove), a nastavnik nema prikaz „kako to izgleda studentu” ni filtar po studentu u popisu „Produljeni rokovi”. Razlog drugog nastavnika je skriven po pravilu, ali nigdje ne piše zašto.
- **G-15 Kasna predaja: nema ni zabrane ni iznimke.** Vidi §1.7 točka 3. Ako vlasnik odluči da zadatak smije zabraniti predaju nakon roka, nema polja ni u obrascu ni u ugovoru; iznimka za jednog studenta mijenja rok (`scope:"one"`), pa potvrda ne nosi „iznimka”, a nastavnik nema zapis „odobrio sam kasnu predaju, razlog …”. Student na koraku 4 u `not_open` dobiva poruku bez imena nastavnika i bez puta do iznimke (NF-3 PR-17).
- **G-16 Pitanje nastavnika uz izjavu nema gdje biti postavljeno.** Obrazac zadatka nema polje; student ga u hostu ne vidi (`question: null`); ugovor declaration-v1 nema pitanja ni odgovora (NF-3 G-5, PR-20).
- **G-17 Kod za upis: mali nedostaci.** Rok koda zadaje se automatski i nije izložen; opoziv koda (`institution.enrollment-code-revocation.post`) i stanje koda (`institution.enrollment-code-state.get`) nisu na kartici kao radnje „Opozovi kod” / rok („Vrijedi do …”); kod je vidljiv samo jednom, a poruka „zapišite ga sada” nije uz gumb kopiranja (provjeriti). „Izdaj novi kod” u praznom N-04 vodi na popis kolegija, ne otvara `dk-h`.
- **G-18 Izvoz: sitne razlike i osobni podaci.** Natpis opcije u izborniku zadatka je samo naslov (bez vrste rada i „rok je prošao”); promjena zadatka je puni prijelaz stranice, fokus se ne vraća; redoslijed „po prezimenu” određuje poslužitelj, klijent ne sortira (neprovjereno); tekst tosta kopiranja otiska je skraćen u zajedničkoj komponenti; CSV sadrži imena i prezimena studenata, a stranica o tome ne upozorava gdje se datoteka čuva. Revizija dio D.
- **G-19 Probni zadatak i kopiranje nisu povezani s tokom.** Oznaka „Probni” i kopiranje (`assignment-copy`) postoje, ali bez ulaza na kartici (G-3); pri kopiranju student-vidljivi tekst (`opensAt`, `dueAt`) se mora ponovno unijeti, a ne piše što se kopira (opis, pravila alata, grupe) ni što ne (rokovi, produljenja).

### 2.2 Stanja

- **Učitavanje:** kolegiji, mentorstva, N-04, N-17, produljenje, izvoz imaju tekst po ekranu i kostur; Brz put ne prosljeđuje `loading` (opće „Učitavanje…”).
- **Prazno:** „Još nemate kolegija”, „Još se nitko nije upisao”, „Nijedan rok nije produljen”, „Nema predanih radova”; N-17 prazno vodi na mrtvu rutu (G-1).
- **Greška:** svi ekrani imaju „Pokušaj ponovno” (`role=alert`); greška samo čitanja popisa produljenja je odvojena od pada cijelog čitanja (dobro).
- **Prekinuto/nepoznato:** objava („Provjeri popis zadataka”), produljenje („Nije poznato je li produljenje zabilježeno. Osvježite stranicu prije novog pokušaja.”), dorada i kod za upis tek toast; ključ zahtjeva štiti objavu i paket od dvostrukog slanja.
- **Dvostruki klik:** objava i paket su zaštićeni; „Zabilježi produljenje” prelazi u „Bilježi se…”; za „Izdaj novi kod” i „Pošalji zahtjev” (dorada) nije provjereno.
- **Suradnik:** gumbi za pisanje su skriveni, a ne onemogućeni s razlogom; ne piše zašto nema „Dodaj zadatak” (provjeriti).
- **Istek sesije:** 401 vodi na prijavu; je li zahtjev za objavu poslan ili ne, nastavnik ne zna (isto kao „prekinuto”).

### 2.3 Pristupačnost (iz koda i revizije; čitačem provjeriti)

- Dobro: `<dialog>` s fokusom, Escape i povratom (`dk-h`, `do-h`, `dd-h`), `aria-current` u bočnoj traci, `aria-expanded` na „Izbornik”, okvir grešaka obrasca s fokusom i `aria-invalid`, `role=alert` na greškama, `role=status` na pripremi paketa, `aria-disabled` na krajevima Brzog puta, „dodano:”/„uklonjeno:” u usporedbi.
- Pitanja: (1) obrazac zadatka je dug (četiri odjeljka, `datetime-local`): redoslijed Tab, `fieldset`/`legend` za radio skupine i objašnjenje zašto je opcija onemogućena (`aria-describedby`) nisu mjereni; (2) onemogućene opcije („Samo sažimanje”, vanjski alati) čitač može preskočiti bez razloga; (3) tablice N-17 i izvoza sa 6 do 8 stupaca: zaglavlja (`scope`), poredak čitanja i sažetak; (4) otisak u skupinama po 4 znaka čita se kao 16 riječi (isto kao NF-3); (5) toast 3200 ms prekratak za čitač ako nije `role=status` (provjeriti); (6) kontrast oznaka „Probni”, „suradnik”, stanja zapisa nije zasebno mjeren; (7) nema axe specifikacije za obrazac zadatka, produljenje i izvoz (revizija: samo a11y/viz prolaz za N-13, viz za N-18).

### 2.4 Mobitel (granice 640/760/1050/1250 px; provjeriti u pregledniku)

- Nastavnik uglavnom radi na računalu, ali ga traže i na mobitelu (provjera predaje pred rokom, produljenje u hodu). Nije mjereno: kartica kolegija sa šest gumba, filtar grupa, tablica zbirnog sa 6 stupaca (vodoravni pomak ili kartice po studentu), CSV pregled sa 8 stupaca, obrazac zadatka s `datetime-local` na mobitelu, dijalog `dd-h` s `DatePicker` ispod 400 px.
- Ciljevi dodira (44 px) za „Otvori rad”, poveznice u traci i gumbe dijaloga nisu zasebno mjereni. Preuzimanje paketa i CSV-a na mobitelu često nudi samo „Otvori”.

### 2.5 Greške i oporavak

- Objava: „odbijeno” čuva podatke (dobro); „prekinuto” nudi „Provjeri popis zadataka”, ali ako je banner nedohvatljiv (G-1), nastavnik ne zna je li zadatak objavljen i može objaviti drugi.
- Produljenje: „Nije poznato je li produljenje zabilježeno…” ispravno ne obećava; oporavak je osvježiti i pročitati „Produljeni rokovi” (zapis se ne briše, pa pogrešan unos nema „poništi”: ispravak je novo produljenje). Nastavnik se ne upozorava na to prije spremanja (G-13, provjeriti tekst).
- Dorada: pogrešno poslan zahtjev se ne može povući s nastavničke strane osim „Prihvati”/„Ponovno otvori”; `collaboration.revision-requests.post` ima `withdraw` (za zahtjev), ali u sučelju nije izložen (iz revizije: provjeriti).
- Kod za upis: izdavanje novog koda poništava stari (dijalog to kaže); nema „Opozovi bez novog koda” (G-17).
- Izvoz: istek poveznice nakon 24 h poruka kaže „Pripremite novi paket.”; greška priprema nema „Javi problem” (`support.problem-report` postoji u ljusci).

---

## 3. Što nude slični alati i što traže pilot, privatnost i pravila o AI izjavi

### 3.1 Slični alati (opisno, iz općeg poznavanja, bez kopiranja izgleda)

- **Sustavi za e-učenje (tipa Moodle/Merlin, Google Classroom, Canvas):** kolegij ima kod ili poveznicu za upis, uloge (nositelj, asistent, promatrač), zadatak s rokom, „vrijedi od/do” i postavkama kasne predaje (zabranjena, dopuštena s oznakom ili s kaznenim pravilom), produljenja po studentu (često kao „iznimka” ili „preglasavanje” s razlogom), obavijest studentima pri objavi i promjeni, popis predaja s filtrima (nije predano, predano, kasno, vraćeno), skupno preuzimanje i izvoz. Česti nedostaci: razlog iznimke i povijest se slabo vide, a obavijest o promjeni roka često se izgubi među ostalima; nastavnik ne zna tko je obavijest vidio.
- **Alati za provjeru podudaranja (tipa Turnitin):** nastavnik postavlja pravila na zadatku (što se provjerava, što se isključuje), a rezultat je procjena. Problem koji Ductura izbjegava: neprozirna ocjena; ovdje nastavnik postavlja pravila uporabe alata i prag bilježenja, a izvještaji nisu dokaz autorstva (PRODUCT §5, Ustav v1.6 C-6).
- **Uređivači i radni prostori u oblaku (tipa Google Dokumenti, Notion):** nema „zadatka”; nastavnik dijeli dokument i komentira. Očekivanje koje studenti i nastavnici odatle donose: jedan klik do pregleda rada i jasno „tko što može” (čitanje, komentiranje, uređivanje).
- **Sustavi za ocjenjivanje i upravljanje kolegijima (tipa studentske informacijske referade):** popis upisanih, grupe i termini, izvoz ocjena u CSV, evidencija promjena. Očekivanje: izvoz za sustav fakulteta bez prepisivanja, uz čuvanje osobnih podataka.
- **Alati za podsjetnike i obavijesti (e-pošta, push, kalendar):** nastavnici očekuju „pošalji podsjetnik onima koji nisu započeli” i kalendarski unos roka. U Ductura je to odluka privatnosti (2147: obavijest samo u aplikaciji; P-17 u pilot po odluci 23. 11., vidi §3.2).

Što nastavnici obično traže: (1) jedan ekran na kojem se vidi tko je gdje (nije započeo, piše, predao, kasni, dorada); (2) rok i produljenje koji se mijenjaju bez gubitka povijesti, uz razlog; (3) jasna postavka „što je dopušteno” (alati, kasna predaja) prije nego što student počne; (4) znati da je student vidio promjenu; (5) izvoz u sustav fakulteta bez ručnog prepisivanja.

### 3.2 Što traže pilot, privatnost i pravila o AI izjavi za ovaj dio

- **Pilot:** prijava samo AAI@EduHr (D-09, D-16); rok funkcija 15. 1. 2027.; sve novo najprije u prototip i `INVENTAR-nastavnik.md`; pilot je s izmišljenim podacima do pravnog mišljenja i DPIA. Komponente iz `@ductura/ui` bez lokalnog stila; vizualni prolaz je centralan (22. 11.).
- **Privatnost:** popis studenata, CSV i paket sadrže imena i prezimena i tekst rada; poveznica paketa vrijedi 24 h; preuzimanje treba biti bilježeno i objašnjeno. Razlog produljenja nije slobodan tekst (izbor s popisa), vide ga nastavnik koji je zabilježio i student; ne smije u zbirni, CSV ni obavijest. Pregled obavijesti (NZ-7) ne smije sadržavati sadržaj rada ni imena osim nastavnikova. Napomena studenta uz rad (PD-4) i izjava nisu u ovom dijelu osim što ih nastavnik vidi u dijelu 5.
- **Obavijest studentima:** odluka 2147 kaže „samo u aplikaciji”, a NF-1 P-17 (e-pošta/push) je u pilotu po odluci 23. 11. Proturječje je za vlasnika (pitanje 1): ako e-pošta uđe, to je prva obavijest izvan aplikacije, s kanalom (adresa iz AAI@EduHr), sadržajem bez imena zadatka i rada, DPIA-om i pravom na isključivanje; server nema rutu.
- **Pravila uporabe AI alata:** nastavnik ih postavlja po zadatku (FPZG čl. 8, `aiPolicy`, `aiPurposes`, `externalToolsAllowed`, `aiSummaryOnly`); **asistent je u pilotu isključen** (OC-1, Q-10 odgođen), pa pravilo opisuje samo što student smije izvan Ducture i što navodi u izjavi. Tekst nikad ne imenuje pružatelja ni model i ne obećava otkrivanje.
- **Izjava (declaration-v1, #499):** verzionirani obrazac fakulteta (OD-11: samo test-izjava), `humanHelp {kind,text}` zatvoren skup (OD-12), granice kao imenovane konstante (OD-4); „Izjava obavezna” po zadatku (`teacher.declaration-required.put`) odlučuje nastavnik; pitanje nastavnika uz izjavu (PR-20) je u pilotu, a ugovor ga nema (§4, NZ-15). „Izvornost” samo kao doslovan naziv službenog obrasca (B-5).
- **Predaja nakon roka, povlačenje, produljenje:** pravila su odluke vlasnika i fakulteta; nastavnik ih postavlja po zadatku (P-D3: povlačenje zadano uključeno, nastavnik ga smije isključiti), a student ih vidi. Tekst o kašnjenju opisuje zadatak, ne studenta, i ne govori o posljedicama (ocjena, sankcija).
- **Zabranjeni izrazi:** svaki novi tekst kroz skener (PRODUCT §5): „plagijat”, „kazna”, „dokaz autorstva” (samo u negaciji), „provjera AI-ja”, „varanje”, „izvornost” (samo kao naziv obrasca). Tekstovi o iznimci kasne predaje ne smiju zvučati kao presuda o studentu.

---

## 4. Numerirani prijedlozi

Veličina: S (do ~150 redaka koda), M (150–400), L (više od 400 ili više PR-ova). „Server” = treba li novo polje ili ruta; „ne, postoji” znači da je operacija u izvatku ugovora. „Prototip” = dodiruje li prototip (`Ductura_nastavnik.html`, `INVENTAR-nastavnik.md`) i što bi se najprije izmijenilo. Uz svaki prijedlog stoji i zadatak revizije (PR-A do PR-J iz `paritet-nastavnik-2.md`) ako ga pokriva.

**NZ-1 Mrtve veze i ulazi po zadatku.**
- Opis: „Brz put kroz radove” i ulaz Brz put šalju `?zadatak=` (ili Brz put bez parametra odabire prvi zadatak uz izbornik zadatka); „Dodaj zadatak” na praznom Zbirnom vodi na `/nastavnik/zadatak/novi`; preusmjerenje `/nastavnik/kolegiji` čuva query (banner „prekinuto” se vidi); „Izdaj novi kod” iz praznog N-04 otvara `dk-h`; na kartici zadatka ulazi „Predaje”, „Uredi (nova verzija)”, „Kopiraj zadatak” (P-D4), „Produljenje”, „Izvoz”.
- Korist: G-1, G-3, G-19; nastavnik ne mora znati URL-ove. Veličina: S do M. Rizik: nizak. Server: ne, postoji. Prototip: da (kartica N-01; „Predaje” i „Nova verzija” dodati u prototip, A-10). Revizija: PR-A, PR-B, PR-J.

**NZ-2 Kartica kolegija: izbor zadatka za Produljenje, Izvoz i Zbirni.**
- Opis: „Produljenje roka” i „Izvoz za Merlin” s kartice otvaraju izbor zadatka kolegija (izbornik „Zadatak” kao u N-18) umjesto „sljedećeg”/prvog; produljenje se nudi i za zadatak s prošlim rokom (preporuka: da, jer je tada najpotrebnije; vidi pitanje 5). „Zbirni pregled” otvara zbirni s kolegijem.
- Korist: G-2. Veličina: S. Rizik: nizak (odluka 5 u reviziji). Server: ne. Prototip: da (N-01 gumbi).

**NZ-3 Obrazac zadatka: grupe, vanjski alati, „samo sažimanje”.**
- Opis: čitanje grupa (`institution.course-groups.get`) i slanje `groupIds`; „Vanjski alati” (`externalToolsAllowed`) postaje stvarna postavka; „samo sažimanje” (`aiSummaryOnly`) dobiva definiran značaj prije gradnje (pitanje 2) ili ostaje onemogućeno uz objašnjenje „U pilotu asistent nije uključen”; pregled prikazuje grupe i alate riječima. Uz svaku onemogućenu opciju stoji razlog (`aria-describedby`).
- Korist: G-4, G-5. Veličina: M. Rizik: srednji (pravilo alata pravno osjetljivo, tekstovi kroz pravni pregled; ugovor ima polja, ali treba potvrditi da ih poslužitelj obrađuje). Server: ne za slanje; **provjeriti** obradu. Prototip: da (zs-2 grupe, zs-3). Revizija: PR-E.

**NZ-4 „Pravila predaje” na zadatku: kasna predaja, povlačenje, izjava obavezna (jedno mjesto).**
- Opis: peti odjeljak obrasca zadatka i isti odjeljak u `/uredi`: (a) „Predaja nakon roka: dopuštena / nije dopuštena” (NF-3 odluka 3), (b) „Povlačenje predaje dok rok traje: uključeno / isključeno” (`teacher.submission-withdrawal.post {allowed}`, zadano uključeno, P-D3), (c) „Izjava o korištenju AI alata obavezna” (`teacher.declaration-required.put {required}`). Uz svaku stavku jedna rečenica što student zbog toga vidi („Student na koraku predaje vidi: …”). Prekidač povlačenja ostaje i na popisu predaja. Pri promjeni nakon objave: dijalog „Ova izmjena mijenja pravila koja su studenti već vidjeli” (vidi NZ-7).
- Korist: G-6, G-15. Veličina: M. Rizik: srednji. Server: (b) i (c) ne, postoje; **(a) da: nema polja** (npr. u `institution.course-assignments.post` i `assignment-versions.post`); ne izmišljam ime ni oblik; poslužitelj danas vraća `not_open` kad je predaja zatvorena. Prototip: da (nova stavka u zs-2/zs-3 i P-D3).

**NZ-5 Iznimno odobrenje kasne predaje pojedinom studentu, sa zapisom.**
- Opis: na retku studenta (N-04, N-17, popis predaja) radnja „Dopusti predaju nakon roka…” otvara dijalog (razlog s popisa kao kod produljenja, bez slobodnog teksta; rok do kad; upozorenje da student to vidi i da se zapis ne briše). Zapis ide u popis „Produljeni rokovi”/povijest s oznakom „iznimka”. Dvije varijante: **(A)** iznimka je produljenje za jednog studenta (`teacher.deadline-extension.post` `scope:"one"`, razlog „Dogovor s nastavnikom”), bez servera, ali potvrda i povijest ne razlikuju produljenje od iznimke; **(B)** posebna iznimka s vlastitim zapisom i razlogom (novo polje ili operacija). Preporuka: A za pilot, B ako vlasnik traži razlikovanje.
- Korist: G-15; nastavnik ne mora lažirati rok za sve. Veličina: M. Rizik: srednji (zapisi i razlozi; ne smije zvučati kao presuda). Server: A ne, postoji; B da (ne izmišljam). Prototip: da (N-13 proširiti; N-04/N-17 radnja na retku).

**NZ-6 Povijest produljenja s razlogom: nastavnička strana P-7.**
- Opis: popis „Produljeni rokovi” dobiva filtar po studentu i oznaku „Student vidi: Bio {stari rok}, razlog: opravdano / tehnički / dogovor” (isti tekst kao NF-1 P-7); uz redak studenta u N-04, N-17 i na popisu predaja oznaka „Rok produljen do {datum}” s poveznicom na zapis; napomena zašto razlog drugog nastavnika nije vidljiv. Provjera nastavnikovog prikaza prema prikazu studenta (isti izvor, `previousDueAt`, `dueAt`, `reasonId`, `scope`).
- Korist: G-14; nastavnik zna što student vidi. Veličina: S do M. Rizik: nizak do srednji (prikaz razloga treba potvrditi s pravnim odgovorom, kao u P-7). Server: ne, postoji (`teacher.deadline-extensions.get`; student: `student.deadline-history.get`). Prototip: da (N-13 lista, nova oznaka u N-04/N-17).

**NZ-7 Obavijest studentima: pregled prije objave i verzije obavijesti (nastavnička strana P-16).**
- Opis: (a) u pregledu zadatka blok „Ovako će student vidjeti obavijest” (rok, pravila alata, opseg, obavezna izjava, povlačenje) iz istih polja kao studentska obavijest, bez imena studenata; (b) u `/uredi` ispod obrasca „Što ste promijenili u odnosu na verziju n” (rok, pravilo alata, opseg; usporedba polja prije/poslije, računa klijent iz učitane verzije, `institution.assignment.get`); (c) dijalog pri spremanju značajne izmjene: „Studenti će morati ponovno potvrditi obavijest (verzija n+1)” i objašnjenje što je „značajno”; (d) sukob verzija (`expectedVersion`) objašnjen riječima s „Učitaj ponovno”.
- Korist: G-8; nastavnik zna što šalje i što izmjena uzrokuje. Veličina: M. Rizik: srednji (obećanja o obavijesti; test svih kombinacija). Server: (a)–(d) ne, postoje; **usporedba verzija na studentskoj strani (NF-1 P-16) traži server** (nema prethodne verzije u `student.notice.get`), ovdje se ne gradi. Prototip: da (taskReview; dodati blok i `/uredi`).

**NZ-8 Tko je potvrdio obavijest.**
- Opis: u popisu predaja, N-04 i N-17 stanje „obavijest nije potvrđena” po studentu (model već ima `phase`) i broj „Potvrdilo n od m” na kartici zadatka; nakon izmjene zadatka (NZ-7) broj se vraća na „Potvrdilo 0 od m” uz riječ „nova verzija”. Samo čitanje.
- Korist: G-9; zamjena za „podsjeti”. Veličina: S do M. Rizik: nizak. Server: **provjeriti** vraća li `teacher.assignment-overview.get` / `teacher.assignment-submissions.post` potvrdu obavijesti po studentu (paritet: model postoji, polje nitko ne postavlja; ugovor `teacher.assignment-submissions.post` izričito ne daje vrijeme ni rok). Ako ne, treba polje. Prototip: da (N-17 stupac Stanje, taskFacts).

**NZ-9 Obavijest e-poštom ili push: nastavnička postavka (nadovezuje se na NF-1 P-17).**
- Opis: pri objavi i pri izmjeni roka okvir „Obavijesti studente i e-poštom” (zadano isključeno), s popisom što poruka sadrži („Novi zadatak u Ducturi. Otvorite aplikaciju.” bez naslova rada i bez rada), pregled „Poslano n studentima” bez imena; student se može odjaviti. Podsjetnik „onima koji nisu započeli” ne predlažem u ovom dijelu.
- Korist: G-9 (studenti ne otvaraju aplikaciju svaki dan); u pilotu po Danielovoj odluci. Veličina: L. Rizik: **visok** (odluka 2147, privatnost, DPIA; adresa e-pošte i kanal). Server: **da, nema rute ni polja**; ne izmišljam. Prototip: da (nova stavka u zs-2/pregledu).

**NZ-10 Popis studenata i zbirni sa stvarnim podacima.**
- Opis: isti join kao `assignment-facts/read.ts` (overview + submissions + extensions + zahtjevi za doradu): poveznica na rad uz ime, stanje (nije započeo / piše / predano / predano nakon roka / dorada), vrijeme i verzija predaje u kratkom obliku („5. 11. 2026. u 21:14”), „Rok produljen do …”, naziv zadatka; stupac Dorada „zatražena · rok …” / „nije zatražena”; meta redak „Rok …”.
- Korist: G-10, G-11. Veličina: M + M. Rizik: nizak do srednji (N poziva za doradu, vidi NZ-12). Server: ne za osnovu; dorada po studentu skupno **ne postoji** (pitanje 6). Prototip: da (N-04 redak, N-17 tablica). Revizija: PR-C, PR-D.

**NZ-11 Zbirni i popis studenata: filtri, sortiranje, mobitel.**
- Opis: filtri „Nije započeo / Piše / Predano / Nakon roka / Dorada” i grupa (N-04 filtar već postoji), sortiranje po prezimenu i po stanju, broj „Nije započelo n”; ispod 760 px redak postaje kartica (ime, stanje, rok); onemogućene radnje imaju razlog. Samo čitanje.
- Korist: G-10, §2.4; nastavnik u 10 s vidi tko kasni. Veličina: M. Rizik: nizak. Server: ne. Prototip: da (N-17 stanja; mobitel centralno uz VIZ).

**NZ-12 Dorada kao jedan tok i popis dorada.**
- Opis: jedan dijalog `dd-h` na radu, predaji i iz retka studenta (stari „Vrati rad na doradu” se uklanja); na zbirnom filtar „Dorada”; na kartici zadatka „Dorada: n otvorenih, m čeka Vaš pregled”; u banneru rok dorade i radnja „Povuci zahtjev” (ako je izložen `withdraw`). Tekst studenta (NF-3 PR-16) ostaje zajednički izvor: nastavnik vidi „Student vidi: …”.
- Korist: G-11, G-12. Veličina: M. Rizik: srednji. Server: dijalog i povlačenje ne, postoje (`work.return-for-revision.post`, `collaboration.revision-requests.post`); **skupno čitanje dorada po zadatku ne postoji** (paritet; treba SRV ruta ili polje u `teacher.assignment-overview.get`). Prototip: da (N-04 `dorada`, N-17 stupac, dd-h). Revizija: zadatak 6 i 7 objedinjenog popisa.

**NZ-13 Kod za upis: stanje, rok, opoziv, upute.**
- Opis: kartica „Kod za upis: vrijedi do {datum}”, „Opozovi kod” (`institution.enrollment-code-revocation.post`, dijalog s potvrdom), „Izdaj novi kod” s izborom roka (`validUntil`), uz jednokratni prikaz gumb „Kopiraj kod” i „Zapišite ga sada; poslije se vidi samo sažetak”; kratka uputa studentu („Upišite kod na stranici Upis”). Ugovor postoji, kod ne ide u CSV ni obavijest.
- Korist: G-17. Veličina: S do M. Rizik: nizak (samo nositelj; oprez s prikazom koda). Server: ne, postoji. Prototip: da (N-01 `.code-once`, dk-h).

**NZ-14 Nastavnici i mentori na kolegiju: ulaz i uloge.**
- Opis: kartica „Nastavni tim i grupe” (već postoji) dobiva jasnu poveznicu s kartice kolegija, popis uloga (nositelj, suradnik, mentor) s opisom što svaka smije (suradnik samo čita i komentira, 22. 11.), „Dodaj nastavnika” i raspored po grupama (`institution.teaching-team.post`, `institution.course-group-teachers.post`); mentorstvo se samo spominje i vodi na „Radovi uz mentora” (dio 6).
- Korist: G-3, §1.2 točka 4. Veličina: M. Rizik: srednji (dodjela uloga; A-5: ulogu nastavnika daje administrator, ne nositelj; treba potvrditi tko smije dodavati). Server: ne, postoji; provjeriti pravo. Prototip: ne (A-10: zadržano; dodati).

**NZ-15 Pitanje nastavnika uz izjavu: gdje ga nastavnik postavlja (NF-3 PR-20).**
- Opis: u odjeljku zs-3 polje „Pitanje studentu uz izjavu (nije obavezno)” (kratki tekst, granica kao imenovana konstanta, OD-4) i pregled „Student ga vidi na koraku Izjava”; na pregledu rada nastavnik vidi pitanje i odgovor uz izjavu (dio 5). U pilotu bez pitanja izjava radi kao danas.
- Korist: G-16; zatvara mrtvi prototipski element. Veličina: M do L. Rizik: srednji (novi sadržaj u pravno osjetljivoj izjavi). Server: **da** (novo polje u declaration-v1 ili zadatku, odgovor u izjavi; ne izmišljam). Prototip: da (E-9 pitanje, nastavnički `declPanel`).

**NZ-16 Izvoz: sitnice i osobni podaci.**
- Opis: naslov opcije zadatka s vrstom i „rok je prošao”; fokus na izbornik nakon promjene; upozorenje „Datoteka sadrži imena studenata; čuvajte je prema pravilima fakulteta”; tekst tosta kopiranja otiska ujednačen (zajednička komponenta, samo uz odluku); potvrda da poslužitelj vraća poredak po prezimenu; e2e za pripremu i preuzimanje paketa; isti izvoz za zbirni (CSV 8 stupaca ne mijenja se, odluka 22. 11.).
- Korist: G-18. Veličina: S. Rizik: nizak. Server: ne (poredak: provjeriti). Prototip: ne (osim naslova opcije). Revizija: PR-3 dijela D.

**NZ-17 Pristupačnost i mobitel nastavničkih ekrana.**
- Opis: axe spec za obrazac zadatka, produljenje, izvoz, N-04 i N-17; `fieldset`/`legend` i razlozi za onemogućene opcije; zaglavlja tablica; ciljevi dodira 44 px; mjerenje na 400, 760 i 1050 px; probe čitačem zaslona. Centralni prolaz (22. 11.), bez lokalnog stila.
- Korist: §2.3, §2.4. Veličina: M. Rizik: nizak. Server: ne. Prototip: ne.

**NZ-18 Scenarij VIZ „puno” za nastavnika.**
- Opis: lažni poslužitelj dobiva `teacher.access.get` i čitanja zadatka, zbirnog, produljenja i izvoza da se ekrani mogu provjeriti klikom i mjeriti (revizija, zadatak 16). Samo izmišljeni podaci.
- Korist: bez njega se ništa od ostalog ne može provjeriti klikom. Veličina: S. Rizik: nizak. Server: ne (test-fakes). Prototip: ne.

Nisu predloženi: ocjenjivanje i ocjene (PRODUCT), „podsjeti studente” (server, privatnost), uklanjanje studenta s kolegija (`institution.student-removal.post` postoji, ali tko smije i posljedice nisu odlučeni — pitanje izvan ovog dijela), skupno slanje komentara, mentorstvo (dio 6), pregled rada, sažetak i reprodukcija (dio 5).

---

## 5. Tablica za Danielovu odluku

Preporuka je moja; odluka je vaša. „Pilot” = ulazi u funkcije pilota 15. 1. 2027. (najprije u prototip i `INVENTAR-nastavnik.md`). Redoslijed je po koristi za nastavnika i riziku od pogrešnog ishoda (rok, predaja, obavijest).

| # | Prijedlog | Veličina | Server | Moja preporuka | Razlog | Vaša odluka |
|---|-----------|----------|--------|----------------|--------|-------------|
| NZ-18 | VIZ „puno” za nastavnika | S | ne | **za pilot** | Bez njega se ne može provjeriti klikom | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-1 | Mrtve veze i ulazi po zadatku | S do M | ne | **za pilot** | Nastavnik ne dolazi do povlačenja, uređivanja ni Brzog puta | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-4 | „Pravila predaje” na zadatku | M | (a) da, (b)(c) ne | **za pilot** (bez (a) ako server kasni) | Odluka NF-3 traži postavku; povlačenje i izjava već imaju ugovor | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-5 | Iznimno odobrenje kasne predaje (varijanta A) | M | ne (A) / da (B) | **za pilot (A)** | Zahtjev NF-3 odluke 3 s postojećim ugovorom | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-3 | Obrazac: grupe, vanjski alati, „samo sažimanje” | M | ne, provjeriti obradu | **za pilot** | Ugovor ima polja; prototip ima grupe | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-7 | Pregled obavijesti i verzije (nastavnička strana) | M | ne | **za pilot** | P-16 nastavnička strana; nastavnik zna što šalje | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-6 | Povijest produljenja s razlogom | S do M | ne | **za pilot** | P-7 nastavnička strana, ugovor postoji | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-10 | Popis studenata i zbirni sa stvarnim podacima | M | ne (dorada skupno: ne) | **za pilot** | Sada pokazuju samo „predano / nije predano” | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-2 | Kartica: izbor zadatka za Produljenje i Izvoz | S | ne | **za pilot** | Produljenje za prošli rok je glavni slučaj | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-8 | Tko je potvrdio obavijest | S do M | provjeriti | **za pilot** | Zamjena za „podsjeti”; bez e-pošte | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-12 | Dorada kao jedan tok | M | skupno čitanje: da | **za pilot** (bez skupnog popisa ako server kasni) | Jedan dijalog, jasni rokovi | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-13 | Kod za upis: stanje, rok, opoziv | S do M | ne | **za pilot** | Ugovor postoji; prvi korak svakog kolegija | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-16 | Izvoz: sitnice i osobni podaci | S | ne | **za pilot** | Privatnost i obećanja | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-17 | Pristupačnost i mobitel nastavnika | M | ne | **za pilot** (centralni prolaz) | Obvezno prije pilota | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-11 | Filtri, sortiranje, mobitel zbirnog | M | ne | **za pilot** (nakon NZ-10) | Korisno tek uz stvarne podatke | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-14 | Nastavnici i mentori na kolegiju | M | ne | nakon pilota | Postoji; ulaz i uloge nisu hitni | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-15 | Pitanje nastavnika uz izjavu | M do L | **da** | pilot **samo uz SRV ugovor**, inače nakon | Nema ugovora; pravno osjetljivo | ☐ pilot ☐ nakon pilota ☐ ne |
| NZ-9 | Obavijest e-poštom/push | L | **da** | pilot samo kao postavka bez slanja; slanje nakon pilota | Odluka 2147, DPIA, nema rute | ☐ pilot ☐ nakon pilota ☐ ne |

Pitanja na koja ne mogu odgovoriti sama (najviše 8):
1. **Obavijest e-poštom (NZ-9):** odluka 2147 kaže „samo u aplikaciji”, a P-17 je u pilotu. Je li pilot s e-poštom stvarno željen, i znači li to izuzeće od 2147 uz DPIA?
2. **„Samo sažimanje” (NZ-3):** što točno znači uz isključenog asistenta (OC-1)? Ostaje li opcija onemogućena u pilotu?
3. **Zabrana predaje nakon roka (NZ-4a):** na kojoj razini živi (zadatak, kolegij, fakultet) i smije li je nastavnik mijenjati nakon objave? Ugovor nema polja: otvara li se SRV zadatak?
4. **Iznimka kasne predaje (NZ-5):** je li dovoljno produljenje za jednog studenta (A) ili traži posebnu iznimku s vlastitim zapisom (B)? Smije li student vidjeti razlog „Dogovor s nastavnikom”?
5. **Produljenje za zadatak s prošlim rokom (NZ-2):** smije li se nuditi (prototip da, host samo za budući rok)?
6. **Dorada po studentu (NZ-10, NZ-12):** hoće li poslužitelj dati skupno čitanje dorada (rok, stanje) uz `teacher.assignment-overview.get`?
7. **Potvrda obavijesti (NZ-8):** vraća li poslužitelj po studentu da je obavijest potvrđena i kojom verzijom?
8. **Izjava obavezna (NZ-4c):** smije li nastavnik isključiti obaveznu izjavu u pilotu, ili je izjava uvijek obavezna po fakultetu (OD-11)?

Otvoreno za provjeru u pregledniku (nije moguće iz ovog pregleda): mobitel (§2.4), čitači zaslona (§2.3), slijepe ulice G-1 i G-3, banner „prekinuto”, tekst sukoba verzija zadatka, ponašanje paketa i poveznice 24 h, jesu li nalazi G-1, G-7, G-10 popravljeni nakon revizije od 23. 11., obrada `groupIds`, `externalToolsAllowed` i `aiSummaryOnly` na poslužitelju.

---

## 6. Provedba u prototipu (NF-4, 23. 11. 2026.)

Zadatak `nf4-prototip-nastavnik`. Danielove odluke (doslovno: „1 da 2. asistent u pilotu radi 3. Da 4. Oboje 5. Da 6. Smije isključiti” i „Asistent radi u pilotu i sve stavke NZ idu u pilot”) zatvaraju pitanja 1 do 5 i 8 iz odjeljka 4 i stavljaju svih 18 prijedloga u pilot, uključivo NZ-14, NZ-15 i NZ-9. Provedeno je u `docs/prototip/Ductura_nastavnik.html` (oznaka `data-nf4="NZ-n"` na elementu; `.srv` „Poslužitelj:” označava što poslužitelj nema) i u `docs/prototip/INVENTAR-nastavnik.md` §8 (ID-evi NF4-NZn, stanja, serverska ovisnost). Pružatelj i model se ne imenuju, piše samo „Asistent”.

| NZ | INVENTAR ID | Element u prototipu | Poslužitelj |
|---|---|---|---|
| NZ-1 | NF4-NZ1 | kartica zadatka u `kolegiji`: Predaje, Uredi (nova verzija), Kopiraj zadatak, Produljenje, Izvoz, Brz put; izbornik „Zadatak” u `brz-put`; „Izdaj novi kod” iz praznog `studenti` | postoji |
| NZ-2 | NF4-NZ2 | „Produljenje roka…” i „Izvoz za Merlin…” s kartice kolegija otvaraju izbornik zadatka; produljenje i za prošli rok | postoji |
| NZ-3 | NF4-NZ3 | grupe kao kućice, „samo sažimanje” i „Vanjski alati” kao postavke, razlozi uz `aria-describedby` | obradu polja potvrditi |
| NZ-4 | NF4-NZ4 | odjeljak „Pravila predaje” u obrascu i u `uredi`, dijalog „Ova izmjena mijenja pravila koja su studenti već vidjeli” | (a) nedostaje; (b), (c) postoje |
| NZ-5 | NF4-NZ5 | dijalog `di-h` iz retka studenta, varijante A i B, razlog vidljiv studentu po izboru nastavnika | A postoji; B nedostaje |
| NZ-6 | NF4-NZ6 | filtar po studentu i redak „Student vidi: Bio …” u `produljenje`, poveznica „Rok produljen do …” | postoji |
| NZ-7 | NF4-NZ7 | blok „Ovako će student vidjeti obavijest”, usporedba u `uredi`, dijalog značajne izmjene, sukob verzija | postoji |
| NZ-8 | NF4-NZ8 | „Potvrdilo obavijest: n od m”, stanje po studentu, „nova verzija” | nedostaje potvrda po studentu |
| NZ-9 | NF4-NZ9 | kućica „Obavijesti studente i e-poštom” (zadano isključeno), banner „Poslano n studentima” | nedostaje ruta i polje |
| NZ-10 | NF4-NZ10 | stvarni podaci u `studenti` i tablica od 9 stupaca u `zbirni` | dorada skupno nedostaje |
| NZ-11 | NF4-NZ11 | filtri stanja i grupe, poredak, „Nije započelo n”, kartice ispod 760 px | postoji |
| NZ-12 | NF4-NZ12 | jedan dijalog `dd-h`, „Povuci zahtjev”, „Dorada: n otvorenih, m čeka Vaš pregled” | skupno čitanje nedostaje |
| NZ-13 | NF4-NZ13 | rok koda, „Opozovi kod”, „Kopiraj kod”, uputa studentu | postoji |
| NZ-14 | NF4-NZ14 | novi ekran `tim` | postoji, provjeriti pravo |
| NZ-15 | NF4-NZ15 | polje „Pitanje studentu uz izjavu” | nedostaje |
| NZ-16 | NF4-NZ16 | naslov opcije izvoza, fokus, upozorenje o imenima studenata | poredak potvrditi |
| NZ-17 | NF4-NZ17 | `fieldset`/`legend`, `aria-describedby`, ciljevi dodira 44 px, mjereno na 390 i 1280 px | ne |
| NZ-18 | NF4-NZ18 | varijanta „puno” svakog novog elementa; lažni poslužitelj u `packages/` nije dirnut | test-fakes: otvoreno |

Provjera: sve varijante svih 16 ekrana prototipa crtaju se bez grešaka u konzoli; skripta s tokovima (kod za upis, iznimka, dorada, filtri, uređivanje s dijalogom, obrazac s pogreškom, izvoz) prolazi; axe (WCAG 2 A/AA, 2.1 AA i najbolje prakse) na 390 i 1280 px u svijetloj i tamnoj temi nije našao pogreške na novim elementima, osim dva nalaza trake prototipa (`#proto-bar`: nedostaje `lang` i landmark), koji postoje i prije NF-4 i nisu proizvod.

Otvoreno: lažni poslužitelj za scenarij VIZ „puno” (NZ-18) u `packages/test-fakes`; e2e izvoza (NZ-16); čitač zaslona (nije izmjereno); postojeći tekstovi prototipa izvan ovog zadatka još imenuju „Pružatelj A, model M-2” (ekrani sažetak, brz put i rad, dio 5) i trebaju se zamijeniti riječju „Asistent”.
