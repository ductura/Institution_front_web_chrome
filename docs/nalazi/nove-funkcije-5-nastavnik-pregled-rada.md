# Nove funkcije, dio 5: Nastavnik, pregled rada (otvaranje predanog rada, sažetak procesa, karta podrijetla, reprodukcija, izjava studenta i pitanje uz izjavu, objašnjenja uz podudaranje, povratna informacija i dorada, ocjena, izvoz i ispis)

Zadatak NF-5 `nove-funkcije-nastavnik-pregled`. Dodao ga je orkestrator 23. 11. 2026. po planu „Nove funkcije: pregled dio po dio” (plan u `ductura/.github` oblak ne vidi, pa je opis zadatka iz naloga). Oblik i razina detalja po uzoru na `docs/nalazi/nove-funkcije-1-student-zadaci.md` do `nove-funkcije-4-nastavnik-kolegiji-zadaci.md`. Ovaj dokument je samo pregled; kod se ne mijenja. Kolegiji, zadaci, produljenja i izvoz za Merlin su dio 4; mentorstvo je dio 6; ovdje su samo spomenuti kad dodiruju pregled rada.

Oznake: nalazi **H-n**, prijedlozi **PG-n** (da se ne miješaju s G-n/NZ-n iz dijela 4, P-n iz dijelova 1 i 2 ni PR-n iz dijela 3). Odluke iz dijelova 1 do 4 se ne ponavljaju kao pitanja, nego se na njih nadovezuje (vidi §0).

## 0. Izvori, način pregleda i ograničenja

Pročitano:
- prototip: `docs/prototip/INVENTAR-nastavnik.md` (ekrani N-06 `rad`, N-07 `predaja`, N-08 komentari i prijedlozi, N-09 `reprodukcija`, N-10 `sazetak` s kartom podrijetla `km-h`, N-11 `usporedba`, N-14 priprema za razgovor; §3.7 do §3.11, dijalog `dd-h`, `declPanel` i `ch-h`; §4 podaci, §7 nejasno), `docs/prototip/Ductura_nastavnik.html` i `Ductura_nastavnik_kartice.html` samo za nazive, redoslijed i stanja; Danielovi odgovori `docs/prototip/ODGOVORI-DANIEL-2026-11-19.md`;
- revizija `docs/nalazi/paritet-nastavnik-2.md` (dio B: rad, predaja, dorada; dio C: sažetak, reprodukcija, usporedba; mjereno 23. 11. 2026.) te dijelovi 1 do 4 ove serije (`nove-funkcije-2-radni-prostor-editor.md`, `nove-funkcije-3-predaja.md` PR-14 do PR-20, `nove-funkcije-4-nastavnik-kolegiji-zadaci.md` NZ-4, NZ-5, NZ-12, NZ-15);
- aplikacija (host) `packages/app/src/host/teacher/`: `n06/` (okvir rada), `n07/` (predaja i potvrda), `n09/` (reprodukcija), `n10/` (sažetak procesa), `n11/` (usporedba), `provenance/` (karta podrijetla, sastav, podudaranje s pomoćnikom), `ai-declaration/` (izjava i razgovori), `interview/` (priprema za razgovor, N-14), `revision/` (dorada), `comments/`, `comment-bank/`, `changes-since-review/`, `direct-edit/`, `proposals/`, `input-rhythm/`, `submissions/grade/`, `mobile-review/`; samo kao izvor teksta i ponašanja;
- ugovori u izvatku `src/client/migration-contracts.generated.json` za ovaj dio: `teacher.work.get`, `teacher.submission-detail.get`, `teacher.submission-receipt.get`, `teacher.receipt-pdf.get`, `projection.process-summary.post`, `projection.process-summary-details.post`, `work.origin-composition.get`, `work.origin-thresholds.get`, `work.input-rhythm.get`, `evidence.replay.post`, `work.compare.get`, `work.versions.get`, `work.version.get`, `teacher.declaration.get`, `teacher.declaration-required.get|put`, `work.assistant-match.get`, `work.assistant-match-explanation.post`, `work.event-disputes.get`, `work.interview*`, `work.comments*`, `work.comment-draft*`, `work.review.post`, `work.changes-since-review.get`, `work.return-for-revision.post`, `collaboration.revision-requests.post`, `work.milestones*`, `work.export-pdf.get`, `work.export.get`, `teacher.assignment-grade.get`.

Što nije učinjeno, izričito:
- **aplikacija nije pokrenuta** s lažnim poslužiteljem (scenarij VIZ „puno”) u ovoj sesiji. Revizija `paritet-nastavnik-2.md` izričito kaže da scenarij „puno” nema `teacher.access.get`, pa ekrani rada, predaje, sažetka i reprodukcije ondje prikazuju samo „Pristup radu trenutačno nije moguće provjeriti.”. Zato je **gotovo sve u ovom dijelu izvedeno iz izvornog koda, kataloga poruka, ugovora i revizije, a ne potvrđeno klikom**. Gdje stavka ovisi o stvarnom prikazu (razmak, odsijecanje, ciljevi dodira, redoslijed Tab, čitač zaslona, mobitel, ispis), označena je „provjeriti u pregledniku”. To je i prijedlog PG-15 (scenarij za pregled rada);
- **plan `NOVE-FUNKCIJE.md` iz `ductura/.github` nije čitan** (oblak nema pristup). Sadržaj dijela 5 uzet je iz naloga orkestratora;
- **kasniji PR-ovi nisu provjereni.** Revizija je od 23. 11.; prije otvaranja zadatka po bilo kojem nalazu provjeriti da nije riješen u novijoj grani;
- nije provjeravan pravi poslužitelj, baza ni Docker; ono što poslužitelj stvarno vraća nije provjereno, nego samo što ugovor dopušta;
- opisi sličnih alata u §3.1 su iz općeg poznavanja takvih alata, ne iz uživo provjere njihovih trenutačnih verzija; ništa se ne kopira (ni izgled ni tekst);
- svi primjeri su izmišljeni („Student A”, „Nastavnik A”, kolegij „Uvod u medije”); nijedna stvarna osoba ni rad.

Odluke na koje se nadovezuje (ne pitaju se ponovno):
- **Dijelovi 1 do 4: sve je u pilotu** (Daniel, 23. 11.). Za ovaj dio: zadatak smije zabraniti kasnu predaju, a nastavnik smije odobriti iznimku (varijanta A produljenje ili B iznimka sa zapisom, NF-4 NZ-4, NZ-5); nastavnik smije isključiti obaveznu izjavu (`teacher.declaration-required.put`); NF-3: student dobiva PDF potvrde s QR kodom; **PR-20 pitanje nastavnika uz izjavu je u pilotu** (NF-4 NZ-15 ga gradi s poslužiteljske strane).
- **Asistent u pilotu radi** (promjena 23. 11.; pružatelj i model se ne imenuju, Q-10 nije donesena). Nastavnik zato vidi **zabilježene razgovore studenta s asistentom** priložene izjavi (`teacher.declaration.get`, dijalog `ch-h`; prototipov `declPanel` i `ch-h` koji su u kodu bili nedohvatljivi sada ulaze u pilot). U NF-4 §0 stajalo je „asistent isključen (OC-1)”; **ova odluka od 23. 11. ima prednost**, a razlika se vodi kao pitanje 8.
- **NF-2 P-13:** podudaranje s pomoćnikom je samo usporedba teksta (osam ili više riječi zaredom jednako odgovoru, deterministički), **nije tvrdnja o autorstvu**. Pregled nastavnika ne smije sugerirati „detekciju AI-ja”.
- **Ustav v1.6 C-6, v1.7/v1.8, v1.9:** smiju se prikazati (a) udio iz zabilježenih događaja, (b) postotak podudarnosti s izvorima (samo izvori iz D-260 t. 5, čekaju pravno mišljenje i DPIA), (c) oznaka podudaranja s odgovorom pomoćnika; uvijek uz napomenu „nije dokaz autorstva”; bez modela detektora, ne blokira, ne sankcionira, ne rangira, student vidi isto; ritam unosa bilježi razmake u ms, bez sadržaja tipki izvan editora, briše se najkasnije 30 dana nakon predaje; oznaka „za pregled” nikad ne ulazi u ocjenu ni izvoz. Sa stvarnim studentima ništa do pravnog mišljenja i DPIA; pilot je s izmišljenim podacima.
- **P-1 potvrđen** (22. 11.): vrste podrijetla (zatvoren popis), sastav s postotcima po vrsti, ritam unosa (isključuje ga samo nastavnik), pragovi fakulteta bez zadanih. Docs Ductusa (PRODUCT, privacy, terms.ts) mijenja samo orkestrator.
- Odluke za paritet (22. 11.): „podprikazi Pregleda” (Nacrt, Pojmovnik, Provjere), kriteriji ocjene vidljivi studentu (2122), navod prema izvoru s blažim tekstom (2134), CSV 8 stupaca, suradnik samo čita i komentira, banner praznina po C-18, naziv „izvornost” samo kao naziv službenog obrasca.

Ograničenja plana za sve prijedloge: rok funkcija pilota 15. 1. 2027. se ne pomiče; prijava samo AAI@EduHr (D-09, D-16); server se ne izmišlja (uz svaki prijedlog stoji postoji li operacija u izvatku ili treba novo polje); prototip ostaje izvor istine; PRODUCT §5 i rječnik zabranjenih izraza vrijede za svaki tekst.

---

## 1. Tok korisnika od početka do kraja

Rute u hostu (iz koda i revizije): `/nastavnik/rad/{documentId}` (okvir rada N-06), `…/predaja` (N-07), `…/sazetak` (N-10), `…/reprodukcija` (N-09), `…/usporedba` (N-11), `…/konzultacije` (N-12), `…/razgovor` (priprema za razgovor, N-14), `/nastavnik/brz-put?zadatak=…` (N-05, prolaz kroz radove). Pristup svakoj stranici ide kroz `work.access.get` / `teacher.access.get`; bez njega stoji „Pristup radu trenutačno nije moguće provjeriti.”.

### 1.1 Otvaranje predanog rada

1. Nastavnik dolazi iz popisa studenata (N-04), zbirnog (N-17), popisa predaja ili Brzog puta; poveznica „Otvori rad” postoji samo za rad s dokumentom (u N-17 imena još nisu poveznice, NF-4 H-10).
2. **Okvir rada (N-06):** traka „Natrag na kolegije”; naslov „{Student} · Rad” (prototip: „Student A · Seminarski rad „Naslov””; naslov zadatka ruta `teacher.work.get` ne vraća); redak stanja: „Predano {vrijeme}, nakon roka (rok …) · verzija n · zapis je cjelovit / ima praznine”, „U pisanju · prikaz se osvježava dok student piše” ili „Nije predano · rok je prošao · prikazan je zadnji tekst koji je poslužitelj primio”; „Slijed rada” (poslano na pregled, zatražena dorada s rokom, predano i verzija).
3. **Poveznice pogleda** (`.rd-links`): „Što je student predao”, „Sažetak procesa”, „Reprodukcija”, „Usporedba verzija”, „Konzultacije”, „Pripremi razgovor”. Tekst rada u listu s oznakama komentara, bočni dio „Komentari i prijedlozi”.
4. Pogled „Promjene od zadnjeg pregleda” (`changes-since-review`, `work.changes-since-review.get`) i „Označi kao pregledano” (`work.review.post` vraća `reviewedRevision`, `reviewedAt`).
5. Rad se otvara i prije predaje (prikaz uživo); student to zna iz obavijesti o zadatku (n09 `foot`).

### 1.2 Što je student predao (N-07, potvrda)

1. Ploča „Sažetak procesa prije predaje” (`pp-h`: otvorena mjesta za izvor, lijepljenja, pravila oblika), zatim potvrda: Vrijeme predaje, Rok, „Potpisivanje potvrde započelo”, Verzija, „Točne vrijednosti iz potvrde (UTC)”, otisak predanog teksta u skupinama po četiri znaka, „Kopiraj otisak”, Stanje zapisa, „Provjera potvrde” (bez prijave), QR uzorak bez sadržaja (QR je u zapisu koji je student preuzeo).
2. Stanja: „Predaja u obradi” (potpis još nije izdan), „Predaja nije dovršena: zamjenski postupak”, „Ovaj rad nije predan, pa potvrde nema”. PDF potvrde: `teacher.receipt-pdf.get`.
3. Radnje: „Natrag na rad”, „Zatraži doradu”, „Brz put”.

### 1.3 Sažetak procesa

1. N-10 (`projection.process-summary.post`, `…-details.post`): razdoblje rada (prvi i posljednji zabilježeni događaj), sesije (niz promjena bez prekida duljeg od P-01, postavka fakulteta; „Popis sesija”), aktivno vrijeme uređivanja („nije mjera truda ni vremena razmišljanja”), verzije (poslano na pregled, predano), lijepljenja iznad praga P-02 (s „Prikaži mjesto u radu”), AI pomoćnik (svako prenošenje teksta iz pomoćnika u rad), praznine u zapisu (od verzije do verzije), napomene studenta, stanje zapisa, „Pravila fakulteta” (u skladu / za pregled / prekoračeno, uz napomenu „izjava o skladu s pravilima fakulteta, ne ocjena studenta”).
2. Dijelovi koje poslužitelj nastavniku ne daje označeni su „Trenutačno nije dostupno.” (npr. „Pružatelj, model, svrha i preneseni tekst nisu dostupni.”); ništa se ne nagađa.

### 1.4 Karta podrijetla teksta

1. **Prototip (`provMap`, `km-h`):** prekidač oznaka podrijetla i prekidač „Napisano u Ducturi”, legenda, sidra na lijepljenja i AI pomoćnika, rečenica „Ductura ne zna tko je tipkao.”, stanje „karta nema oznaka”.
2. **Host (`provenance/`, P-1):** „Podrijetlo teksta”: „Sastav teksta” s postotkom po šest vrsta (`work.origin-composition.get`: tipkano u Ducturi, umetnuto iz pomoćnika, podudara se s odgovorom pomoćnika, uvezeno iz datoteke, zalijepljeno poznatog podrijetla, zalijepljeno nepoznatog podrijetla); „manje od 1 %”; usporedba s pragovima fakulteta (`work.origin-thresholds.get`); „Odsječci teksta” (odsječak, kako je ušao, otprilike u, ritam unosa u ms ili „nije zabilježen”; `work.input-rhythm.get`). Fiksne napomene: „Nepoznato podrijetlo nije prekršaj. Traži objašnjenje, ne sankciju.”, „Ductura ne otkriva alate izvan sebe. Ovo nije samostalan temelj disciplinskog postupka.”, „Ritam je dokaz o unosu, ne o autorstvu.”.
3. **Podudaranje s pomoćnikom** (`AssistantMatchSection`, `work.assistant-match.get`): popis nalaza (riječi zaredom, zabilježeno, razgovor priložen izjavi) uz napomenu „Ovo je obična usporedba teksta i ništa ne govori o autorstvu.”; „Uz ovaj udio još nema priloženog razgovora.”.

### 1.5 Reprodukcija (vremenska crta pisanja)

1. N-09 (`evidence.replay.post` po stranicama): tekst nastaje promjenu po promjenu; „Pokreni/Zaustavi”, „Prethodna/Sljedeća promjena”, brzina 1×/2×/4×, klizač „Promjena n od N”, „Skok na” sesiju, redak „izvor ove promjene: utipkano / zalijepljeno / praznina u zapisu”, istaknut dodan tekst, poruka o praznini.
2. Fiksni opis: „Služi razgovoru o radu, ne ocjeni. Bez vremenske osi i bez trajanja.”; „Isti prikaz vide student, mentor i nastavnik zadatka.”. Skok na sesiju je u hostu „nedostupno” jer zapis ne nosi sesije (D-239). Usporedba verzija (N-11, `work.compare.get`, „dodano:” / „uklonjeno:”) je zasebni pogled.

### 1.6 Izjava studenta, pitanje i razgovori s asistentom

1. **Izjava o korištenju generativne umjetne inteligencije** (`ai-declaration/`, `teacher.declaration.get {assignmentId, studentId}`): stanje „none” ili vezana izjava s `declarationSha256`; „Zabilježeno u Ducturi i izjava studenta.”; „Razgovori uz izjavu” s gumbom „Pregledaj razgovor” koji otvara dijalog `ch-h` „Razgovor n · datum” („Točno kako je zabilježen; isti razgovor vidi i student.”). Izjava je verzionirani obrazac fakulteta (declaration-v1, #499) s `humanHelp {kind,text}`.
2. **Izjava obavezna** (`teacher.declaration-required.get|put`) po zadatku: nastavnik smije isključiti; u hostu za to nema sučelja (NF-4 G-6, NZ-4c).
3. **Pitanje nastavnika uz izjavu (PR-20):** u pilotu; nastavnik ga zadaje pri stvaranju zadatka (NF-4 NZ-15), student na njega odgovara u izjavi, a nastavnik pitanje i odgovor vidi na pregledu rada. Ugovor declaration-v1 danas nema ni pitanje ni odgovor.

### 1.7 Objašnjenja studenta uz podudaranje i uz događaje

1. Student uz nalaz podudaranja smije napisati **objašnjenje** (`work.assistant-match-explanation.post {segmentRef, messageId, text ≤ 2000}`, vidi NF-2 P-13); uz događaje zapisa smije dati **prigovor ili dopunu** (`work.event-disputes.get|post`, vrste npr. `amendment`).
2. Nastavnik objašnjenja vidi u pripremi za razgovor (N-14, „2. Studentova objašnjenja”: opće objašnjenje + po odlomku, „3. Dijelovi rada za razgovor” s pitanjem nastavnika). Na karti podrijetla ni u sažetku objašnjenje nije prikazano uz sam nalaz (H-9).
3. Priprema za razgovor (`interview/`): poziv studentu (`work.interview-invite.post`), pitanja (`work.interview-questions.post|delete`), termin, bilješke, „održan”, izvoz PDF (`work.interview-pdf.get`); fiksna napomena „Ovo je priprema za razgovor, ne optužba ni disciplinski postupak.”. Student pitanja do poziva ne vidi.

### 1.8 Povratna informacija i dorada

1. **Komentari** (`comments/`, N-08): komentar uz mjesto u tekstu, odgovor, „Označi kao riješeno”/„Ponovno otvori”; nacrti (`work.comment-draft*`) i objava (`work.comments.publish.post`, `…publish-selected.post`); banka komentara (`comment-bank/`); prijedlozi izmjene (`proposals/`, `direct-edit/`); „Isti komentar vidi i student.”.
2. **Dorada:** na predanom radu „Zatraži doradu” otvara `dd-h` („Što treba doraditi” obavezno do 2000 znakova; „Rok za doradu” obavezan) → `work.return-for-revision.post {comment, revisionDueAt}`; banner dorade u četiri stanja (otvoren; student navodi da je proveden; prihvaćen; ponovno otvoren) s „Prihvati doradu” i „Ponovno otvori” (`collaboration.revision-requests.post`). Mogu postojati i etape (`work.milestones*`: plan, „zatraži doradu”, odobri).
3. Student dobiva obavijest (`notifications.returned-for-revision.list.get`) i novu predaju radi istim koracima.

### 1.9 Ocjena, izvoz i ispis

1. **Ocjena:** u izvatku postoji samo **`teacher.assignment-grade.get`** → `{eligible: true}` ili 409 `practice_assignment` (probni zadatak se ne ocjenjuje i ne izvozi, P-D1; `submissions/grade/GradeGate`). **Ne postoji ugovor za upis ni čitanje same ocjene.** Kriteriji ocjene vidljivi su studentu (2122); gdje ocjena živi (Ductura ili Merlin) nije odlučeno u ovom dijelu (pitanje 6).
2. **Izvoz jednog rada:** PDF rada (`work.export-pdf.get`: `pdfBase64`, `outputSha256`, `reportHash`, `docxBase64`, `noticeKey`), izvoz (`work.export.get`), PDF potvrde (`teacher.receipt-pdf.get`), PDF pripreme za razgovor; skupno preuzimanje i paket za Merlin su dio 4.
3. **Ispis:** posebnog prikaza za ispis ne nalazim (provjeriti u pregledniku); nastavnik ispisuje preko preuzetog PDF-a.

---

## 2. Gdje zapinje

Označeno je „(kod)” ako je izvedeno iz izvornog koda, „(revizija)” iz `paritet-nastavnik-2.md`, „(ugovor)” iz izvatka. Ništa nije potvrđeno klikom (§0). Prije popravka provjeriti da nije riješeno u novijoj grani.

### 2.1 Koraci i tok

- **H-1 Okvir rada ne govori o čemu je rad.** Naslov je „{ime} · Rad”; naziv zadatka, kolegij i vrsta rada nisu u `teacher.work.get`; `titleUnavailable` je u katalogu, a ne koristi se (revizija). Nastavnik koji otvori dva rada istog studenta ne zna koji je koji; „Natrag na kolegije” vodi na popis, ne na zadatak (provjeriti).
- **H-2 Pogledi su razbacani, a nema „jednog pregleda”.** Pet do šest poveznica (predaja, sažetak, karta podrijetla, reprodukcija, usporedba, konzultacije, razgovor) otvara zasebne stranice; nastavnik za jedan rad prolazi 4 do 6 ekrana i na svakom se mora vratiti. Karta podrijetla je u prototipu pokraj sažetka, u hostu je zasebna sekcija (kod).
- **H-3 „Pristup radu nije moguće provjeriti” u scenariju za provjeru.** `teacher.access.get` nema u scenariju „puno”, pa nijedan od ovih ekrana nije moguće izmjeriti bez pravog poslužitelja (revizija, zadatak 16). Isto vrijedi za mobilni pregled (`mobile-review/`).
- **H-4 Karta podrijetla pokazuje postotke, ne tekst.** Sastav je tablica postotaka i popis odsječaka; prototipova **obojana karta u samom tekstu** (prekidač oznaka, „Napisano u Ducturi”, skok na lijepljenje/AI) u hostu ili ne postoji ili nije povezana s tekstom rada (kod; kartica „raspon po izvoru” je „plan napada”, INVENTAR §4). Nastavnik ne vidi *gdje* u radu je koji dio ušao.
- **H-5 Dvije različite stvari izgledaju kao jedna.** „Zalijepljeno poznatog/nepoznatog podrijetla” (lijepljenje), „umetnuto iz pomoćnika” (prijenos iz asistenta u Ducturi) i „podudara se s odgovorom pomoćnika” (usporedba teksta) su tri odvojena pojma, a nalazi se prikazuju u istom popisu postotaka. Bez objašnjenja uz svaku vrstu nastavnik može „podudara se” pročitati kao „napisao je asistent” (rizik P-13; kod).
- **H-6 Sažetak nema aktivno vrijeme, verzije ni pružatelja.** Kad poslužitelj ne daje dio, tekst je „Trenutačno nije dostupno.” (dobro, ne nagađa), ali nastavnik ne razlikuje „nije dostupno jer server ne daje” i „greška” (kod; `assistantDetailsMissing`). Uz asistenta u pilotu (23. 11.) „AI pomoćnik” u sažetku mora pokazati broj razgovora i prijenosa, a ne samo popis.
- **H-7 Reprodukcija: bez skoka na sesiju i s dugim radom.** „Skok na” je „nedostupno” jer zapis ne nosi sesije (D-239, kod); za rad sa stotinama promjena dostupni su samo klizač i brzina 4×, bez skoka na lijepljenje ili prazninu; stranica reprodukcije prima zapis po stranicama (`evidence.replay.post` s `head`), pa je čekanje na dug rad neprovjereno.
- **H-8 Izjava, pitanje i razgovori: pitanja nema.** Izjava se prikazuje s razgovorima (`ch-h`), ali **pitanje nastavnika i studentov odgovor ne postoje** ni u ugovoru ni u sučelju (NF-4 G-16, PR-20); `humanHelp {kind,text}` je u izjavi, ali nastavnik ga čita unutar zasebnog dijela, ne uz kartu podrijetla.
- **H-9 Objašnjenje studenta nije uz nalaz.** Student može objasniti nalaz podudaranja (`work.assistant-match-explanation.post`) i prigovoriti događaju (`work.event-disputes`), ali nastavnik ih vidi u pripremi za razgovor (N-14) i/ili ih ne vidi uopće uz nalaz na karti podrijetla; objašnjenje „Zalijepljeno, podrijetlo nepoznato” ima samo opće polje (kod; provjeriti u pregledniku). Pravičnost: nastavnik može donijeti sud prije nego što pročita objašnjenje.
- **H-10 Dorada: dva dijaloga, rok i povlačenje.** Na predaji stari „Vrati rad na doradu”, na radu novi `dd-h` (NF-4 G-12); zahtjev se ne može povući iz sučelja iako ugovor ima `withdraw`; ne vidi se „Student vidi: …”; „Prihvati doradu” i „Ponovno otvori” rade, ali nastavnik ne vidi što je student promijenio između verzija bez prelaska u Usporedbu (kod, revizija).
- **H-11 Povratna informacija: više mjesta, nema sažetka.** Komentari, prijedlozi, dorada, etape i konzultacije su zasebni mehanizmi; nema jednog mjesta „što sam rekao ovom studentu” (komentari + dorada + konzultacije), a nastavnik ne vidi što student od toga već vidi.
- **H-12 Ocjene nema.** Postoji samo provjera smije li se zadatak ocjenjivati. Nastavnik koji pregledom dođe do ocjene nema gdje je zapisati ni pročitati; prototip nema ocjenu (INVENTAR bilježi samo nastavnikove komentare). PRODUCT i dosadašnji dijelovi nisu odlučili je li to namjerno.
- **H-13 Izvoz i ispis.** PDF rada i potvrde postoje, ali izvoz **jednog** rada nije vezan na okvir rada (nema gumba „Izvezi PDF rada” uz pogled; provjeriti u pregledniku); sažetak, karta podrijetla i reprodukcija se ne mogu izvesti ni ispisati; PDF pripreme za razgovor je jedini pogled s izvozom. Nema upozorenja da izvoz sadrži tekst rada i ime studenta.
- **H-14 Brz put kroz radove.** Prolaz kroz sve radove zadatka (N-05) dijeli slijepe ulice iz NF-4 G-1; „Prethodni/Sljedeći rad” čuvaju rad, ali ne pogled (nakon „Sljedeći” nastavnik se vraća na tekst, ne ostaje na sažetku). Provjeriti.

### 2.2 Stanja

- **Učitavanje:** „Učitavam rad s poslužitelja…”, „Učitavam sažetak procesa…”, „Učitavam promjene rada…”, „Učitavanje podrijetla teksta…”; kosturi nisu mjereni; pogledi se učitavaju svaki zasebno, pa nastavnik vidi nekoliko različitih „učitavam”.
- **Prazno:** „Rad još nije započet…”, „Rad još nije započet, pa sažetka procesa nema.”, „Nema promjena za prikaz”, „U radu još nema teksta.”; „Još nema komentara.”.
- **Greška i oporavak:** svaki pogled ima „Pokušaj ponovno” (dobro; `role=alert` provjeriti); nije dostupno parcijalno: greška jednog dijela (npr. podudaranje) ne smije skriti ostale (kod: odvojeni `unavailable` po dijelu).
- **Istek sesije:** 401 vodi na prijavu (provjeriti da komentar u pisanju nije izgubljen; nacrti komentara postoje na poslužitelju, `work.comment-drafts`).
- **Nepotpun zapis:** banner praznina s „Otvori sažetak procesa”; prototipov uvjet bannera je `&& false` (nikad se ne vidi), u hostu postoji (kod).
- **Predaja u obradi / zamjenski postupak:** potvrda još nije potpisana; vrijeme predaje se ne mijenja; ne piše koliko to traje.
- **Probni zadatak:** bez ocjene i izvoza (409), prikaz „Probni zadatak se ne ocjenjuje” (NF-4).

### 2.3 Pristupačnost (iz koda i revizije; čitačem provjeriti)

- Dobro: `<dialog>` s fokusom i povratom (`dd-h`, `ch-h`), `aria-expanded`, `role=alert` na greškama, „dodano:”/„uklonjeno:” u usporedbi, `role=status` na pripremi.
- Pitanja: (1) **boja kao jedini nosilac podrijetla** na karti (oznake podrijetla moraju imati tekstualni oblik, ne samo boju); (2) otisak u skupinama po 4 znaka čita se kao 16 riječi (isto kao NF-3); (3) **reprodukcija** „Pokreni” s tajmerom: automatsko mijenjanje teksta mora imati „Zaustavi”, ne smije se najavljivati čitaču pri svakoj promjeni (`aria-live` neprovjeren), a kontrole moraju raditi tipkovnicom (klizač `#rp-r`, select brzine); (4) tablica sastava i odsječaka sa zaglavljima `scope` i redoslijedom čitanja; (5) dijalog `ch-h` s dugim razgovorom (fokus, pomicanje, Escape); (6) kontrast oznaka „za pregled”, „prekoračeno”, „u skladu” (ne smiju ovisiti samo o boji); (7) nema axe specifikacije za sažetak, kartu, reprodukciju i izjavu (revizija).

### 2.4 Mobitel (granice 640/760/1050/1250 px; provjeriti u pregledniku)

- Nastavnik pregled rada često radi na računalu, ali `mobile-review/` postoji u hostu. Nije mjereno: tablica sastava i odsječaka sa 6 stupaca, tekst rada uz bočni dio komentara, klizač reprodukcije (cilj dodira 44 px), dijalog `dd-h` s `DatePicker`, karta podrijetla s oznakama, dugi otisci, PDF „otvori” umjesto „preuzmi”.

### 2.5 Greške i oporavak

- Pogrešan komentar: može se riješiti/ponovno otvoriti, ali se ne briše iz sučelja nakon objave (provjeriti).
- Pogrešno poslana dorada: `withdraw` ne postoji u sučelju (H-10).
- Pogrešno označen pregled (`work.review.post`): nema „poništi”; sljedeća izmjena studenta ionako ponovno pokazuje promjene.
- Greška poslužitelja pri otvaranju razgovora: dijalog bez teksta razgovora ne smije izgledati kao „nema razgovora” (provjeriti: „Izjava o korištenju AI-ja trenutačno nije dostupna.” + „Predaja i potvrda predaje time se ne mijenjaju.” je dobro).
- Nepoznato stanje podudaranja: „Podudaranje … trenutačno nije moguće dohvatiti.” ne smije se čitati kao „nema podudaranja” (provjeriti raspored poruka).

---

## 3. Što nude slični alati i što traže pilot, privatnost, pravila o AI izjavi i pravičnost prema studentu

### 3.1 Slični alati (opisno, iz općeg poznavanja, bez kopiranja izgleda)

- **Alati za provjeru podudaranja (tipa Turnitin, Moodle dodaci):** nastavnik otvara „izvještaj” s postotkom i obojanim tekstom; postotak se često čita kao presuda. Za Ductura iz toga proizlazi: prikaz mora biti tekstualan i opisan, nikad ocjena; razlika od njih je što Ductura ne gleda tuđe izvore osim onih iz D-260 t. 5, a podrijetlo prikazuje iz zabilježenih događaja.
- **Uređivači i radni prostori u oblaku (tipa Google Dokumenti, Notion):** „povijest verzija” i „komentari/prijedlozi” u jednom pogledu; očekivanje nastavnika: jedan klik do povijesti i usporedbe te komentar uz mjesto u tekstu.
- **Alati za bilježenje procesa pisanja (tipa dodaci koji bilježe tipkanje i sesije):** vremenska crta, „reprodukcija” i sažetak aktivnosti. Poznat problem: ocjena „koliko je tipkano” pretvara se u sumnju; Ductura ne bilježi sadržaj tipki izvan editora i ritam smije služiti samo razgovoru (Ustav v1.9).
- **Sustavi za e-učenje i ocjenjivanje (tipa Merlin, Canvas, Google Classroom):** ocjena, rubrika i povratna informacija na jednom mjestu, izvoz ocjena u CSV, vraćanje na doradu s rokom. Očekivanje: povratna informacija i ocjena nisu odvojene aplikacije.
- **Alati za usmeni razgovor i obranu (bilješke, pitanja, zapisnik):** priprema pitanja iz rada i zapisnik razgovora; ovdje postoji N-14.

Što nastavnici obično traže: (1) jedan pregled rada u kojem se vidi „što je student radio i kako” bez prelaska na pet ekrana; (2) mogućnost da sami zaključe, a ne da im sustav daje zaključak; (3) jasno što je dokaz o zapisu, a što nagađanje; (4) povratna informacija uz mjesto u tekstu i rok dorade; (5) izvoz i ispis za razgovor sa studentom ili povjerenstvom.

### 3.2 Što traže pilot, privatnost i pravila o AI izjavi za ovaj dio

- **Pilot:** prijava samo AAI@EduHr (D-09, D-16); rok funkcija 15. 1. 2027.; sve novo najprije u prototip i `INVENTAR-nastavnik.md`; izmišljeni podaci do pravnog mišljenja i DPIA; komponente iz `@ductura/ui` bez lokalnog stila.
- **Privatnost:** pregled rada prikazuje tekst studentskog rada, ime i ritam unosa; razgovori s asistentom su osobni zapisi studenta priloženi izjavi; pristup nastavnika bilježi se u dnevnik pristupa (`work.access.get`); ritam se briše najkasnije 30 dana nakon predaje, pa pregled mora znati reći „ritam više nije dostupan” kao obično stanje, ne kao grešku; izvoz (PDF, CSV) napušta Ducturu, pa uz njega treba upozorenje; objašnjenja i prigovori studenta vide samo nastavnik zadatka i mentor.
- **Pravila o AI izjavi:** pravilo uporabe alata postavlja nastavnik po zadatku (FPZG čl. 8); izjava je obrazac fakulteta (declaration-v1); asistent u pilotu radi, a razgovori se **automatski prilažu izjavi** kao preneseni tekst (match-messages); izjava nikad ne zamjenjuje potvrdu predaje i obratno. „Izvornost” samo kao doslovan naziv službenog obrasca (B-5). Pružatelj i model se ne imenuju (Q-10).
- **Pravičnost prema studentu:** (1) student vidi isto što i nastavnik (sastav, sažetak, reprodukcija, podudaranje); (2) nijedna oznaka ne blokira predaju, ne ulazi u ocjenu ni izvoz, ne rangira; (3) nepoznato podrijetlo „traži objašnjenje, ne sankciju”, a student ima gdje to objašnjenje dati (`…-explanation.post`, `event-disputes`) i ono se mora vidjeti **uz** nalaz prije nego što ga nastavnik interpretira; (4) „nije dokaz autorstva” stoji uz svaki postotak i uz oznaku podudaranja; (5) ritam unosa smije služiti samo razgovoru o radu; (6) ako zapis ima praznine, nastavnik to vidi prije nego što zaključi bilo što; (7) nastavnik ne vidi ni jedan sudski ton: nema riječi „sumnjivo”, „osuđen”, „kazna”, „varanje”, „plagijat”, „provjera AI-ja”.
- **P-13 (podudaranje s pomoćnikom):** tekst kaže „Ovo je obična usporedba teksta i ništa ne govori o autorstvu.” Pregled ne smije imati naslov „AI sadržaj”, „postotak AI-ja” ni ikonu upozorenja; broj riječi zaredom i datum razgovora su činjenice, a zaključak ostaje nastavniku.
- **Zabranjeni izrazi:** svaki novi tekst kroz skener (PRODUCT §5): „plagijat”, „kazna”, „dokaz autorstva” (samo u negaciji), „provjera AI-ja”, „varanje”, „izvornost” (samo naziv obrasca). Tekst o kašnjenju opisuje zadatak, ne studenta.

---

## 4. Numerirani prijedlozi

Veličina: S (do ~150 redaka koda), M (150–400), L (više od 400 ili više PR-ova). „Server” = treba li novo polje ili ruta; „ne, postoji” znači da je operacija u izvatku ugovora. „Prototip” = dodiruje li prototip (`Ductura_nastavnik.html`, `INVENTAR-nastavnik.md`) i što bi se najprije izmijenilo.

**PG-1 Jedan pregled rada: zaglavlje s kontekstom i kartice pogleda.**
- Opis: zaglavlje okvira rada s kolegijem, naslovom zadatka, vrstom rada, rokom i stanjem (spoj `institution.assignment.get` po `assignmentId`, ili polja u `teacher.work.get`); ispod kartice (tabs) „Tekst · Sažetak · Podrijetlo · Reprodukcija · Usporedba · Izjava” koje čuvaju rad i položaj pri prijelazu; „Natrag na zadatak”, ne samo na kolegije. Brz put (N-05) pamti odabranu karticu pri „Sljedeći rad”.
- Korist: H-1, H-2, H-14. Veličina: M. Rizik: nizak do srednji (dira ljusku rada; vizualni okvir je centralan, 22. 11.). Server: ne za spoj preko `institution.assignment.get`; naziv i kolegij u `teacher.work.get` bi bila nova polja (ne izmišljam). Prototip: da (N-06 zaglavlje, kartice kao u N-05).

**PG-2 Karta podrijetla uz tekst rada.**
- Opis: tekst rada s oznakama podrijetla po odlomku (tipkano, zalijepljeno poznato/nepoznato, uvezeno, iz pomoćnika, podudara se) kao **tekstualna** oznaka uz boju (nije samo boja), prekidač „Prikaži podrijetlo”, skok „sljedeće lijepljenje / prijenos iz pomoćnika”, popis odsječaka kao alternativni prikaz; ispod: „Ductura ne zna tko je tipkao.” i „nije dokaz autorstva”. Podaci: `work.origin-composition.get`, odsječci iz sažetka; raspon po izvoru je plan napada.
- Korist: H-4, H-5. Veličina: L. Rizik: **srednji do visok** (najosjetljiviji prikaz: nastavnik čita obojan tekst; oznake ne smiju zvučati kao presuda; ovisi o pravnom mišljenju i DPIA za izvore). Server: **raspon (početak i kraj) po izvoru po odlomku može zahtijevati novo polje**; provjeriti vraćaju li odsječci `segmentRef` s rasponom; ne izmišljam. Prototip: da (`provMap`, `km-h`).

**PG-3 Razjašnjenje triju pojmova uz postotke (podrijetlo, podudaranje, ritam).**
- Opis: uz svaku vrstu u „Sastavu teksta” jedna rečenica što znači i što **ne** znači („Podudara se s odgovorom pomoćnika: osam ili više riječi zaredom jednako je odgovoru koji je student dobio u Ducturi. To je usporedba teksta, ne zaključak.”); „umetnuto iz pomoćnika” odvojeno od „podudara se” (prikaz u dva reda); isti tekst vidi student; pomoć „Kako čitati ovaj prikaz” (zatvorena zadano).
- Korist: H-5, pravičnost. Veličina: S. Rizik: nizak (tekst kroz pravni pregled i skener). Server: ne. Prototip: da (legenda `pv-legend`).

**PG-4 Sažetak procesa: pilot-dijelovi i razlika „nije dostupno” / „greška”.**
- Opis: odjeljak „AI pomoćnik” u sažetku pokazuje broj razgovora i prijenosa (iz `work.assistant-match.get` i izjave, bez pružatelja i modela), uz poveznicu na razgovore; „Trenutačno nije dostupno.” dobiva razlog („poslužitelj ovaj dio ne daje” / „pokušajte ponovno”) i „Pokušaj ponovno” samo kad ima smisla; „Ritam više nije dostupan (briše se 30 dana nakon predaje)” kao uobičajeno stanje.
- Korist: H-6, §3.2. Veličina: S do M. Rizik: nizak. Server: ne, postoji; **pružatelj, model, svrha i preneseni tekst nisu dostupni** i ne traže se (Q-10). Prototip: da (N-10 „AI pomoćnik”, „Praznine”).

**PG-5 Reprodukcija: skok na lijepljenje/prazninu i lagano pomicanje.**
- Opis: popis „Važna mjesta” (lijepljenja iznad praga, prijenosi iz pomoćnika, praznine, predaje) s „Skoči” umjesto „Skoka na sesiju” dok zapis ne nosi sesije (D-239); tipkovnica: razmak = pokreni/zaustavi, strelice = promjena; `aria-live` isključen za tajmer, „Promjena n od N” kao izjava na zahtjev; zadana brzina 1×, bez automatskog pokretanja.
- Korist: H-7, §2.3. Veličina: M. Rizik: nizak. Server: ne za popis (iz sažetka); sesije u zapisu bi bile **novo polje** (ne izmišljam). Prototip: da (N-09 „Skok na”).

**PG-6 Izjava studenta, razgovori i pitanje nastavnika na jednom mjestu pregleda.**
- Opis: kartica „Izjava” u pregledu rada: obrazac fakulteta (verzija), što je student naveo (`humanHelp {kind,text}`), **pitanje nastavnika i odgovor studenta** (kad postoji, NF-4 NZ-15), „Razgovori uz izjavu” s brojem i datumima, „Pregledaj razgovor” (`ch-h`), stanje „Izjava nije predana” / „Izjava nije obavezna” (iz `teacher.declaration-required.get`). Nastavnik vidi što student vidi („Isto vidi i student”).
- Korist: H-8, PR-20. Veličina: M. Rizik: srednji (pravno osjetljiv sadržaj; razgovori su osobni zapis). Server: osnova ne, postoji (`teacher.declaration.get`); **pitanje i odgovor: da, novo polje u declaration-v1** (NF-4 NZ-15; ne izmišljam oblik). Prototip: da (`declPanel`, `ch-h`, E-9 pitanje).

**PG-7 Objašnjenja i prigovori studenta uz nalaz, prije zaključka.**
- Opis: uz svaki nalaz podudaranja, uz „zalijepljeno nepoznatog podrijetla” i uz događaj s prigovorom prikazati studentovo objašnjenje (`work.assistant-match-explanation`, `work.event-disputes.get`) ispod nalaza, zadano raširen; ako objašnjenja nema, „Student još nije dao objašnjenje.”; nastavnik ne može označiti nalaz „riješenim” bez čitanja (samo prikaz, bez oznake). Sažetak „objašnjeno n od m” na kartici podrijetla.
- Korist: H-9, pravičnost (3). Veličina: M. Rizik: srednji (nastavnik ne smije biti prisiljen odgovarati; ništa ne ulazi u ocjenu). Server: **provjeriti** vraća li nalaz objašnjenje uz isti `messageId`/`segmentRef` u jednom čitanju (ugovori su zasebni: `assistant-match.get` i `…-explanation.post`); čitanje objašnjenja nije u izvatku kao posebna operacija (ne izmišljam). Prototip: da (nova stavka uz `provMap`).

**PG-8 Dorada kao jedan tok s pregleda rada.**
- Opis: jedan dijalog `dd-h` iz okvira rada, predaje i retka studenta; „Student vidi: …” uz poruku; rok obavezan (2151); „Povuci zahtjev” (`withdraw`) dok student nije odgovorio; u banneru što je student naveo i poveznica „Usporedi s predanom verzijom”. Vidi NF-4 NZ-12; ovdje samo ulaz iz pregleda rada.
- Korist: H-10. Veličina: M. Rizik: srednji (ishod mora čekati poslužitelj, 2164). Server: ne, postoji (`work.return-for-revision.post`, `collaboration.revision-requests.post`). Prototip: da (`dd-h`, `doradaBanner`).

**PG-9 Povratna informacija: „Što je student već dobio”.**
- Opis: jedna vremenska lista za rad (komentari objavljeni studentu, dorada, etape, konzultacije, razgovor), označeno što je student vidio; nacrti komentara označeni „nije objavljeno”; samo čitanje.
- Korist: H-11. Veličina: M. Rizik: nizak. Server: ne za osnovu (komentari, nacrti, dorada, konzultacije su zasebne operacije); „student je vidio” **nije u izvatku** (ne izmišljam). Prototip: da (nova kartica uz `cm-h`).

**PG-10 Ocjena: odluka prije gradnje.**
- Opis: tri smjera: (a) Ductura ne bilježi ocjenu, ostaje uz Merlin i u pregledu stoji samo „Probni zadatak se ne ocjenjuje” / „Ocjenu upisujete u Merlin” uz izvoz; (b) polje „Ocjena” i „Komentar uz ocjenu” uz rubriku (kriteriji vidljivi studentu, 2122); (c) samo rubrika bez broja. Preporuka (a) za pilot.
- Korist: H-12. Veličina: S (a) / L (b). Rizik: (a) nizak; (b) **visok** (PRODUCT, oznake „za pregled” nikad ne ulaze u ocjenu, pravni status ocjene u sustavu). Server: (a) ne; (b) **da, nema operacije za upis ni čitanje ocjene** (`teacher.assignment-grade.get` samo kaže smije li se ocjenjivati). Prototip: (a) ne; (b) da.

**PG-11 Izvoz i ispis pregleda rada.**
- Opis: gumb „Izvezi PDF rada” uz pogled (`work.export-pdf.get`: PDF + otisak izlaza), „Izvezi sažetak procesa”, „Ispiši pregled” (jednostavan prikaz za ispis: zaglavlje s kolegijem, studentom i datumom izvoza; tekst, sastav, sažetak, izjava, napomene „nije dokaz autorstva”), upozorenje „Datoteka sadrži tekst rada i ime studenta; čuvajte je prema pravilima fakulteta”; izvoz se bilježi u dnevnik pristupa; probni zadatak bez izvoza (409).
- Korist: H-13. Veličina: M do L. Rizik: srednji (osobni podaci napuštaju Ducturu; ispis sažetka i karte). Server: PDF rada ne, postoji; **PDF sažetka/karte: nema operacije** (ispis iz preglednika `@media print` bez servera je moguć). Prototip: da (novi gumbi uz `rd-links`).

**PG-12 Mobilni pregled rada.**
- Opis: pregled rada na 400 px: kartice pogleda jedna ispod druge, sastav kao kartice umjesto tablice, reprodukcija s velikim kontrolama (44 px), „Zatraži doradu” i komentar kao cijeli ekran; provjera `mobile-review/`.
- Korist: §2.4. Veličina: M. Rizik: nizak. Server: ne. Prototip: da (mobilne granice centralno uz VIZ).

**PG-13 Pristupačnost pregleda rada.**
- Opis: oznake podrijetla bez oslanjanja na boju, `aria-live` na reprodukciji, zaglavlja tablica (`scope`), fokus i Escape u `ch-h` i `dd-h`, kontrast oznaka „za pregled/prekoračeno/u skladu”, e2e s axe na 1250 i 400 px za sažetak, kartu, reprodukciju, izjavu; čitač zaslona kod reprodukcije.
- Korist: §2.3. Veličina: M. Rizik: nizak. Server: ne. Prototip: ne.

**PG-14 Poruke i zabranjeni izrazi za pregled rada (jedan prolaz).**
- Opis: pregled svih tekstova n06, n07, n09, n10, provenance, ai-declaration, interview kroz skener; popis fraza koje su dopuštene samo u negaciji; dodati tekst „Nijedna oznaka ne ulazi u ocjenu ni izvoz” uz kartu, ako vlasnik potvrdi (Ustav v1.7/v1.8).
- Korist: §3.2, pravičnost. Veličina: S. Rizik: nizak. Server: ne. Prototip: da (tekstovi kao u INVENTAR §3.9–3.11).

**PG-15 Scenarij za provjeru pregleda rada (lažni poslužitelj).**
- Opis: `teacher.access.get`, `teacher.work.get`, `teacher.declaration.get`, sastav, nalazi podudaranja, reprodukcija i objašnjenja u scenariju „puno” (samo izmišljeni podaci), da se pregled rada može provjeriti klikom i mjeriti (revizija, zadatak 16; NF-4 NZ-18).
- Korist: H-3; bez njega nijedan od prijedloga nije provjerljiv klikom. Veličina: S do M. Rizik: nizak. Server: ne (test-fakes). Prototip: ne.

Nisu predloženi: **bilo kakav automatski zaključak o autorstvu** (model, detektor, „postotak AI-ja”, rangiranje studenata; Ustav v1.6 C-6), sumnja ili „zastavica” koja blokira ili ide u ocjenu; snimanje zaslona i zapis tipki (Ustav v1.9); usporedba radova među studentima; prikaz stvarnog sadržaja razgovora izvan studentove izjave; podsjetnici i skupno slanje komentara (dio 4); mentorstvo (dio 6).

---

## 5. Tablica za Danielovu odluku

Preporuka je moja; odluka je vaša. „Pilot” = ulazi u funkcije pilota 15. 1. 2027. (najprije u prototip i `INVENTAR-nastavnik.md`). Redoslijed je po koristi za pravičan pregled i riziku od pogrešnog ishoda.

| # | Prijedlog | Veličina | Server | Moja preporuka | Razlog | Vaša odluka |
|---|-----------|----------|--------|----------------|--------|-------------|
| PG-15 | Scenarij za provjeru pregleda rada | S do M | ne | **za pilot** | Bez njega se ništa ne može provjeriti klikom | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-3 | Razjašnjenje pojmova uz postotke | S | ne | **za pilot** | Najjeftinija zaštita od pogrešnog čitanja (P-13) | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-14 | Prolaz poruka i zabranjenih izraza | S | ne | **za pilot** | Pravičnost i PRODUCT §5 | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-7 | Objašnjenja studenta uz nalaz | M | provjeriti | **za pilot** | Student se čuje prije zaključka | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-6 | Izjava, razgovori i pitanje na jednom mjestu | M | pitanje: da | **za pilot** (pitanje samo uz SRV ugovor) | Asistent i PR-20 u pilotu | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-1 | Zaglavlje s kontekstom i kartice pogleda | M | ne | **za pilot** | Nastavnik ne zna koji je rad ni gdje je | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-4 | Sažetak: pilot-dijelovi, „nije dostupno” | S do M | ne | **za pilot** | Asistent u pilotu mora biti vidljiv | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-8 | Dorada kao jedan tok | M | ne | **za pilot** | Jedan dijalog, jasni rokovi | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-13 | Pristupačnost pregleda | M | ne | **za pilot** (centralni prolaz) | Obvezno prije pilota | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-11 | Izvoz i ispis | M do L | PDF sažetka: da | pilot: PDF rada + ispis iz preglednika; ostalo nakon | Razgovor sa studentom traži papir | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-5 | Reprodukcija: skok i tipkovnica | M | sesije: da | pilot: popis „važna mjesta” i tipkovnica | Sesija u zapisu nije odlučena (D-239) | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-9 | „Što je student već dobio” | M | „vidio”: da | nakon pilota | Korisno, ali nije kritično | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-12 | Mobilni pregled | M | ne | nakon pilota (centralno uz VIZ) | Pregled rada je uglavnom na računalu | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-2 | Karta podrijetla uz tekst rada | L | raspon: provjeriti | pilot samo uz potvrdu servera i pravni pregled; inače nakon | Najosjetljiviji prikaz; boja kao oznaka | ☐ pilot ☐ nakon pilota ☐ ne |
| PG-10 | Ocjena | S / L | (b): da | **(a) u pilotu**: Ductura ne bilježi ocjenu | Nema ugovora, pravno osjetljivo | ☐ pilot ☐ nakon pilota ☐ ne |

Pitanja na koja ne mogu odgovoriti sama (najviše 8):
1. **Ocjena (PG-10):** bilježi li Ductura ocjenu (b), ili ocjena ostaje u Merlinu (a)? Ako (b): tko je smije vidjeti i smije li ulaziti u izvoz?
2. **Karta podrijetla (PG-2):** vraća li poslužitelj raspon po odsječku za prikaz u tekstu rada, ili je dovoljan popis odsječaka i sastav (kao danas)?
3. **Objašnjenje uz nalaz (PG-7):** smije li se studentovo objašnjenje čitati uz nalaz na karti (isti prikaz kao student), ili samo u pripremi za razgovor (N-14)?
4. **Pitanje uz izjavu (PG-6, PR-20):** otvara li se SRV zadatak za polje pitanja i odgovora u declaration-v1 prije pilota?
5. **Ritam unosa (§3.2):** smije li nastavnik u pregledu vidjeti ritam po odsječku uz napomenu „dokaz o unosu, ne o autorstvu”, ili samo da je „zabilježen / nije zabilježen”?
6. **Izvoz i ispis (PG-11):** smije li pregled s oznakama podrijetla i podudaranja biti izvezen/ispisan (napuštaju Ducturu), ili se izvoze samo rad i potvrda?
7. **Skok na sesiju (PG-5):** hoće li zapis nositi sesije (D-239) ili se skok zamjenjuje popisom „važna mjesta”?
8. **Asistent u pilotu (NF-4 §0 / odluka 23. 11.):** potvrđujete li da NF-4 tvrdnja „asistent isključen (OC-1)” vrijedi samo do 23. 11. i da je nastavnik u pilotu vidi razgovore (ch-h)? Ako da, NF-4 NZ-3 („samo sažimanje” onemogućeno) treba ponovno razmotriti.

Otvoreno za provjeru u pregledniku (nije moguće iz ovog pregleda): sve ekrane rada, sažetka, karte, reprodukcije, usporedbe i izjave u scenariju koji ima `teacher.access.get`; mobilni prikaz i `mobile-review/`; čitač zaslona na reprodukciji i karti; ispis i izvoz; je li karta podrijetla povezana s tekstom rada; jesu li nalazi H-1 i H-10 popravljeni nakon revizije od 23. 11.; ponašanje poslužitelja za `work.assistant-match` i objašnjenja.

---

## 6. Provedba u prototipu (NF-5, 23. 11. 2026.)

Zadatak `nf5-prototip-pregled-rada`. Danielove odluke (doslovno: „Sve u pilotu 1. Ostaje u Merlinu 2. Smije ovo prov 3. Da 4. Smije vidjeti ritam pisanja po dijelu teksta 5. Smije s oznamaka podrijetla izvesti i ispisati”) zatvaraju pitanja 1, 3, 4, 5 i 6 iz odjeljka 5 i stavljaju svih 15 prijedloga u pilot. Provedeno je u `docs/prototip/Ductura_nastavnik.html` (novi ekran `pregled`; atribut `data-nf5="PG-n"` na elementu; `.srv` „Poslužitelj:” označava što poslužitelj nema) i u `docs/prototip/INVENTAR-nastavnik.md` §9 (ID-evi NF5-PGn, stanja, serverska ovisnost). Pružatelj i model se ne imenuju: pišu samo „Asistent” (Q-10 nije donesena); zamijenjeni su i preostali tekstovi u sažetku, Brzom putu i radu koji su imenovali „Pružatelj A, model M-2”.

| PG | INVENTAR ID | Element u prototipu | Poslužitelj |
|---|---|---|---|
| PG-1 | NF5-PG1 | zaglavlje s kontekstom i kartice pogleda na ekranu `pregled`; ulaz iz `rad` | naziv zadatka i kolegij nedostaju u `teacher.work.get` |
| PG-2 | NF5-PG2 | tekst s oznakama podrijetla riječima, prekidač, skok na sljedeću oznaku, tablica odsječaka | raspon po odlomku nedostaje |
| PG-3 | NF5-PG3 | „Sastav teksta” s „Što znači / Što ne znači” i „nije dokaz autorstva” uz svaki postotak | postoji |
| PG-4 | NF5-PG4 | sažetak: Asistent (broj), podudaranje s greškom dijela, „nije dostupno” s razlogom, ritam | postoji |
| PG-5 | NF5-PG5 | „Važna mjesta” sa „Skoči”, razmak i strelice, bez automatskog pokretanja | sesije u zapisu nedostaju |
| PG-6 | NF5-PG6 | kartica Izjava s pitanjem i odgovorom, razgovori, `ch-h` | pitanje i odgovor: SRV-IZJAVA-PITANJE otvoren |
| PG-7 | NF5-PG7 | objašnjenje uz svaki nalaz, „Objašnjeno n od m” | čitanje objašnjenja nedostaje |
| PG-8 | NF5-PG8 | jedan dijalog dorade, „Povuci zahtjev”, usporedba | postoji |
| PG-9 | NF5-PG9 | „Što je student dobio” | „student je vidio” nedostaje |
| PG-10 | NF5-PG10 | „Ocjenu upisujete u Merlin”, probni zadatak | ne |
| PG-11 | NF5-PG11 | izvoz i ispis, upozorenje, dnevnik pristupa | PDF sažetka i pregleda nedostaje |
| PG-12 | NF5-PG12 | kartice umjesto tablica ispod 760 px | ne |
| PG-13 | NF5-PG13 | tablist, `caption`/`scope`, `aria-live` na zahtjev, povrat fokusa | ne |
| PG-14 | NF5-PG14 | skener zabranjenih izraza nad novim tekstovima | ne |
| PG-15 | NF5-PG15 | varijanta „puno” svakog elementa | test-fakes: otvoreno |

Provjera: sve varijante (puno, prazno, učitavanje, greška, ritam nedostupan, greška jednog dijela, izjava nije predana, dorada, probni zadatak, greška izvoza) svih osam kartica crtaju se bez grešaka u konzoli; skripta s tokovima (promjena kartice strelicama, reprodukcija, skok na važno mjesto, `ch-h` s povratom fokusa, izvoz sa zapisom u dnevnik, dijalog dorade, skok na oznaku) prolazi; axe (WCAG 2 A/AA, 2.1 AA i najbolje prakse) na 390 i 1280 px u svijetloj i tamnoj temi nije našao pogreške; na 390 px nema vodoravnog pomicanja. Skener zabranjenih izraza javlja samo „dokaz autorstva” u negaciji (dopušteno) i tehničke atribute koji su bili i prije.

Otvoreno: lažni poslužitelj za scenarij VIZ „puno” (PG-15) u `packages/test-fakes`; e2e s axe u hostu (PG-13); čitač zaslona i stvarni ispis (nije izmjereno; `@media print` provjeren samo emulacijom); SRV zadatak SRV-IZJAVA-PITANJE; operacije koje nedostaju (raspon po odlomku, čitanje objašnjenja, „student je vidio”, PDF sažetka).
