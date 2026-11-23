# Nove funkcije, dio 7: Operater i administracija (operater fakulteta/ustanove, upis kolegija i korisnika, uloge i ovlasti, AAI@EduHr prijava, uvoz, postavke fakulteta, dnevnik pristupa i revizija, zahtjevi ispitanika, pomoć i podrška, stanje sustava, postavke asistenta na razini fakulteta)

Zadatak NF-7 `nove-funkcije-operater-admin`. Dodao ga je orkestrator 23. 11. 2026. po planu „Nove funkcije: pregled dio po dio” (plan u `ductura/.github` oblak ne vidi, pa je opis zadatka iz naloga). Ovo je zadnji, sedmi dio. Oblik i razina detalja po uzoru na `docs/nalazi/nove-funkcije-1-student-zadaci.md` do `nove-funkcije-6-mentorstvo-konzultacije.md`. Ovaj dokument je samo pregled; kod se ne mijenja.

Oznake: nalazi **O-n**, prijedlozi **OA-n** (da se ne miješaju s M-n/MK-n iz dijela 6, H-n/PG-n iz dijela 5, G-n/NZ-n iz dijela 4, P-n iz dijelova 1 i 2 ni PR-n iz dijela 3). Odluke iz dijelova 1 do 6 se ne ponavljaju kao pitanja, nego se na njih nadovezuje (vidi §0).

## 0. Izvori, način pregleda i ograničenja

Pročitano:
- prototip: `docs/prototip/ODGOVORI-DANIEL-2026-11-19.md` (A-5 „koordinator je admin fakulteta”, A-7 „kolegij izrađuje administrator”, A-2 kod za upis, C-16 izvoz za Merlin); `docs/prototip/INVENTAR-student.md` (ekran „bez uloge”, „Javite se koordinatoru (administratoru fakulteta)”); `docs/prototip/INVENTAR-nastavnik.md` §7 (točka 7: stvara li kolegij nastavnik ili administrator ustanove, A-03); `docs/prototip/INVENTAR-editor.md` (kartica „Tko osigurava AI”: „U Ducturi ovo postavlja administrator fakulteta, ne nastavnik”; kvačice fak, duc, own, sub, subOk i kvota 50/100/200 su samo radi prototipa). **U prototipu nema zasebnog ekrana operatera ni administratora**; sve što slijedi za administraciju izvedeno je iz odgovora, iz koda i iz ugovora, ne iz prototipa;
- aplikacija (host) `packages/app/src/host/`: `institution/` (`InstitutionPage`, `InstitutionPanels`: pregled, korisnici i uloge, kolegiji i akademske godine, pravila), `institution/data-retention/` (klase podataka i pravna zadržavanja), `institution/student-data-export/` (zahtjev i odobrenje izvoza podataka studenta), `institution/origin-thresholds/` (pragovi po vrsti podrijetla), `admin/institution-config/` (pravila fakulteta po vrsti rada, verzije), `operator/pilot-metrics/` (zbirna mjerila pilota), `public/student-data-download/`, `ProblemReportHelp.tsx`, te `packages/app/src/routes.ts` (popis stranica i uloga);
- ugovori u izvatku `src/client/migration-contracts.generated.json` (245 operacija; provjereno čitanjem izvatka, ne poslužitelja):
  - ustanova i korisnici: `institution.teacher-roles.get` (popisi `pending` i `confirmed`), `institution.role-confirmation.post`, `institution.role-revocation.post`, `institution.academic-years.get`, `institution.admin-courses.get` (kolegiji s nositeljem, timom, grupama i brojem studenata), `institution.courses.post`, `institution.course-assignments.post`, `institution.course-groups.get|post`, `institution.course-group-teachers.post`, `institution.teaching-group-members.put`, `institution.teaching-team.get|post`, `institution.teaching-team-view.get`, `institution.enrollment-code.post`, `institution.enrollment-code-state.get`, `institution.enrollment-code-revocation.post`, `institution.enrollments.post`, `institution.student-removal.post`, `institution.student-return.post`, `student.enrollments.post`;
  - postavke i pravila: `institution.config.get` i `institution.config-versions.post` (verzije s datumom važenja; pravila `citationStyle`, `workLanguages` hr|en, `defaultWorkLanguage`), `institution.faculty-rules.get|post` (po vrsti rada: `aiPolicy`, `aiPurposes`, `evidenceProfile`, `importAllowed`, verzija na kojoj se temelji), `institution.milestone-template.get|put`, `institution.origin-thresholds.get`, `institution.origin-threshold.put|delete`, `institution.work-language.post`, `institution.work-work-language.get|post`, `teacher.declaration-required.get|put`, `institution.acknowledgment.post`;
  - zadržavanje i pravna zadržavanja: `institution.retention.get` (klase s `retentionDays`, `mode` probni/briše, `candidates`, `lastRunAt`), `institution.legal-holds.get|post` (`subjectType` rad/student/zadatak, `caseReference`), `institution.legal-hold-release.post`;
  - zahtjevi ispitanika: `institution.student-data-exports.get|post` (`studentId`, `identityCheckedBy`, `note`; stanja, `expiresAt`), `institution.student-data-exports-approve.post` (`reference`), `student.data-export.get` (jednokratna poveznica, ZIP), `student.access-log.get` (dnevnik pristupa po radu: `at`, `role`, `surface`, `reader`);
  - podrška i stanje: `support.problem-report.post`, `support.problem-reports.post` (kategorije technical, account, course), `platform.health.get`, `platform.ready.get`, `platform.status.get` (`components`: writing, submission, mentorView; `maintenanceWindows`), `ops.pilot-metrics.get` (zbirni brojevi; skrivene skupine ispod praga 5), `notifications.list.get|read.post`, `student.notice.get`, `student.notice-read.post`;
  - prijava: `auth.logout.post`, `auth.logout-all.post`, `auth.backchannel-logout.post`; uloge sesije `institution_admin`, `teacher`, `student`, `network_engineer` (`src/client/api.ts`);
  - uvoz i Merlin: `teacher.merlin-roster.get`, `teacher.merlin-roster-csv.get`, `teacher.merlin-packages.post`, `teacher.merlin-package*.get` (izvoz iz Ducture prema Merlinu; **uvoza iz ISVU-a ili Merlina u izvatku nema**);
- dokumenti `docs/nalazi/nove-funkcije-1` do `-6` za nazive i odluke na koje se nadovezuje.

Što nije učinjeno, izričito:
- **aplikacija nije pokrenuta** s lažnim poslužiteljem u ovoj sesiji. Zaključci o koracima, stanjima i pristupačnosti izvedeni su iz izvornog koda, kataloga poruka, ugovora i ruta; gdje stavka ovisi o stvarnom prikazu, označena je „provjeriti u pregledniku”;
- **plan `NOVE-FUNKCIJE.md` iz `ductura/.github` nije čitan** (oblak nema pristup); sadržaj dijela 7 uzet je iz naloga orkestratora;
- **kasniji PR-ovi nisu provjereni.** Prije otvaranja zadatka po bilo kojem nalazu provjeriti da nije riješen u novijoj grani;
- nije provjeravan pravi poslužitelj, baza ni Docker: znamo što ugovor dopušta, ne što poslužitelj stvarno vraća ni tko smije koju radnju (RLS nije vidljiv iz izvatka). **Ništa u ovom dokumentu ne tvrdi da serverska mogućnost postoji ako je nema u izvatku**; gdje je nema, piše „treba novo polje” i označeno je „za orkestratora”;
- **sigurnosne slabosti se ne opisuju** (nalog); gdje je nešto sigurnosno osjetljivo, piše samo „za orkestratora, privatno”;
- opisi sličnih alata u §3.1 su iz općeg poznavanja takvih alata, ne iz uživo provjere njihovih trenutačnih verzija; ništa se ne kopira (ni izgled ni tekst);
- svi primjeri su izmišljeni („Student A”, „Nastavnik A”, „Operater A”, „Fakultet A”, kolegij „Uvod u medije”); nijedna stvarna osoba.

Odluke na koje se nadovezuje (ne pitaju se ponovno):
- **Dijelovi 1 do 6: sve je u pilotu** (Daniel, 23. 11.).
- **Asistent u pilotu radi** (pružatelj i model se ne imenuju, Q-10 nije donesena; OC-1: prekidač alata u `config/faculties`, zadano isključeno, mijenja se samo vlasnikovim PR-om; OC-2: prazan popis odredišta pretrage za pilot; OC-3 do OC-5 otvoreni). Za ovaj dio to znači: postavka asistenta na razini fakulteta danas **nije** ekran administratora, nego konfiguracija u repou; ekran bi je samo prikazivao, a ne mijenjao, dok vlasnik ne odluči drukčije.
- **Ocjena ostaje u Merlinu**; **obrasci fakulteta i suglasnost mentora unutar Ducture**; **mentorstvo otvara nastavnik**; **„Poruka sebi” na poslužitelju**; **izvoz pregleda rada s oznakama podrijetla**; **nema automatskog zaključka o autorstvu** (dijelovi 5 i 6).
- **Prijava samo AAI@EduHr** (D-09, D-16); **A-5**: račun bez uloge dobiva uputu da se javi koordinatoru, a koordinator je administrator fakulteta; **A-7**: kolegij izrađuje administrator.
- **Ustav v1.6 do v1.9 i P-1**: mjerila i oznake vrijede kako su opisani u dijelu 5; ovdje se spominju samo kao podatak koji operater/administrator **ne** vidi po osobi.
- **P-D5 (stanje sustava) i P-D6 (zbirna mjerila pilota bez identiteta)** su u pilotu (vlasnik 21. 11.); **P-D8** popis prečaca i **P-D1 do P-D4** nisu tema ovog dijela.

Ograničenja plana za sve prijedloge: rok funkcija pilota 15. 1. 2027. se ne pomiče; server se ne izmišlja; prototip ostaje izvor istine, a **ovdje ga nema**, pa svaki ekran koji bi nastao treba prvo prototip ili izričitu odluku vlasnika; PRODUCT §5 i rječnik zabranjenih izraza vrijede za svaki tekst; podaci su izmišljeni.

---

## 1. Tok operatera i administratora od početka do kraja

Tri uloge nose ovaj dio. Radi jasnoće, nazivi u dokumentu:
- **administrator ustanove** (sesijska uloga `institution_admin`, u prototipu „koordinator” / „administrator fakulteta”): ima prostor `/ustanova` s navigacijom Pregled, Korisnici, Kolegiji, Pravila, Čuvanje podataka, Izvoz podataka studenta, te Pragovi (`routes.ts`);
- **operater** (sesijska uloga `network_engineer` u `api.ts`): **nema prostor u ljusci** (`shellRole` za njega vraća „bez uloge”); postoji samo komponenta `operator/pilot-metrics/PilotMetrics.tsx` s porukom „Za pregled mjerila potreban je operaterski pristup.”, **a ruta za nju nije u popisu stranica**. Operater je dakle danas u ugovoru i u komponenti, ali ne i na zaslonu (nalaz O-1);
- **referada** (matični ured): nema vlastitu ulogu; stranica „Izvoz podataka studenta” otvorena je svakom prijavljenom, a poslužitelj odlučuje (komentar u `routes.ts`, WEB-1302).

Tok, kako ga danas pokrivaju ugovor i kod:

### 1.1 Početak: ustanova, prijava i prva postavka
1. Studenti i nastavnici ulaze **isključivo AAI@EduHr**; lažni OIDC samo lokalno i u CI-ju. Ductura ne vodi lozinke ni vlastiti registar prijave. Račun bez uloge vidi ekran „Račun bez uloge” s uputom da se javi koordinatoru.
2. Administrator otvara „Pregled” (`overviewCounts`): brojevi najnovije akademske godine, uz napomene „Kolegiji najnovije akademske godine (…)” i „student upisan u dva kolegija broji se dvaput”. Ako ustanova nema akademskih godina, piše „Ustanova još nema akademskih godina.” i dalje se ne može; **kako se akademska godina otvara, u izvatku nema** (postoji samo `institution.academic-years.get`) (O-6).
3. **Pravila fakulteta** (`/ustanova/pravila`): za svaku vrstu rada zadnja objavljena verzija; nova verzija se **ne uređuje na mjestu**, nego se pripremi, pregleda razlika („Pregledaj razliku”) i objavi („Objavi novu verziju”). Polja: AI pomoć, dopuštene uporabe, profil zapisa, uvoz teksta dopušten. Ako je u međuvremenu objavljena novija verzija, poruka „U međuvremenu je objavljena novija verzija…” i ponovno učitavanje.
4. **Pragovi po vrsti podrijetla** (`/ustanova/pragovi`): fakultet postavlja pragove, zadanih nema (P-1).

### 1.2 Korisnici i uloge
5. „Korisnici”: dva popisa, **na čekanju** i **potvrđeni** nastavnici (`institution.teacher-roles.get`); administrator potvrđuje ulogu (`role-confirmation`) ili je povlači (`role-revocation`). Svaka promjena ima ishod koji se prikazuje (`RoleOutcome`).
6. **Studenti nemaju popis za upravljanje po osobi**: pregled kaže samo koliko ih je upisano. Upis ide **kodom za upis** koji generira nastavnik/administrator (`enrollment-code`, opoziv `enrollment-code-revocation`), a student ga upisuje; uklanjanje studenta s kolegija i povratak postoje kao operacije (`student-removal`, `student-return`) bez vidljivog ekrana u pregledanim mapama (O-4).
7. **Uvoza korisnika ili upisa iz ISVU-a ili Merlina nema** (ni operacije ni ekrana). Postoji samo izvoz **iz** Ducture prema Merlinu (popis i CSV, paketi) i uvoz teksta rada (`work.imports*`, nije tema ovog dijela) (O-3).

### 1.3 Kolegiji i grupe
8. „Kolegiji”: popis kolegija najnovije akademske godine s nositeljem, timom i grupama (`admin-courses`); radnje: novi kolegij, dodjela nositelja, grupe, nastavnici grupe, članovi grupe, tim kolegija. Odluka A-7: kolegij izrađuje administrator. Ovo su ugovori; **koji su od njih vezani na zaslon, provjeriti u pregledniku** (O-4).

### 1.4 Zadržavanje, zadržavanja i zahtjevi ispitanika
9. „Čuvanje podataka”: dvije kartice. **Klase podataka**: sesije prijave, stanje uređivanja uživo, verzije rada, vrijeme pojedinih izmjena, zapis pristupa, sažeci i potvrde predaje; za svaku rok čuvanja i način („Probni prolaz” ili „Briše se”); „Rok još nije određen” gdje ga nema. **Ovdje se podaci samo prikazuju; nijedna radnja brisanja nije dostupna** (tekst stranice). **Pravna zadržavanja**: zaustavljaju brisanje za rad, studenta ili zadatak uz oznaku slučaja; zadržavanje koje je administrator sam postavio ne može sam skinuti (drugi administrator ili operater).
10. „Izvoz podataka studenta” (GDPR uvid/prenosivost): referada predaje zahtjev **nakon što je provjerila identitet uživo** (isprava biranjem iz popisa, oznaka provjere do 80 znakova, bez broja isprave), administrator odobrava, student dobiva **jednokratnu poveznicu** na javnoj stranici `/izvoz-podataka/[token]`; zahtjev ima rok isteka.
11. **Zahtjev za brisanje** i **ispravak** u izvatku **ne postoje** kao operacije; postoji samo pravno zadržavanje i klase s rokom (O-5). Student u dijelu 3 već vidi **dnevnik pristupa po radu** (`student.access-log.get`: tko je i kojom plohom čitao); **dnevnika pristupa na razini ustanove nema**.

### 1.5 Podrška, stanje sustava i obavijesti
12. **Prijava problema** iz bilo kojeg ekrana (`ProblemReportHelp`): kategorije tehnički, račun, kolegij, uz verziju aplikacije, preglednik, rutu i stanje sinkronizacije. **Tko prijave čita i kako odgovara, u izvatku nema** (postoji samo slanje) (O-8).
13. **Javna stranica stanja** (`/stanje`): tri komponente (pisanje, predaja, pregled mentora) i prozori održavanja (`maintenanceWindows`). Postoji kao čitanje; **tko upisuje prozor održavanja ili obavijest o prekidu, u izvatku nema** (O-9).
14. **Mjerila pilota** (`ops.pilot-metrics.get`): zbirni brojevi (zabilježene predaje, izdane potvrde, predaje bez potvrde, zahtjevi za pomoć, prijave problema sa spremanjem, medijan i 95. percentil vremena do potvrde), uz skrivanje skupina ispod praga 5. Komponenta postoji, ruta ne (O-1).

### 1.6 Kraj: odjava i zatvaranje
15. Odjava jedne i svih sesija (`logout`, `logout-all`), odjava s AAI@EduHr strane (`backchannel-logout`). Nakon kraja pilota: brisanje po klasama i rokovima; **radnja brisanja iz sučelja nije dostupna**, pa bi se izvodila izvan sučelja (O-5).

---

## 2. Gdje zapinje

Oznake O-n; „provjeriti u pregledniku” = izvedeno iz koda, nije potvrđeno klikom.

### 2.1 Koraci i stanja
- **O-1 Operater nema zaslon.** Uloga `network_engineer` nema ljusku, a komponenta mjerila pilota nije u popisu stranica (`PAGES` u `routes.ts`). Posljedica: operater se prijavi i dobije „Račun bez uloge”, što je za operatera pogrešno i zbunjujuće. Dohvatljivo kroz: prijava računa s ulogom operatera. Provjeriti u pregledniku. Zahtijeva ili novi shell za ulogu (prototip ga nema) ili odluku da operater radi samo kroz poslužiteljske alate.
- **O-2 Pragovi, pravila i čuvanje su tri odvojene stranice bez zajedničkog „Postavke fakulteta”.** Administrator mora znati da „pravilo” za AI, „prag” za podrijetlo i „čuvanje” žive na različitim mjestima; „obrasci fakulteta” (izjava, suglasnost mentora) su po dijelu 6 unutar Ducture, ali **nema vidljivog mjesta gdje ih administrator pregledava** kao popis verzija obrasca (OD-11: obrazac je verzionirana datoteka u `config/faculties`, ne ekran).
- **O-3 Nema uvoza iz ISVU-a/Merlina.** Popis studenata i nastavnika danas nastaje **upisom kodom** i potvrdom uloga. Za pilot s malim brojem kolegija izdržljivo; za stvarni fakultet ručno. Ne izmišljati ISVU sučelje: postoji li uopće izvoz iz ISVU-a prema Ducturi, ne zna se (za orkestratora).
- **O-4 Operacije bez vidljivog ekrana ili s nejasnim stanjem.** Za uklanjanje studenta s kolegija, povratak studenta, kod za upis (generiranje, stanje, opoziv), dodjelu grupa i tim kolegija ugovor postoji; u pregledanim mapama `institution/` vidljivi su pregled, korisnici, kolegiji i pravila, ne svaka od tih radnji. **Provjeriti u pregledniku** prije nego što se išta tvrdi „nedostaje”: moguće je da su u drugim mapama (`teacher/`) jer ih nastavnik koristi.
- **O-5 Čuvanje je samo prikaz; nema brisanja ni zahtjeva za brisanje.** Student koji traži brisanje ili ispravak nema kanal u aplikaciji; administrator nema radnju. Tekst „nijedna radnja brisanja nije dostupna” je poštena izjava, ali to znači da se GDPR zahtjev za brisanje u pilotu rješava **izvan aplikacije**. Treba odluku vlasnika i pravno mišljenje (DPIA), ne novi ekran.
- **O-6 Akademska godina se samo čita.** Početak nove godine (kolegiji, upisi, rokovi) nema zaslon ni operaciju u izvatku.
- **O-7 Nema dnevnika pristupa i revizije za administratore.** Postoji dnevnik pristupa **po radu za studenta** i zapis pristupa kao klasa čuvanja. Tko je od administratora/operatera promijenio ulogu, pravilo, prag ili zadržavanje, **vidljivo je samo posredno** (verzije pravila i zadržavanja imaju postavljača i vrijeme; za uloge i pragove provjeriti). Pregled „tko je što promijenio” nije ekran.
- **O-8 Podrška je jednosmjerna.** Prijava problema se šalje; ne vidi se stanje prijave ni odgovor, a nema popisa prijava za administratora/operatera u izvatku. Student ne zna je li prijava stigla osim potvrde pri slanju.
- **O-9 Stanje sustava je čitanje bez izvora.** Prozori održavanja i obavijest o prekidu postoje kao podatak; nema ekrana ni operacije za upis, pa tko obavještava studente o prekidu, nije riješeno.
- **O-10 Postavke asistenta na razini fakulteta nisu ekran.** Uključenost i ograničenja asistenta po zadatku bira nastavnik (dio 4); **prekidač na razini fakulteta je konstanta u konfiguraciji** (OC-1), a prototipska kartica „Tko osigurava AI” (fak, duc, own, sub, kvota) izričito je radi prototipa. Administrator ne vidi, **ni gdje je asistent isključen ni zašto**.

### 2.2 Pristupačnost
Gotovo sve su tablice i obrasci iz `@ductura/ui`; mjerila pilota donose i grafikon uz tablicu, što je dobro (tablica je istovjetna alternativa grafikonu). Za provjeriti u pregledniku:
- **Tablice s dugim popisima** (kolegiji, studenti, zahtjevi za izvoz): naslov tablice, zaglavlja redaka i stranice popisa; čitač zaslona mora čuti „Klase podataka, rokovi i način čuvanja” kao naslov tablice (postoji `caption`).
- **Razlika pravila (prije/poslije):** boja ne smije biti jedina oznaka promjene; stupci „Polje/Prije/Poslije” to pokrivaju tekstom.
- **Potvrde opasnih radnji** (povlačenje uloge, opoziv koda, uklanjanje studenta, postavljanje zadržavanja): dijalog s fokusom na bezopasnoj radnji i povratkom fokusa; **odabir isprave** i polje „oznaka provjere” moraju imati vezane poruke grešaka.
- **Javna stranica jednokratnog izvoza i stanja:** moraju raditi bez prijave i bez skripti koje čitač ne vidi; stanje se ne smije prenositi samo bojom (zeleno/crveno), nego riječju („Radi”, „Ne radi”).

### 2.3 Mobitel
Administracija je radna površina; za pilot nije cilj. Ipak: **provjera stanja sustava i odobrenje izvoza** su radnje koje administrator može poželjeti obaviti s mobitela. Tablice moraju imati vodoravni pomak ili kartični oblik, bez skrivanja stupca „Rok” i „Način” u klasama podataka. Provjeriti u pregledniku na 360 px. Tekst „Pošalji zahtjev” za izvoz ne smije se slati dvaput zbog sporog odgovora (gumb pokazuje „Šaljem zahtjev…”).

### 2.4 Greške i oporavak
- Ugovorene greške imaju tekst iz kataloga, ne sirov kod: „Prijava nije valjana”, „… vidi i mijenja samo administrator ustanove”, „Podaci trenutačno nisu dostupni. Ništa nije promijenjeno; pokušajte ponovno”, „stale” za zastarjelo stanje. To je dobar obrazac i **treba ga zadržati kao pravilo za sve nove zaslone ovog dijela**.
- **Pogreška istodobnog uređivanja** (dva administratora): pravila imaju osnovnu verziju (`basedOnVersionNo`) i poruku nakon konflikta; za uloge i zadržavanja osigurati isto: ponovno učitaj prije ponovne radnje.
- **Istek sesije u dugoj radnji** („Prijava je istekla. Prijavite se ponovno.”): povratak na istu stranicu nakon AAI@EduHr prijave postoji (`returnTo`); provjeriti da se ne gubi nespremljen obrazac (nacrt nove verzije pravila).
- **Greška izvoza**: zahtjev je zapisan prije odobrenja; ako odobrenje padne, administrator mora vidjeti stanje zahtjeva, ne ponovno podnositi novi (dvostruki zahtjevi za istog studenta). Provjeriti u pregledniku.
- **Nepovratnost**: povlačenje uloge nastavniku koji ima mentorstva i zadatke: što se događa s njegovim kolegijima? Ugovor je ne objašnjava. **Za orkestratora** (poslužiteljsko ponašanje), ne nagađati.

---

## 3. Slični alati, pilot, privatnost, sigurnost i pravičnost

### 3.1 Što nude slični alati (opisno, bez kopiranja izgleda)
Opisno, iz općeg poznavanja; nije provjereno uživo:
- **Sustavi za učenje** (tipa Moodle i srodni): administrator ima središnje korisnike, uloge i kolegije, uvoz iz matične evidencije (CSV ili sinkronizacija), postavke po instanci, dnevnike događaja i zasebne alate za zahtjeve za izvoz i brisanje osobnih podataka. Najčešća pritužba: previše postavki na jednom mjestu.
- **Alati za provjeru izvornosti i pisanja** (tipa Turnitin i srodni): administrator postavlja pravila ustanove, upravlja licencijama i kvotama, a **izvješća o korištenju su zbirna**, ne po osobi. Ustanove često traže bilješku o mogućim lažnim pozitivima uz svaki prikaz.
- **Alati za nadzor ispita**: često dnevnik događaja po studentu; to je upravo ono što Ductura **ne** radi i ne smije graditi.
- **Statusne stranice servisa**: javna stranica sa stanjem komponenti, najavljenim održavanjem i poviješću incidenata. Naučeno: obavijest o prekidu mora doći **prije** nego korisnik naiđe na pogrešku, a ne samo kao stranica koju treba tražiti.
- **Službenik za zaštitu podataka na fakultetu**: obično ima poseban ekran za zahtjeve ispitanika s rokom (u pravilu 30 dana) i evidencijom odgovora.

### 3.2 Što traže pilot, privatnost (GDPR, DPIA), sigurnost i pravičnost
- **Pilot:** administrator mora moći **bez programera** upisati kolegij, potvrditi nastavnika, objaviti pravilo i dati studentu uvid u njegove podatke. Današnji tok (upis kodom, potvrda uloge, pravila s verzijama, jednokratni izvoz) to pokriva za manji pilot; **ručno upisivanje većeg broja ljudi** (O-3) i **kanal za brisanje** (O-5) su najslabije točke.
- **Privatnost (GDPR):** uvid i prenosivost postoje (izvoz s provjerom identiteta uživo, odobrenje, jednokratna poveznica, rok). **Brisanje i ispravak nemaju kanal** u aplikaciji. Rokovi čuvanja po klasi su vidljivi, ali „Rok još nije određen” za neke klase znači da pilot kreće bez odluke; **to je pravno pitanje (DPIA), ne ekran**. Administratorski i operaterski pristup mora biti **najmanje potreban** i dnevnik radnji treba biti dostupan (O-7). Operater **ne smije vidjeti sadržaj radova ni po osobi identificirane zbirke** (P-D6: mjerila bez identiteta, s pragom skrivanja 5); to je već ugrađeno.
- **Sigurnost:** pojedinosti se ne opisuju. Za orkestratora, privatno: provjera da ulogu operatera i administratora nitko ne može sam sebi dodijeliti, da jednokratne poveznice izvoza istječu i da pravno zadržavanje ne zaobilazi vlastiti postavljač. U ovom dokumentu nema opisa slabosti.
- **Pravičnost:** administrator **ne smije** moći „rangirati” studente ni nastavnike zbirnim prikazom; **zbirna mjerila ostaju bez imena i bez oznaka „za pregled”**. Postavke asistenta na razini fakulteta ne smiju stvoriti dva razreda studenata (fakultet isključi asistenta, studentu A radi, studentu B ne): pravilo mora biti vidljivo i jedno po vrsti rada.
- **AI na razini fakulteta:** pružatelj i model se ne imenuju (Q-10); ekran smije pokazati **samo je li asistent uključen i što pravila dopuštaju**, ne tko ga isporučuje.

---

## 4. Numerirani prijedlozi

Veličina: S (do ~1 dana), M (2 do 5 dana), L (preko tjedna). „Server” = treba li novo polje; „Prototip” = dodiruje li prototip. Svi prijedlozi su **prijedlozi**, ne odluke; za sve bez prototipa treba prvo skica ili izričita odluka vlasnika. Tehnička pitanja o poslužitelju su označena „za orkestratora”.

**OA-1 Zaslon i ruta za operatera (mjerila pilota).** Dodati rutu `/operater/mjerila` s postojećom komponentom `PilotMetrics`; ulogu `network_engineer` poslati tamo umjesto na „Račun bez uloge”.
- Opis: komponenta, čitanje i poruke već postoje; nedostaju ruta, uloga u ljusci i početna stranica uloge.
- Korist: operater vidi stanje pilota bez identiteta; rješava O-1.
- Veličina: S. Rizik: nizak; zajednička datoteka `routes.ts` i ljuska (traka VIZ-S1: ne dirati okvir bez zadatka orkestratora). Server: ne (`ops.pilot-metrics.get` postoji). Prototip: ne dodiruje (nema ga); treba skicu.

**OA-2 Početna stranica „Postavke fakulteta” (jedno mjesto, tri kartice).** Poveznice na pravila, pragove, čuvanje podataka i „obrasce fakulteta” (samo čitanje).
- Opis: administrator vidi koje je pravilo na snazi, kad je zadnji put promijenjeno i tko je postavio.
- Korist: O-2; manje zalutalih administratora. Veličina: S. Rizik: nizak. Server: ne za pravila (`faculty-rules.get`, `config.get`), **za obrasce fakulteta treba provjeriti** (OD-11: datoteka u konfiguraciji; za orkestratora). Prototip: ne.

**OA-3 Pregled radnji administratora i operatera („Dnevnik radnji”).** Samo za čitanje: vrijeme, uloga, vrsta radnje (uloga potvrđena/povučena, pravilo objavljeno, prag promijenjen, zadržavanje postavljeno/skinuto, izvoz zatražen/odobren), bez osobnih podataka studenata.
- Korist: O-7; revizija i povjerenje. Veličina: M. Rizik: srednji (osjetljiv zapis; sadržaj ne smije curiti). **Server: da**, nova operacija čitanja (za orkestratora; ne izmišljati polja: `at`, `actorRole`, `kind`, `subjectRef`, `outcome` samo kao prijedlog). Prototip: ne.

**OA-4 Zahtjev za brisanje ili ispravak podataka (ispitanik) s evidencijom.** Student u profilu podnosi zahtjev; administrator ga vidi s rokom i bilježi ishod; brisanje po klasi kad nema pravnog zadržavanja.
- Korist: GDPR, O-5. Veličina: L. Rizik: **visok** (nepovratno brisanje, pravno zadržavanje, DPIA). **Server: da** (zahtjev, stanja, ishod). Prototip: ne. **Ne graditi prije pravnog mišljenja i odluke vlasnika.** Preporuka: u pilotu postupak izvan aplikacije uz jasnu uputu u pomoći (vidi OA-5).

**OA-5 „Moja prava” u pomoći (statična uputa).** Kratka stranica koja kaže što student smije (uvid i izvoz kroz referadu, kome se javiti za brisanje i ispravak, koliko traje) bez nove funkcije.
- Korist: pokriva O-5 u pilotu bez servera. Veličina: S. Rizik: nizak (tekst mora proći pravni pregled i rječnik zabranjenih izraza). Server: ne. Prototip: ne dodiruje.

**OA-6 Stanje zahtjeva izvoza i sprečavanje dvostrukog zahtjeva.** Popis zahtjeva već postoji; dodati jasno stanje (čeka odobrenje, odobren, preuzet, istekao) i upozorenje „Za ovog studenta već postoji otvoren zahtjev”.
- Korist: manje grešaka i dvostrukih izvoza. Veličina: S. Rizik: nizak. Server: provjeriti jesu li sva stanja u `state` (za orkestratora). Prototip: ne.

**OA-7 Popis prijava problema za administratora i operatera.** Čitanje primljenih prijava (kategorija, ruta, verzija, stanje, datum), bez sadržaja izvan onoga što je student upisao.
- Korist: O-8; zatvara petlju podrške. Veličina: M. Rizik: srednji (opis može sadržavati osobne podatke; filtrirati i ograničiti pristup). **Server: da** (operacija čitanja i stanje „zaprimljeno/riješeno”; za orkestratora). Prototip: ne.

**OA-8 Obavijest o prekidu i prozor održavanja upisuje operater.** Operater upisuje prozor održavanja i poruku; student i nastavnik vide traku u aplikaciji **prije** prekida; javna stranica stanja ju prikazuje.
- Korist: O-9. Veličina: M. Rizik: srednji (lažna obavijest; samo operater). **Server: da** za upis (čitanje postoji u `platform.status.get`; za orkestratora). Prototip: ne. Obavijest samo u aplikaciji, kao odluka 2147.

**OA-9 Prikaz postavki asistenta na razini fakulteta (samo čitanje).** Administrator vidi je li asistent uključen za fakultet, koje uporabe pravila dopuštaju po vrsti rada, i da student vidi isto; **bez imenovanja pružatelja i modela**, bez promjene s ekrana (OC-1).
- Korist: O-10; pravičnost. Veličina: S. Rizik: nizak. Server: pravila po vrsti rada već postoje (`faculty-rules`); prekidač fakulteta je konstanta, pa **polje „asistent uključen na fakultetu” treba izložiti za čitanje** (za orkestratora; ne izmišljati ga). Prototip: kartica „Tko osigurava AI” je samo radi prototipa; **ne preuzimati kvotu 50/100/200 ni kvačice pružatelja**.

**OA-10 Uvoz popisa studenata iz Merlina/ISVU-a (CSV) uz pregled prije potvrde.** Administrator učitava popis; Ductura pokazuje što će se dogoditi (novi, već upisani, neodgovarajući) i tek na potvrdu upisuje.
- Korist: O-3; manje ručnog posla. Veličina: L. Rizik: visok (točnost identiteta, privatnost, stvarni podaci u testovima zabranjeni; jedino izmišljeni). **Server: da** (nema operacije; za orkestratora, ne izmišljati format datoteke). Prototip: ne. Preporuka: nakon pilota, osim ako Daniel potvrdi da fakultet ne može ručno.

**OA-11 Pokretanje akademske godine („Nova akademska godina”).** Čarobnjak: nova godina, preuzimanje strukture kolegija (bez studenata i radova), rokovi.
- Korist: O-6. Veličina: L. Rizik: srednji. **Server: da** (nema operacije). Prototip: ne. Preporuka: nakon pilota.

**OA-12 Ujednačen obrazac za sve nove zaslone administracije (okvir, ne izgled).** Svaki zaslon: naslov, jedna rečenica svrhe, tablica ili obrazac iz `@ductura/ui`, stanja prazno/učitavanje/greška, potvrda opasne radnje dijalogom, poruke iz kataloga (nikad sirovi kodovi), „Pokušaj ponovno”, bez izuma stila.
- Korist: dosljednost i pristupačnost (§2.2, §2.4). Veličina: S. Rizik: nizak. Server: ne. Prototip: ne dodiruje; vizualni smjer „papir i grafit” bez vlastitih boja i fontova.

---

## 5. Tablica za Danielovu odluku

Preporuka: **za pilot** = potrebno da pilot bude vjerodostojan i pravno čist; **nakon pilota** = vrijedno, ali traži server, pravno mišljenje ili preveliko je za rok 15. 1. 2027.; **ne** = ne raditi.

| Prijedlog | Veličina | Preporuka | Razlog (kratko) |
|---|---|---|---|
| OA-1 Zaslon operatera (mjerila pilota) | S | **za pilot** | Komponenta je gotova, nedostaje ruta; operater danas dobiva „Račun bez uloge”. |
| OA-2 Početna „Postavke fakulteta” | S | **za pilot** | Bez servera, smanjuje zbunjenost administratora. |
| OA-3 Dnevnik radnji administratora | M | **nakon pilota** (osim ako pravni pregled traži za pilot) | Treba server i pažljivu privatnost; u pilotu je dovoljna povijest verzija pravila. |
| OA-4 Zahtjev za brisanje/ispravak | L | **nakon pilota** | Pravno i DPIA; nepovratno; u pilotu postupak izvan aplikacije (OA-5). |
| OA-5 „Moja prava” (statična uputa) | S | **za pilot** | Pokriva GDPR uputu bez servera. |
| OA-6 Stanje zahtjeva izvoza, bez duplikata | S | **za pilot** | Mali, smanjuje greške u već gotovoj funkciji. |
| OA-7 Popis prijava problema | M | **za pilot** | Pilot bez povratne informacije o podršci ne uči; server dopunu otvara orkestrator. |
| OA-8 Obavijest o prekidu (upisuje operater) | M | **nakon pilota** | Treba server; u pilotu dovoljna je javna stranica stanja i obavijest ručno. |
| OA-9 Prikaz postavki asistenta na fakultetu | S | **za pilot** | Pravičnost; samo čitanje; bez pružatelja i modela. |
| OA-10 Uvoz iz Merlina/ISVU-a | L | **nakon pilota** | Veliko, visok rizik; pilot s upisom kodom. |
| OA-11 Nova akademska godina | L | **nakon pilota** | Nije potrebno za jedan semestar pilota. |
| OA-12 Obrazac zaslona administracije | S | **za pilot** | Okvir za sve gore; bez izgleda. |

Ništa nije preporučeno „ne”, ali se **ne treba graditi**: kvota 50/100/200 i kvačice pružatelja iz prototipa (OA-9), nadzor po osobi, rangiranje studenata ili nastavnika te bilo kakvo imenovanje pružatelja ili modela.

### Pitanja za Daniela (najviše 8, kratka)

1. **Operater:** treba li operater imati zaslon u aplikaciji (OA-1) ili radi samo kroz poslužiteljske alate, a `network_engineer` je tehnička uloga? *(za orkestratora: što `network_engineer` smije prema RLS-u?)*
2. **Brisanje i ispravak:** potvrđuješ li da se u pilotu to rješava izvan aplikacije uz uputu „Moja prava” (OA-5), a ekran dolazi nakon pravnog mišljenja i DPIA?
3. **Uvoz popisa:** zadovoljava li pilot upis kodom i potvrda uloga, ili fakultet traži CSV uvoz već u pilotu (OA-10)?
4. **Dnevnik radnji administratora (OA-3):** traži li ga pravni pregled za pilot ili ostaje za poslije?
5. **Rokovi čuvanja:** tko određuje rok za klase gdje piše „Rok još nije određen”, i prije početka pilota?
6. **Asistent na razini fakulteta:** ostaje li prekidač samo u konfiguraciji (OC-1), a administrator ga samo vidi (OA-9)?
7. **Obavijest o prekidu:** je li dovoljna javna stranica stanja i ručna obavijest u pilotu, ili treba da operater upisuje poruku (OA-8)? *(za orkestratora: tko smije pisati `maintenanceWindows`?)*
8. **Prijave problema:** tko ih u pilotu čita i odgovara (OA-7), i je li dovoljan jedan komentar „zaprimljeno/riješeno”? *(za orkestratora: operacija čitanja i stanja prijava u izvatku ne postoji.)*

---

## Provedba u prototipu (23. 11. 2026.)

Daniel je 23. 11. 2026. odlučio za pilot: OA-1, OA-2, OA-3, OA-5, OA-6, OA-7, OA-9, OA-10, OA-12; nakon pilota OA-4, OA-8, OA-11. Napravljen je statični prototip `docs/prototip/Ductura_administracija.html` (kartice: `Ductura_administracija_kartice.html`, inventar: `INVENTAR-administracija.md`). Ekrani za uloge operater (`network_engineer`) i administrator fakulteta (`institution_admin`), izmišljeni podaci, stanja puno, prazno, učitavanje, greška.

| OA | INVENTAR ID | Element u prototipu |
|---|---|---|
| OA-1 | NF7-OA1 | ekran `mjerila`, `data-nf7="OA-1"` |
| OA-2 | NF7-OA2 | ekran `postavke` (uključuje „Čuvanje podataka”: „Rok još nije određen (čeka odluku)”) |
| OA-3 | NF7-OA3 | ekran `dnevnik` |
| OA-5 | NF7-OA5 | ekran `prava`, oznaka „čeka pravni pregled” |
| OA-6 | NF7-OA6 | ekran `izvoz`, stanje „dupli zahtjev” |
| OA-7 | NF7-OA7 | ekran `prijave` (kategorija, usmjerenje, zaprimljeno/riješeno) |
| OA-9 | NF7-OA9 | ekran `asistent` (samo čitanje) |
| OA-10 | NF7-OA10 | ekran `uvoz` (pregled prije potvrde, dijalog potvrde, upis kodom ostaje) |
| OA-12 | NF7-OA12 | zajednički obrazac: `head`, `sideState`, `empty`, `table` u prototipu |

Provjereno: axe bez nalaza na 390 i 1280 px, svijetla i tamna tema, obje uloge, sva stanja svih ekrana (i kartice); tipkovnica: dijalog potvrde zatvara se tipkom Escape, fokus je zarobljen; skener zabranjenih izraza (`findForbiddenTerms`, hr) bez nalaza nad tekstom prototipa i kartica.
