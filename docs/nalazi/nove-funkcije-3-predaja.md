# Nove funkcije, dio 3: Predaja i potvrda (ulaz iz editora, koraci predaje, izjava, slanje i ishodi, potvrda primitka, povlačenje, predaja nakon roka i dorada)

Zadatak NF-3 `nove-funkcije-predaja`. Plan: `ductura/.github`, `docs/plan/NOVE-FUNKCIJE.md`, dio 3 (Danielova odluka 23. 11. 2026.). Oblik i razina detalja po uzoru na `docs/nalazi/nove-funkcije-1-student-zadaci.md` (WEB #551) i `docs/nalazi/nove-funkcije-2-radni-prostor-editor.md` (WEB #555). Ovaj dokument je samo pregled; kod se ne mijenja. Nastavnička strana predaje (pregled predanih radova, povlačenje s nastavničke strane, produljenje roka, zahtjev za doradu) je dio 5; ovdje je opisano samo ono što student vidi od nje.

Odluke iz dijela 2 se ne ponavljaju, nego se na njih nadovezuje: P-12 (izjava o AI-ju kao dijalog u editoru), P-16 (proba predaje sa stvarnim podacima), P-17 („Predaja rada” uvijek vidljiva i broj blokada). Oznake prijedloga u ovom dokumentu su **PR-n** (da se ne miješaju s P-n iz dijela 2), nalaza **G-n**.

## 0. Izvori, način pregleda i ograničenja

Pročitano:
- prototip: `docs/prototip/INVENTAR-student.md` (§E-7 do §E-11, §PD-1 do §PD-8, §3 „Radnje” R-27 do R-42, §4 podaci, §7 nejasno), `docs/prototip/Ductura_student.html` i `Ductura_student_kartice.html` samo za nazive i redoslijed koraka; `docs/prototip/INVENTAR-editor.md` samo za granicu editora i predaje; Danielovi odgovori `docs/prototip/ODGOVORI-DANIEL-2026-11-19.md` (B-5 „izvornost” kao navod službenog obrasca, B-6 „spremljeno” samo uz potvrdu poslužitelja, C-3 izjava prije D-194, C-6 javna provjera potvrde, C-19 „nije” u provjeri oblika);
- revizije `docs/nalazi/paritet-student-2.md` (dijelovi C: E-8, E-9, PD-1, PD-2, PD-4; D: E-10, E-11, PD-3, PD-7, PD-8, R-27 do R-42, PO-17, PO-18; mjereno 23. 11. 2026.) i `docs/nalazi/paritet-editor-2.md` (B52 do B59: predaja, banner „predano”, dorada), te `docs/nalazi/nove-funkcije-1-student-zadaci.md` i `nove-funkcije-2-radni-prostor-editor.md`;
- aplikacija (host), `packages/app/src/host/student/submission/`: `index.tsx` (ruta i okviri), `steps/` (traka koraka, ploča „rad nije započet”, „predano”), `summary/` (E-8, PD-1, PD-4, vrata izjave `declaration-gate.ts`), `declaration/` (E-9, PD-2, `step-ports.ts`), `submit/` (E-10, PD-3, `newer-local.ts`, `local-hold.ts`), `receipt/` (E-11), `withdraw/` (povlačenje), te `host/student/work.tsx` (banner predano), `host/editor/mentor/` (Proba predaje), `host/editor/work/review/` (dorada, student), `host/teacher/revision/` samo kao izvor teksta koji student vidi;
- ugovori u izvatku `src/client/migration-contracts.generated.json` za ovaj dio: `student.submission.get`, `submission.submit.post`, `submission.submit-second.post`, `student.declaration.get|put`, `student.declaration-attachments.post`, `student.submission-notes.get|post`, `student.submission-withdrawal.get|post`, `student.submission-history.get`, `student.receipt-pdf.get`, `student.portable-record.get`, `student.submission-package-link.post`, `student.submission-package.get`, `notifications.returned-for-revision.list.get`, `work.return-for-revision.post`, `work.milestones.request-revision.post`, `collaboration.revision-requests.post`, `teacher.deadline-extension.post|teacher.deadline-extensions.get` (samo što student vidi), `support.problem-report`.

Što nije učinjeno, izričito:
- **aplikacija nije pokrenuta** s lažnim poslužiteljem (scenarij VIZ „puno”) u ovoj sesiji. Ponašanje je izvedeno iz izvornog koda, kataloga `messages.hr.ts`, testova i žive provjere iz `paritet-student-2.md` i `paritet-editor-2.md` (23. 11. 2026., Chromium 1440, 1250, 1050 i 400 px). Gdje stavka ovisi o stvarnom prikazu (razmak, odsijecanje, veličina cilja, redoslijed Tab, čitač zaslona), označena je „provjeriti u pregledniku”. Revizija izričito upozorava da VIZ „puno” daje pogrešnu sliku za E-6, E-7, E-8, E-10 i E-11 (vektori), pa su ti ekrani ondje mjereni vlastitim odgovorima; to vrijedi i za ovaj dokument;
- **plan `NOVE-FUNKCIJE.md` iz `ductura/.github` nije čitan**: oblak nema pristup tom repou (HTTP 403). Sadržaj dijela 3 uzet je iz naloga orkestratora (popis tema) i iz dijelova 1 i 2 u ovom repou. Ako plan traži temu koje ovdje nema, upisat će se naknadno;
- nije provjeravan nastavnički prikaz predanog rada (dio 5), baza, Docker ni pravi poslužitelj; potpisi potvrda i javna provjera nisu pokretani;
- opisi sličnih alata u dijelu 3 su iz općeg poznavanja takvih alata, ne iz uživo provjere njihovih trenutačnih verzija; ništa se ne kopira (ni izgled ni tekst);
- ništa nije provjeravano na stvarnim studentima; svi primjeri su izmišljeni (kolegij „Uvod u medije”, „Student A”, mentor „Nastavnik A”).

Ograničenja plana koja vrijede za sve prijedloge: rok funkcija pilota 15. 1. 2027. se ne pomiče; prijava studenata samo AAI@EduHr (D-09, D-16); server se ne izmišlja (uz svaki prijedlog stoji postoji li operacija u izvatku ili treba novo polje); prototip ostaje izvor istine; PRODUCT §5 i rječnik zabranjenih izraza vrijede za svaki tekst. Odluke koje se ne ponavljaju kao pitanja: Q-10 odgođen (ne bira se pružatelj ni model), izjava o AI-ju kao dijalog ch-h (2165), „izvornost” samo kao doslovni naziv službenog obrasca (B-5), predaja se potvrđuje samo potpisanom potvrdom poslužitelja (B-6), vrijeme predaje je trenutak kad zahtjev stigne na poslužitelj (ne trenutak klika), P-D3 povlačenje samo dok rok traje, svaka predaja i povlačenje zapisani s potvrdom, nastavnik ga smije isključiti (zadano uključeno), podudaranje s pomoćnikom uključeno u pilotu (22. 11.), postotci i oznake „za pregled” ne ulaze u predaju (Ustav v1.7 do v1.9), kriteriji ocjene su vidljivi studentu (2122).

---

## 1. Tok korisnika od početka do kraja

Rute u aplikaciji (host): `/rad/{id}` (editor), `/rad/{id}/predaja` (ulaz u tok), `/rad/{id}/predaja/izjava` (korak 2), `/rad/{id}/predaja/pregled` (korak 3), `/rad/{id}/predaja/slanje` (korak 4), `/rad/{id}/predaja/potvrda` (korak 5), javna `/provjera`. Student dolazi iz dijela 2 (editor) ili iz obavijesti o doradi (dio 1).

### 1.1 Ulaz iz editora

1. U zaglavlju radnog prostora „Predaja rada” je poveznica na `/rad/{id}/predaja`; ne predaje ništa. Nakon predaje je skrivena. Bez mreže je onemogućen gumb s napomenom „Predaja rada traži vezu s mrežom.” (dio 2, P-17 predlaže da bude uvijek dohvatljiv i da nosi broj blokada).
2. U desnom panelu, kartica „Mentor” (puni naziv „Mentor i predaja”), „Proba predaje”: „Ništa se ne predaje. Ovo je popis onoga što bi mentor i referada dobili da rad predate sada.” Odjeljci: „Blokira predaju” (mjesta ostavljena za kasnije), „Dijelovi rada”, „Za pogledati”, „Opseg”, Sažetak, Summary, Ključne riječi, Izjava, „Komentari mentora (Otvoreno: n)”, „Suglasnost mentora”, „Kako će izgledati ispis”. Redak o izjavi čita lokalnu oznaku, ne stanje poslužitelja (dio 2, G-19).
3. Ako je rad vraćen na doradu, uz rad se prikazuje obavijest „Rad je kod Vas: dorada” i kartica „Pregled” s „Runda n čeka Vaš pregled.” i „Pregled runde”; „Pošalji doradu” trenutačno piše „Slanje dorade trenutačno nije dostupno.” (port `send: null`).
4. Student može predati i bez probe; proba je savjetodavna, a blokira samo ono što blokira poslužitelj.

### 1.2 Zajednički okvir koraka (E-8 do E-11)

- Ljepljiva traka: „Natrag na rad” i put „Kolegij A · naslov · oznaka koraka”.
- `ol` s `aria-label` „Koraci predaje”: 1 Tekst, 2 Izjava, 3 Prije predaje, 4 Predaja, 5 Potvrda; tekući korak `aria-current=step`. Redoslijed prikaza (Izjava prije pregleda) slijedi prototip.
- Ploče u dva stupca od 1050 px; desni stupac na koraku 3 je sažetak procesa (PD-1).
- Okviri svakog koraka: učitavanje („Učitavam stanje rada s poslužitelja.”), greška s „Pokušaj ponovno”, „Rad još nije započet. Započnite ga u radnom prostoru.” + „Otvori radni prostor”, „Predaja ovog rada već je zatražena {vrijeme}.” + „Otvori potvrdu o predaji” (za predan rad korak 4 preusmjerava ravno na potvrdu).
- Odjava (401) vodi na `/api/v1/auth/login?returnTo=…/predaja/{korak}` i vraća na isti korak.

### 1.3 Korak 2: Izjava o korištenju generativne umjetne inteligencije (E-9)

1. Naslov „Izjava o korištenju generativne umjetne inteligencije”, meta „po čl. 9 i 15 pravilnika fakulteta”.
2. Blok „Zabilježeno u Ducturi” (oznaka „zabilježeno”): u pilotu uvijek „U ovom radu nije zabilježen razgovor s AI pomoćnikom.” jer asistenta nema (OC-1 isključeno, Q-10 odgođen).
3. Blok „Vaša izjava” (oznaka „izjavljeno”): četiri retka (Vanjski alati, Svrha, Faza rada, Ljudska pomoć `humanHelp {kind,text}`), „Uredi izjavu” otvara ugrađeno uređivanje; prazno: „Izjava još nije ispunjena.” + „Ispuni izjavu”.
4. „Prilozi”: u pilotu „Nema razgovora za prilaganje.” (declaration-v1 `attachments maxItems 0`).
5. „Pitanje nastavnika” i polje „Odgovor (nije obavezan)” napisani su, ali `question: null`; ne prikazuju se.
6. Potvrdni okvir „Potvrđujem izjavu”; dok nije označen „Dalje” je `aria-disabled` s razlogom „Dalje je moguće kad potvrdite izjavu.”. Potvrda se piše na poslužitelj (`student.declaration.put`); stanja izjave none, draft, confirmed, stale (tekst se promijenio nakon potvrde), bound (vezana uz predaju).
7. „Natrag” vodi u editor; nakon potvrde „Dalje” vodi na korak 3. Greška učitavanja blokira potvrdu.

### 1.4 Korak 3: Prije predaje (E-8) i sažetak procesa (PD-1)

1. Uvod „Popis pokazuje je li sve priloženo. Ne ocjenjuje rad.”
2. Pet redaka: (1) Izjava „Potvrđena” / „Još nije potvrđena.” + „Otvori izjavu”; (2) „Razgovori uz izjavu” (u pilotu „Broj priloženih razgovora trenutačno nije dostupan.”); (3) mjesta za izvor, (4) lijepljenja, (5) „Pravila oblika: Provjera oblika još nije pokrenuta.”. Redci 3 i 4 su danas statični tekst bez popisa i poveznica („Lijepljenja veća od praga: 1…; manja lijepljenja: 2. Lijepljenja ne zaustavljaju predaju.”).
3. Poveznica „Dodaj napomenu (nije obavezna)” otvara obrazac PD-4 (do 600 znakova, `aria-invalid` pri praznom tekstu; napomene se samo dodaju).
4. Desni stupac, sažetak procesa (PD-1, 11 odjeljaka): razdoblje rada, sesije, aktivno vrijeme uređivanja, verzije, lijepljenja, AI pomoćnik (u pilotu „nije dostupan”), praznine u zapisu, izjava, napomene studenta, stanje zapisa, karta podrijetla. Uvodna rečenica: „Rad još nije predan. Sažetak se dopunjuje dok pišete; nastavnik ga može otvoriti u svakom trenutku.” Uz odjeljke oznake „opaženo” i „izjavljeno”.
5. Gumbi: „Natrag” (izjava) i „Dalje” (slanje); s nepotvrđenom izjavom „Dalje” zamjenjuje „Natrag na izjavu” (vrata izjave). Bez mreže: „Nema veze s poslužiteljem. Predaja traži vezu; …”, oznaka ploče „Bez veze”, „Dalje” `aria-disabled`.

### 1.5 Korak 4: Predaja (E-10) i dijalog „Predati rad?” (PD-3)

1. Ploča „Predati rad?”: rok, „Riječi u predanom tekstu”, „Razgovori uz izjavu”, „Tekst koji predajete” (verzija na poslužitelju) i napomena „Predaje se točno ovaj tekst, onako kako je spremljen na poslužitelju. Izmjene koje još nisu stigle na poslužitelj nisu u predaji.”; „Vrijeme predaje je trenutak kad zahtjev za predaju stigne na poslužitelj, ne trenutak klika. Nakon predaje tekst ovog rada više nije moguće mijenjati.”
2. Varijante vremena: **produljen** (oznaka „Rok produljen do {datum}” + „Rok je produljen do {datum} u {sat}.”), **nakon roka** („Rok je bio {rok}. … Predaja će biti označena kao predaja nakon roka.”; gumb ostaje omogućen, rok se računa prema kasnijem od roka i produljenja), **rok nije moguće učitati** („Poslužitelj ga provjerava pri predaji.”).
3. Vrata: bez mreže, bez potvrđene izjave („Predaja je moguća kad potvrdite izjavu.” + „Otvori izjavu”; stanje izjave čita se s poslužitelja, uz „Provjeravam izjavu na poslužitelju…” i „Provjeri izjavu ponovno”), bez teksta na poslužitelju („Na poslužitelju još nema teksta ovog rada.”). Onemogućen „Predaj rad” je `aria-disabled` s `aria-describedby`.
4. Novija verzija na uređaju (INT-16): „Na uređaju je novija verzija” s izborom „Pošalji najprije zadnju verziju pa predaj” ili „Predaj potvrđenu verziju V{n}”; predaje se uvijek samo ono što je poslužitelj potvrdio.
5. „Predaj rad” otvara modalni dijalog „Predati rad?”: „Predaje se tekst rada „{naslov}” spremljen na poslužitelju, s izjavom.”, „Nakon predaje tekst više nije moguće mijenjati.”, kod roka „Rok je prošao, pa će potvrda navesti da je rad predan nakon roka.”, „Riječi: n.”; gumbi „Predaj rad” (fokus) i „Natrag”. Tijekom slanja (`role=status` „Šalje se…”/„Predaja u tijeku…”) oba gumba su `aria-disabled`, Escape i zastor ne zatvaraju, drugi zahtjev se ne šalje (`oneAtATime`).
6. Zahtjev: `submission.submit-second.post` ({documentId, revision}); uspjeh tek uz potpisanu potvrdu oblika ductus-submission-receipt-v2 za isti dokument i reviziju, zatim prijelaz na korak 5.

### 1.6 Ishodi slanja (korak 4)

| Ishod poslužitelja | Što student vidi | Je li predano |
|---|---|---|
| 200 + potpisana potvrda | prijelaz na potvrdu | da |
| 409 blocked: `segment_unsigned` | „Predaja nije prihvaćena: poslužitelj još nije potvrdio cijeli zapis ove verzije teksta. Ostavite radni prostor otvoren s vezom…” | ne |
| 409 blocked: `record_discontinuous`, `no_evidence` | „…zapis ove verzije teksta na poslužitelju nije cjelovit.” / „…na poslužitelju nema zapisa ovog rada.” + „Rad nije predan. Tekst je spremljen na uređaju.” | ne |
| 409 blocked: `record_mismatch` | „Predaja nije dovršena: zamjenski postupak”; „Vrijeme Vašeg zahtjeva je zabilježeno i ostaje vrijeme predaje. … Obratite se nastavniku kolegija.” (zamjenski postupak samo ako ga poslužitelj navodi, odluka 2156; inače „Zamjenski postupak trenutačno nije dostupan.”) | zahtjev zabilježen, predaja nedovršena |
| 409 `stale_revision` | „Na poslužitelju je novija verzija teksta. Osvježite i pokušajte ponovno.” + „Učitaj ponovno” | ne |
| 409 `already_requested` | „Predaja ovog rada već je zatražena {vrijeme}.” (stanje čeka: „Poslužitelj je primio zahtjev… potvrda još nije potpisana”) | da (zahtjev) |
| 409 `not_open` | „Predaja za ovaj zadatak trenutačno nije otvorena.” | ne |
| 409 `not_acknowledged` | preusmjerenje na obavijest zadatka (`/zadatak/{id}`) | ne |
| 4xx `too_large`, `not_found`, `upgrade_required` | „Tekst je prevelik za predaju.”, „Rad nije dostupan ovom računu.”, „Ova verzija aplikacije je zastarjela. Osvježite stranicu.” | ne |
| 503, 408, prekid veze, odgovor izvan ugovora | „Odgovor poslužitelja nije stigao, pa ishod predaje nije poznat. Rad je možda predan.” + „Provjeri stanje predaje” (čita `student.submission.get`: potvrđeno vodi na potvrdu; „Poslužitelj nema zabilježenu predaju ovog rada. Rad možete predati.”) | nepoznato |
| 401 | prijava, povratak na isti korak | ne |

### 1.7 Korak 5: Potvrda o predaji (E-11) i što dalje

1. Naslov „Predano {datum u sat}” (+ „, nakon roka”); u obradi: „Predaja u obradi” („Potpis potvrde još se izdaje; vrijeme predaje se time ne mijenja.”).
2. Retci „Vrijeme predaje”, „Rok”, „Potpisivanje potvrde započelo” u zoni s oznakom (UTC+1/2); `details` „Točne vrijednosti iz potvrde (UTC)”.
3. „Otisak predanog teksta” u 16 skupina po 4 znaka; „Kopiraj otisak” (kopira 64 znaka bez razmaka, obavijest „Otisak je u međuspremniku (64 znaka, bez razmaka).”, nestaje nakon 3200 ms); uz praznine „Zapis ima praznine.”
4. „Otvori sažetak procesa” (ugrađena ploča, `aria-expanded`), „Provjera potvrde” (javna stranica bez prijave, otisak i broj potvrde u fragmentu adrese), QR uzorak („QR kod je u preuzetom zapisu. Ovdje je samo uzorak bez sadržaja.”), „Preuzmi zapis (PDF s QR kodom)”, kartica „Prenosivi zapis” (ZIP, `student.portable-record.get`), „Paket” i „za referadu” (`student.submission-package-link.post`, jednokratna poveznica), „Na početnu”.
4a. Svaki posjet ponovno čita `student.submission.get`, pa osvježavanje daje istu potvrdu (PO-18).
5. „Povlačenje predaje” (E-11, `withdraw/`): „Dok rok traje, predaju možete povući i predati ponovno.” → dijalog „Povući predaju?” („Povlačenje se bilježi: zapisuju se vrijeme i revizija koju povlačite, a nastavnik u povijesti vidi i predaju i povlačenje. …”) → „Predaja je povučena. Potvrdu povlačenja možete preuzeti.”; „Potvrde povlačenja” s retkom „Revizija n, povučeno {datum}” i „Preuzmi potvrdu”. Kad povlačenje nije moguće: „Povlačenje predaje više nije moguće.” (`student.submission-withdrawal.get` daje `withdrawable` i potpisane potvrde).
6. Nakon povlačenja editor se ponovno otvara za pisanje; novu predaju student radi istim koracima (novi pokušaj, `attempt` u povijesti `student.submission-history.get`; nastavnik vidi i predaju i povlačenje).

### 1.8 Predano, nakon roka i dorada

1. **Predani rad u editoru:** banner „Predano {vrijeme}. Rad je predan, pa se ovdje više ne može pisati.”; mentor i komentari samo za čitanje; izmjene nakon predaje ostaju „samo na ovom uređaju”.
2. **Predaja nakon roka:** dopuštena ako zadatak to ne zabranjuje (poslužitelj odlučuje); student je prije slanja dvaput obaviješten (ploča i dijalog), a potvrda nosi „, nakon roka”. Produljenje roka postavlja nastavnik (dio 5); student vidi samo oznaku „Rok produljen do …”.
3. **Dorada:** nastavnik vraća rad na doradu (`work.return-for-revision.post`, `work.milestones.request-revision.post`, `collaboration.revision-requests.post`); student dobiva obavijest (`notifications.returned-for-revision.list.get`: komentar do 2000 znakova, `revisionDueAt`, `readAt`) i vidi zahtjev uz rad (stanja otvoren, „student navodi da je proveden”, prihvaćen, ponovno otvoren); rok dorade je obavezan (2151). Nova predaja ide istim koracima. Odgovor „Pošalji doradu” u editoru još nije spojen.

---

## 2. Gdje zapinje

Oznake: **G-n** nalaz; uz svaki ekran, element i stanje piše je li provjereno u kodu, preuzeto iz revizije (23. 11.) ili treba preglednik. Prije nego se nalaz popravlja, provjeriti da nije već riješen u novijem PR-u (revizija je od 23. 11.).

### 2.1 Koraci i tok

- **G-1 Ulaz iz editora se gubi na uskim zaslonima.** „Predaja rada” je odsječena na 1050 i 400 px (zaglavlje se vodoravno pomiče), a „Proba predaje” je iza ladice kartice Mentor (≤1050 px: dva dodira). Student s mobitela teško pronalazi ulaz (dio 2: G-23, P-17). Preuzeto iz revizije; provjeriti u pregledniku.
- **G-2 Proba predaje i stvarna predaja se razilaze.** Proba čita lokalnu oznaku izjave i uvijek „Podatak trenutačno nije dostupan.” za tri retka; stvarni koraci čitaju stanje izjave s poslužitelja (`declaration-gate.ts`). Student može vidjeti „Potvrđena.” u probi i „Izjava nije potvrđena” pri predaji (dio 2: G-19, G-24; P-11, P-16). Provjereno u kodu.
- **G-3 Pet koraka, ali „Tekst” nije korak u ploči.** Traka pokazuje „1 Tekst” bez poveznice u istom okviru; povratak je „Natrag na rad”. Poredak (Izjava prije Prije predaje) nije očit onome tko očekuje „pregled pa izjava”. Provjeriti u pregledniku (je li korak 1 klikabilan).
- **G-4 Izjava: AI dio je prazan, ali korak izgleda kao da nešto bilježi.** „Zabilježeno u Ducturi” uvijek piše „U ovom radu nije zabilježen razgovor s AI pomoćnikom.”; student koji je koristio vanjski alat vidi samo vlastita četiri retka. Nigdje ne piše zašto je blok prazan (asistent nije uključen), niti što je „zabilježeno” (`viewOf` daje `recorded: []`, declaration-v1 `ai.recorded maxItems 0`). Provjereno u kodu.
- **G-5 Izjava: mrtve radnje.** „Pitanje nastavnika” i „Odgovor” (R-33), „Dodaj objašnjenje” (R-35), „Obrazac izjave” (R-34), „Pregledaj razgovor” (R-31) i dijalog „Razgovor N” (PD-2) napisani su, ali u hostu nedohvatljivi (`question: null`, `chats: []`, `recorded: []`). Ugovor nema pitanja ni odgovora; plan ne navodi val. Provjereno u kodu i reviziji.
- **G-6 Izjava: „Uredi izjavu” i potvrda žive na stranici, ne u dijalogu.** Odluka 2165 kaže dijalog ch-h; danas je stranica koraka. Student koji potvrdi izjavu pa promijeni tekst dobiva stanje `stale`, no ekran ne objašnjava da se potvrda ponavlja. Provjereno u kodu; tekst za `stale` provjeriti u pregledniku.
- **G-7 Prije predaje: dva retka su samo tekst.** Mjesta za izvor i lijepljenja nemaju popis ni poveznicu na mjesto u tekstu (prototip: dvije poveznice, „Nema otvorenih mjesta za izvor.”, „Oznaka podrijetla dodana uz sva zalijepljena mjesta.”); „Pravila oblika: Provjera oblika još nije pokrenuta.” je dvosmislena (C-19: „nije”). Student ne vidi što bi trebao pogledati. Provjereno u kodu i reviziji.
- **G-8 Prije predaje: s nepotvrđenom izjavom poruka stoji dvaput.** „Još nije potvrđena.” je i u retku i uz „Natrag na izjavu”; „Dalje” je zamijenjen drugim gumbom (prototip uvijek ima „Dalje”). Mali nalaz; zbunjuje čitač zaslona (dva istovjetna odlomka). Provjereno u reviziji.
- **G-9 Napomena uz rad: dodavanje je pucalo.** Revizija (23. 11.) je našla da klijent traži `createdAt` sa 6 decimala, a ugovor daje 3: dodavanje napomene javlja „Nije potvrđeno je li napomena dodana. Osvježite stranicu…”, a popis s ijednom napomenom pada u „Napomene trenutačno nije moguće učitati.”. Jesu li to popravili kasniji PR-ovi, nije provjereno; provjeriti prije nego se zadatak otvara.
- **G-10 Sažetak procesa na koraku 3: greška u VIZ-u, i prazan u pilotu.** Odjeljci „Verzije”, „AI pomoćnik” i „Izjava” (datum potvrde, blok „Izjava studenta”) su „nije dostupan”; PD-1 ima 11 odjeljaka, a student ih u pilotu vidi pet do šest. „Prikaži mjesto u radu” vodi na `/rad/{id}` bez mjesta (i u prototipu). Provjereno u kodu i reviziji.
- **G-11 Predaja: tekstovi „s izjavom” i „razgovori” ne odgovaraju zadatku.** Dijalog uvijek kaže „…spremljen na poslužitelju, s izjavom.” čak i kad zadatak izjavu ne traži; „Razgovori uz izjavu” je „nedostupno” (`dialogConversations` se ne koristi). Student može pomisliti da je priložio nešto što nije. Provjereno u kodu i reviziji.
- **G-12 Predaja: odbijena predaja ostaje u ploči s omogućenim „Predaj rad”.** Prototip pokazuje zasebnu ploču „Predaja” bez gumba; aplikacija zadržava gumb pa student može odmah ponoviti isti zahtjev, a razlog (`segment_unsigned`) traži da prvo ostane u editoru s vezom. Tekst nema gumba „Otvori radni prostor” uz prvi odlomak osim kao poveznica. Provjereno u kodu i reviziji.
- **G-13 Predaja: „nedovršeno” nikad ne objašnjava.** `nextOf(answer)` ne dobiva `known`, pa je tekst uvijek „Predaja nije dovršena. Zamjenski postupak trenutačno nije dostupan.” bez vremena zahtjeva i bez rečenice o nepodudaranju teksta; naslov i dalje glasi „zamjenski postupak”. Student ne zna je li zahtjev zabilježen. Provjereno u kodu i reviziji (osim ako je od tada popravljeno).
- **G-14 Predaja: „nepoznato” i „već zatraženo” izgledaju različito za isto stanje.** Prototip: „…već je zatražena {vrijeme}.” + upozorenje; aplikacija: dvije druge rečenice („Odgovor poslužitelja nije stigao…”, „Potvrda nije stigla. Prije ponovnog pokušaja…”). Student na mobitelu s nestabilnom mrežom najčešće upada baš u to stanje (G-16). Provjereno u kodu.
- **G-15 Predaja: novija lokalna verzija se otkriva tek na koraku 4.** Student je u editoru vidio „Spremljeno na uređaju”, na koraku 4 tek saznaje da poslužitelj ima stariju verziju i mora birati („Pošalji najprije zadnju verziju pa predaj” ili „Predaj potvrđenu verziju V{n}”). Nema upozorenja u probi ni na koraku 3. Provjereno u kodu; tijek provjeriti u pregledniku.
- **G-16 Slaba mreža: „Rad je možda predan.”** Kad odgovor ne stigne, jedini put je „Provjeri stanje predaje” ili ponovno otvaranje stranice. Nema automatskog ponovnog čitanja, nema obavijesti kad se veza vrati, a „Predaj rad” ostaje omogućen. Rizik dvostruke predaje je ublažen poslužiteljem (`already_requested`), ali student to ne zna. Provjereno u kodu.
- **G-17 Potvrda: sažetak procesa je uvijek „nije dostupan”.** Host ne prosljeđuje `summary` ploči (R-40, PD-8): poveznica „Otvori sažetak procesa” otvara praznu ploču bez pomaka do nje (scrollY 0→0). Rečenica „Zapis je neizmijenjen od primitka na poslužitelj.” za predani rad nedohvatljiva. Provjereno u kodu i reviziji.
- **G-18 Potvrda: nedostaju „Dalje” i sažetak o tome što je predano.** Na potvrdi nema popisa „Što je predano” (verzija, riječi, izjava, napomene); nema „Razgovori uz izjavu” ni broja riječi (korak 4 ga ima, korak 5 ne). Student koji želi sačuvati dokaz mora ručno prepisati ili preuzeti PDF/paket. Provjereno u kodu.
- **G-19 Potvrda: tri različita preuzimanja.** „Preuzmi zapis (PDF s QR kodom)”, kartica „Prenosivi zapis” (ZIP) i „Paket”/„za referadu” (jednokratna poveznica) nude se jedno uz drugo bez objašnjenja što je koje i tko ih traži. Student ne zna što poslati mentoru, a što referadi. Provjereno u kodu; izgled u pregledniku.
- **G-20 Povlačenje: razlog zašto nije moguće ne razlikuje se.** „Povlačenje predaje više nije moguće.” stoji i kad je rok istekao, kad je nastavnik isključio povlačenje (P-D3) i kad je predaja već povučena; ugovor `student.submission-withdrawal.get` daje samo `withdrawable` (boolean). Provjereno u kodu i ugovoru.
- **G-21 Povlačenje je samo na potvrdi.** Student koji u zaključanom editoru vidi „Rad je predan, pa se ovdje više ne može pisati.” ne dobiva poveznicu na povlačenje; banner nosi vrijeme, ali ne i radnju (prototipski „Vrati u uređivanje” zamijenjen je povlačenjem na koraku 5, B56). Provjereno u kodu.
- **G-22 Povlačenje: nakon dijaloga nema jasnog sljedećeg koraka.** Poruka „Predaja je povučena. Potvrdu povlačenja možete preuzeti.” ne kaže da se rad ponovno može mijenjati niti koliko roka je ostalo, a ne nudi „Otvori radni prostor”. Neprovjereno u pregledniku.
- **G-23 Ponovna predaja: pokušaji i verzije nisu vidljivi studentu.** `student.submission-history.get` (događaji `submission` s `attempt`, `afterDeadline`, `receipt`; događaji povlačenja) postoji, ali ga student nigdje ne vidi (poziva ga samo nastavnička povijest). Nakon dvije predaje student ne vidi koja je trenutno važeća ni što je povučeno. Provjereno u kodu.
- **G-24 Dorada: zahtjev nije jedna cjelina.** Student vidi obavijest „Rad je kod Vas: dorada”, retke u kartici „Pregled”, zahtjeve u kartici Komentari i „Dnevnik dorade” (RevisionLog); rok dorade je u rezultatu obavijesti, ali ne uz gumb „Predaja rada”. „Pošalji doradu” je „nedostupno” (`send: null`), pa student koji je doradio mora ići kroz punu predaju bez ikakve poveznice da je to dorada. Provjereno u kodu i reviziji (B44, B45).
- **G-25 Predaja nakon roka: potvrda je zasebna, ali upozorenje je samo tekst.** Student na koraku 4 dobiva dva teksta o kašnjenju; ne dobiva izbor „odustani” s razlogom osim „Natrag”, niti zna posljedicu (ovisi o pravilu fakulteta, ne vidi se). Zatvoreni produljeni rok kod `submitStageOf` je samo u kodu. Provjereno u kodu; posljedice (ocjena, sankcije) ne smiju se pisati (PRODUCT §5).
- **G-26 Pitanje nastavnika i izjava predana s radom.** Nakon predaje „Izjava je predana s radom i više se ne mijenja.”; nema načina da student doda ispravak izjave (npr. zaboravljen alat) osim povlačenja i ponovne predaje, što je dostupno samo dok rok traje. Provjereno u kodu i zahtjevu; treba odluku (PR-14).

### 2.2 Stanja

- **Učitavanje:** svaki korak ima „Učitavam stanje rada s poslužitelja.” (`role=status`); na koraku 5 put u traci je prazan („· Potvrda”) dok se zadatak čita (revizija). Nema vremenskog ograničenja ni poruke „još uvijek učitavam”. Provjeriti usporenom mrežom.
- **Prazno:** rad nije započet (ploča s „Otvori radni prostor”); bez teksta na poslužitelju (korak 4: „Na poslužitelju još nema teksta ovog rada.”); potvrde nema („Ovaj rad još nije predan, pa potvrde nema.”).
- **Greška:** koraci 3 do 5 imaju „Pokušaj ponovno”; tekst na koraku 4 nema rečenicu „Tekst rada nije zahvaćen. Prije nove predaje pokušajte ponovno:” (prototip).
- **Bez mreže:** koraci 3 i 4 `aria-disabled` s razlogom; korak 2 dopušta uređivanje izjave, a potvrda se ne piše bez mreže (poruka nije provjerena). Povratak mreže se ne najavljuje (dio 2, G-10).
- **Dvostruki klik:** slanje je `oneAtATime`; „Povuci predaju” ima `withdrawing` stanje; „Dodaj napomenu” nije provjereno.
- **Predano:** korak 4 preusmjerava na potvrdu, koraci 2 i 3 prikazuju ploču „Predaja ovog rada već je zatražena…”; izjava se ne uređuje.
- **Nakon isteka sesije usred slanja:** 401 vodi na prijavu s povratkom na korak; je li zahtjev poslan ili ne, ne zna se (isto kao G-16).

### 2.3 Pristupačnost (iz koda i revizije; čitačem provjeriti)

- Dobro: `ol` „Koraci predaje” s `aria-current=step`; `aria-disabled` + `aria-describedby` umjesto skrivenih gumba (fokusabilni, razlog se čita); modalni dijalog `<dialog>` s fokusom na „Predaj rad” i povratkom fokusa; tijekom slanja `role=status`; obavijest „Otisak je u međuspremniku…” je `role=status`; `aria-invalid` u obrascu napomene.
- Pitanja: (1) PD-3 nema atribut `aria-modal` (nativni dijalog ima implicitnu modalnost; revizija ga bilježi kao odstupanje); (2) „Dalje” zamijenjen drugim gumbom (G-8) i dvostruki odlomak; (3) obavijest o odbijenoj predaji dobiva fokus na prvi redak, ali nema `role=alert`; neprovjereno; (4) otisak u skupinama po 4 čita se kao 16 riječi, nema „kopiraj” alternative za čitač osim gumba; (5) ploča sažetka na potvrdi se otvara bez pomaka i bez najave (G-17); (6) axe spec za korake predaje ne postoji (dio 2, P-21); (7) boja i kontrast u oznakama „Bez veze”, „opaženo”, „izjavljeno” nisu zasebno mjereni.

### 2.4 Mobitel (granice 640/760/1050/1250 px; provjeriti u pregledniku)

- Ulaz: „Predaja rada” odsječena (G-1); proba predaje iza ladice.
- Ispod 1050 px koraci su jedan stupac; sažetak procesa (desni stupac) pada ispod popisa provjera, pa je „Dalje” daleko od vrha; 64-znamenkasti otisak u 16 skupina može se lomiti u više redaka.
- Ciljevi dodira: „Natrag na rad”, poveznice u traci i gumbi dijaloga nisu zasebno mjereni na 44 px.
- Dijalog „Predati rad?” na 400 px: dva gumba jedan uz drugi ili ispod; provjeriti da „Predaj rad” ne završi izvan zaslona.
- Kopiranje otiska, QR „samo uzorak”, preuzimanje PDF-a/ZIP-a (preglednik na mobitelu često nudi samo „Otvori”).
- Slaba mreža na mobitelu najčešći je put do „Rad je možda predan.” (G-16).

### 2.5 Greške i oporavak

- Odbijena predaja (`segment_unsigned` i srodne): oporavak je „vrati se u editor s vezom pa pokušaj ponovno”; ne postoji gumb „Pošalji zadnju verziju” osim u slučaju INT-16 (G-12, G-15).
- Nedovršena predaja (`record_mismatch`): oporavak je izvan aplikacije (nastavnik, zamjenski postupak); student ne dobiva nikakav dokaz o zahtjevu osim teksta (G-13).
- Nepoznat ishod: „Provjeri stanje predaje”, ponovno otvaranje stranice; ni jedno ne nudi „javi problem” (`support.problem-report` postoji, `ProblemReportHelp` u ljusci, ali nije u koracima predaje).
- Neuspjelo potpisivanje potvrde: stanje „Predaja u obradi” s poveznicom „Provjeri stanje predaje”; ne kaže koliko dugo je normalno čekati.
- Izjava: greška učitavanja blokira potvrdu; ne kaže da tekst rada nije zahvaćen.
- Javna provjera potvrde (`/provjera`): ishod „Predani tekst nije mijenjan od predaje.” ili neuspjeh; nema upute što učiniti ako provjera ne uspije (neprovjereno).
- Povlačenje: greška ima „Pokušaj ponovno”; „Nije poznato je li povlačenje zabilježeno. Osvježite stanje prije novog pokušaja.” ispravno ne obećava ništa.

---

## 3. Što nude slični alati i što traže pilot, privatnost i pravila o AI izjavi

### 3.1 Slični alati (opisno, iz općeg poznavanja, bez kopiranja izgleda)

- **Sustavi za predaju zadataka u sustavima za e-učenje (tipa Moodle/Merlin, Google Classroom, Canvas):** dvostupanjski tok (nacrt, pa „Predaj”), jasan status („Predano”, „Predano nakon roka”, „Vraćeno”), potvrda e-poštom ili na ekranu, mogućnost „Poništi predaju” dok nastavnik ne ocijeni, potvrda s vremenom. Mana koja se često spominje: status se vidi tek na popisu zadataka, a ne uz sam rad; „kasno” se zna tek nakon predaje.
- **Alati za provjeru podudaranja i izvornosti (tipa Turnitin):** potvrda s identifikatorom, ponekad „predaj nacrt i dobij izvješće”. Problem koji ovdje izbjegavamo: neprozirna procjena; Ductura bilježi događaje i podudaranje teksta, ne procjenjuje autorstvo (PRODUCT §5, Ustav v1.6 C-6: uvijek „nije dokaz autorstva”, ne blokira, ne rangira, student vidi isto).
- **Uređivači u oblaku (tipa Google Dokumenti):** nema „predaje”; podijeli se poveznica, a povijest verzija je dokaz. Student očekuje da je predaja što bliže jednom kliku, no uz sigurnost („jesam li zaista poslao”).
- **Repozitoriji završnih radova i referade (tipa institucijski repozitorij, e-pošta):** konačna verzija uz izjavu o izvornosti kao zaseban obrazac, često na papiru, s potpisom. Student očekuje „obrazac koji ispiše i odnese”: ovdje ga zamjenjuju PDF s QR kodom i paket za referadu.
- **Blockchain i vremenski žigovi (tipa kvalificirani vremenski žig):** nepromjenjiv dokaz postojanja teksta u trenutku. Ductura nudi isto s potpisanom potvrdom, otiskom SHA-256 i javnom provjerom bez prijave; ne treba ništa preuzimati od tih alata.

Zajedničko što studenti očekuju: (1) jasna posljedica klika („što će se dogoditi, mogu li natrag”); (2) potvrda koja se može sačuvati i pokazati; (3) status vidljiv uz rad, ne samo na popisu; (4) lagan put do ispravka dok rok traje; (5) da je kašnjenje izričito označeno, bez iznenađenja; (6) da je izjava o pomoći kratka i pošteno prazna kad pomoći nije bilo.

### 3.2 Što traže pilot, privatnost i pravila o AI izjavi za ovaj dio

- **Pilot:** prijava samo AAI@EduHr (D-09, D-16); rok funkcija 15. 1. 2027.; sve novo najprije u prototip i INVENTAR-student; pilot je s izmišljenim podacima do pravnog mišljenja i DPIA. Komponente iz `@ductura/ui` bez lokalnog stila; vizualni prolaz je centralan (Daniel 22. 11.), pa prijedlozi ne traže izgled.
- **Privatnost:** potvrda nosi `principalId`, `evidenceDomainId`, otisak i potpis; paket za referadu i prenosivi zapis sadrže tekst rada, pa poveznice moraju biti jednokratne i kratkotrajne (već jesu: `student.submission-package-link.post`); nijedan novi prijedlog ne smije u poruke, obavijesti ni javnu provjeru staviti sadržaj rada ili imena. Napomena uz rad (PD-4) je izjavljeni sadržaj (do 600 znakova) i vidi je nastavnik; student mora znati tko je vidi. Nema novog bilježenja procesa u ovom dijelu; sadržaj tipki smije se bilježiti samo u polju editora (Ustav v1.9) i ne ulazi u predaju ni izvoz.
- **Obećanja (B-6):** „Predano” se tvrdi samo uz potpisanu potvrdu; „možda predano” kad odgovor nije stigao; „povučeno” samo uz potpisanu potvrdu povlačenja. Svaki novi tekst o ishodu to mora poštovati.
- **AI izjava (declaration-v1, #499):** verzionirani obrazac fakulteta (OD-11: samo test-izjava dok fakultet ne objavi svoj), `humanHelp {kind,text}` zatvoren skup (OD-12), granice kao imenovane konstante (OD-4); izjava je dijalog ch-h (2165); „izvornost” smije stajati samo kao doslovni naziv službenog obrasca (B-5); izjava se veže uz verziju teksta (stanje `bound`), pa tekst promijenjen nakon potvrde daje `stale`. Predaja se odbija bez potvrđene izjave samo ako zadatak izjavu traži (`declarationRequired`). Izjava ne tvrdi autorstvo ni nastanak rada. OC-1 isključen, Q-10 odgođen: **ne bira se pružatelj ni model**, a razgovori i prilozi (PD-2, R-31) ostaju bez pozivatelja.
- **Podudaranje s pomoćnikom i postotci:** podudaranje je u pilotu uključeno (22. 11.), uvijek uz napomenu „nije dokaz autorstva”, ne blokira predaju, ne ulazi u ocjenu ni izvoz. Postotak sličnosti s izvorima i udio iz događaja (C-6) ne grade se bez zadatka orkestratora; ovaj dokument ih ne predlaže. Oznaka „za pregled” nikad ne blokira predaju.
- **Predaja nakon roka i povlačenje:** pravila (kašnjenje, produljenje, povlačenje samo dok rok traje, nastavnik smije isključiti povlačenje, zadano uključeno) su odluke vlasnika i fakulteta; student ih vidi, ne mijenja. Tekst nikad ne govori o posljedicama (ocjena, kazna): to je fakultetsko pravilo.
- **Zabranjeni izrazi:** svaki novi tekst kroz skener (PRODUCT §5). Posebno oprez: „izvornost” (samo kao naziv obrasca), „plagijat”, „dokaz autorstva” (samo u negaciji), „provjera AI-ja”, „kazna”; tekstovi o roku opisuju zadatak, ne studenta.

---

## 4. Numerirani prijedlozi

Veličina: S (do ~150 redaka koda), M (150–400), L (više od 400 ili više PR-ova). „Server” = treba li novo polje ili ruta; „ne, postoji” znači da je operacija u izvatku ugovora. „Prototip” = dodiruje li prototip (`Ductura_student.html`, INVENTAR-student) i što bi se najprije izmijenilo. Prijedlozi iz dijela 2 (P-11, P-12, P-16, P-17, P-18, P-22) se ne ponavljaju; ovdje su samo označeni kao preduvjeti.

**PR-1 Ulaz u predaju vidljiv na svim širinama i iz banera.**
- Opis: nadovezuje se na P-17: uz „Predaja rada” uvijek stoji broj blokada iz probe; na uskim zaslonima ulaz je u donjoj traci ili skupljenom izborniku. Banner „Predano {vrijeme}…” u editoru dobiva radnje „Otvori potvrdu o predaji” i, dok je povlačenje moguće, „Povuci predaju” (isti `student.submission-withdrawal.get`).
- Korist: G-1, G-21; student u svakom trenutku zna gdje je predaja i što je s njom.
- Veličina: S do M. Rizik: nizak do srednji (zaglavlje je dio VIZ-S1, ide zajednički). Server: ne, postoji. Prototip: da (INVENTAR §E-7: „Predaja rada”; dodati banner s radnjama).

**PR-2 Proba predaje i koraci čitaju isti izvor istine.**
- Opis: redak „Izjava” u probi čita `student.declaration.get` (isti `declaration-gate.ts`) i pokazuje stanja none/draft/confirmed/stale/bound riječima; uz proboj i korake jedan tekst „Što još fali” iz istih provjera. Nadovezuje se na P-11 i P-16; ovdje samo ujednačavanje s korakom 3.
- Korist: G-2; „Potvrđena.” više ne proturječi odbijenici. Veličina: S do M. Rizik: srednji (izjava je pravno osjetljiva; tekstovi kroz pravni pregled). Server: ne, postoji. Prototip: da (E-8 retci 1 do 5).

**PR-3 Korak 3 „Prije predaje”: stvarni popis umjesto statičnog teksta.**
- Opis: retci „Mjesta za izvor” i „Zalijepljeno” prikazuju popis s poveznicom na mjesto u radu (ili „Nema otvorenih mjesta za izvor.” / „Oznaka podrijetla dodana uz sva zalijepljena mjesta.”); „Pravila oblika” kaže „Provjera oblika nije dostupna u pilotu.” umjesto dvosmislenog „Nije” (C-19); s nepotvrđenom izjavom jedna poruka, a „Dalje” ostaje kao onemogućen gumb s razlogom. Mjesta i lijepljenja ne blokiraju (PRODUCT §5).
- Korist: G-7, G-8; student zna što pogledati prije slanja. Veličina: M. Rizik: nizak (čitanje postojećih podataka; „Prikaži mjesto u radu” traži sidro u editoru). Server: ne, postoji (podaci u sažetku procesa). Prototip: da (E-8 retci 3 i 4, R-36).

**PR-4 Izjava: pošteno prazno stanje i objašnjenje.**
- Opis: u bloku „Zabilježeno u Ducturi” rečenica „U pilotu pomoćnik nije uključen; ovdje se bilježi samo ono što napravi sama Ductura. Alate izvan Ducture navedite u „Vašoj izjavi”.”; „Prilozi” bez razgovora skrivaju se ili objašnjavaju; izbacuju se mrtvi elementi (pitanje nastavnika, „Dodaj objašnjenje”) dok ih ugovor ne podrži. Svi tekstovi bez imena modela i pružatelja.
- Korist: G-4, G-5; korak ne obećava ono što ne postoji. Veličina: S. Rizik: nizak (tekst; pravni pregled). Server: ne. Prototip: da (E-9 puno, `prazno`).

**PR-5 Izjava kao dijalog iz koraka predaje i uvjet „stale”.**
- Opis: nadovezuje se na P-12: dijalog ch-h otvara se i s koraka 2, 3 i 4 („Otvori izjavu”) i zatvara povratom na isti korak; kad je izjava `stale` (tekst se promijenio nakon potvrde), korak 3 i 4 kažu to jednom rečenicom i nude „Potvrdi izjavu ponovno”.
- Korist: G-6; student ne gubi mjesto u toku. Veličina: M. Rizik: srednji (isti kao P-12). Server: ne, postoji (`student.declaration.get|put`). Prototip: da (odluka 2165).

**PR-6 Napomena uz rad: provjera i pouzdano dodavanje.**
- Opis: potvrditi da `student.submission-notes.get|post` radi s ugovornim oblikom `createdAt` (3 decimale); ako nije, popraviti klijentsku shemu (usko, samo oblik vremena); toast „Napomena je dodana.” tek uz odgovor poslužitelja; ispod obrasca napomena „Vidi je nastavnik uz sažetak.”.
- Korist: G-9; funkcija koja je u revizijama padala postaje pouzdana. Veličina: S. Rizik: nizak (klijentska shema). Server: ne, postoji. Prototip: ne (već u PD-4).

**PR-7 Dijalog „Predati rad?”: istiniti sažetak i dva stupnja kašnjenja.**
- Opis: tekst dijaloga gradi se iz stvarnih podataka: „s izjavom” samo ako je zadatak traži i ako je potvrđena; „s n priloženih razgovora” samo ako ih ima; „Riječi: n.”; kod kašnjenja izričita druga potvrda „Razumijem da će predaja biti označena kao predaja nakon roka” (potvrdni okvir), ne nova kazna. Bez posljedica u tekstu.
- Korist: G-11, G-25; student ne potvrđuje ono što nije točno. Veličina: S. Rizik: nizak (tekst i jedan okvir). Server: ne, postoji (`declarationRequired`). Prototip: da (PD-3).

**PR-8 Odbijena i nedovršena predaja: zasebna ploča s ispravnim radnjama.**
- Opis: ishodi `segment_unsigned`, `record_discontinuous`, `no_evidence` i `record_mismatch` prikazuju se u zasebnoj ploči „Predaja” (kao prototip) umjesto u ploči „Predati rad?”; uz `segment_unsigned` gumbi „Otvori radni prostor” i „Pokušaj ponovno” (onemogućen dok stanje u editoru nije „Spremljeno na poslužitelju”); za `record_mismatch` vrijeme zahtjeva (kad poslužitelj navede) i rečenica o nepodudaranju teksta, naslov „Predaja nije dovršena”, zamjenski postupak samo ako ga poslužitelj imenuje (2156).
- Korist: G-12, G-13; student ne ponavlja isti zahtjev. Veličina: M. Rizik: srednji (kritični put predaje; ide uz plan napada). Server: ne, postoji (odgovor 409 nosi razlog; vrijeme zahtjeva i zamjenski postupak provjeriti u ugovoru `submission.submit-second.post`). Prototip: da (E-10 `odbijeno`, `nedovrseno`).

**PR-9 Slaba mreža: ponovno čitanje stanja i jedna istinita poruka.**
- Opis: stanje „nepoznato” prikazuje prototipsku rečenicu („Predaja ovog rada već je zatražena {vrijeme}.” kad je vrijeme poznato, inače „Rad je možda predan.”); automatski jedno ponovno čitanje `student.submission.get` pri povratku veze i nakon 10 s; „Predaj rad” ostaje onemogućen dok se stanje ne pročita; „Javi problem” (`support.problem-report`, bez sadržaja rada) kad ni nakon trećeg pokušaja nema odgovora.
- Korist: G-14, G-16; najčešći strah („jesam li predao?”) se rješava bez klikova. Veličina: M. Rizik: srednji (dira obećanja B-6; test svih kombinacija). Server: ne, postoji. Prototip: da (E-10 `nepoznato`, R-38).

**PR-10 Prije slanja: upozorenje o novijoj verziji na uređaju već u probi i na koraku 3.**
- Opis: ako lokalni dnevnik ima novu verziju koju poslužitelj nije potvrdio, proba i korak 3 pokazuju „Na uređaju je novija verzija” s istim izborom kao na koraku 4 (`newer-local.ts`), tako da se odluka donosi prije dijaloga.
- Korist: G-15. Veličina: S do M. Rizik: nizak. Server: ne. Prototip: da (nova stavka; dodati u E-8).

**PR-11 Potvrda: sadržaj „što je predano” i sažetak procesa koji radi.**
- Opis: na koraku 5 kratki popis „Predano: verzija n, riječi, izjava (potvrđena {datum}), napomene (n)”; prosljeđivanje `summary` ploči da „Otvori sažetak procesa” prikaže PD-1 za predani rad uz pomak do ploče i rečenicu „Zapis je neizmijenjen od primitka na poslužitelj.” (R-40, PD-8).
- Korist: G-10, G-17, G-18; potvrda sama govori što je dokazala. Veličina: M. Rizik: nizak do srednji (čitanje; PD-1 odjeljci bez postotaka). Server: ne, postoji (`evidence.open` process-summary, `student.submission.get`). Prototip: da (E-11 puno, PD-8).

**PR-12 Potvrda: jedan izbornik „Sačuvaj potvrdu” s objašnjenjem.**
- Opis: tri postojeća preuzimanja (PDF s QR kodom, prenosivi zapis ZIP, paket/za referadu) grupirana u jedan odjeljak „Sačuvaj potvrdu” s po jednom rečenicom „Za koga je” (npr. „Za mentora/osobnu pohranu”, „Za referadu: poveznica vrijedi kratko i jednom”) i oznakom veličine; greške preuzimanja jednoobrazne (`Zapis trenutačno nije moguće preuzeti. Pokušajte ponovno.`).
- Korist: G-19. Veličina: S do M. Rizik: nizak. Server: ne, postoji. Prototip: da (R-42 i „Prenosivi zapis”; dodati u E-11).

**PR-13 Povlačenje: razlog, sljedeći korak i vrijeme do roka.**
- Opis: `withdrawable=false` prikazuje razlog koji klijent zna (rok istekao: iz `dueAt` i `extendedDueAt`; inače općenito „Nastavnik ili fakultet ne dopušta povlačenje za ovaj zadatak”, ne nagađa); nakon povlačenja poruka „Predaja je povučena. Rad možete ponovno mijenjati do {rok}. Zatim ga predajte iznova.” + „Otvori radni prostor” (isti tekst bez posljedica); uz „Povuci predaju” stoji „Rok: {datum u sat}”.
- Korist: G-20, G-22; student zna zašto i što dalje. Veličina: S do M. Rizik: nizak (razlog bez novog polja; ako treba razlikovati „nastavnik isključio”, vidi PR-14 i pitanje 2). Server: ne za osnovu; **provjeriti** vraća li poslužitelj razlog nemogućnosti povlačenja (ugovor daje samo boolean; ne izmišljam polje). Prototip: da (P-D3).

**PR-14 Ispravak izjave nakon predaje i izjava uz doradu.**
- Opis: odluka za Daniela. Opcije: (a) ispravak samo kroz povlačenje i ponovnu predaju (danas); (b) uz predani rad student smije dodati „Napomenu uz izjavu” (iz PD-4) vidljivu nastavniku uz sažetak, bez izmjene potvrđene izjave; (c) izjava se pri dorađenoj predaji automatski otvara za pregled (jer `stale`).
- Korist: G-26; student ne ostaje s pogrešnom izjavom. Veličina: S (b) do M (c). Rizik: srednji (pravna osjetljivost). Server: ne za (a); (b) koristi `student.submission-notes.post`; (c) koristi `student.declaration.*`. Prototip: da (E-9 „Rad predan”, PD-4).

**PR-15 Povijest pokušaja za studenta.**
- Opis: na koraku 5 popis „Moje predaje” iz `student.submission-history.get`: za svaki pokušaj „Predaja n · datum · nakon roka (ako jest)”, „Povučena {datum}”, trenutno važeća označena; svaki redak vodi na potvrdu ili potvrdu povlačenja. Samo čitanje.
- Korist: G-23; student koji je povlačio i ponavljao ne gubi pregled. Veličina: M. Rizik: nizak (isti podaci koje nastavnik vidi). Server: ne, postoji. Prototip: da (nova stavka).

**PR-16 Dorada kao jedna cjelina uz „Predaja rada”.**
- Opis: kad je rad vraćen na doradu, uz „Predaja rada” oznaka „Dorada do {rok}” i komentar nastavnika (skraćen) iz `notifications.returned-for-revision.list.get`; „Predaja rada” se zove „Predaj doradu” i vodi u iste korake; „Pošalji doradu” (`send: null`) ostaje „nedostupno” dok ne postoji ugovor; obavijest se označava pročitanom kad je student otvori. Rok dorade je obavezan (2151).
- Korist: G-24; student vidi što se traži i do kada na jednom mjestu. Veličina: M. Rizik: srednji (dira banner i zaglavlje, VIZ-S1). Server: ne za prikaz; **ne izmišljam** operaciju slanja dorade (pitanje 3). Prototip: da (B44, B45, nastavnički „Zatraži doradu”).

**PR-17 Predaja nakon roka: pregledna rečenica, bez posljedica.**
- Opis: na koraku 3 (a ne tek na 4) traka „Rok je prošao {datum}. Predaja je moguća i bit će označena kao predaja nakon roka.” kad poslužitelj to dopušta; kad ne dopušta (`not_open`), „Predaja za ovaj zadatak više nije otvorena. Obratite se nastavniku kolegija.” bez tona kazne. Zatvoreni produljeni rok dobiva isti obrazac.
- Korist: G-25. Veličina: S. Rizik: nizak (tekst). Server: ne, postoji (`dueAt`, `extendedDueAt`, `not_open`). Prototip: da (E-10 `nakonroka`).

**PR-18 Pristupačnost koraka predaje (axe, `aria-modal`, najave).**
- Opis: axe spec za korake 2 do 5 i dijalog PD-3; `aria-modal` na dijalogu; `role=alert` za odbijenu predaju; ploča sažetka dobiva fokus i najavu pri otvaranju; otisak ima `aria-label` s cijelim nizom (bez „16 riječi”); ciljevi dodira 44 px na ≤640 px.
- Korist: 2.3 i 2.4; obvezno prije pilota (dio 2: P-21). Veličina: M. Rizik: nizak do srednji. Server: ne. Prototip: ne. Ide u centralni prolaz pristupačnosti.

**PR-19 VIZ „puno” prolazi cijelu predaju.**
- Opis: lažni poslužitelj daje vektore koje klijent zaista čita (`evidence.open` s dnevnikom i sesijom, potpisanu potvrdu, 409 ishode, povlačenje i povijest), da se E-8 do E-11 mogu proći klikom i snimiti; oporavlja se i sažetak procesa. Nadovezuje se na P-22.
- Korist: bez ovoga se prijedlozi PR-1 do PR-17 ne mogu provjeriti na ekranu; revizija je već jednom dala pogrešnu sliku. Veličina: S do M. Rizik: nizak (test-fakes). Server: ne. Prototip: ne.

**PR-20 Pitanje nastavnika i odgovor uz izjavu (R-33).**
- Opis: odgođeno. Ugovor nema pitanja ni odgovora; plan ne navodi val. Ostaje zabilježeno da ga student u pilotu neće vidjeti, a prototipski element se skriva (PR-4).
- Veličina: M do L. Rizik: srednji (novi sadržaj u izjavi, pravno). Server: **da** (novo polje u declaration-v1; ne izmišljam, treba odluku i ugovor). Prototip: da (E-9).

**PR-21 Razgovori uz izjavu i dijalog „Razgovor N” (PD-2).**
- Opis: odgođeno po planu (val 12, D-194/Q-10); ovdje samo zapisano da ostaje bez pozivatelja i da se ne gradi dok Daniel ne odluči o pomoćniku.
- Veličina: L. Rizik: visok. Server: da (prilozi, `student.declaration-attachments.post` postoji, ali `attachments maxItems 0`). Prototip: da.

---

## 5. Tablica za Danielovu odluku

Preporuka je moja; odluka je vaša. „Pilot” = ulazi u funkcije pilota 15. 1. 2027. (najprije u prototip i INVENTAR-student). Redoslijed unutar „pilot” je po koristi za studenta i riziku od krivog ishoda predaje.

| # | Prijedlog | Veličina | Server | Moja preporuka | Razlog | Vaša odluka |
|---|-----------|----------|--------|----------------|--------|-------------|
| PR-19 | VIZ „puno” prolazi cijelu predaju | S do M | ne | **za pilot** | Bez njega se ništa od ostalog ne može provjeriti klikom | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-8 | Odbijena i nedovršena predaja: zasebna ploča i radnje | M | ne (provjeriti 409 polja) | **za pilot** | Kritični put; student ne smije ponavljati isti zahtjev | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-9 | Slaba mreža: ponovno čitanje i jedna poruka | M | ne | **za pilot** | „Jesam li predao?” je najveći strah | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-2 | Proba i koraci isti izvor izjave | S do M | ne | **za pilot** | Proba ne smije proturječiti predaji | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-7 | Dijalog „Predati rad?”: istinit sažetak | S | ne | **za pilot** | Student ne potvrđuje ono što nije točno | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-4 | Izjava: pošteno prazno stanje, bez mrtvih elemenata | S | ne | **za pilot** | Asistent isključen; korak mora to reći | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-1 | Ulaz u predaju na svim širinama, banner s radnjama | S do M | ne | **za pilot** (s VIZ-S1) | Ulaz i povlačenje ne smiju nestati | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-6 | Napomena uz rad pouzdano | S | ne | **za pilot** | Funkcija je pucala; jeftino | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-11 | Potvrda: što je predano, sažetak procesa koji radi | M | ne | **za pilot** | Potvrda je dokaz; mora govoriti | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-13 | Povlačenje: razlog i sljedeći korak | S do M | provjeriti razlog | **za pilot** | P-D3 je u pilotu; mora biti razumljivo | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-3 | Korak 3: stvarni popis umjesto teksta | M | ne | **za pilot** | Sada samo obavještava; uz poveznice postaje koristan | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-17 | Predaja nakon roka: ranije i smireno | S | ne | **za pilot** | Student ne smije biti iznenađen | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-10 | Novija verzija na uređaju: ranije upozorenje | S do M | ne | **za pilot** | Odluka prije dijaloga | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-12 | „Sačuvaj potvrdu”: tri preuzimanja objašnjena | S do M | ne | **za pilot** | Student ne zna što poslati kome | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-18 | Pristupačnost koraka predaje | M | ne | **za pilot** (centralni prolaz) | Obvezno prije pilota | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-16 | Dorada kao cjelina uz „Predaja rada” | M | ne za prikaz; slanje dorade nepostojeće | **za pilot** (prikaz) | Student mora vidjeti što i do kada | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-15 | Povijest pokušaja za studenta | M | ne | nakon pilota | Korisno uz ponovne predaje; nije hitno | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-5 | Izjava kao dijalog iz koraka (uz P-12) | M | ne | nakon pilota | Stranica radi; odluka 2165 ide s P-12 | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-14 | Ispravak izjave nakon predaje | S do M | ne | odluka vlasnika (pravno) | Pravno osjetljivo; za pilot dovoljno povlačenje | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-20 | Pitanje nastavnika uz izjavu | M do L | da | nakon pilota | Nema ugovora; plan ne navodi val | ☐ pilot ☐ nakon pilota ☐ ne |
| PR-21 | Razgovori uz izjavu, dijalog „Razgovor N” | L | da | nakon pilota (Q-10) | Čeka odluku o pomoćniku | ☐ pilot ☐ nakon pilota ☐ ne |

Pitanja na koja ne mogu odgovoriti sama (iz ovog repoa se ne vidi):
1. Je li plan `NOVE-FUNKCIJE.md` (dio 3) predviđao temu koje ovdje nema? Plan nije bio dostupan (oblak nema pristup `ductura/.github`).
2. Vraća li poslužitelj razlog zbog kojeg povlačenje nije moguće (rok, nastavnik isključio, već povučeno)? Ugovor daje samo `withdrawable` (PR-13).
3. Postoji li ili se planira operacija „pošalji doradu” (student → mentor)? Danas je port `send: null` (PR-16).
4. Je li popravljen oblik `createdAt` kod napomena (PR-6)? Revizija od 23. 11. bilježi pad; kasniji PR-ovi nisu provjereni.
5. Smije li predaja nakon roka biti ograničena zadatkom (`not_open`) i kako se to nastavniku prikazuje (dio 5)?
6. Treba li student u pilotu vidjeti paket za referadu i prenosivi zapis (PR-12) ili samo PDF s QR kodom?
7. Potvrđuje li se da izjava ostaje stranica koraka u pilotu, a dijalog ch-h ide s P-12 nakon pilota (PR-5)?
8. Treba li za pilot pitanje nastavnika uz izjavu (R-33, PR-20) ili se prototipski element skriva?

Otvoreno za provjeru u pregledniku (nije moguće iz ovog pregleda): mobitel (2.4), najave čitača zaslona (2.3), izgled odbijene i nedovršene predaje, ponašanje pri sporoj mreži, preuzimanje PDF-a/ZIP-a na mobitelu, javna provjera potvrde, tekst stanja `stale` izjave, jesu li G-9 i G-17 popravljeni nakon revizije od 23. 11.
