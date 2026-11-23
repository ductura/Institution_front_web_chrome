# Nove funkcije, dio 6: Mentorstvo i konzultacije (mentor i student, etape i rokovi, zahtjevi za konzultacije i termini, zapisnik, komentari i dorada, „Poruka sebi” i „Dokle sam stao”, obrasci i zahtjevi fakulteta, pregled mentora nad više studenata)

Zadatak NF-6 `nove-funkcije-mentorstvo`. Dodao ga je orkestrator 23. 11. 2026. po planu „Nove funkcije: pregled dio po dio” (plan u `ductura/.github` oblak ne vidi, pa je opis zadatka iz naloga). Oblik i razina detalja po uzoru na `docs/nalazi/nove-funkcije-1-student-zadaci.md` do `nove-funkcije-5-nastavnik-pregled-rada.md`. Ovaj dokument je samo pregled; kod se ne mijenja. Predaja je dio 3, kolegiji i zadaci dio 4, pregled predanog rada dio 5; ovdje su spomenuti samo gdje dodiruju mentorstvo.

Oznake: nalazi **M-n**, prijedlozi **MK-n** (da se ne miješaju s H-n/PG-n iz dijela 5, G-n/NZ-n iz dijela 4, P-n iz dijelova 1 i 2 ni PR-n iz dijela 3). Odluke iz dijelova 1 do 5 se ne ponavljaju kao pitanja, nego se na njih nadovezuje (vidi §0).

## 0. Izvori, način pregleda i ograničenja

Pročitano:
- prototip: `docs/prototip/INVENTAR-editor.md` §2.5 (`mentor2.js`: kartica Mentor, stanje rada, etape, poruke, konzultacije, „Kako mentor radi”, obrasci fakulteta, suglasnost mentora, stanja nakon predaje i obrana, dijalozi „Vremenska crta”, „Moji studenti”, „Vrati na doradu”, „Zatraži konzultacije”; `mentor3.js`: „Pregled runde”, „Usporedi predaje”, „Kriteriji ocjene”), §2.4 (rail: „Gdje sam stao”, „Poruka sebi”, rokovi), §2.8 i §8; `docs/prototip/INVENTAR-nastavnik.md` (N-12 `konzultacije`, N-15 etape, N-16 `mentorstva` s `zm-h` i `do-h`, §7 nejasno); `docs/prototip/INVENTAR-student.md` (PO-40 dorada, N-4); Danielovi odgovori `docs/prototip/ODGOVORI-DANIEL-2026-11-19.md`; `Ductura_nastavnik*.html` i `editor/mentor2.js`, `mentor3.js`, `nf2.js` samo za nazive, redoslijed i stanja;
- revizije `docs/nalazi/paritet-editor-2.md` (D01–D06 kartica Mentor, B86 i C-07 „Poruka sebi” i „Nastavi gdje ste stali”, B93 i C-33 etape i zapisnik, C-24 „Riješi redom”), `paritet-nastavnik-2.md`, `paritet-student-2.md`; te dijelovi 1 do 5 ove serije (`nove-funkcije-2` P-8, P-13, P-16, pitanje 8; `nove-funkcije-4` NZ-12, NZ-14; `nove-funkcije-5` PG-6, PG-8, PG-9, PG-10);
- aplikacija (host) `packages/app/src/host/`: `editor/mentor/` (`MentorCard`, `mentor-model`, `messages.hr.ts`), `editor/work/consult/` (`ConsultPanel`, `ConsultSlots`, `ConsultRecords`, `ConsultCriteria`, `consult-model`), `student/mentorship-request/` (zahtjev za mentorstvo), `teacher/n12/` (zapisi konzultacija), `teacher/n16/` (`RequestsCard`, `WorksList`), `teacher/mentorships/`, `teacher/revision/`, `teacher/key-dates/`, `editor/assist/AssistCards.tsx` (`ResumeCard`), te `src/components/editor/mentor/` (poruke, `WorkMentorSections`); samo kao izvor teksta i ponašanja;
- ugovori u izvatku `src/client/migration-contracts.generated.json` za ovaj dio (provjereno čitanjem izvatka, ne poslužitelja):
  - mentorstvo: `mentorship.student-mentor-candidates.get`, `mentorship.requests.post` (`teacherId`, `workType`), `mentorship.student-requests.get` (stanja `requested`, `approved`, `declined`, `withdrawn`), `mentorship.request-withdraw.post`, `teacher.mentorship-requests.get`, `teacher.mentorship-request-decision.post` i `mentorship.request-approve.post|request-decline.post` (neobavezan `reason`, do 600 znakova), `teacher.mentorships.get`, `teacher.mentorship.get` (stanje rada `not_started`, `in_progress`, `submitted`), `mentorship.key-dates.get` (vrste `deadline`, `milestone`, `consultation`), `mentorship.notes.get|post` (mentorove vlastite bilješke);
  - etape: `work.milestones.get|patch`, `work.milestone-states.get` (stanja `not_submitted`, `submitted`, `revision_requested`, `approved`), `work.milestones.submit.post`, `…approve.post` (`message`), `…request-revision.post` (`comment`, `revisionDueAt`), `…details.patch` (`title`, `dueAt`), `…delete`, `work.milestone-plan.get`, `…add.post`, `…apply-template.post`, `institution.milestone-template.get|put` (uključuje `requireFinalStageApproval`);
  - konzultacije: `work.consultation-slots.get|post|patch` (stanja `requested`, `countered`, `confirmed`; radnje `confirm`, `counter`, `accept`), `work.consultation-records.get|post` (`heldOn`, `topic`, `agreement`), `work.consultation-additions.post` (`text`);
  - komunikacija i dorada: `work.messages.get|post` (`senderRole` student ili nastavnik, `text`), `work.return-for-revision.post`, `collaboration.revision-requests.post`, `notifications.returned-for-revision.list.get`, `notifications.list.get` (vrste `assignment_version`, `comment_posted`, `course_handover`, `deadline_reminder`, `submission_recorded`), `collaboration.comments.post`, `work.comment-drafts*`, `teacher.comment-bank*`, `work.comments.publish*`;
  - fakultet: `institution.faculty-rules.get|post`, `student.declaration.get`, `teacher.declaration.get`, `teacher.declaration-required.get|put`.

Što nije učinjeno, izričito:
- **aplikacija nije pokrenuta** s lažnim poslužiteljem u ovoj sesiji. Revizije `paritet-editor-2.md` i `nove-funkcije-2` navode da scenarij VIZ „puno” ne otvara editor (`/me` nema `journalScope` i `sessionTag`), pa se kartica Mentor i konzultacije ondje ne mogu proći klikom. Zato je **gotovo sve u ovom dijelu izvedeno iz izvornog koda, kataloga poruka, ugovora i revizija, a ne potvrđeno klikom**. Gdje stavka ovisi o stvarnom prikazu, označena je „provjeriti u pregledniku”;
- **plan `NOVE-FUNKCIJE.md` iz `ductura/.github` nije čitan** (oblak nema pristup); sadržaj dijela 6 uzet je iz naloga orkestratora;
- **kasniji PR-ovi nisu provjereni.** Revizije su od 22. i 23. 11.; prije otvaranja zadatka po bilo kojem nalazu provjeriti da nije riješen u novijoj grani (osobito montiranje `MentorCard` i `ConsultPanel`);
- nije provjeravan pravi poslužitelj, baza ni Docker: znamo što ugovor dopušta, ne što poslužitelj stvarno vraća ni tko smije koju radnju (to je RLS, nije vidljivo iz izvatka);
- opisi sličnih alata u §3.1 su iz općeg poznavanja takvih alata, ne iz uživo provjere njihovih trenutačnih verzija; ništa se ne kopira (ni izgled ni tekst);
- svi primjeri su izmišljeni („Student A”, „Nastavnik A”, kolegij „Uvod u medije”, rad „Mediji i povjerenje”); nijedna stvarna osoba ni rad.

Odluke na koje se nadovezuje (ne pitaju se ponovno):
- **Dijelovi 1 do 5: sve je u pilotu** (Daniel, 23. 11.).
- **Asistent u pilotu radi** (23. 11.; pružatelj i model se ne imenuju, Q-10 nije donesena). Zato mentor uz izjavu vidi zabilježene razgovore studenta s asistentom (dio 5 PG-6), a priprema za konzultacije smije spomenuti da je asistent korišten samo kao činjenicu iz izjave, bez sadržaja izvan studentove izjave.
- **NF-2:** zapisnik konzultacija i „Dokle sam stao” su u pilotu (Daniel, 23. 11.); „Poruka sebi” ide s njima po nalogu.
- **NF-5:** ocjena ostaje u Merlinu (PG-10 (a)); nastavnik čita objašnjenje studenta uz nalaz; ritam pisanja po dijelu teksta vidljiv uz napomenu „zapis o unosu, ne o autorstvu”; izvoz i ispis pregleda s oznakama dopušten uz upozorenje; pitanje nastavnika uz izjavu je u pilotu (SRV zadatak otvoren); **nema automatskog zaključka o autorstvu.** Iz toga za ovaj dio slijedi da **kriteriji ocjene** iz prototipa (`mentor3.js`, §2.5 točka 6) ne postaju ocjena u Ducturi: smiju biti samo vidljiva rubrika bez broja (PG-10 (c)), ako je vlasnik odobri.
- **Odluke za paritet (22. 11.):** razlog odbijanja mentorstva student vidi (2148); obavijest pri objavi samo u aplikaciji (2147); rok dorade obavezan (2151); toast 3200 ms tek nakon potvrde poslužitelja (2164); kriteriji ocjene vidljivi studentu (2122); suradnik samo čita i komentira.
- **Ustav v1.6 C-6, v1.7/v1.8, v1.9** i P-1: „Podrijetlo teksta”, ritam unosa i oznaka „za pregled” vrijede kako su opisani u dijelu 5; ovdje se spominju samo kao sadržaj koji mentor već vidi, ne kao novi prikaz.
- **PRODUCT §5 pravilo 5** (po inventaru): mentorove radne bilješke student ne vidi (`mentorship.notes` su samo mentorove).

Ograničenja plana za sve prijedloge: rok funkcija pilota 15. 1. 2027. se ne pomiče; prijava samo AAI@EduHr (D-09, D-16); server se ne izmišlja (uz svaki prijedlog stoji postoji li operacija u izvatku ili treba novo polje); prototip ostaje izvor istine; PRODUCT §5 i rječnik zabranjenih izraza vrijede za svaki tekst; podaci su izmišljeni.

---

## 1. Tok mentora i studenta od početka do kraja

Rute u hostu (iz `routes.ts`, koda i revizija): student `/zadaci/mentorstvo` (zahtjev za mentorstvo, trenutačno `pending` u `routes.ts`), editor `/rad/{documentId}` s karticom Mentor u desnom panelu; nastavnik `/nastavnik/mentorstva` (N-16), `/nastavnik/rad/{documentId}` (okvir rada, dio 5) i `…/konzultacije` (N-12). **Prototip drži mentora u desnoj kartici editora (`panelRad`, „Mentor i predaja”), a nastavnika u zasebnim ekranima; host ih još nije povezao** (§2, M-1).

### 1.1 Dodjela mentora (završni/diplomski rad)

1. **Student** otvara „Zahtjev za mentorstvo” (`MentorshipRequestPage`): bira nastavnika s popisa kandidata (`mentorship.student-mentor-candidates.get`, ime i odjel) i vrstu rada (završni, diplomski, specijalistički, doktorski), „Pošalji zahtjev”. Poruka: „Zahtjev je poslan i čeka odluku nastavnika.” Popis „Moji zahtjevi” s oznakama „Čeka odluku / Odobreno / Odbijeno / Povučeno”; „Povuci zahtjev” dok čeka. Tom nastavniku za tu vrstu rada može postojati samo jedan zahtjev koji čeka („Tom nastavniku za tu vrstu rada već imate zahtjev koji čeka odluku.”).
2. **Nastavnik** vidi karticu „Zahtjevi za mentorstvo” na N-16 (`RequestsCard`): „Odobri” (`mentorship.request-approve.post`; „Zahtjev je odobren; mentorstvo je nastalo.”) ili „Odbij” kroz dijalog `do-h` s neobaveznim razlogom do 600 znakova („Student vidi odgovor i razlog.”, odluka 2148). Bez zahtjeva: „Nema zahtjeva na čekanju.”
3. Nakon odobrenja nastaje **mentorstvo**; nastavnik ga vidi na popisu „Radovi uz mentora” (`teacher.mentorships.get`: student, naslov, vrsta rada, stanje rada „nije započeto / u tijeku / predano”) s „Otvori rad”.
4. Obavijest studentu o odluci: samo u aplikaciji (2147); `notifications.list.get` nema vrstu za mentorstvo (vrste su `assignment_version`, `comment_posted`, `course_handover`, `deadline_reminder`, `submission_recorded`), pa je način na koji student **saznaje** za odluku otvoreno pitanje (§2, M-3).

### 1.2 Etape rada i rokovi etapa

1. **Plan etapa** (`work.milestone-plan.*`, `institution.milestone-template.*`): fakultet zadaje predložak (npr. Prijava teme, Nacrt, Prvo poglavlje, Cijeli nacrt, Predajna verzija; opisi iz prototipa `STG`), a plan rada se gradi iz predloška („apply-template”) ili dodavanjem etape (`title`, `dueAt`, `submits`). Predložak može zahtijevati odobrenje završne etape (`requireFinalStageApproval`).
2. **Student:** u kartici Mentor, „Etape · X od Y odobreno”: stanje svake etape (`not_submitted`, `submitted`, `revision_requested`, `approved`), rok, opis; „Predaj etapu” (`work.milestones.submit.post`, „Etapa je predana mentoru.” u prototipu). „Sljedeća etapa: {naslov} · rok {datum} ({za n dana})”.
3. **Mentor:** „Odobri” (`approve`, poruka `message`) ili „Vrati s napomenom” (`request-revision`: `comment`, `revisionDueAt`); „promijeni rok” (`work.milestones.patch|details.patch`, `dueAt`).
4. **Rokovi mentorstva** na jednom popisu: `mentorship.key-dates.get` (rok zadatka, rokovi etapa i konzultacije, poredano po trenutku). U prototipu „Vremenska crta rada” (`m2time`) spaja i povijest događaja; u hostu postoji `teacher/key-dates/`.
5. Etapa nije ocjena; ono što student vidi jest stanje i napomena mentora.

### 1.3 Zahtjev za konzultacije i termini

1. **Student:** „Zatraži konzultacije” (`work.consultation-slots.post`, `startsAt`): polje „Predloženi termin”; u prototipu i „O čemu želite razgovarati” te kvačica „Priloži pripremu za konzultacije”. Termin je „čeka mentora” (`requested`).
2. **Mentor** na termin: „Potvrdi” (`confirm`) ili „Predloži drugi termin” (`counter`, novi `startsAt`); stanje „čeka studenta” (`countered`).
3. **Student** na prijedlog: „Prihvati {termin}” (`accept`). Potvrđeni termin (`confirmed`) ulazi u rokove (`key-dates`).
4. Tekst stanja ovisi o ulozi (`consultHr.slots.status`): student „čeka mentora / mentor predlaže drugi termin / potvrđeno”, mentor „čeka Vaš odgovor / čeka studenta / potvrđeno”, suradnik kao student.

### 1.4 Zapisnik konzultacija

1. **N-12 (nastavnik):** „Novi zapis konzultacije”: datum (`heldOn`), verzija rada (select, obvezno u prototipu), tema (obvezno), „Dogovoreno” (`agreement`); „Konzultacija je zabilježena. Isti zapis vidi i student.”
2. **Dopune:** zapis se ne briše ni ne prepravlja, može se samo dopuniti (`work.consultation-additions.post`, `text`; dopuna nosi vrijeme); dopunjuje samo mentor; student vidi zapis i dopune.
3. **Student** u kartici Mentor: „Zapisnik (vide ga student i mentor)” (`ConsultRecords`): „Održano: {datum}”, „Tema”, „Dogovoreno”, „Dopune”.
4. **Razlika od prototipa:** prototip (`mentor2.js`) dopušta zapis i studentu, uz „Potvrđujem” i „Imam primjedbu” druge strane te „Dogovoreno na konzultacijama” kao popis zadataka s kvačicama (`S.tasks`, `konsTask`). U hostu stoji „Potvrda zapisnika druge strane nije dostupna.” (`confirmUnavailable`): **ugovor nema ni potvrdu ni primjedbu ni zadatke**.

### 1.5 Komentari mentora, povratna informacija i dorada

1. Mentor komentira tekst (komentari uz mjesto, prijedlozi izmjene, nacrti koji nisu objavljeni, banka komentara; dio 5 PG-9). Objava komentara studentu (`work.comments.publish*`) javlja studentu `comment_posted`.
2. **Dorada:** „Vrati na doradu” (`work.return-for-revision.post`) s tekstom i rokom (rok obavezan, 2151). Student u kartici Mentor: „Rad je kod Vas: dorada”, „rok {datum} (za n dana)”, „n obveznih komentara otvoreno”, „Riješi redom”, „Pošalji doradu”. Mentor: „Rad čeka Vaš pregled”, „Prihvati rad” / „Vrati na doradu”.
3. **Pregled runde** (nastavnik, prototip `m3In`): što je novo od zadnjeg slanja, tvoji komentari (riješeni, otvoreni, „student je odgovorio”), što je sustav označio, sažetak podrijetla; hostu odgovara dio 5 (`changes-since-review`).
4. **Poruke** između mentora i studenta uz rad (`work.messages.get|post`): kratke poruke koje nisu komentar uz tekst; u prototipu „Poruke (N) · novo K” i značka kartice Mentor.

### 1.5a Suglasnost za predaju i obrasci fakulteta

1. Prototip: „Suglasnost mentora za predaju” (mentor „Odobravam predaju” / „Povuci”), „Obrasci fakulteta (X od Y)” (kvačice koje student sam označi: prijava teme, izjava o izvornosti rada, izjava o pohrani u repozitorij; „Popis je primjer. U Ducturi ga daje fakultet.”), „Proba predaje” s redcima „Suglasnost mentora” i „Obrasci fakulteta”.
2. **U izvatku nema operacije za suglasnost mentora ni za popis obrazaca fakulteta** (traženo: „consent”, „form”). Postoji izjava o AI-ju kao obrazac fakulteta (`declaration-v1`, `currentForm`), ali to nije popis obrazaca za završni rad.

### 1.6 „Poruka sebi” i „Dokle sam stao”

1. **Student** (samo pisanje, nepredano): „Poruka sebi” (jedna rečenica za sljedeći put; kursor čeka u odlomku u kojem je student pisao; „Poruka je spremljena za sljedeći put.”), „Idi tamo”, „Obriši”.
2. **„Nastavi gdje ste stali: {poglavlje}”** (rail, odjeljak 5) skače na zadnji položaj; „Što je novo od zadnje sesije” (`prevTouched`). Alatna traka: „Dokle sam stao” (oznaka dokle je student pročitao; vidi je samo student). Mentor to **ne** vidi („vidite je samo Vi”).
3. U hostu `ResumeCard` postoji ali ga nijedan ekran ne montira (`paritet-editor-2.md` C-07); „Poruka sebi” u editoru ima samo okvir (B86).

### 1.7 Pregled mentora nad više studenata

1. **N-16 „Radovi uz mentora”** (`WorksList`): student, naslov, vrsta rada, stanje rada („nije započeto / u tijeku / predano”), „Otvori rad”; N-17 „Zbirni” po kolegiju (dio 4).
2. Prototipov dijalog **„Moji studenti”** (`m2all`): tablica „Student i rad / Etapa / Stanje” s redoslijedom „čeka Vas” prvo, „kod studenta, rok prošao prije n dana”, „predano, obrana …”; u prototipu su ostali redovi izmišljeni primjeri, „u Ducturi je to zaseban ekran mentora”. **U izvatku nema agregata mentora** (etapa, tko čeka koga, dani kašnjenja po studentu): `teacher.mentorships.get` daje samo `workState`.
3. Brz put i obavijesti (dio 4, dio 5) vode kroz radove; nema popisa „što čeka mene” za mentora.

### 1.8 Nakon predaje

Prototip `AFT`: „predano referadi → kod povjerenstva → zakazan termin obrane → obranjeno”, „Termin obrane”, „Pitanja koja možete očekivati na obrani”, „Kostur za obranu”; N-14 „priprema za razgovor” (dio 5). **U izvatku nema stanja nakon predaje ni obrane** (ni predaje referadi); to ostaje izvan ovog dijela (§4, MK-14).

---

## 2. Gdje zapinje

Svi nalazi su iz koda, kataloga i revizija (ne iz klika). Težina: **V** visoka (student/mentor ne može obaviti korak ili zbunjuje), **S** srednja, **N** niska.

### 2.1 Koraci i stanja

- **M-1 (V) Kartica Mentor u živom editoru nije cijela.** Montirani su Proba predaje, stanje rada, vremenska crta i zahtjevi za doradu (`EditorPageWork`, `RevisionPanel`), ali ne `MentorCard` (značka, priprema, konzultacije, zapisnik, kriteriji): D02, D05 i C-33 u reviziji `paritet-editor-2.md`. Komponente `ConsultPanel`, `ConsultSlots`, `ConsultRecords` i klijent postoje i imaju testove, ali ih nijedan ekran ne montira. Student zato **nema ulaz** u „Zatraži konzultacije” ni u zapisnik. (Provjeriti u grani prije zadatka.)
- **M-2 (V) Student ne vidi stanje dorade, pregleda i prihvata u kartici (D05).** Stanja `review`, `revise`, `accepted` iz prototipa nisu u hostu; student vidi samo zahtjeve za doradu. „Rad je kod mentora” i „Prihvaćeno” nikad nisu rečeni.
- **M-3 (S) Odluka o zahtjevu za mentorstvo stiže bez obavijesti.** Odluka se pokazuje samo na popisu „Moji zahtjevi”; `notifications.list.get` nema vrstu za mentorstvo, pa student mora sam otvoriti stranicu. Ruta `/zadaci/mentorstvo` je `pending` u `routes.ts`. Nije jasno gdje se u glavnoj navigaciji studenta pojavljuje.
- **M-4 (S) Zahtjev za mentorstvo ne vodi dalje.** Nakon „Odobreno” ne postoji „Započni rad uz mentora” ni poveznica na rad; student mora sam naći zadatak. Nastavnik nakon odobrenja vidi mentorstvo bez zadatka dok student ne započne rad (`not_started`).
- **M-5 (S) Zahtjev je vezan uz vrstu rada, a ne uz zadatak.** `mentorship.requests.post` prima `teacherId` i `workType`; ne postoji polje za temu ni kratki opis namjere. Nastavnik odlučuje „slijepo” o temi.
- **M-6 (S) Nema pamćenja zahtjeva nakon odbijanja.** Odbijen zahtjev ostaje na popisu, ali nema „Pošalji drugom nastavniku” (ponovno unosi isto). Razlog je vidljiv (2148); nije provjereno prikazuje li ga host na popisu.
- **M-7 (V) Zapisnik konzultacija: ugovor je uži od prototipa.** Nema potvrde druge strane, primjedbe, brisanja vlastitog zapisa ni zadataka „Dogovoreno” (`confirmUnavailable`). Student ne može zapisati svoj dojam; to rješava samo nastavnik. Student može tek vidjeti zapis.
- **M-8 (S) Termin: nema otkazivanja ni povlačenja.** `work.consultation-slots.patch` poznaje samo `confirm`, `counter`, `accept`. Prototipov „Ukloni” nema ugovor; student ne može povući zahtjev koji više ne treba, a mentor ne može odbiti.
- **M-9 (S) Termin je jedno polje `startsAt`.** Nema teme, trajanja, mjesta/poveznice ni priloga „priprema za konzultacije” kakve prototip ima (`topic`, `prep`). Mentor ne zna o čemu se razgovara dok ne dođe.
- **M-10 (S) Etape: stanje se ne poklapa s izvorom.** `work.milestone-states.get` nema opis etape (opisi `STG` iz prototipa); nastavnik vidi samo naslov. Student ne vidi što etapa traži.
- **M-11 (S) „Vrati s napomenom” i „Vrati na doradu” su dva puta.** Etapa (`milestones.request-revision`) i cijeli rad (`return-for-revision`) imaju zasebne ulaze i rokove; student ne vidi razliku ni gdje je dorada (dio 5 PG-8 ima isti nalaz za nastavnika).
- **M-12 (S) Nema „Kako mentor radi”.** Prototipov tekst („Odgovaram unutar pet radnih dana. Šaljite cijela poglavlja… Konzultacije su četvrtkom od 12 do 14.”) u hostu stoji kao „Ovaj podatak trenutačno nije dostupan.”; **u izvatku nema polja**. Student ne zna očekivani rok odgovora.
- **M-13 (S) Poruke mentor–student nisu uvijek ulaz.** `WorkMessages` postoji (`src/components/editor/mentor/messages/`), a `MentorCard` ih ne prikazuje u hostu; značka „novo” ne radi bez montiranja (D02). Poruke ne dobivaju obavijest (nije u vrstama `notifications.list.get`).
- **M-14 (N) Mentor ne vidi dokle je student stao.** „Dokle sam stao” i „Poruka sebi” su namjerno studentove; mentor to ne smije vidjeti. Nije nalaz, nego granica koju treba zadržati (MK-9).

### 2.2 Pristupačnost

- **Provjeriti u pregledniku:** kartica Mentor ima mnogo odjeljaka (`details`) koji se otvaraju sami („Poruke” kad ima novih, „Etape” zatvoreno); fokus i čitač zaslona kod automatskog otvaranja; ciljevi dodira za „+ Termin”, „Ukloni”, „Potvrdi” (revizija navodi 34–38 px za konzultacije i komentare u alatnoj traci editora, dio 2).
- **Značka kartice** („Mentor: n novo”) mora biti tekst, ne samo broj ili boja; prototip je ima kao `tag c2new` „novo”.
- **Stanje termina** (`čeka mentora`, `potvrđeno`) kao tekst uz boju; kontrast oznaka u tamnoj ljusci provjeriti centralno (VIZ).
- **Datum i vrijeme termina:** polje „Predloženi termin” u prototipu je slobodan tekst („npr. 20. 11. 2026. u 12:30”); u hostu je potreban pravi izbor datuma i vremena s tipkovnicom i čitačem; slobodan tekst vodi do greške „Termin nije valjan” (`consultHr.slots.errors.invalid`).
- **Zapisnik:** zapis se ne smije brisati ni prepravljati; čitač zaslona treba čuti „dopuna, dodao mentor, datum”.
- **Dijalozi** `do-h` („Odbiti zahtjev za mentorstvo?”), „Zatraži konzultacije”, „Vrati na doradu”: fokus, Escape, povratak fokusa, obavezno polje s porukom greške.

### 2.3 Mobitel

- Student piše na mobitelu rjeđe, ali **zahtjev za konzultacije, potvrda termina i čitanje zapisnika** su kratke radnje koje se rade s mobitela. Desni panel editora na ≤1050 px postaje ladica (`min(320px,88vw)`); kartica Mentor u ladici mora biti dohvatljiva s jednim dodirom (mobilna alatna traka editora nema „Mentor”: dio 2 G-5 „nema Brzih alata”).
- Mentor na mobitelu: odobravanje zahtjeva za mentorstvo i potvrda termina; N-16 i N-12 su tablice; dio 4 NZ-12 i dio 5 PG-12 imaju isti nalaz (tablice u kartice na 400 px).
- „Idi tamo” kod „Poruke sebi” na mobitelu otvara tipkovnicu i skok; provjeriti da ne pomiče ekran.

### 2.4 Greške i oporavak

- Poruke grešaka u hostu su dobre i **tek nakon potvrde poslužitelja** (2164): „Nije poznato je li promjena zabilježena. Provjerite prikaz prije novog pokušaja. Ono što ste upisali je sačuvano.” (termin), „Nije poznato je li zapis spremljen. Ono što ste upisali je sačuvano.” (zapisnik), „Nije poznato je li zahtjev zabilježen. Osvježite popis prije novog pokušaja.” (mentorstvo). To je ispravan uzor; ostaje provjeriti da **upisani tekst doista ostaje** u polju nakon greške.
- **Istek sesije** („Prijava je istekla. Prijavite se ponovno.”) vraća na AAI@EduHr; provjeriti da se nacrt zapisa ili poruke ne gubi.
- **Istodobna promjena** („Termin je u međuvremenu promijenjen…”, 409): prikaz se osvježava; provjeriti da mentorova potvrda i studentov prihvat u istom trenutku ne daju lažan uspjeh.
- **Prazna stanja** („Nema dogovorenih termina.”, „Nema zapisa s konzultacija.”, „Nema zahtjeva na čekanju.”) postoje; stanje „poslužitelj ovaj dio ne daje” (npr. „Kako mentor radi”) mora se razlikovati od praznog (dio 5 PG-4).
- **Poruka sebi i „Dokle sam stao”:** lokalni su podaci. Gdje se čuvaju i što biva pri odjavi (logout fence i brisanje lokalnog dnevnika, `ductus-local-storage-logout`), nije potvrđeno u ovom pregledu; „Poruka sebi” ne smije preživjeti odjavu na zajedničkom računalu (privatnost, §3.2).

---

## 3. Slični alati, pilot, privatnost, AI izjava i pravičnost

### 3.1 Što nude slični alati (opisno, bez kopiranja izgleda)

Iz općeg poznavanja takvih alata, ne iz uživo provjere:
- **Sustavi za e-učenje (tipa Merlin, Moodle, Canvas):** zadatak s rokovima, predaja i povratna informacija, poruke uz kolegij; mentorstvo za završni rad obično nije modelirano (nema etapa po radu, a komunikacija ide e-poštom).
- **Alati za vođenje završnih i doktorskih radova (tipa sustava za prijavu i praćenje završnih radova na fakultetu, repozitoriji):** prijava teme, odobrenje mentora, obrasci i rokovi, pohrana rada; nisu uz sam tekst i proces.
- **Uređivači i radni prostori u oblaku (tipa Google Dokumenti, Notion, Overleaf):** komentari i prijedlozi, povijest verzija, dijeljenje s mentorom; konzultacije i etape se vode izvan dokumenta (kalendar, e-pošta).
- **Alati za bilješke i zakazivanje (tipa kalendarski sustavi s terminima):** prijedlog termina, potvrda, protuprijedlog; očekivanje: jedan klik za potvrdu, podsjetnik, otkazivanje.
- **Alati za bilježenje sastanaka:** zapisnik s dogovorenim zadacima i odgovornima; obično jedna strana piše, druga potvrđuje.

Što mentori obično traže: (1) jedno mjesto gdje se vidi „tko je na redu” za svakog studenta; (2) zapisnik koji ne ovisi o sjećanju; (3) rokovi etapa koji studenta ne iznenade; (4) komentar uz mjesto u tekstu i jasan rok dorade; (5) da ih sustav ne tjera na ocjenjivanje procesa. Što studenti obično traže: (1) da znaju što mentor očekuje i koliko brzo odgovara; (2) da konzultacije mogu zatražiti bez e-pošte; (3) da se dogovoreno vidi kao popis, ne kao prepričavanje; (4) da se „gdje sam stao” ne izgubi između sesija; (5) da nitko ne vidi njihove privatne bilješke.

### 3.2 Što traže pilot, privatnost, AI izjava i pravičnost

- **Pilot:** prijava samo AAI@EduHr (D-09, D-16); rok funkcija 15. 1. 2027.; sve novo najprije u prototip i `INVENTAR-editor.md`/`INVENTAR-nastavnik.md`; izmišljeni podaci do pravnog mišljenja i DPIA; komponente iz `@ductura/ui` bez lokalnog stila; server se ne izmišlja.
- **Privatnost:**
  - mentor vidi tekst studentova rada samo uz mentorstvo ili dodjelu; svaki pristup nastavnika bilježi se u dnevnik pristupa;
  - **mentorove radne bilješke** (`mentorship.notes`) student ne vidi (PRODUCT §5 pravilo 5); komentar označen „privatna bilješka” ne smije procuriti u objavu (`work.comments.publish*`);
  - **„Poruka sebi” i „Dokle sam stao” su osobni podaci studenta**: ne vide ih mentor ni nastavnik; ne ulaze u izvoz, pregled ni dnevnik; briše ih odjava na zajedničkom uređaju;
  - **zapisnik konzultacija** vidi student i mentor; ne briše se ni ne prepravlja (samo dopune), pa student mora znati da je zapis trajan prije nego što ga mentor spremi;
  - razlog odbijanja mentorstva do 600 znakova vidi student; mentor ne smije upisati ocjenu osobe (tekst pomoći: „Opišite razlog u vezi s kapacitetom ili temom”);
  - izmišljeni podaci u testovima i fixtureima; nijedan stvarni mentor ni student.
- **Pravila o AI izjavi:** izjava je obrazac fakulteta (`declaration-v1`); asistent u pilotu radi, a razgovori se prilažu izjavi. Za mentorstvo: priprema za konzultacije i zapisnik smiju reći **da** je asistent korišten (činjenica iz izjave), ne zaključak o autorstvu; asistent ne piše u zapisnik ni u poruku mentoru umjesto studenta; „Izjava o izvornosti rada” (naziv službenog obrasca, B-5) ostaje doslovan naziv obrasca. Pružatelj i model se ne imenuju (Q-10).
- **Pravičnost prema studentu:**
  1. student vidi isto što i mentor o vlastitom radu (rokovi, etape, zapisnik, komentari, dorada);
  2. rok dorade obavezan i vidljiv, napomena etape tekstom („Vrati s napomenom”), razlog odbijanja vidljiv;
  3. **mentor se ne nagrađuje ni kažnjava preko sustava**: nema rangiranja studenata, „zastavica” ni brojača „kasni” koji ide u ocjenu; pregled „Moji studenti” opisuje stanje („kod studenta, rok prošao prije 3 dana”), ne procjenu osobe;
  4. ocjena ostaje u Merlinu; „Kriteriji ocjene” iz prototipa najviše kao rubrika bez broja (PG-10 (c));
  5. nijedna oznaka procesa (ritam, podudaranje, podrijetlo) ne ulazi u zapisnik konzultacije, etapu ni povratnu informaciju bez studentova objašnjenja uz nju (dio 5);
  6. studenti bez mentora (`not_started`, bez odobrenja) imaju isti pristup alatima kao drugi, bez „ocjene aktivnosti”.
- **Zabranjeni izrazi:** svaki novi tekst kroz skener (PRODUCT §5): „plagijat”, „kazna”, „dokaz autorstva” (samo u negaciji), „varanje”, „izvornost” (samo naziv obrasca); u poruci o kašnjenju etape opisuje se rok, ne student.

---

## 4. Numerirani prijedlozi

Veličina: S (do ~150 redaka koda), M (150–400), L (više od 400 ili više PR-ova). „Server” = treba li novo polje ili ruta; „ne, postoji” znači da je operacija u izvatku ugovora. „Prototip” = dodiruje li prototip (`Ductura_nastavnik*.html`, `editor/mentor2.js`, `INVENTAR-*.md`) i što bi se najprije izmijenilo.

**MK-1 Mentor u editoru: montirati cijelu karticu Mentor.**
- Opis: montirati `MentorCard` (stanje rada, značka, etape, poruke, konzultacije, zapisnik) u desni panel editora, s redoslijedom iz prototipa (Stanje rada, tri skupine „S mentorom / Uz rad / Predaja”); stanja `review`, `revise`, `accepted` s tekstom po ulozi (`mentorCardHr.headline`); mobilni ulaz u ladicu.
- Korist: M-1, M-2, M-13; bez ovoga ostali prijedlozi nemaju gdje živjeti. Veličina: M do L (više PR-ova, dio 2 P2-10 i VIZ okvir). Rizik: srednji (dira okvir editora; okvir je centralan i zaključan, vidi pravilo „VIZ okvir editora”). Server: ne, postoji (`work.milestone-states.get`, `work.messages.*`, `work.consultation-*`). Prototip: da (`panelRad`, mentor2).

**MK-2 Zahtjev za konzultacije i termini: cijeli tok studenta i mentora.**
- Opis: „Zatraži konzultacije” (izbor datuma i vremena umjesto slobodnog teksta), stanja termina tekstom, „Potvrdi / Predloži drugi / Prihvati”, uloga-ovisan tekst; termin potvrđen ulazi u „Rokovi”; isti ulaz s N-12 za mentora (`ConsultSlots`).
- Korist: M-1, M-8, M-9, §2.2 (datum). Veličina: M. Rizik: nizak do srednji (istodobna promjena 409). Server: ne, postoji; **tema, trajanje, mjesto i otkazivanje nisu u ugovoru** (ne izmišljam; vidi MK-3). Prototip: da (`m2meet`).

**MK-3 Termin: tema, otkazivanje i povlačenje.**
- Opis: polje „O čemu želite razgovarati”, radnje „Povuci zahtjev” (student) i „Odbij” (mentor), „Otkaži potvrđeni termin”; podsjetnik na termin kroz `deadline_reminder` ako vlasnik odobri.
- Korist: M-8, M-9. Veličina: M. Rizik: nizak. Server: **da: nova polja i radnje u `work.consultation-slots` (npr. `topic`, radnje `withdraw`, `decline`, `cancel`)**; ne izmišljam oblik, otvara se SRV zadatak. Prototip: da (`m2MeetDel`, `m2MeetSend` s temom).

**MK-4 Zapisnik konzultacija: pilot dio.**
- Opis: zapis (datum, tema, dogovoreno) i dopune kroz N-12 i kroz karticu Mentor; student čita; tekst „zapis se ne briše ni ne prepravlja” prije spremanja; poveznica na verziju rada (zadatak N-12); „Kopiraj zapisnik” samo uz pravi naziv iz kataloga (ne „Kopiraj” bez pravila „kopirano”, vidi INVENTAR-nastavnik §7 pitanje 4).
- Korist: M-7; NF-2 odluka (zapisnik u pilotu). Veličina: M. Rizik: nizak. Server: ne, postoji (`work.consultation-records.*`, `…-additions.post`). Prototip: da (N-12, `konzultacije`).

**MK-5 Zapisnik: potvrda druge strane, primjedba i dogovoreni zadaci.**
- Opis: student „Potvrđujem” / „Imam primjedbu” na zapis; „Dogovoreno na konzultacijama” kao popis zadataka s kvačicama koje student označava; zapis i student smije započeti („zapisao student”, čeka potvrdu mentora).
- Korist: M-7, pravičnost (student ima glas). Veličina: M do L. Rizik: srednji (zapis je trajan; spor oko sadržaja). Server: **da: potvrda/primjedba, zadaci i student kao autor zapisa nisu u ugovoru** (host: `confirmUnavailable`). Prototip: da (`m2KonsOk`, `m2KonsObj`, `konsTask`).

**MK-6 Etape: plan, rokovi i napomene u jednom pregledu.**
- Opis: popis etapa s opisom (iz predloška fakulteta), stanjem, rokom i napomenom mentora; „Predaj etapu” (student), „Odobri” / „Vrati s napomenom” s obaveznim rokom (mentor); „promijeni rok”; predložak fakulteta primjenjiv na rad („apply-template”); jedan tekst za dorade etape i rada (M-11).
- Korist: M-10, M-11, §1.2. Veličina: M. Rizik: srednji (ishod mora čekati poslužitelj, 2164). Server: ne, postoji (`work.milestone*`, `institution.milestone-template`); **opis etape u `work.milestone-states.get` nije u odgovoru** (ne izmišljam; opis se može uzeti iz predloška). Prototip: da (`m2-etape`, `m2Due`, `stageSub`, `stageOk`, `stageBack`).

**MK-7 Zahtjev za mentorstvo: ulaz, tema i povratna informacija.**
- Opis: stalan ulaz u navigaciji studenta („Mentorstvo”) i s kartice zadatka; kratko polje „Tema ili područje” uz zahtjev; obavijest u aplikaciji o odluci; nakon „Odobreno” gumb „Započni rad” / poveznica na rad; nakon „Odbijeno” razlog i „Pošalji drugom nastavniku”.
- Korist: M-3, M-4, M-5, M-6. Veličina: M. Rizik: nizak. Server: osnova ne, postoji; **tema u zahtjevu i vrsta obavijesti za mentorstvo: da, novo polje i nova vrsta** (ne izmišljam). Prototip: da (nastavnik `zm-h`, `do-h`; studentska strana u prototipu nije posebno popisana, vidi §5 pitanje 4).

**MK-8 Komentari mentora, dorada i „Pregled runde” kao jedan tok.**
- Opis: povratna informacija i dorada u kartici Mentor na jednom mjestu: „Što je mentor rekao” (objavljeni komentari, napomena dorade, rok), „Riješi redom”, „Pošalji doradu”; mentor: „Pregled runde” s „Što je novo” (hostu odgovara `changes-since-review`), „Vrati na doradu” s obaveznim rokom. Nadovezuje se na PG-8 i PG-9 (dio 5): ovdje samo studentska i mentorska strana unutar mentorstva.
- Korist: M-2, M-11. Veličina: M do L. Rizik: srednji. Server: ne, postoji (`work.return-for-revision.post`, `collaboration.revision-requests.post`, `work.comments.*`); „student je vidio” **nije u izvatku**. Prototip: da (`m2Back`, `m3In`, `walkStart`).

**MK-9 „Poruka sebi” i „Dokle sam stao”: pilot dio.**
- Opis: „Nastavi gdje ste stali: {poglavlje}” u railu (`ResumeCard`) i povratna traka pri otvaranju rada („Poruka od prošli put”); „Poruka sebi” (jedna rečenica, „Idi tamo”, „Obriši”); alatna traka „Dokle sam stao” (oznaka čitanja, vidi je samo student). Pohrana **lokalno** (uređaj, Dexie) i briše se odjavom po pravilu o lokalnoj pohrani; mentor i nastavnik ne vide ništa. Ako vlasnik želi da poruka putuje između uređaja, treba polje na serveru (MK-9b, nakon pilota).
- Korist: M-14, §1.6; NF-2 odluka (u pilotu). Veličina: S do M. Rizik: nizak (privatnost: lokalno i brisanje pri odjavi; `ductus-local-storage-logout`). Server: **ne za lokalnu varijantu**; za više uređaja: da, novo polje (ne izmišljam). Prototip: da (`rail`, `noteSelf`, `menu-stop`, `S.lastPos`, `S.prevTouched`).

**MK-10 Priprema za konzultacije.**
- Opis: „Složi iz rada”: što je izmijenjeno od zadnjih konzultacija (broj odlomaka), riješeni komentari, što je od dogovorenog gotovo, otvorena mjesta; student mijenja tekst, „Pošalji mentoru” (uz zahtjev za termin), „Kopiraj”; izračun u pregledniku iz podataka koje student ionako vidi, bez asistenta i bez zaključaka o autorstvu.
- Korist: M-9; manje praznih konzultacija. Veličina: M. Rizik: nizak (sadržaj je iz studentova rada; šalje student). Server: osnova ne (izračun u pregledniku, slanje kao poruka `work.messages.post` ili uz termin); **prilog uz termin nije u ugovoru** (ne izmišljam). Prototip: da (`prepMake`, `prepSend`, `S.prep`; kartica „Priprema za konzultacije”, `mentorCardHr.prep`).

**MK-11 Pregled mentora: „Moji studenti” s redoslijedom „čeka Vas”.**
- Opis: na N-16 uz popis radova stupci „Student i rad / Etapa / Stanje”, prvo „čeka Vas” (rad na pregledu, zahtjev, termin za potvrdu), zatim „kod studenta, rok …”, „predano”; filtar po vrsti rada; poveznica „Otvori rad”; bez rangiranja i bez ocjene aktivnosti.
- Korist: §1.7, mentori s više studenata. Veličina: M. Rizik: srednji (pregled ne smije postati „popis kašnjenja”). Server: **da: agregat po mentorstvu (etapa, čeka koga, dani do roka) nije u `teacher.mentorships.get`** (daje samo `workState`); moguć spoj `work.milestone-states.get` po radu (N poziva), ne izmišljam novu rutu. Prototip: da (`m2all`; u prototipu su ostali redovi izmišljeni).

**MK-12 Obrasci i zahtjevi fakulteta za završni rad.**
- Opis: kartica „Obrasci fakulteta (X od Y)” i redak „Suglasnost mentora za predaju” u Probi predaje; popis daje fakultet (verzionirana datoteka u `config/faculties`, kao OD-11 za izjavu), student označava „predano”, mentor daje i povlači suglasnost; „Popis je primjer” samo u izmišljenim podacima.
- Korist: §1.5a; zahtjevi fakulteta za završni (prijava teme, izjava o izvornosti rada, izjava o pohrani). Veličina: M do L. Rizik: **srednji do visok** (pravni status suglasnosti i obrazaca; „izvornost” samo kao naziv službenog obrasca, B-5). Server: **da: nema operacije za suglasnost mentora ni popis obrazaca** (izvadak sadrži samo izjavu o AI-ju); ne izmišljam, otvara se SRV zadatak. Prototip: da (`m2-obr`, `m2Consent`).

**MK-13 Rokovi: jedan pregled (vremenska crta) za oba korisnika.**
- Opis: „Rokovi” u railu i „Vremenska crta rada” iz `mentorship.key-dates.get` (rok zadatka, rokovi etapa, potvrđene konzultacije; prošlo i predstoji, „danas”); mentor vidi isto po mentorstvu (`teacher/key-dates/`); tekst „za n dana / prije n dana”.
- Korist: M-10, §1.2. Veličina: S do M. Rizik: nizak. Server: ne, postoji. Prototip: da (`m2time`, rail „Rokovi”).

**MK-14 Nakon predaje i obrana (samo odluka).**
- Opis: stanja „predano referadi → kod povjerenstva → zakazan termin obrane → obranjeno”, termin obrane, pitanja za obranu (prototip). Ne gradi se bez ugovora; ovdje samo odluka je li u pilotu.
- Korist: cjelovit tok završnog rada. Veličina: L. Rizik: visok (ovisnost o procesu fakulteta i referade; PRODUCT). Server: **da, nema operacije** (ni stanja nakon predaje ni obrane). Prototip: da (`m2-aft`).

**MK-15 Pristupačnost i mobitel za mentorstvo (jedan prolaz).**
- Opis: tekstualne oznake stanja uz boju; značka kartice kao tekst; izbor datuma i vremena s tipkovnicom; fokus i Escape u `do-h`, „Zatraži konzultacije”, „Vrati na doradu”; mobilna ladica Mentor; tablice N-12 i N-16 u kartice na 400 px; e2e s axe na 1250 i 400 px za karticu Mentor, termine, zapisnik, N-16.
- Korist: §2.2, §2.3. Veličina: M. Rizik: nizak. Server: ne. Prototip: ne (mobilne granice centralno uz VIZ).

**MK-16 Scenarij za provjeru mentorstva (lažni poslužitelj).**
- Opis: u scenariju VIZ „puno” dodati: mentorstvo i zahtjev (`mentorship.*`, `teacher.mentorship*`), etape (`work.milestone*`), termine (`consultation-slots`), zapisnik i dopune, poruke, `key-dates`; i otvaranje editora (isti nalaz kao dio 2 P-22). Samo izmišljeni podaci.
- Korist: bez toga nijedan prijedlog nije provjerljiv klikom. Veličina: S do M. Rizik: nizak (`packages/test-fakes`). Server: ne. Prototip: ne.

**MK-17 Poruke i zabranjeni izrazi za mentorstvo (jedan prolaz).**
- Opis: pregled tekstova `mentorCardHr`, `consultHr`, `mentorshipRequestText`, `n12Messages`, `n16`, `revision` kroz skener; popis fraza dopuštenih samo u negaciji; jedan način pisanja „mentor”/„nastavnik” (prototip: „Mentor” u kartici, „nastavnik” u N-16); tekst „Zapis se ne briše ni ne prepravlja.” prije spremanja.
- Korist: §3.2. Veličina: S. Rizik: nizak. Server: ne. Prototip: da.

Nisu predloženi: **ocjena i broj u Ducturi** (PG-10 (a): ostaje Merlin; „Kriteriji ocjene” najviše kao rubrika bez broja uz odluku vlasnika), **automatski zaključak o autorstvu** ili „zastavica” uz mentorstvo, rangiranje i usporedba studenata, mentorov pregled studentovih „Poruke sebi” i „Dokle sam stao”, asistent koji piše mentoru ili zapisnik umjesto studenta, kalendar vanjskih sustava (Google/Outlook), videopoziv ili chat u stvarnom vremenu, plaćanje ili naplata mentorstva, sinkronizacija s referadom izvan ugovora.

---

## 5. Tablica za Danielovu odluku

Preporuka je moja; odluka je vaša. „Pilot” = ulazi u funkcije pilota 15. 1. 2027. (najprije u prototip i inventare). Redoslijed je po koristi i riziku od pogrešnog ishoda.

| # | Prijedlog | Veličina | Server | Moja preporuka | Razlog | Vaša odluka |
|---|-----------|----------|--------|----------------|--------|-------------|
| MK-16 | Scenarij za provjeru mentorstva | S do M | ne | **za pilot** | Bez njega se ništa ne može provjeriti klikom | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-1 | Montirati cijelu karticu Mentor u editoru | M do L | ne | **za pilot** | Student nema ulaz u konzultacije ni stanje rada | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-2 | Zahtjev za konzultacije i termini | M | ne (postoji) | **za pilot** | Središnji tok mentorstva | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-4 | Zapisnik konzultacija (pilot dio) | M | ne (postoji) | **za pilot** (NF-2) | Već odlučeno: zapisnik je u pilotu | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-9 | „Poruka sebi” i „Dokle sam stao” (lokalno) | S do M | ne | **za pilot** (NF-2, nalog) | Već odlučeno; lokalno i brisanje pri odjavi | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-6 | Etape: plan, rokovi, napomene | M | opis etape: provjeriti | **za pilot** | Završni/diplomski rad su etapni | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-13 | Rokovi: jedna vremenska crta | S do M | ne (postoji) | **za pilot** | Najjeftinije; student ne smije biti iznenađen | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-17 | Poruke i zabranjeni izrazi | S | ne | **za pilot** | PRODUCT §5 | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-7 | Zahtjev za mentorstvo: ulaz, tema, obavijest | M | tema i obavijest: da | pilot: ulaz i povratna informacija; tema i obavijest nakon | Odluka i razlog već postoje; ostalo traži ugovor | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-8 | Dorada i „Pregled runde” kao jedan tok | M do L | „vidio”: da | pilot: studentska strana; ostalo nakon | Nadovezuje se na PG-8 i PG-9 | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-15 | Pristupačnost i mobitel (prolaz) | M | ne | **za pilot** (centralni prolaz) | Obvezno prije pilota | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-3 | Termin: tema, otkazivanje, povlačenje | M | da | nakon pilota (osim ako je „Povuci” nužno) | Treba SRV zadatak | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-10 | Priprema za konzultacije | M | prilog: da | nakon pilota; kopija u poruku bez servera ako bude vremena | Korisno, nije kritično | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-11 | „Moji studenti” za mentora | M | agregat: da | nakon pilota | Pilot ima malo mentorstava; N-16 je dovoljan | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-5 | Zapisnik: potvrda, primjedba, zadaci | M do L | da | nakon pilota | Pravno osjetljivo, traži ugovor | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-12 | Obrasci i zahtjevi fakulteta, suglasnost | M do L | da | **nakon pilota** (osim ako fakultet traži za pilot) | Pravni status i ugovor ne postoje | ☐ pilot ☐ nakon pilota ☐ ne |
| MK-14 | Nakon predaje i obrana | L | da | **ne za pilot** | Izvan opsega i ugovora | ☐ pilot ☐ nakon pilota ☐ ne |

Pitanja na koja ne mogu odgovoriti sama (najviše 8, samo za Daniela):
1. **Zapisnik (MK-4, MK-5):** smije li student sam započeti zapis konzultacije i potvrditi ili osporiti mentorov (prototip), ili za pilot ostaje „piše samo mentor, student čita”?
2. **Obrasci i suglasnost (MK-12):** hoće li pilot imati popis obrazaca i suglasnost mentora za predaju, ili fakultet sve to vodi izvan Ducture?
3. **Završni i diplomski rad u pilotu:** koliko mentorstava očekujemo u pilotu i na kojem fakultetu? Ako je malo, MK-11 i MK-14 mogu biti „ne”.
4. **Ulaz studenta u mentorstvo (MK-7):** treba li student u pilotu uopće tražiti mentora kroz Ducturu, ili mentora i mentorstvo otvara nastavnik/fakultet i student samo vidi odluku?
5. **Kriteriji ocjene (MK-1, uz PG-10):** može li rubrika (šest kriterija bez broja, vidljiva studentu) u pilotu stajati u kartici Mentor, ili Ductura u pilotu uopće ne prikazuje kriterije?
6. **Priprema za konzultacije (MK-10):** smije li je student priložiti zahtjevu za termin kao sažetak onoga što je mijenjao u tekstu (broj odlomaka, riješeni komentari), uz napomenu „zapis o unosu, ne o autorstvu”?
7. **Poruke mentor–student (`work.messages`):** je li to u pilotu ulaz za kratke poruke uz rad (uz značku „novo”), ili sve ide kroz komentare i dorade?
8. **Poruka sebi na više uređaja (MK-9):** je li lokalna pohrana na uređaju dovoljna za pilot, ili student očekuje istu poruku na drugom računalu (traži polje na serveru)?

**Za orkestratora** (tehnička pitanja o serveru; ne idu Danielu):
- O1. Postoji li za `work.consultation-slots` namjera proširenja (tema, radnje povlačenja/odbijanja/otkazivanja)? Ako ne, otvara li se SRV zadatak (MK-3)?
- O2. Ugovor zapisnika: može li student biti autor zapisa i postoji li potvrda/primjedba druge strane i zadaci (MK-5)? Host trenutačno kaže „Potvrda zapisnika druge strane nije dostupna.”
- O3. Daje li `work.milestone-states.get` ili predložak opis etape (`STG` iz prototipa) i je li on u odgovoru (MK-6)?
- O4. Vrsta obavijesti za mentorstvo (odluka o zahtjevu, nova poruka, termin čeka odgovor) u `notifications.list.get` (MK-7, M-3, M-13).
- O5. Operacija za suglasnost mentora i popis obrazaca fakulteta (MK-12); je li OD-11 mehanizam (verzionirana datoteka u `config/faculties`) predviđen i za ovo?
- O6. Agregat „Moji studenti” (etapa, tko je na redu, dani do roka): uzima li se iz `teacher.mentorships.get` uz nova polja ili iz `work.milestone-states.get` po radu (MK-11)?
- O7. Lokalna pohrana „Poruke sebi” i „Dokle sam stao”: gdje se čuva i briše li je logout fence (`ductus-local-storage-logout`) (MK-9)?
- O8. Montiranje `MentorCard` i `ConsultPanel` u editor (MK-1) dira okvir editora i zajedničke datoteke traka; treba li zasebni VIZ zadatak ili je u traci pisca editora?

Otvoreno za provjeru u pregledniku (nije moguće iz ovog pregleda): sve ekrane kartice Mentor, konzultacija i zapisnika u scenariju koji otvara editor; mobilni prikaz i ladicu; čitač zaslona i fokus u dijalozima `do-h`, „Zatraži konzultacije”, „Vrati na doradu”; ostaje li upisani tekst nakon greške; ponašanje poslužitelja pri istodobnoj potvrdi i prihvatu termina; je li nešto od M-1 do M-13 riješeno u novijoj grani nakon revizija od 22. i 23. 11.

---

## 6. Provedba u prototipu

Zadatak `nf6-prototip-mentorstvo` (slot `claude:wnf6-proto:frontend`, 23. 11. 2026.). Danielove odluke, doslovno: „1 samo mentor, student čita 2. Unutar Ducture 3. Nisam siguran još 4. Mentorstvo otvara nastavnik 5. Da 6. Smije 7. Jesu 8. I na drugom računalu. Inače, sve u pilot”. Svih 17 MK ulazi u pilot. Odluke po pitanjima iz §5:

| Pitanje | Odluka | Posljedica u prototipu |
|---|---|---|
| 1 Zapisnik | piše i dopunjuje samo mentor, student čita | uklonjeni studentski zapis, „Potvrđujem”, „Imam primjedbu”; MK-5 svodi se na zadatke koje upisuje mentor |
| 2 Obrasci i suglasnost | unutar Ducture | MK-12 ostaje u kartici Mentor; „izvornost” samo kao naziv službenog obrasca |
| 3 Broj mentorstava u pilotu | nije siguran | bez promjene prototipa; MK-11 i MK-14 ipak u pilotu |
| 4 Ulaz u mentorstvo | mentorstvo otvara nastavnik | uklonjen studentski „Zahtjev za mentorstvo”; N-16 dobiva „Otvori mentorstvo”; student vidi odluku i mentora |
| 5 Kriteriji | rubrika bez broja, vidljiva studentu | razine i ocjene uklonjene; ocjena ostaje u Merlinu |
| 6 Priprema | student smije priložiti uz zahtjev za termin | napomena „zapis o unosu, ne o autorstvu” |
| 7 Poruke | jesu u pilotu uz značku „novo” | odjeljak „Poruke” u kartici Mentor |
| 8 Poruka sebi i Dokle sam stao | i na drugom računalu | pohrana na poslužitelju, vidi samo student, briše se na zahtjev studenta |

Tablica MK-n → INVENTAR ID → element prototipa. Svaki element ima stanja puno, prazno, učitavanje i grešku (izbornik „Stanja mentorstva” u kartici Mentor, Ctrl+K ili `#nf6=<odjeljak>:<stanje>`; na N-16 izbornik stanja prototipa).

| MK | INVENTAR ID | Element |
|---|---|---|
| MK-1 | NF6-MK1, NF6-MK1-RUB (editor §2.9) | kartica Mentor (`mentor2.js` `RP.vRadX`), poruke, „Kako mentor radi”, „Kriteriji rada” (`mentor3.js`) |
| MK-2 | NF6-MK2 | „Termini konzultacija”, dijalog `m2meet` s izborom datuma i vremena |
| MK-3 | NF6-MK3 | tema termina, „Povuci zahtjev”, „Odbij”, „Otkaži termin” |
| MK-4 | NF6-MK4 (editor §2.9), NF6-MK4 (nastavnik §10) | „Zapisnik konzultacija” (samo mentor piše); N-12 `konzultacije` |
| MK-5 | NF6-MK5 (editor, nastavnik) | „Dogovoreno na konzultacijama”: zadatke upisuje mentor |
| MK-6 | NF6-MK6 | „Etape · n od m odobreno” s rokom i opisom |
| MK-7 | NF6-MK7 (editor, nastavnik) | odjeljak „Mentorstvo” u kartici; „Otvori mentorstvo” i dijalog `om-h` na N-16 |
| MK-8 | NF6-MK8 | „Stanje rada” (dorada, pregled, prihvat), „Vrati na doradu”, „Pregled runde” |
| MK-9 | NF6-MK9 | „Poruka sebi” i „Dokle sam stao” s pohranom na poslužitelju; trake stanja |
| MK-10 | NF6-MK10 | „Priprema za konzultacije”, prilog uz zahtjev za termin |
| MK-11 | NF6-MK11 (editor, nastavnik) | dijalog „Moji studenti”; kartica „Moji studenti” na N-16 |
| MK-12 | NF6-MK12 | „Obrasci fakulteta” i „Suglasnost mentora za predaju” |
| MK-13 | NF6-MK13 | dijalog „Vremenska crta rada” |
| MK-14 | NF6-MK14 | „Nakon predaje i obrana” |
| MK-15 | NF6-MK15 (editor, nastavnik) | stanja tekstom, izbor datuma i vremena, 44 px, `lang="hr"`, axe |
| MK-16 | NF6-MK16 | izbornik „Stanja mentorstva”; scenarij lažnog poslužitelja izvan trake |
| MK-17 | NF6-MK17 (editor, nastavnik) | pregled tekstova i zabranjenih izraza |

Serverske ovisnosti koje **nedostaju** i ne izmišljaju se (svaka je navedena u INVENTAR-u uz svoju stavku): SRV-MENTOR-1 („Kako mentor radi”, kriteriji, obavijest o poruci), SRV-MENTOR-3 (tema, povlačenje, odbijanje, otkazivanje termina), SRV-MENTOR-5 (zadaci s kvačicama), SRV-MENTOR-6 (opis etape), SRV-MENTOR-7 (otvaranje mentorstva od nastavnika, obavijest), SRV-MENTOR-8 („student je vidio”), SRV-MENTOR-9 (serverska pohrana Poruke sebi i Dokle sam stao), SRV-MENTOR-10 (prilog pripreme uz termin), SRV-MENTOR-11 (agregat „Moji studenti”), SRV-MENTOR-12 (suglasnost i obrasci), SRV-MENTOR-14 (nakon predaje i obrana). Postojeće rute (MK-2, MK-4, MK-6, MK-8, MK-13) navedene su uz stavke.

Provjera 23. 11. 2026.: 1280 i 390 px, svijetla i tamna tema, tipkovnica, axe; jedino kršenje (`aria-required-children` na `#tabs`) postoji i na bazi. Aplikacija u `packages/` nije dirana: uklanjanje studentskog „Zahtjeva za mentorstvo” (`student/mentorship-request/`) i montiranje u host su zasebni WEB zadaci.
