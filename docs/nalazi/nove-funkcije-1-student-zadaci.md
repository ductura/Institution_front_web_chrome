# Nove funkcije, dio 1: Student (zadaci, obavijest o zadatku, upis u kolegij, moji radovi, prijava)

Zadatak NF-1 `nove-funkcije-student-zadaci`. Plan: `ductura/.github`, `docs/plan/NOVE-FUNKCIJE.md` (grana `plan/nove-funkcije`), Danielova odluka 23. 11. 2026. („Može da”). Ovaj dokument je samo pregled; kod se ne mijenja.

## 0. Izvori, način pregleda i ograničenja

Pročitano:
- prototip `docs/prototip/Ductura_student.html` i `INVENTAR-student.md` (ekrani E-0 do E-6, podaci PO-1 do PO-8, nejasna pitanja N-1 do N-14);
- Danielovi odgovori `docs/prototip/ODGOVORI-DANIEL-2026-11-19.md` (A-1 početna je „Moji zadaci”; A-2 kod 8 do 32 znaka, server; A-3 proširiti podatke zadatka; A-5 račun bez uloge je stanje, koordinator je administrator fakulteta; A-6 odjava; A-10 ekrani izvan prototipa se zadržavaju; C-5 napomene studenta da);
- aplikacija u `packages/app/src/host/student/` (`home/`, `courses/`, `enrol/`, `notice/`, `start-work/`, `toast/`), `host/signin/`, `host/shell/notifications/` i `src/client/notifications.ts`;
- ugovori u izvatku `src/client/migration-contracts.generated.json` (operacije `student.*`, `institution.enrollments.post`, `notifications.*`, `profile.me.get`).

Što nije učinjeno, izričito:
- aplikacija **nije pokrenuta** s lažnim poslužiteljem (scenarij VIZ „puno”) u ovoj sesiji; ponašanje je zaključeno iz izvornog koda stranica, modela i njihovih testova. Gdje stavka ovisi o stvarnom prikazu (razmaci, preklapanje, veličina ciljeva na dodir), označena je „provjeriti u pregledniku”;
- `docs/nalazi/paritet-student.md` **ne postoji** na grani `migracija/kopija-ductus-front` (postoji samo `paritet-nastavnik-2.md`), pa paritet studenta nije mogao biti izravno uspoređen s revizijom; usporedba je prema INVENTAR-u (§5.2 i §6) i izvornom kodu. Orkestrator treba reći je li revizija u drugoj grani;
- opisi sličnih alata u dijelu 3 su iz općeg poznavanja takvih sustava, ne iz uživo provjere njihovih trenutačnih verzija; nema preuzimanja izgleda ni teksta;
- ništa nije provjeravano na stvarnim studentima; svi primjeri su izmišljeni.

Ograničenja plana koja vrijede za sve prijedloge: rok funkcija pilota 15. 1. 2027. se ne pomiče; prijava studenata samo AAI@EduHr (D-09); server se ne izmišlja, pa je uz svaki prijedlog navedeno treba li novo polje; prototip ostaje izvor istine (što Daniel stavi „za pilot” najprije ulazi u prototip i INVENTAR); pravila PRODUCT §5 i rječnik zabranjenih izraza vrijede (tekst nikad ne tvrdi otkrivanje autorstva ni varanja).

---

## 1. Što student u ovom dijelu radi od početka do kraja

Ruta u aplikaciji (host): `/zadaci` (Moji zadaci), `/zadaci/kolegiji`, `/zadaci/radovi`, `/upis`, `/zadatak/{id}` (obavijest), `/rad/{id}` (uređivač). Ljuska: bočna traka s pet stavki, zvonce obavijesti, tema, odjava.

### 1.1 Prijava (E-1)
1. Student otvori aplikaciju neprijavljen; zaslon `SignInScreen`: h1 „Dobro došli u svoj *prostor.*”, kartica „Vaš akademski identitet”, jedini gumb „Prijava sustavom AAI@EduHr”, ispod „Lozinku upisujete samo kod AAI@EduHr.” Razotkrivanja „Prvi dolazak ili imate kod zadatka?” i „Trebate pomoć?” (službena pomoć AAI@EduHr, „javite se koordinatoru”).
2. Klik: stanje `preusmjeravanje` (`role=status`, gumb onemogućen), povratak s AAI@EduHr.
3. Ishodi: uspjeh vodi na „Moji zadaci” (A-1); `greska` („Prijava nije dovršena”, „Pokušaj ponovno”); `nedostupno` (AAI ne odgovara); `bezuloge` („Prijava je uspjela… račun još nema dodijeljenu ulogu”, odjava).
4. Šifre neuspjele prijave dolaze kao `/prijava?greska=login_failed|provider_unavailable`; za `login_refused` (403) nema zasebnog teksta (INVENTAR PO-2).

### 1.2 Moji zadaci (E-2, `HomePage`)
1. Zaglavlje: današnji datum (postavlja se tek nakon montiranja, pa je kratko prazan), h1 „Vaš studentski *prostor*”, uvod „Zadaci na kolegijima.”
2. Čita se `student.assignments.get` i `student.assignment-work.get` (`readMyWorks`). Dok čita: kostur (`aria-busy`, `role=status`). Odjavljen: „Prijavite se da vidite svoje zadatke.” Nedostupno: kartica `role=alert` „Prikaz trenutačno nije dostupan… To ne znači da nema kolegija ili radova.” s gumbom „Pokušaj ponovno” (stvarno ponovno čitanje).
3. Bez kolegija (`Empty`): „Još nemate kolegija.”, obrazac koda i tri koraka „Što slijedi nakon upisa?”. Kolegij bez zadatka: kartica „U ovom kolegiju zasad nema zadatka.” (prikazuje se samo prvi kolegij: `read.courses[0]`) i kartica koda.
4. S podacima: (a) kartica „nastavak rada” (`continueRow` = prvi redak vrste `rad`, tj. započet, ne predan, obavijest potvrđena; gumb „Otvori rad”); (b) ravni popis „Moji zadaci”; (c) kartica „Imate kod novog kolegija?”.
5. Redak: nadnaslov kolegija, naslov, „Rok: …” ili „Produljeni rok: …”, oznaka „Rok za N dana” (samo od 0 do 7 dana ispred), oznaka „Prvo pročitajte obavijest”, oznaka „Probni” (P-D1). Gumb po vrsti: `predano` „Otvori rad” (na potvrdu), `obavijest` „Pročitaj upute” (na `/zadatak/{id}`), `rad` „Otvori rad”, `zadatak` „Otvori zadatak”. Uz retke koji nisu predani ni „obavijest” stoji i „Započni rad” (`startWorkAction`, WEB-1402).

### 1.3 Moji kolegiji (E-3) i Moji radovi (E-4)
- Kolegiji: kartica po kolegiju s akademskom godinom, seminarskim grupama (oznake „Seminarska grupa 2”), mentorom i zadacima; stanja prazno („Upiši kolegij kodom”), `istekla` (ponovna prijava), kostur, greška.
- Radovi: popis svih zadataka sa stanjem („Predano” bez vremena, „Upute još nisu potvrđene”, „Rad je započet, nije predan”, „Rad nije započet”) i „Rok …” za nepredane. Postoji pretraga i filtar akademske godine koje prototip nema (A-10: zadržati).

### 1.4 Upis kodom (E-5, `EnrolForm`)
1. Student dobije kod od nastavnika (usmeno, na kolegiju) i upiše ga na `/upis` ili na početnoj (kartica koda prenosi ga kao `?kod=`, trimiran i velikim slovima; polje dobiva fokus).
2. `CodeField` (maks. 64 znaka u ugovoru; tekst traži 8 do 32), gumb „Upiši” je onemogućen dok je polje prazno.
3. Odgovor poslužitelja (`student.enrollments.post`): `enrolled` vodi na stranicu kolegija (`courseHref`), `already_enrolled` daje „Već ste upisani…” + „Otvori zadatak”, `enrolled_no_assignment` daje „Upisani ste u kolegij, ali… nema otvorenog zadatka” + „Upiši drugi kolegij”.
4. Greške: 422 `invalid_input` (format: „Kod ima od 8 do 32 slova i brojke…”), 422 `invalid_code`/`expired_code` (isti tekst: „Kod ne postoji ili je istekao.”), 429 `too_many_attempts`, 401 (poveznica na prijavu), mreža („Nema veze s poslužiteljem…”).

### 1.5 Obavijest o zadatku (E-6, S-05; `NoticePage` + `HostNotice`)
1. Student otvara `/zadatak/{id}` (s popisa, s retka „Pročitaj upute”, ili `Započni rad` kad obavijest još nije potvrđena).
2. Učita se `student.notice.get` (`assignmentId, versionNo, templateVersion, title, instructions, workType, opensAt, dueAt, aiPolicy, aiPurposes, evidenceProfile, wordMin, wordMax, readAt, acknowledgedAt`).
3. **Odmah po učitavanju**, ako `readAt` još nije postavljen, stranica sama zove `student.notice-read.post` (`markNoticeRead`) i prikazuje „Bilježi se da je obavijest otvorena…”, zatim „Na poslužitelju je zabilježeno da je obavijest otvorena.” Greška: „Poslužitelj nije potvrdio…”, stari broj verzije: „Objavljena je nova verzija zadatka…”.
4. Sadržaj: nadnaslov „Prije pisanja”, h1 „Prije prve *rečenice*”, naslov zadatka, vrsta · opseg riječi, rok; kartica „Uporaba alata u ovom zadatku (FPZG čl. 8)” (dopušteno ✓ prema `aiPurposes`, nije dopušteno × uključujući uvijek zabranjene, razotkrivanje „Pravilo fakulteta”); tri stupca „Što se bilježi”, „Što se ne bilježi”, „Što vidi nastavnik (mentor)”; napomena da Ductura ne procjenjuje autorstvo ni korištenje AI-ja; rok čuvanja.
5. Potvrda: potvrdni okvir „Pročitao/la sam obavijest…” i gumb „Potvrdi i otvori editor”; `acknowledgeNotice` šalje `{versionNo, fingerprint}` na `institution.acknowledgment.post`. Stanja: `nijeotvoren` (potvrda tek kad se zadatak otvori), `potvrdeno` („Potvrđeno {vrijeme}” + „Otvori rad”), `promijenjeno` (nova verzija), `bezprava`.
6. Potvrda vodi na `/rad/{id}`, uređivač (izvan ovog dijela).

### 1.6 Zvonce obavijesti u ljusci (`ShellNotifications`)
Zvonce s brojem nepročitanih postoji u ljusci, ali je zadano vezano na `UNAVAILABLE_TRANSPORT` (`src/client/notifications.ts`, redak 91): obje metode vraćaju 404 bez mrežnog poziva, pa zvonce uvijek kaže „Obavijesti trenutačno nisu dostupne.” (vidi 2.1, nalaz G-1).

### 1.7 Odjava
Gumb „Odjava” u podnožju trake (`SignOut`: `auth.logout.post`, zatim izlaz). Odluka A-6: dijalog o neposlanom tekstu ostaje, odjava vodi na početnu stranicu.

---

## 2. Gdje zapinje

Oznake: **G-n** je nalaz (zapinje); uz svaki je navedeno gdje (ekran, element, stanje) i je li provjereno u kodu ili treba preglednik.

### 2.1 Koraci i tok

- **G-1 Zvonce obavijesti ne radi (nije priključeno).** Ekran: ljuska, `ShellNotifications`. Zadani transport vraća 404, pa student nikad ne vidi obavijest o novoj verziji zadatka, komentaru ni predaji. Dodatno, klijentski oblik se ne poklapa s ugovorom: `src/client/notifications.ts` očekuje `{items, unread}` i vrste `comment|assignmentVersion|submission`, dok ugovor `notifications.list.get` vraća `{notifications[], nextBefore}` s vrstama `assignment_version|course_handover|comment_posted|submission_recorded|deadline_reminder` (do 50 po stranici, stranica „prije” id-a), a `readNotifications` odbija cijeli odgovor ako se ijedna vrsta ne prepozna (`items.includes(null)` daje „nedostupno”). Priključivanje bez preslikavanja i dalje bi dalo „nedostupno”. Provjereno u kodu (`item()` redak 40 do 50, `readNotifications` redak 52 do 70). Utječe na S-05 jer je odluka 2147 „obavijest pri objavi samo u aplikaciji”: bez zvonca nema ničega.
- **G-2 Dva odvojena zapisa za jednu obavijest, jedan automatski.** Ekran `/zadatak/{id}`. Poslužitelju se šalje „otvorena” (`notice-read`) čim se stranica učita, bez ikakve radnje studenta, a „potvrđena” (`acknowledgment`) tek potvrdnim okvirom. Prototip kaže „Prije potvrde ništa se ne šalje na poslužitelj” (R-19). Tekst u katalogu (`messages.hr.ts`, `notConsent`) je uži: „Prije potvrde zapis rada ne šalje se na poslužitelj.”, pa nije izravno netočan, ali student ne zna da se otvaranje obavijesti ipak bilježi. Razlika prema prototipu postoji; Daniel treba potvrditi da je zapis „otvorena” dopušten i navesti ga u tekstu obavijesti; vidi P-9.
- **G-3 Prvi kolegij bez zadatka skriva ostale.** `HomePage`: kad su `rows.length === 0`, prikazuje se samo `read.courses[0]`; student upisan u dva kolegija bez zadataka vidi samo jedan. Provjereno u kodu.
- **G-4 Oznaka roka nestaje kad rok prođe.** `nearTag` (home/model.ts) vraća `null` ako je `due < now`; redak ne nosi nikakvu oznaku „Rok je prošao”, a dugme je i dalje „Otvori zadatak”/„Započni rad”. Student bez produljenja ne dobiva signal da je kasno; predaja nakon roka postoji tek u E-10. Provjereno u kodu.
- **G-5 „Nastavak rada” bira prvi redak, ne najhitniji.** `continueRow` uzima prvi redak vrste `rad` po redoslijedu kolegija, ne po roku. Student s dva započeta rada vidi onaj koji slučajno dolazi prvi. Provjereno u kodu.
- **G-6 Popis zadataka je ravan i neuređen po roku.** Redoslijed je redoslijed kolegija pa zadataka poslužitelja. Hitnost se čita samo iz oznake „Rok za N dana”. Provjeriti u pregledniku s osam do deset zadataka.
- **G-7 „Predano” bez vremena.** `courses/WorksPage.tsx` i `HomePage` prikazuju „Predano” bez vremena jer `student.assignment-work.get` daje samo `workState`; INVENTAR PO-5 to već navodi kao DJELOMIČNO. Ugovor `student.submission.get` postoji za pojedini zadatak, ali zvati ga po retku znači N+1 poziva.
- **G-8 Greška upisa: dva uzroka isti tekst, a 429 nije obrađen u prototipu.** `invalid_code` i `expired_code` oba daju „Kod ne postoji ili je istekao.”; za `too_many_attempts` (429) prototip nema tekst, a student koji tri puta pogriješi nema uputu što dalje. Provjeriti `enrollError` (zajednički tekst) u pregledniku.
- **G-9 Dva pravila normalizacije koda.** `enroll()` (`src/components/student/upis/enroll.ts`) uklanja razmake i crtice, podiže slova i traži 8 do 32 znaka, što odgovara uputi na ekranu. Međutim, kartica koda na početnoj (`normalizeCode` u `home/model.ts`) samo trimira i podiže slova, pa se u polju na `/upis` kod prenesen s početne prikaže s crticama (npr. „AB-CD-EF-GH”); radi, ali izgleda kao greška. Uz to `maxLength` polja je 64 (kao ugovor), dok je tekst 8 do 32. Izmjena je kozmetička; provjeriti u pregledniku.

### 2.2 Stanja

- **Učitavanje:** kostur na E-2; na `/zadatak/{id}` `RouteLoading`. Nema vremenskog ograničenja ni „još učitavam” poruke ako poslužitelj ne odgovara (provjeriti u pregledniku s usporenom mrežom).
- **Prazno:** E-2 `Empty` je dobar (tri koraka); E-4 vodi na `EnrollLink`; E-3 isto. Kolegij upisan, a zadataka nema, vidljiv je samo uz G-3 ograničenje.
- **Greška:** pokušaj ponovno radi stvarno ponovno čitanje na E-2/E-4 i na obavijesti. Greška upisa zadržava uneseni kod.
- **Dvostruki klik:** upis ima `busy` ref; obavijest ima `sending` ref; ostalo nije provjereno.
- **Stara kartica preglednika:** odluka A-12 prihvaćena; nema vlastitog stanja na ovim ekranima.

### 2.3 Pristupačnost (iz koda; provjeriti čitačem zaslona)

- Redak zadatka: gumb ima `aria-label` „Otvori rad: {naslov}” (dobro, različito po retku); uz njega „Započni rad: {naslov}”. Ispravno, ali redak ima dva gumba i povezanu poveznicu `a.open`, pa čitač zaslona čita tri naziva.
- `H1` na E-5 sakriven u stanjima `vecupisan` i `bezzadatka` (`styles.hidden`), poruka `role=status`: dobro.
- Oznaka „Rok za N dana” je `Tag` bez veze s retkom; za čitač ostaje usputan tekst unutar `span`-a.
- Datum u zaglavlju postavlja se tek poslije montiranja: čitač zaslona ga ne čita pri prvom prolazu (kratko prazno `span`).
- Potvrdni okvir obavijesti i `aria-disabled` na gumbu: provjeriti da onemogućeni gumb nije izvan tab-redoslijeda (INVENTAR to traži).
- Kontrast i fokus: ocjena `VIZ-WCAG.md` pokriva paket `ui`; za ove ekrane nije posebno mjereno.

### 2.4 Mobitel (provjeriti u pregledniku, ispod 800 px)

- Bočna traka postaje izbornik („Izbornik”, `aria-expanded`); odjava i tema u podnožju, potrebno je otvoriti izbornik da se odjavite.
- Redak zadatka s dva gumba („Otvori zadatak” i „Započni rad”) i tri oznake: rizik preklapanja i premale ciljne površine; ciljevi na dodir trebaju biti barem 44 px.
- Tri stupca „Što se bilježi / ne bilježi / vidi nastavnik” na obavijesti: provjeriti slažu li se u jedan stupac.
- Polje koda: `autocapitalize=characters` je postavljeno (dobro); zalijepljeni kod s razmacima iz poruke na mobitelu.

### 2.5 Greške i oporavak
- Prijava: tri jasna stanja; `login_refused` bez zasebnog teksta (N-8, A-5: koordinator je administrator fakulteta; tekst treba imenovati ulogu).
- Istek prijave usred rada: E-3 `istekla` pokriva; E-2 i E-5 vode na `signInHref`.
- Zadatak koji je u međuvremenu promijenjen: `stale` dolazi tek nakon automatskog označavanja; student može prvo potvrditi staru verziju (utrka, `notice_changed` 409 pokriva).

---

## 3. Što nude slični alati i što traže pilot, privatnost i pravila o AI izjavi

### 3.1 Slični alati (opisno, iz općeg poznavanja, bez kopiranja izgleda)

- **Sustavi za e-učenje (Merlin/Moodle i slični):** popis zadataka po kolegiju, rok i status predaje na jednom mjestu, kalendar s rokovima, obavijesti u aplikaciji i e-poštom o novom zadatku ili promjeni roka, upis ključem kolegija (kao ovdje) ili ručno od nastavnika. Mana koja se često spominje: mnogo klikova do stvarnog zadatka i obavijesti koje se izgube među općim porukama.
- **Alati za zadatke u razredu (tipa Google Classroom):** „za predati”, „kasni”, „predano” kao odjeljci, sortirano po roku; oznaka kašnjenja na retku; podsjetnik prije roka; izvoz u kalendar.
- **Sustavi za predaju i provjeru izvornosti (tipa Turnitin):** jedan ekran s potvrdom o predaji i vremenom predaje; kod nas to postoji u E-11. Njihov problem koji ovdje izbjegavamo: neprozirna procjena; Ductura ne procjenjuje autorstvo (PRODUCT §5).
- **Planeri studija (kalendar i liste zadataka):** zbirni pogled tjedna, ICS izvoz, podsjetnici.

Zajedničko što studenti očekuju: (1) što je sljedeće i do kada, bez traženja; (2) vidljivo je li nešto kasni; (3) obavijest kad se nešto promijeni; (4) potvrda o onome što je poslano.

### 3.2 Što traže pilot, privatnost i AI izjava za ovaj dio

- **Pilot:** prijava samo AAI@EduHr (D-09, D-16); lažni OIDC samo lokalno i u CI-ju; rok funkcija 15. 1. 2027.; sve novo najprije u prototip i INVENTAR.
- **Privatnost:** obavijest kaže što se bilježi i što se ne bilježi (tipke, ritam, druge aplikacije, kamera, mikrofon, zaslon, IP i uređaj ne); Ustav v1.9 dopušta sadržaj tipki samo u polju editora, nikad izvan njega, pa ni na ovim ekranima. „Potvrda nije privola.” Svaki novi zapis na ovim ekranima (npr. „otvorena obavijest”) mora biti naveden u tekstu obavijesti, a čuvanje ide do roka čuvanja fakulteta.
- **Obavijesti izvan aplikacije:** po odluci 2147 obavijest pri objavi je samo u aplikaciji; e-pošta i push nisu dopušteni bez nove odluke i DPIA.
- **AI izjava:** nastavnik postavlja pravilo uporabe alata za zadatak (FPZG čl. 8, `aiPurposes`); student ga vidi u obavijesti prije pisanja; izjava (E-9) ovisi o D-194 i Q-10 (Q-10 ne blokira Asistenta jer se pružatelj ni model ne imenuju; asistent u pilotu radi od 23. 11. 2026.); izjava o AI-ju je dijalog `ch-h` (odluka 2165). U ovom dijelu AI izjava je samo informacija (stupac „Dopušteno / Nije dopušteno”); nikakva procjena niti „postotak AI-ja” ne ulazi ovamo.
- **Zabranjeni izrazi:** svi novi tekstovi kroz skener (PRODUCT §5). Posebno oprez kod prijedloga o podsjetnicima i oznakama kašnjenja: „kasni” opisuje rok, ne ponašanje studenta.

---

## 4. Numerirani prijedlozi

Oznake: veličina S (do ~1 dan), M (2 do 4 dana), L (tjedan ili više). „Server” = treba li novo polje ili ruta (ne izmišljam: ako ruta već postoji u izvatku ugovora, piše „ne, postoji”). „Prototip” = dodiruje li prototip i INVENTAR (što bi se najprije izmijenilo prije gradnje).

**P-1 Priključiti zvonce obavijesti na postojeće rute.**
- Opis: transport nad `notifications.list.get` i `notifications.read.post` s preslikavanjem vrsta (`assignment_version`, `comment_posted`, `submission_recorded`, `deadline_reminder`, `course_handover`) i ponašanjem „nepoznata vrsta se preskače, ne ruši popis”; klik vodi na `/zadatak/{id}` ili rad.
- Korist: bez toga S-05 (obavijest o novom zadatku/verziji) i odluka 2147 nemaju gdje živjeti; rješava G-1.
- Veličina: M. Rizik: srednji (klijent trenutno očekuje drugi oblik; jedan test ugovora). Server: ne, rute postoje u izvatku; **ipak** treba potvrditi tko i kada stvara zapise `assignment_version` i `deadline_reminder` (to je poslužiteljska strana i nije vidljiva iz ovog repoa). Prototip: da, prototip nema zvonce; ljuska E-0 treba dobiti stavku i INVENTAR red.

**P-2 Podsjetnik na rok u zvoncu i na početnoj.**
- Opis: vrsta `deadline_reminder` prikazuje se u zvoncu kao „Rok za zadatak {naslov}: {rok}”; na početnoj samo postojeća oznaka. Ne šalje se izvan aplikacije.
- Korist: student ne mora sam pratiti rokove. Veličina: S nakon P-1. Rizik: nizak; tekst bez pritiska i bez tvrdnji o ponašanju. Server: ne, vrsta postoji u ugovoru; kad i za koga se stvara, ne znam. Prototip: da (zvonce).

**P-3 Oznaka „Rok je prošao” i razlikovanje „Započni rad” nakon roka.**
- Opis: retku (E-2, E-3, E-4) dodati oznaku kad je `dueAt` (ili produljeni rok) prošao, a rad nije predan; tekst činjenični („Rok je prošao {datum}”). Gumb ostaje isti.
- Korist: rješava G-4. Veličina: S. Rizik: nizak. Server: ne (`dueAt`, `extendedDueAt` postoje). Prototip: da (retka datuma `when()` nema tu oznaku).

**P-4 Hitnost u „nastavku rada” i uređenje popisa po roku.**
- Opis: „nastavak rada” bira započet rad s najbližim rokom (ne prvi po redu); popis na E-2 ima neobavezan poredak „po roku” (zadano) i odjeljke „Uskoro”, „Kasnije”, „Predano” (predani na dnu).
- Korist: G-5 i G-6. Veličina: S do M. Rizik: nizak (čista funkcija, testovi u `home/model.test.ts`). Server: ne. Prototip: da (prototip ima ravan popis i prvi redak).

**P-5 Filtar po stanju na „Moji radovi”.**
- Opis: uz postojeću pretragu i godinu: izbornik stanja „Sve / Za predati / Predano / Čeka obavijest”.
- Korist: student s mnogo kolegija. Veličina: S. Rizik: nizak. Server: ne. Prototip: da (A-10 je već zadržao pretragu i godinu iz weba; ovo ih proširuje).

**P-6 Vrijeme predaje na „Moji radovi” i „Moji zadaci”.**
- Opis: uz „Predano” prikazati vrijeme predaje i oznaku „nakon roka”.
- Korist: G-7; student vidi što je potvrđeno bez otvaranja potvrde. Veličina: S (klijent) + server. Rizik: nizak. Server: **da: novo polje `submittedAt` (i `afterDeadline`) u odgovoru `student.assignment-work.get`**, jer poziv `student.submission.get` po retku nije razuman (N+1). Prototip: da (INVENTAR PO-5 to već bilježi kao DJELOMIČNO).

**P-7 Povijest produljenja roka na retku i na obavijesti.**
- Opis: oznaka „Produljeni rok” već postoji; dodati „Bio {stari rok}, razlog: opravdano/tehnički/dogovor” iz `student.deadline-history.get` (polja `previousDueAt`, `dueAt`, `reasonId`, `scope`).
- Korist: student zna zašto se rok promijenio. Veličina: S do M. Rizik: nizak do srednji (razlog je nastavnikova odluka; prikaz razloga treba potvrditi s pravnim odgovorom o tome što student smije vidjeti). Server: ne, ruta postoji u izvatku; klijent je danas ne zove. Prototip: da.

**P-8 Obavijest o zadatku: sažetak na vrhu (5 redaka).**
- Opis: iznad punog teksta: rok, opseg riječi, dopušteno (jedan redak s `aiPurposes`), što je najvažnije bilježenje, jedna rečenica „Potvrda nije privola”. Puni tekst ostaje ispod.
- Korist: dug zaslon (tri kartice) prije potvrdnog okvira; student mora skrolati da uopće vidi okvir (provjeriti na mobitelu). Veličina: S. Rizik: nizak (samo prikaz podataka koje već imamo; tekst kroz skener). Server: ne. Prototip: da (E-6 tijelo).

**P-9 Uskladiti „otvorena” i „potvrđena” obavijest.**
- Opis: dvije mogućnosti koje Daniel bira: (a) maknuti automatski `notice-read` pri učitavanju i zadržati samo potvrdu (prototip: „prije potvrde ništa se ne šalje”); (b) zadržati i u tekstu obavijesti i u INVENTAR-u navesti da se bilježi otvaranje.
- Korist: rješava G-2, usklađuje tekst i ponašanje. Veličina: S. Rizik: srednji (dira privatnost i tekst koji studentu obećava, pa ide kroz pravni pregled). Server: ne; `notice-read` je postojeća ruta. Prototip: da (R-19 i tekst).

**P-10 Zasebna poruka za previše pokušaja upisa i za bolje razlikovanje kodova.**
- Opis: tekst za 429 (`too_many_attempts`): „Previše pokušaja. Pričekajte i pokušajte ponovno ili se javite nastavniku.” (bez izmišljanja trajanja); zadržati isti tekst za `invalid_code` i `expired_code` radi sigurnosti ili ih razdvojiti (Daniel).
- Korist: G-8. Veličina: S. Rizik: nizak; razdvajanje „ne postoji” i „istekao” otkriva postojanje koda, pa je preporuka ostaviti isti tekst. Server: ne (greške postoje u ugovoru). Prototip: da (`MSG` u E-5).

**P-11 Jedno pravilo normalizacije koda na početnoj i na upisu.**
- Opis: `normalizeCode` na početnoj koristi isti postupak kao `enroll()` (bez razmaka i crtica) pa polje na `/upis` pokazuje čist kod; `maxLength` polja usklađen s 32.
- Korist: G-9. Veličina: S. Rizik: nizak. Server: ne (klijent već normalizira prije slanja). Prototip: da (R-10 i R-15).

**P-12 „Više kolegija bez zadatka” na početnoj.**
- Opis: kad nijedan zadatak nije vidljiv, prikazati sve kolegije (ne samo prvi) s porukom i karticom koda.
- Korist: G-3. Veličina: S. Rizik: nizak. Server: ne. Prototip: da (`kolegijbeztaska` prikazuje „Kolegij A”).

**P-13 Pristupačnost i mobitel: ciljevi, jedan primarni gumb po retku, sažimanje stupaca.**
- Opis: provjera i ispravak iz 2.3 i 2.4: min. 44 px, spojiti naziv gumba, tri stupca u jedan, odjava dostupna bez otvaranja izbornika (ili ostaje, ali s jasnom oznakom).
- Veličina: M. Rizik: srednji (dira zajedničke komponente `@ductura/ui`; ne ide u ovom zadatku, nego u centralni prolaz stila 22. 11.). Server: ne. Prototip: da (mobilni izgled, INVENTAR E-0).

**P-14 Izvoz rokova u kalendar (ICS), samo u pregledniku.**
- Opis: gumb „Dodaj rokove u kalendar” generira `.ics` na klijentu iz `dueAt` i naslova; ništa se ne šalje poslužitelju.
- Korist: česta potreba studenata. Veličina: M. Rizik: nizak do srednji (datoteka sadrži nazive zadataka; ne uključivati ništa osim naslova, kolegija i roka; promjene roka se ne sinkroniziraju). Server: ne. Prototip: da (nova radnja).

**P-15 Poseban tekst za odbijenu prijavu (`login_refused`) i bez uloge.**
- Opis: tekst koji imenuje administratora fakulteta (A-5) i razlikuje „AAI ne odgovara” od „nemate ulogu”.
- Korist: N-8; student zna kome se javiti. Veličina: S. Rizik: nizak. Server: ne (šifre postoje). Prototip: da (E-1, `bezuloge`).

**P-16 Prikaz razlike verzija obavijesti (v1 prema v2).**
- Opis: u stanju `promijenjeno` istaknuti što se promijenilo (rok, pravilo alata, opseg).
- Korist: student ne mora čitati sve ponovno. Veličina: L. Rizik: srednji. Server: **da: nova ruta ili polje s prethodnom verzijom** (nema ga u `student.notice.get`). Prototip: da.

**P-17 Obavijest e-poštom ili push (izvan aplikacije).**
- Opis: obavijest o novom zadatku e-poštom.
- Korist: studenti ne otvaraju aplikaciju svaki dan. Veličina: L. Rizik: visok (privatnost, DPIA, odluka 2147 kaže samo u aplikaciji). Server: **da, nema rute**. Prototip: da.

---

## 5. Tablica za Danielovu odluku

Preporuka je moja; odluka je vaša. „Pilot” = ulazi u funkcije pilota 15. 1. 2027. (najprije u prototip i INVENTAR). Redoslijed unutar „pilot” je po koristi.

| # | Prijedlog | Veličina | Server | Moja preporuka | Razlog | Vaša odluka |
|---|-----------|----------|--------|----------------|--------|-------------|
| P-1 | Priključiti zvonce obavijesti na postojeće rute | M | ne (rute postoje) | **za pilot** | Bez njega S-05 i odluka 2147 nemaju gdje živjeti; danas uvijek „nedostupno” | ☐ pilot ☐ nakon pilota ☐ ne |
| P-9 | Uskladiti „otvorena” i „potvrđena” obavijest (tekst i ponašanje) | S | ne | **za pilot** | Ponašanje se razlikuje od prototipa i od obećanja na ekranu | ☐ pilot ☐ nakon pilota ☐ ne |
| P-3 | Oznaka „Rok je prošao” | S | ne | **za pilot** | Jeftino, jasno studentu | ☐ pilot ☐ nakon pilota ☐ ne |
| P-11 | Jedno pravilo normalizacije koda | S | ne | **za pilot** | Kod s početne dolazi s crticama u polje | ☐ pilot ☐ nakon pilota ☐ ne |
| P-15 | Tekst za `login_refused` i bez uloge | S | ne | **za pilot** | Prvi dojam, a student ne zna kome se javiti | ☐ pilot ☐ nakon pilota ☐ ne |
| P-12 | Više kolegija bez zadatka na početnoj | S | ne | **za pilot** | Jednostavan ispravak greške | ☐ pilot ☐ nakon pilota ☐ ne |
| P-10 | Poruka za previše pokušaja upisa | S | ne | **za pilot** | Student inače ne zna da je blokiran | ☐ pilot ☐ nakon pilota ☐ ne |
| P-4 | Najhitniji „nastavak rada”, redoslijed po roku | S do M | ne | **za pilot** | Čista funkcija, brzo | ☐ pilot ☐ nakon pilota ☐ ne |
| P-8 | Sažetak obavijesti na vrhu | S | ne | **za pilot** | Skraćuje put do potvrde, posebno na mobitelu | ☐ pilot ☐ nakon pilota ☐ ne |
| P-6 | Vrijeme predaje na popisima | S + server | da (`submittedAt`) | nakon pilota | Traži SRV zadatak; ne ide u pilot bez njega | ☐ pilot ☐ nakon pilota ☐ ne |
| P-7 | Povijest produljenja roka | S do M | ne (ruta postoji) | nakon pilota | Razlog nastavnikove odluke treba pravni pregled | ☐ pilot ☐ nakon pilota ☐ ne |
| P-2 | Podsjetnik na rok u zvoncu | S nakon P-1 | ne (vrsta postoji; izvor nepoznat) | nakon pilota | Ovisi o P-1 i o tome stvara li server zapis | ☐ pilot ☐ nakon pilota ☐ ne |
| P-5 | Filtar po stanju na „Moji radovi” | S | ne | nakon pilota | Korisno tek uz više kolegija | ☐ pilot ☐ nakon pilota ☐ ne |
| P-13 | Pristupačnost i mobitel (ciljevi, stupci) | M | ne | **za pilot (ide u centralni prolaz stila)** | Obvezno prije pilota, ali ne kao funkcija | ☐ pilot ☐ nakon pilota ☐ ne |
| P-14 | Izvoz rokova u kalendar (ICS) | M | ne | nakon pilota | Nije potrebno za pilot | ☐ pilot ☐ nakon pilota ☐ ne |
| P-16 | Razlika verzija obavijesti | L | da | nakon pilota | Veliko, traži novu rutu | ☐ pilot ☐ nakon pilota ☐ ne |
| P-17 | Obavijest e-poštom ili push | L | da | **ne** | Protivno odluci 2147; visok rizik privatnosti | ☐ pilot ☐ nakon pilota ☐ ne |

Pitanja koja vas traže odgovor i koja ne mogu odlučiti sama:
1. Je li zapis „otvorena obavijest” prije potvrde dopušten (P-9, a ili b)?
2. (zatvoreno: klijent već uklanja crtice u `enroll()`; P-11 je samo usklađivanje početne.)
3. Stvara li poslužitelj zapise `deadline_reminder` i `assignment_version` (P-1, P-2)? To nije vidljivo iz ovog repoa.
4. Nalazi se `docs/nalazi/paritet-student.md` u drugoj grani? Pregled bi ga trebao usporediti.

Otvoreno za provjeru u pregledniku (nije moguće iz ovog pregleda): mobitel (2.4), redoslijed Tab na obavijesti, izgled s mnogo zadataka.

---

## 6. Ishod: odluka vlasnika i unos u prototip (NF-1-PROTO, 23. 11. 2026.)

Daniel je 23. 11. 2026. svih 17 prijedloga stavio u pilot (plan `ductura/.github`, `docs/plan/NOVE-FUNKCIJE.md`, odjeljak „Odluke · NF-1”). P-9 ide u varijanti (a): prije potvrde ništa se ne bilježi, a automatski `notice-read` pri učitavanju se uklanja. P-17 (obavijest e-poštom ili push) ulazi u pilot uz pregled privatnosti: sadržaj bez osobnih podataka iz rada, pristanak i odjava.

Svih 17 unijeto je u `docs/prototip/Ductura_student.html` i `docs/prototip/INVENTAR-student.md` (dopune označene „NF-1”). Aplikacija se ne mijenja; gradnja čeka zatvaranje pariteta studenta (PAR2-S). Svi podaci u prototipu su izmišljeni.

Prijedlozi koji traže poslužiteljsko polje ili rutu koje u izvatku ugovora ne postoje (opisano u INVENTAR-u, ne izmišlja se da postoje): P-6 (PO-28), P-16 (PO-29), P-17 (PO-30 do PO-33). P-1 i P-2 koriste rute iz izvatka (PO-26), ali traže provjeru stvara li poslužitelj zapise `assignment_version` i `deadline_reminder` (N-17). P-7 koristi postojeću rutu (PO-27), a tekst razloga čeka pravni pregled.

### 6.1 Tablica P-n → ID inventara → element prototipa

Elementi prototipa su ekran (hash), varijanta stanja (izbornik „stanje” u traci prototipa) i oznaka u kodu. Izbornik „zvonce” u traci prototipa bira stanje ploče PD-9.

| P | ID u `INVENTAR-student.md` | Element prototipa |
|---|---|---|
| P-1 | E-0a, PD-9, R-43 do R-47, PO-26 | gumb „Obavijesti” u podnožju trake (`data-nf=bell`), ploča `#nf-panel`; stanja zvonca `puno`, `prazno`, `ucitavanje`, `greska`; nepoznata vrsta se preskače |
| P-2 | PD-9, PO-26 | vrsta `deadline_reminder` u ploči: „Rok za zadatak {naslov}: {rok}” |
| P-3 | E-2a (isto na E-3, E-4) | oznaka `.tag.late` „Rok je prošao {datum}”; zadatak „Sažetak stručnog članka o medijskoj pismenosti” |
| P-4 | E-2d, E-2e, R-48 | `#pocetna`: izbornik „Poredak”, odjeljci „Uskoro”, „Kasnije”, „Predano”; kartica „nastavak rada” po najbližem roku |
| P-5 | E-4a, R-50, R-51 | `#radovi`: izbornik „Stanje”, varijanta `bezrezultata` |
| P-6 | E-2c, PO-28 | oznaka „Predano nakon roka” uz „Predano {vrijeme}” (zadatak „Esej o povjerenju u institucije”) |
| P-7 | E-2b, E-6d, PO-27 | redak „Produljeni rok” s „Prethodni rok… Razlog… Vrijedi za…” na E-2, E-3, E-4 i u E-6 (zadatak „Lokalni mediji i izborna kampanja”) |
| P-8 | E-6a | kartica „Ukratko” (`.up-sum`) na `#obavijest` |
| P-9 | E-6b, R-19 | stavka „Otvaranje ove obavijesti…” u stupcu „Što se ne bilježi”; meta „Prije potvrde ništa se ne šalje na poslužitelj.” |
| P-10 | E-5a | `#upis`: varijanta `previse` (nakon trećeg pogrešnog koda) |
| P-11 | E-5b, R-10 | `#pocetna` obrazac koda → `#upis` polje s čistim kodom, `maxlength=32` |
| P-12 | E-2g | `#pocetna`, varijanta `kolegijbeztaska`: kartice za Kolegij A i Kolegij B |
| P-13 | E-0b, E-2h | gornja traka ispod 800 px s „Obavijesti” i „Odjava”; naziv gumba retka s naslovom zadatka i `aria-describedby`. Veličina ciljeva i prijelomi stupaca ostaju u centralnom prolazu stila |
| P-14 | E-2f, R-49 | `#pocetna`: gumb „Dodaj rokove u kalendar” (preuzima `.ics`) |
| P-15 | E-1a | `#prijava`: varijanta `odbijeno`; tekst `bezuloge` imenuje administratora fakulteta |
| P-16 | E-6c, PO-29 | `#obavijest`: varijante `promijenjeno` (tablica razlike), `razlikaucitava`, `promijenjenobezrazlike` |
| P-17 | E-12, E-13, R-52 do R-54, PO-30 do PO-33 | `#postavke` (osam stanja) i `#odjavaposte` (pet stanja) |

### 6.2 Što je provjereno i što nije

- Prototip je otvoren u Chromiumu u svijetloj i tamnoj temi na 390 i 1280 px. Izvor stranica nije dobio JavaScript grešku ni u jednoj varijanti.
- Postojeći ekrani bez ljuske (`rad`, `pregled`, `izjava`, `predaja`, `potvrda`) i varijante prijave `preusmjeravanje`, `greska` i `nedostupno` imaju istovjetan HTML prije i poslije izmjene. Na ostalim ekranima razlikuje se samo ono što zadatak traži (zvonce u traci, oznake roka, novi redci i stanja). Veličine i položaji sadržaja na ekranima upis, kolegiji, radovi i početna ostali su isti; razlika je samo u traci prototipa (nije proizvod), koja na mobitelu ima jedan red više zbog izbornika „zvonce”.
- Nije provjereno čitačem zaslona; nazivi i opisi dolaze iz koda (`aria-label`, `aria-describedby`, `role`), a P-13 (ciljevi na dodir, prijelom stupaca, redoslijed tabulatora) ostaje za centralni prolaz stila.
- Nije pokrenuta aplikacija ni poslužitelj; za P-1, P-2, P-6, P-7, P-16 i P-17 podaci iz zvonca i povijesti dolaze iz izmišljenih zapisa u prototipu.

## 7. Promjena 23. 11. 2026.: asistent u pilotu radi (ASIST-STUDENT)

**Promijenjeno 23. 11. 2026.: asistent u pilotu radi.** Danielova odluka mijenja raniju odluku „isključen” (NF-2 br. 1, OC-1). U ovom nalazu to pogađa pravilo uporabe alata u obavijesti zadatka (`aiPolicy`, `aiPurposes`) i izjavu (E-9). Pružatelj ni model se ne imenuju (Q-10), samo „Asistent”.

| Stavka | INVENTAR ID | Element prototipa (`Ductura_student.html`) |
|---|---|---|
| Obavijest zadatka: pravilo uporabe alata (E-4) | E-4, ASIST-S1 | sažetak „Ukratko”: redak „Asistent u Ducturi radi u pilotu za dopuštene svrhe…”; kartica „Uporaba alata” bez promjene |
| Zabranjeno zadatkom (`aiPolicy` = prohibited) | ASIST-S1 | varijanta `asistent_zabranjeno` ekrana Izjava: „Asistent nije dostupan. Obavijest ovog zadatka ne dopušta alate.” |
| Samo sažimanje (`aiSummaryOnly`) | ASIST-S1 | varijanta `asistent_sazimanje`; polje u izvatku obavijesti **nedostaje** |
| Zapis „što se bilježi” (E-4) | E-4 | u popisu zabilježenog dodani „razgovori s Asistentom” uz „prijenos iz Asistenta” |
