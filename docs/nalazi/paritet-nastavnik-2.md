# Ponovna revizija pariteta funkcija prototip ↔ aplikacija: uloga nastavnik (PAR2-N)

Datum: 23. 11. 2026. Baza: `migracija/kopija-ductus-front` (nakon VIZ-S1..S4b, E1..E4, N1..N6 i WEB-21xx). Docs-only: kod aplikacije nije mijenjan. Zadatak: PAR2-N `paritet2-nastavnik` (Ductus#2055).

Izvor istine: `docs/prototip/INVENTAR-nastavnik.md`, `Ductura_nastavnik.html`, `Ductura_nastavnik_kartice.html`, `ODGOVORI-DANIEL-2026-11-19.md`. Polazište je stara revizija `docs/nalazi/paritet-nastavnik.md` (PR #343, grana `migracija/wparitet-nast-revizija`, 267 stanja). Za svaku njezinu stavku utvrđeno je stanje danas; ocjenjuje se funkcija, sadržaj, tekst, stanje ekrana i dohvatljivost u hostu `packages/app/src/host`, ne boja ni razmak (to je VIZ).

## Metoda i dokaz

- Čitanje koda hosta, komponenti i testova (e2e `teacher-work.spec.ts` i srodni), po skupinama ekrana (četiri neovisna prolaza, A do D).
- **Provjera u izvođenju:** host je izgrađen (`next build`) i pokrenut s lažnim poslužiteljem scenarija VIZ „puno” (`e2e/viz`, 1280 px); ispis teksta 19 nastavničkih ruta pregledan je uz kod. Retci potvrđeni ispisom označeni su „izvođenje”. Ostalo stoji na kodu i testovima.
- **Ograničenje dokaza:** u scenariju „puno” nastavnički ekrani rada (rad, predaja, sažetak, reprodukcija, usporedba, konzultacije, priprema razgovora) prikazuju samo „Pristup radu trenutačno nije moguće provjeriti”, jer lažni poslužitelj nema `teacher.access.get`. To nije nedostatak aplikacije, ali znači da za te ekrane nema potvrde izvođenjem. Preporuka: proširiti scenarij VIZ „puno” čitanjima rada (zasebni mali zadatak).
- Pristupna imena i izmišljeni podaci: samo `demo-*` i izmišljeni tekstovi.

## Sažetak (brojke)

Stanja: **280** (267 starih + 13 novih). Ocjena danas:

| Ocjena | Broj |
|---|---|
| postoji | 197 |
| odstupa | 62 |
| nedostaje | 14 |
| odgođeno po planu | 5 |
| informativno (bez ocjene) | 2 |

Stara revizija: 54 postoji, 142 odstupa, 70 nedostaje, 1 odgođeno. Napredak je velik: većina tekstova i ekrana koji su tada nedostajali sada postoji.

Po ekranu (samo stari retci i novi retci zajedno, ocjena danas):

| Ekran | postoji | odstupa | nedostaje | odgođeno |
|---|---|---|---|---|
| ljuska | 9 | 2 | 0 | 0 |
| dk-h | 5 | 0 | 0 | 0 |
| do-h | 4 | 2 | 0 | 0 |
| dd-h | 7 | 0 | 0 | 0 |
| ch-h | 0 | 2 | 0 | 0 |
| N-01 | 13 | 3 | 0 | 0 |
| N-02/N-03 | 11 | 4 | 2 | 3 |
| N-04 | 6 | 2 | 1 | 0 |
| N-05 | 9 | 3 | 0 | 0 |
| N-16 | 7 | 3 | 0 | 0 |
| N-17 | 6 | 5 | 1 | 0 |
| N-06 | 15 | 14 | 2 | 0 |
| N-07 | 15 | 7 | 0 | 1 |
| N-08 | 8 | 1 | 0 | 0 |
| N-09 | 11 | 5 | 1 | 0 |
| N-10 | 20 | 1 | 4 | 1 |
| N-11 | 5 | 2 | 1 | 0 |
| N-12 | 18 | 1 | 1 | 0 |
| N-13 | 13 | 3 | 0 | 0 |
| N-18 | 14 | 2 | 0 | 0 |

(Redak „N-09/10/11” u dijelu C: 1 postoji, 1 nedostaje, ne ulazi u gornje zbrojeve po ekranu.)

### Glavni zaključci

1. **Svi ekrani iz prototipa sada postoje u hostu:** N-04 popis studenata, N-05 brz put, N-11 usporedba, N-12, N-13, N-18 (Merlin), sažetak N-10 kao zasebna stranica s kartom podrijetla; dijalozi dk-h, do-h, dd-h postoje. Stare tvrdnje „PendingPage”, „nema rute u hostu” i „nema ulaza” više ne vrijede.
2. **Dohvatljivost (izvođenje):** brz put se otvara bez `?zadatak=` pa uvijek piše „Odaberite zadatak u svojim kolegijima”; gumb „Dodaj zadatak” na praznom Zbirnom vodi na rutu koje nema.
3. **Okvir rada nije spojen s podacima:** `WorkFrame` ne dobiva `deadlinePassed` ni `started`, pa su banner „nije predano” (i ulaz u produljenje iz rada) i „rad nije započet” nedohvatljivi; naslov zadatka, vrsta i kolegij u zaglavlju rada nedostaju.
4. **Podaci koje poslužitelj ne daje:** razlog odbijanja mentorstva student ne vidi (odluka 22. 11. nije provedena), izjava o AI-ju na predaji ima prazne razgovore i prijenose (ch-h se ne može otvoriti), karta podrijetla nema označeni tekst rada, reprodukcija nema sesija, „Napomene studenta” nastavnik ne vidi, Zbirni/N-04 nemaju poveznicu na rad, vrijeme/verziju i dorade.
5. **Odluke 22. 11. nisu do kraja provedene:** obrazac zadatka ne šalje grupe, vanjske alate ni „samo sažimanje” iako ih ugovor ima; objava zadatka i odobravanje/odbijanje mentorstva nemaju toast 3200 ms tek nakon potvrde poslužitelja; dva dijaloga za doradu (novi na radu, stari „Vrati rad na doradu” na predaji).
6. **Usporedba (N-11) radi po blokovima, ne riječ po riječ;** navodi, mjesta za izvor i fusnote crtaju se samo kad dijeljeni čitač teksta zakaže; prijedlozi teksta (del/ins) samo u bočnom panelu.

## Tablice po skupinama ekrana

Oznake ocjene: postoji, odstupa, nedostaje, odgođeno po planu. „Stara ocjena = novo” znači stanje koje stara revizija nije imala. Stupac „Odluka”/„Vlasnik” označava stavku koja traži vlasnikovu odluku.


### Dio A: Ljuska, dijalozi dk-h/do-h/dd-h/ch-h, N-01 do N-05, N-16, N-17

Stanje koda: grana migracija/wpar2n-paritet2-nastavnik, 23. 11. 2026. "izvođenje" = potvrđeno ispisom u scratchpad/probe/*.txt (host + lažni poslužitelj, scenarij puno). Ostalo je potvrđeno kodom. Kratice putanja: HT = packages/app/src/host/teacher, UI = packages/ui/src/components. Stupac "Odluka" = traži vlasnikovu odluku (— ako ne).

#### 1. Tablica

| Oznaka | Ekran | Stanje | Stara ocjena | Ocjena danas | Implementacija (datoteka:redak) | Napomena (što točno) | Odluka |
|---|---|---|---|---|---|---|---|
| ljuska | Zajednička ljuska | Navigacija s 4 stavke | postoji | postoji | src/components/shell/nav.ts:19-28; UI/side-shell/SideShell.tsx:118-120 | Moji kolegiji, Brz put, Radovi uz mentora, Zbirni; `aria-current`. Izvođenje potvrđeno. | — |
| ljuska | Zajednička ljuska | Natpis „Zbirni” | odstupa | postoji | HT/shell/messages.hr.ts:5; shell/messages.ts:11-14 | Natpis „Zbirni” samo za nastavnika (izvođenje: „Zbirni”). | — |
| ljuska | Zajednička ljuska | Marka „D” vodi na početnu | postoji | postoji | SideShell.tsx:109-112; nav.ts homeHref | Znak „D”, vodi na /nastavnik. | — |
| ljuska | Zajednička ljuska | Gumb „Izbornik” ispod 800 px | odstupa | postoji | SideShell.tsx:113-115; HT/shell/messages.hr.ts:7 | Tekstni gumb „Izbornik”, `aria-expanded`, Esc zatvara. | — |
| ljuska | Zajednička ljuska | Tema | postoji | postoji | SideShell.tsx:55-61,132 | Gumb ◐ u podnožju, kao prototip. | — |
| ljuska | Zajednička ljuska | Odjava | postoji | postoji | packages/app/src/host/SignOut.tsx:24-60 | Dijalog potvrde, auth.logout.post pa AAI odjava i povratak na „/” (A-6 „oboje”). Dodano „Postavke profila” (izvođenje). | — |
| ljuska | Zajednička ljuska | Odjava ne uspije | postoji | postoji | SignOut.tsx:47 | Greška u dijalogu, ponuda ponovnog pokušaja. | — |
| ljuska | Zajednička ljuska | `main#sadrzaj` | postoji | postoji | SideShell.tsx:141 | `tabIndex=-1`. | — |
| ljuska | Zajednička ljuska | Std stanje: učitavanje | odstupa | odstupa | HT/shell/TeacherPage.tsx:36-47; HT/n05/FastPathPage.tsx:37-39 | Tekst po ekranu i kosturi postoje (kolegiji, mentorstva, zbirni, N-04). Brz put ne prosljeđuje `loading`, pa piše opći „Učitavanje…” umjesto „Učitavanje radova…” (poruka t.loading postoji, n05/messages.hr.ts:6, neiskorištena). | — |
| ljuska | Zajednička ljuska | Std stanje: greška + „Pokušaj ponovno” | postoji | postoji | TeacherPage.tsx:60-70 | `role=alert` i gumb. | — |
| ljuska | Zajednička ljuska | Toast 3200 ms | nedostaje | odstupa | UI/toast-queue.ts:11; HT/toast/TeacherToast.tsx; outcome-toast.ts:4-33 | Komponenta i pravilo „tek nakon potvrde” postoje; koriste ga kod izdan (N-01), dorada, N-12, kopiranje otiska, prijedlozi. NE koristi ga objava zadatka, odobri/odbij mentorstvo: `teacherToastHr.published/mentorshipApproved/mentorshipDeclined*` (toast/messages.hr.ts:7-11) nigdje se ne poziva. | — |
| dijalog dk-h | Izdati novi kod za upis? | Otvaranje iz kartice | nedostaje | postoji | HT/assignment-card/AssignmentCards.tsx:133,137-144 | „Novi kod za upis” samo za nositelja (izvođenje potvrđeno). | — |
| dijalog dk-h | Izdati novi kod za upis? | Naslov i objašnjenje | odstupa | postoji | assignment-card/messages.hr.ts:38-39 | Doslovan prototipni tekst. | — |
| dijalog dk-h | Izdati novi kod za upis? | Gumbi „Izdaj novi kod” / „Odustani” | odstupa | postoji | AssignmentCards.tsx:139-142 | Isti natpisi; rok koda zadan automatski (defaultValidUntil), polje nije izloženo. | — |
| dijalog dk-h | Izdati novi kod za upis? | Ishod „Novi kod za upis je izdan.” | odstupa | postoji | AssignmentCards.tsx:95-99,168 | Toast 3200 ms tek nakon odgovora poslužitelja; kod u kartici (`.code-once`, :120-125). | — |
| dijalog dk-h | Izdati novi kod za upis? | Fokus i Escape | postoji | postoji | UI/Dialog.tsx | — | — |
| dijalog do-h | Odbiti zahtjev za mentorstvo? | Otvaranje „Odbij” | postoji | postoji | HT/n16/RequestsCard.tsx:70-73 | — | — |
| dijalog do-h | Odbiti zahtjev za mentorstvo? | Naslov | postoji | postoji | src/lib/i18n/messages.hr.ts:768 | — | — |
| dijalog do-h | Odbiti zahtjev za mentorstvo? | Uvod i polje razloga | odstupa | odstupa | RequestsCard.tsx:88-90; messages.hr.ts:770-771 | Oznaka i pomoć doslovno prema prototipu („Student će vidjeti razlog”). Uvod: „ime · vrsta rada”, bez kolegija i teme (ugovor ih nema). NETOČNO OBEĆANJE: student ne vidi razlog; mentorship.student-requests.get ne vraća razlog, a studentska stranica ga izričito ne prikazuje (student/mentorship-request/MentorshipRequestPage.tsx:22). Odluka „student vidi razlog” nije provedena. | Ne (odluka postoji), treba server |
| dijalog do-h | Odbiti zahtjev za mentorstvo? | Gumbi „Odbij zahtjev” / „Odustani” | postoji | postoji | RequestsCard.tsx:82-85 | — | — |
| dijalog do-h | Odbiti zahtjev za mentorstvo? | Ishod (toast s/bez razloga) | odstupa | odstupa | src/components/teacher/MentorshipRequests.tsx:36; RequestsCard.tsx:55 | Tekstovi s/bez razloga postoje, ali kao `p role=status` iznad popisa, ne toast 3200 ms. Prikazuje se tek nakon poslužitelja. | — |
| dijalog do-h | Odbiti zahtjev za mentorstvo? | Fokus i Escape | postoji | postoji | UI/Dialog.tsx | — | — |
| dijalog dd-h | Zatražiti doradu? | Otvaranje (rad i predaja) | nedostaje | postoji | HT/revision/RevisionSection.tsx:99; HT/n06/WorkFrame.tsx:59; HT/n07/ReceiptPage.tsx:166 | Gumb „Zatraži doradu” samo za predan rad, na radu i na potvrdi predaje. Na predaji se dijalog otvara ondje, ne na radu (prototip: skok na rad). | — |
| dijalog dd-h | Zatražiti doradu? | Naslov, objašnjenje, gumbi | odstupa | postoji | HT/revision/messages.hr.ts:3-9 | „Zatražiti doradu?”, „Pošalji zahtjev”, „Odustani” doslovno. | — |
| dijalog dd-h | Zatražiti doradu? | #f-dd obavezno | odstupa | postoji | revision/messages.hr.ts:35; RevisionSection.tsx:125-130 | „Upišite što treba doraditi.” u dijalogu (`error`), ne toast; limit 2000. | — |
| dijalog dd-h | Zatražiti doradu? | Rok dorade obavezan | odstupa | postoji | revision/messages.hr.ts:36; RevisionSection.tsx:133 | DatePicker, bez zadane vrijednosti, vrijedi do 23:59; „Upišite rok za doradu.”, prošli datum odbijen (C-8). Ugovor je rok držao neobaveznim (`revisionDueAt?`), UI ga traži. | — |
| dijalog dd-h | Zatražiti doradu? | Slanje i uspjeh | nedostaje | postoji | HT/revision/port.ts:38 (work.return-for-revision.post); RevisionSection.tsx:97 | Toast „Zahtjev za doradu je poslan. Student ga vidi uz rad.” tek nakon 200. | — |
| dijalog ch-h | Razgovor n · datum | Dijalog razgovora | nedostaje | odstupa | HT/ai-declaration/AiDeclarationSection.tsx:73-85; HT/n07/ReceiptPage.tsx:163; src/client/declaration.ts:318 | Dijalog „Razgovor n · datum”, „Točno kako je zabilježen…”, „Zatvori” i panel izjave na potvrdi predaje postoje (testovi s lažnim portom). Stvarni port (readTeacher) uvijek vraća `conversations: []`, pa se dijalog u appu nikad ne može otvoriti; naslov bi uz stvarni podatak imao ISO datum (`confirmedAt` neformatiran, :73). | Ne, treba ugovor (razgovori u teacher.declaration.get) |
| N-01 | Moji kolegiji | Zaglavlje i opis | odstupa | postoji | assignment-card/messages.hr.ts:3-4 | Doslovan prototipni opis (godina 2026./2027. fiksno). Izvođenje. | — |
| N-01 | Moji kolegiji | Gumb „Novi kolegij i zadatak” | odstupa | postoji | AssignmentCards.tsx:54-58,156-162; pages.tsx:131 | Vodi na odabir postojećeg kolegija (A-7: kolegij izrađuje administrator); natpis zadržan. | Odluka A-7 već dana |
| N-01 | Moji kolegiji | Kartica: Uloga, Upisano, Kod za upis, Sljedeći rok | nedostaje | postoji | AssignmentCards.tsx:113-119; assignment-card/model.ts:11-49 | Izvođenje: „nositelj (Vi)”, „1 student · Grupa A”, stanje koda, „Sljedeći rok”. | — |
| N-01 | Moji kolegiji | „Popis studenata” | nedostaje | postoji | AssignmentCards.tsx:127 | Vodi na N-04. | — |
| N-01 | Moji kolegiji | „Dodaj zadatak” | odstupa | postoji | AssignmentCards.tsx:128 | Obrazac s unaprijed odabranim kolegijem; skriveno suradniku. | — |
| N-01 | Moji kolegiji | „Produljenje roka”, „Zbirni pregled”, „Izvoz za Merlin” | nedostaje | odstupa | AssignmentCards.tsx:129-132 | Sva tri postoje. Produljenje samo ako kolegij ima budući rok (nextDeadline), na taj zadatak; Merlin vodi samo na prvi zadatak kolegija; „Zbirni pregled” vodi na zbirni svih kolegija. Zadatak s prošlim rokom nema ulaz u produljenje. | — |
| N-01 | Moji kolegiji | „Novi kod za upis” | nedostaje | postoji | AssignmentCards.tsx:133 | Samo nositelj. | — |
| N-01 | Moji kolegiji | taskFacts „Otvorilo rad…” i „Zbroj…” | nedostaje | postoji | HT/assignment-facts/AssignmentFacts.tsx:50-51; messages.hr.ts:15-17 | Iz course-students + submissions + overview + extensions. U probi mock bez studenata: „Na ovom zadatku još nema upisanih studenata.” | — |
| N-01 | Moji kolegiji | subRows: „Otvori rad” / „Rad nije započet” | nedostaje | postoji | AssignmentFacts.tsx:52-61 | — | — |
| N-01 | Moji kolegiji | „Brz put kroz radove” | odstupa | odstupa | AssignmentFacts.tsx:88-90 | Poveznica na /nastavnik/brz-put BEZ `?zadatak=`; ekran Brz put tada piše samo „Odaberite zadatak u svojim kolegijima.” (izvođenje, brz-put.txt). Prikazuje se samo uz prvi zadatak kolegija. Slijepa ulica. | — |
| N-01 | Moji kolegiji | Kolegij B: suradnik | nedostaje | postoji | assignment-card/model.ts:11-14; AssignmentCards.tsx:108,116 | „suradnik”, „Izdaje nositelj kolegija.”, bez gumba za pisanje. | — |
| N-01 | Moji kolegiji | `.code-once` jednokratni kod | odstupa | postoji | AssignmentCards.tsx:120-125; messages.hr.ts:30 | Doslovan tekst. | — |
| N-01 | Moji kolegiji | prekinuto: banner i „Provjeri popis zadataka” | nedostaje | odstupa | HT/assignment-facts/AssignmentFacts.tsx:98-135; HT/publish/PublishDone.tsx:27-31 | Banner, gumb i toast postoje. Poveznica iz obrasca vodi na /nastavnik/kolegiji?objava=… a ta ruta radi `redirect()` bez query-ja (app/[base]/nastavnik/kolegiji/page.tsx:7-11), pa se banner vjerojatno nikad ne pojavi (potvrditi u pregledniku). | — |
| N-01 | Moji kolegiji | prazno | odstupa | postoji | assignment-card/messages.hr.ts:10-11 | Doslovno. | — |
| N-01 | Moji kolegiji | ucitavanje | odstupa | postoji | messages.hr.ts:5; TeacherPage.tsx:36-47 | „Učitavanje kolegija…” + kosturi. | — |
| N-01 | Moji kolegiji | greska + „Pokušaj ponovno” | odstupa | postoji | messages.hr.ts:7-8 | Doslovno. | — |
| N-02/N-03 | Novi zadatak | Odabir kolegija prije obrasca | odstupa | postoji | HT/assignment/new-assignment.tsx:36-45 | Popis kolegija ili `?kolegij=` (izvođenje: „Odaberi kolegij”); A-7. | Odluka A-7 već dana |
| N-02/N-03 | Novi zadatak | Jedan obrazac u odjeljcima zs-1..zs-4 | odstupa | postoji | HT/assignment-form/AssignmentForm.tsx:127-190 | Više nije čarobnjak; odluka 22. 11. provedena. Čarobnjak (assignment-wizard) uklonjen. | — |
| N-02/N-03 | Novi zadatak | zs-1 Osnovno | odstupa | postoji | AssignmentForm.tsx:135-143; assignment-form/messages.hr.ts:19 | „Naslov zadatka”, „Do 160 znakova.”, vrsta, opis; dodano „Probni zadatak (bez ocjene)” (nije u prototipu). | — |
| N-02/N-03 | Novi zadatak | zs-2 Rok i opseg | odstupa | postoji | AssignmentForm.tsx:145-155; messages.hr.ts:20-23 | Otvaranje, rok, najmanje/najviše riječi; `datetime-local` umjesto teksta. | — |
| N-02/N-03 | Novi zadatak | zs-2 Grupe | nedostaje | nedostaje | AssignmentForm.tsx:156-159; messages.hr.ts:26-29 | Onemogućena kvačica „svi upisani”, ne šalje se. Ugovor institution.course-assignments.post ima `groupIds?` (migration-contract-types.generated.ts:33), a čitanje grupa postoji (institution.course-groups.get). | — |
| N-02/N-03 | Novi zadatak | zs-3 AI pomoćnik (kolegij / samo sažimanje / ne) | odstupa | odstupa | AssignmentForm.tsx:164-171; messages.hr.ts:36 | Tri radio opcije, ali „Samo sažimanje” je onemogućena („trenutačno nedostupan”), a ugovor ima `aiSummaryOnly?`. Pravilo „samo suziti” poštuje se. | Možda: točno značenje „samo sažimanje” prema aiPurposes |
| N-02/N-03 | Novi zadatak | zs-3 Vanjski alati (da/ne) | nedostaje | nedostaje | AssignmentForm.tsx:172-174; messages.hr.ts:42 | Radio onemogućen, ne šalje se; ugovor ima `externalToolsAllowed?`. Dodatno polje „Dopušten uvoz” (ImportAllowedField) kojeg prototip nema. | — |
| N-02/N-03 | Novi zadatak | zs-4 Što se bilježi | odstupa | postoji | messages.hr.ts:47-58 | Pragovi P-01/P-02 i „Ne zna tko je tipkao.”; uvodna rečenica doslovno. | — |
| N-02/N-03 | Novi zadatak | Gumbi „Pregled i objava” / „Odustani” | odstupa | postoji | AssignmentForm.tsx:185-189 | + pomoć „Ovim gumbom ništa se ne objavljuje…”. | — |
| N-02/N-03 | Novi zadatak | pogreske: `#wz-err` | odstupa | postoji | AssignmentForm.tsx:131; form-checks.ts:14-30 | „Obrazac ima pogreške: …” fokusirano + greška uz polje. | — |
| N-02/N-03 | Novi zadatak | pregled: sažetak polja | odstupa | odstupa | AssignmentForm.tsx:94-106 | Kolegij, vrsta, naslov, vrsta rada, otvaranje, rok, opseg, grupe, AI, alati. Grupe uvijek „svi upisani studenti”, alati „nedostupno” (posljedica gornjih redaka). | — |
| N-02/N-03 | Novi zadatak | pregled: rečenica o obavijesti i produljenju | odstupa | postoji | HT/publish/messages.hr.ts:4 | „…obavijest o zadatku u aplikaciji. Rok se kasnije mijenja samo produljenjem…” (C-17, samo u aplikaciji). Je li obavijest stvarno stvorena na poslužitelju, nije provjereno u ovom dijelu. | Provjeriti server (obavijest pri objavi) |
| N-02/N-03 | Novi zadatak | pregled: „Objavi zadatak” / „Natrag na obrazac” | odstupa | postoji | AssignmentForm.tsx:117-118 | Doslovno. | — |
| N-02/N-03 | Novi zadatak | objava: toast i povratak na kolegije | odstupa | odstupa | HT/publish/PublishDone.tsx:13-21; publish/messages.hr.ts:12 | Prikaz `Notice` „Zadatak je objavljen. Upisani studenti vide ga u „Mojim zadacima”.” + poveznica „Na kolegije” (/nastavnik/kolegiji, preusmjerava). Nema toasta 3200 ms ni automatskog povratka; gotov tekst toasta u toast/messages.hr.ts:7 nije iskorišten. | — |
| N-02/N-03 | Novi zadatak | ucitavanje „Objava zadatka u tijeku…” | odstupa | odstupa | AssignmentForm.tsx:89-91; src/lib/i18n/messages.hr.ts:459 | Tekst je „Objavljivanje…”. | — |
| N-02/N-03 | Novi zadatak | greska objave | odstupa | postoji | HT/publish/publish-outcome.ts:14-16; messages.hr.ts:6 | „Zadatak nije objavljen: poslužitelj je odbio objavu. Uneseni podaci ostaju u obrascu.” + razlog; ključ zahtjeva sprječava dvostruki zadatak. | — |
| N-02/N-03 | Novi zadatak | prekinuto: ishod nije poznat | odstupa | postoji | AssignmentForm.tsx:110; PublishDone.tsx:24-34; publish/messages.hr.ts:8-10 | Banner + „Provjeri popis zadataka” + podaci ostaju (vidi N-01 prekinuto za problem s query-jem). | — |
| N-02/N-03 | Novi zadatak | prazno: novi kolegij (naziv, godina) | nedostaje | odgođeno po planu | — (src/components/teacher/course-create.ts neuvezen) | A-7: kolegij izrađuje administrator (ODGOVORI-DANIEL A-7). | — |
| N-02/N-03 | Novi zadatak | kolegij-stvoren: kod „KOL-C-3H8T” | nedostaje | odgođeno po planu | — | A-7. | — |
| N-02/N-03 | Novi zadatak | „Upišite naziv kolegija.” | nedostaje | odgođeno po planu | — | A-7. | — |
| N-04 | Popis studenata | ruta u hostu | nedostaje | postoji | packages/app/app/[base]/nastavnik/kolegiji/[courseId]/studenti/page.tsx:7-10; HT/n04/port.ts:23-58 | Pravi port nad teacher.course-students.get; izvođenje: popis, filtar, redci. | — |
| N-04 | Popis studenata | naslov „{Kolegij}: studenti” i opis | postoji | postoji | HT/n04/CourseStudents.tsx:40,46; n04/messages.hr.ts:5 | Opis postoji; naslov „Popis studenata” kad kolegij nije čitljiv (izvođenje). Dodan gumb „Zbirni pregled kolegija”. | — |
| N-04 | Popis studenata | filtar grupa | postoji | postoji | CourseStudents.tsx:57-62 | Izvođenje: „Svi (3)”, „Grupa A (1)”, „Grupa B (2)”. | — |
| N-04 | Popis studenata | redak studenta | odstupa | odstupa | CourseStudents.tsx:63-71; n04/port.ts:44-52 | Redak: „Zadatak: Predano.” Bez vremena predaje, roka, verzije i stanja zapisa: port ih ne puni (teacher.course-students.get daje samo workState). Podaci postoje u teacher.assignment-overview/submissions, što N-01 već spaja (assignment-facts/read.ts). U probi je naziv zadatka „Zadatak” (nedostaje course join). | — |
| N-04 | Popis studenata | „Otvori seminarski rad” | postoji | postoji | CourseStudents.tsx:72-77 | Samo za seminarski rad s dokumentom. | — |
| N-04 | Popis studenata | dorada „Čeka doradu, rok…” | nedostaje | nedostaje | n04/messages.hr.ts:33; CourseStudents.tsx:69; n04/port.ts:44-52 | Prikaz i model postoje, ali port nikad ne postavlja `revision`, pa se redak ne vidi nikad. | — |
| N-04 | Popis studenata | prazno | odstupa | odstupa | CourseStudents.tsx:49-54 | Tekst doslovan; „Izdaj novi kod” je poveznica na /nastavnik/kolegiji, ne otvara dijalog dk-h. | — |
| N-04 | Popis studenata | ucitavanje | postoji | postoji | n04/messages.hr.ts:11 | — | — |
| N-04 | Popis studenata | greska | odstupa | postoji | TeacherPage.tsx:60-70 | Gumb „Pokušaj ponovno”. | — |
| N-16 | Radovi uz mentora | popis radova | odstupa | odstupa | HT/n16/WorksList.tsx:28-40; src/components/teacher/mentored-works-view.ts | Ime, „vrsta „naslov”. stanje.”, „Otvori rad”; abecedno, napomena. Bez kolegija, vremena predaje i verzije (teacher.mentorships.get ih ne daje). | Ne, treba server |
| N-16 | Radovi uz mentora | zaglavlje i opis | odstupa | postoji | locales/hr.ts:719-720; MentorshipsPage.tsx:49-50 | Doslovno (izvođenje). | — |
| N-16 | Radovi uz mentora | kartica „Zahtjevi” (zm-h): redak | odstupa | odstupa | RequestsCard.tsx:56-65 | Ime, „vrsta · Zahtjev poslan {datum}”; bez kolegija i teme. Ugovor teacher.mentorship-requests.get postoji. | — |
| N-16 | Radovi uz mentora | „Odobri”: toast | odstupa | odstupa | RequestsCard.tsx:55,66-69; MentorshipRequests.tsx:36 | Inline `status` umjesto toasta; popis se ponovno čita. | — |
| N-16 | Radovi uz mentora | „Odbij” otvara do-h | postoji | postoji | RequestsCard.tsx:70-73,78-91 | — | — |
| N-16 | Radovi uz mentora | Bez zahtjeva | odstupa | postoji | messages.hr.ts:760 | „Nema zahtjeva na čekanju.” | — |
| N-16 | Radovi uz mentora | prazno | odstupa | postoji | locales/hr.ts:723-724; WorksList.tsx:20-27 | Doslovno. | — |
| N-16 | Radovi uz mentora | ucitavanje | odstupa | postoji | HT/shell/messages.hr.ts:9 | „Učitavanje mentorstava…”. | — |
| N-16 | Radovi uz mentora | greska + „Pokušaj ponovno” | odstupa | postoji | locales/hr.ts:725; izvođenje mentorstva.txt | Doslovno. | — |
| N-16 | Radovi uz mentora | Student B nakon odobrenja | odstupa | postoji | locales/hr.ts:731 | „Rad nije započet.”; ponovno čitanje. | — |
| N-05 | Brz put | ruta u hostu | nedostaje | odstupa | packages/app/app/[base]/nastavnik/brz-put/page.tsx; HT/n05/FastPathPage.tsx:22-33,129; AssignmentFacts.tsx:89; HT/n07/ReceiptPage.tsx:168 | Ruta spojena, ali čita `?zadatak=`, a nijedan ulaz (navigacija, N-01, N-07) ga ne šalje. Izvođenje: „Odaberite zadatak u svojim kolegijima.” Nema izbora zadatka, pa popis radova u hostu nije dohvatljiv bez ručnog URL-a. Zaglavlje nema naziv zadatka (lead statičan). | — |
| N-05 | Brz put | popis radova „Studenti · po prezimenu” | odstupa | postoji | FastPathPage.tsx:66-75 | Samo ime + stanje riječju, napomena „Popis se ne može poredati po brojevima.” | — |
| N-05 | Brz put | oznake stanja bez točke | odstupa | postoji | FastPathPage.tsx:71; n05/messages.hr.ts:15-19 | „Obavijest nije potvrđena / U pisanju / Predano”, riječima. | — |
| N-05 | Brz put | pojedinosti rada | odstupa | odstupa | HT/n05/model.ts:30-39 | Stanje, Zadnja promjena, Lijepljenja bez izvora („Ima ih · popis u punom sažetku”/„Nema ih”), Stanje zapisa postoje. „Stanje” je samo riječ, bez vremena predaje, verzije i „rok produljen do”. | — |
| N-05 | Brz put | kartica „Tekst rada” | postoji | postoji | FastPathPage.tsx:91-100,107-113 | — | — |
| N-05 | Brz put | kartica „Sažetak procesa” + puni sažetak | odstupa | postoji | FastPathPage.tsx:114-118 | Cijeli ProcessSummaryView + „Otvori puni sažetak procesa” (bogatije od 4 činjenice u prototipu). | — |
| N-05 | Brz put | „Prethodni” / „Sljedeći” | postoji | postoji | FastPathPage.tsx:60-63,81-82 | `aria-disabled` na krajevima. | — |
| N-05 | Brz put | „Otvori rad” | postoji | postoji | FastPathPage.tsx:83 | — | — |
| N-05 | Brz put | nezapočet rad | odstupa | postoji | n05/messages.hr.ts:22 | Doslovno. | — |
| N-05 | Brz put | prazno | odstupa | postoji | n05/messages.hr.ts:8-9 | „Nema radova” + „Nijedan student još nije započeo rad u ovom zadatku.” | — |
| N-05 | Brz put | ucitavanje | postoji | odstupa | FastPathPage.tsx:37-39 | Opći „Učitavanje…”, vidi ljuska. | — |
| N-05 | Brz put | greska + „Pokušaj ponovno” | odstupa | postoji | FastPathPage.tsx:39 | Gumb preko TeacherPage. | — |
| N-17 | Zbirni pregled | ruta i navigacija | postoji | postoji | app/[base]/nastavnik/zbirni/page.tsx; HT/overview.tsx:18-34 | — | — |
| N-17 | Zbirni pregled | kartica po zadatku | odstupa | postoji | HT/n17/Overview.tsx:48-92 | Sve kartice odjednom, „Kolegij: „Naslov””. Izvođenje. (Prototip piše vrstu rada umjesto kolegija u naslovu.) | — |
| N-17 | Zbirni pregled | meta redak | nedostaje | odstupa | HT/n17/model.ts:80-92 | Zbroj postoji („predano 3 (od toga 1 nakon roka), nije predano 1”); „Rok …” na početku nedostaje. | — |
| N-17 | Zbirni pregled | tablica 6 stupaca | postoji | postoji | Overview.tsx:68-72; n17/messages.hr.ts:16-23 | — | — |
| N-17 | Zbirni pregled | stupac Student (poveznica na rad) | odstupa | nedostaje | n17/model.ts:112-115; src/client/teacher-reads.ts:96-108 | `workHref` traži `documentId`, a `toRow` ga nikad ne postavlja (TODO(ugovor)): nijedno ime nije poveznica (izvođenje: obično ime). Dokument je dostupan iz course-students. | — |
| N-17 | Zbirni pregled | stupac Stanje | odstupa | odstupa | n17/model.ts:62-67 | „u pisanju”, „rok produljen”, „obavijest nije potvrđena” postoje u modelu, ali `phase`/`deadlineExtended` nitko ne postavlja: izvođenje pokazuje samo „predano”/„nije predano”. | — |
| N-17 | Zbirni pregled | Vrijeme predaje, Nakon roka, Stanje zapisa | odstupa | odstupa | n17/model.ts:69-82 | „nema/da/ne/cjelovit/ima praznine/čeka potvrdu” kao prototip. Vrijeme u dugom obliku „20. prosinca 2026. u 22:14” (prototip „5. 11. 2026. u 21:14”) (izvođenje). | — |
| N-17 | Zbirni pregled | stupac Dorada | nedostaje | odstupa | n17/model.ts:84-87 | Tekst „zatražena · …”/„nije zatražena” implementiran, ali `revision` se ne postavlja pa je uvijek „nedostupno” (izvođenje). | — |
| N-17 | Zbirni pregled | prazno | odstupa | odstupa | Overview.tsx:49-55 | Tekst doslovan; gumb „Dodaj zadatak” vodi na /nastavnik/novi-zadatak, a te rute nema (postoji /nastavnik/zadatak/novi). Mrtva veza. | — |
| N-17 | Zbirni pregled | ucitavanje | odstupa | postoji | n17/messages.hr.ts:5 | „Učitavanje zbirnog pregleda…”. | — |
| N-17 | Zbirni pregled | greska (čitanje kolegija) | postoji | postoji | n17/messages.hr.ts:6 | — | — |
| N-17 | Zbirni pregled | greska (čitanje predaja zadatka) | odstupa | postoji | Overview.tsx:57-62 | Kartica ima `role=alert` i gumb „Pokušaj ponovno”. | — |
| ljuska | Zajednička ljuska | Zvono obavijesti, „Postavke profila”, „Prijavi problem”, „Kako Ductura radi”, „Izjava o pristupačnosti” | novo | — | packages/app/src/host/Host.tsx:130-146 | Podnožje ljuske ima više veza nego prototip (vidi „Novo u appu”). | — |
| dijalog dd-h | Zatražiti doradu? | Gumb samo za predan rad (skriven inače) | novo | postoji | RevisionSection.tsx:49-51,99 | Prototip: samo za predano. | — |
| dijalog dd-h | Zatražiti doradu? | doradaBanner (4 stanja, Prihvati / Ponovno otvori, toastovi) | novo | postoji | RevisionSection.tsx:105-120 | Izvan mojih oznaka (N-06), navedeno jer dijeli dijalog. | — |
| dijalog ch-h | Razgovor n · datum | Panel izjave „Izjava o korištenju generativne umjetne inteligencije” na predaji | novo | odstupa | AiDeclarationSection.tsx:56-72; ReceiptPage.tsx:163 | Panel se prikazuje, ali bez popisa razgovora (stvarni port) i s prikazom privitaka. | Ne, treba ugovor |
| N-16 | Radovi uz mentora | Kartica „Ključni datumi” po mentorstvu | novo | — | HT/mentorships/MentorshipsPage.tsx:54-56 | Bez prototipa (vidi dolje). | — |

#### 2. Novo u appu bez prototipa

- Ljuska: zvono obavijesti (ShellNotifications), „Postavke profila”, „Prijavi problem”, „Kako Ductura radi”, „Izjava o pristupačnosti”, dijalog potvrde odjave.
- N-01 kartica: „Bilježi ritam tipkanja” (CourseRhythm, AssignmentRhythm), „Nastavni tim i grupe” (CourseTeachingTeam), oznaka „Probni” (PracticeBadge).
- N-02/N-03: potvrdni okvir „Probni zadatak (bez ocjene)”, polje „Dopušten uvoz”.
- N-04: „Zbirni pregled kolegija” (/nastavnik/kolegiji/[id]/zbirno, course.aggregate.get).
- N-16: kartica „Ključni datumi” po mentorstvu (mentorship.key-dates.get).
- Rute bez ulazne točke u hostu (A-10 „Zadržati”): „Predaje zadatka” (/nastavnik/zadatak/[id]/predaje) i „Nova verzija zadatka” (/uredi, kopiranje zadatka, jezik rada). Staro stablo (TeacherCourses) je imalo veze „Predaje” i „Nova verzija”; u hostu ih nijedna kartica ne nosi (CardTasks se ne koristi jer host predaje `tasks`).

#### 3. Prijedlozi zadataka (samo nedostaje/odstupa)

PR-A (S) Mrtve veze i slijepe ulice. Pokriva: N-05 ruta, N-01 „Brz put kroz radove”, N-17 prazno, N-01 prekinuto, N-02/N-03 objava (link), N-04 prazno. Radnje: N-17 gumb na /nastavnik/zadatak/novi; „Brz put” veze s `?zadatak=`; CheckListLink bez gubitka query-ja (izravno na /nastavnik); „Izdaj novi kod” iz N-04 vodi na N-01. Ovisnost: nema.

PR-B (M) Brz put: izbor zadatka. Pokriva: N-05 ruta, ljuska učitavanje, N-05 ucitavanje/pojedinosti. Radnje: bez `?zadatak=` odabrati prvi zadatak (ili izbornik zadatka), naziv zadatka u zaglavlju, `loading` tekst, vrijeme predaje i verzija u „Stanje”. Ovisnost: client (teacher.courses.get, submissions).

PR-C (M) N-17 stvarni podaci. Pokriva: N-17 Student poveznica, Stanje, Dorada, meta redak „Rok”, vrijeme (kratki oblik). Radnje: spojiti documentId i workState iz course-students, rokove produljenja i zahtjeve za doradu kao u assignment-facts/read.ts. Ovisnost: client; za dorada po studentu moguć ugovor.

PR-D (M) N-04 redak s činjenicama. Pokriva: N-04 redak studenta, dorada, naslov zadatka. Radnje: isti join kao PR-C (overview + submissions + revision), join naziva zadatka. Ovisnost: client; dorada po studentu možda ugovor.

PR-E (M) Obrazac zadatka: grupe, vanjski alati, samo sažimanje. Pokriva: N-02/N-03 Grupe, zs-3 AI, zs-3 Vanjski alati, pregled. Radnje: čitanje grupa (institution.course-groups.get), slanje `groupIds`, `externalToolsAllowed`, `aiSummaryOnly`. Ovisnost: ugovor već ima polja; provjeriti da ih server stvarno obrađuje.

PR-F (S) Toasti prema odluci. Pokriva: ljuska toast, N-02/N-03 objava i ucitavanje, N-16 Odobri, do-h ishod. Radnje: `toastWhenConfirmed` za objavu (+ povratak na /nastavnik), odobri, odbij (s/bez razloga); tekst „Objava zadatka u tijeku…”. Ovisnost: nema.

PR-G (M, server) Razlog odbijanja vidljiv studentu. Pokriva: do-h uvod i razlog. Radnje: razlog u mentorship.student-requests.get i na studentskoj stranici; do tada ukloniti obećanje iz pomoći. Ovisnost: ugovor i server.

PR-H (L, server) Razgovori u izjavi (ch-h). Pokriva: ch-h. Radnje: teacher.declaration.get s popisom pripojenih razgovora, formatiran datum u naslovu. Ovisnost: ugovor i server.

PR-I (M, server) N-16 podaci. Pokriva: N-16 popis i kartica zahtjeva (kolegij/tema, vrijeme predaje, verzija). Ovisnost: ugovor i server.

PR-J (S) N-01 akcije po kolegiju. Pokriva: N-01 Produljenje/Merlin/Zbirni. Radnje: Produljenje i za zadatke s prošlim rokom, izbor zadatka, „Zbirni” s kolegijem. Plus ulazne točke „Predaje” i „Nova verzija” po zadatku (A-10). Ovisnost: nema.

#### 4. Stavke koje traže vlasnikovu odluku

1. Sadržaj „Samo sažimanje” (zs-3): kako se mapira na aiPurposes/`aiSummaryOnly` (nije u odlukama 22. 11.). Prije PR-E.
2. Obavijest studentima pri objavi (C-17, „samo u aplikaciji”): potvrditi da poslužitelj stvara obavijest; do tada pregled zadatka tvrdi da je dobivaju.
3. Razlog odbijanja: odluka postoji, ali traži izmjenu ugovora (PR-G); odlučiti hoće li se do tada ukloniti tvrdnja „Student će vidjeti razlog”.
4. ch-h: ugovor za razgovore uz izjavu (C-3/C-4 su dali „smije”, ali server ih ne vraća).
5. N-01 „Produljenje roka” za zadatke s isteklim rokom (prototip ga nudi uvijek). Odluka o tome treba li dopustiti.
6. Zamjenski postupak/C-6/Q-n: nije u mojem dijelu.

#### Brojke (107 starih redaka mojih oznaka)

postoji 75, odstupa 25, nedostaje 4, odgođeno po planu 3 (A-7). Novih redaka: 5 (stara ocjena „novo”), nisu uračunati.

### Dio B: Rad (N-06), predaja (N-07), komentari (N-08)

Baza: grana migracija/wpar2n-paritet2-nastavnik. Putanje su relativne na `packages/app/src/host/teacher/` osim gdje piše `src/`.
Zadnji stupac "Vlasnik" = traži vlasnikovu odluku. "izvođenje" nije potvrđeno ni za jedan redak: probe/rad.txt i probe/rad-predaja.txt u scenariju "puno" pokazuju samo "Pristup radu trenutačno nije moguće provjeriti." (nema teacher.access.get), pa se sve temelji na kodu, unit testovima i e2e `packages/app/e2e/teacher-work.spec.ts`.
Kratice datoteka: WF = n06/WorkFrame.tsx, M6 = n06/model.ts, RS = revision/RevisionSection.tsx, RP = n07/ReceiptPage.tsx, RM = n07/model.ts, PG = work/pages.tsx, CP = comments/TeacherCommentsPanel.tsx.

#### 1. Tablica

| Oznaka | Ekran | Stanje | Stara ocjena | Ocjena danas | Implementacija (datoteka:redak) | Napomena (što točno) | Vlasnik |
|---|---|---|---|---|---|---|---|
| N-06 | rad | okvir: sticky traka „Natrag na kolegije” + putanja | nedostaje | odstupa | n07/WorkPage.tsx:16-22; WF:61; M6:22 | Traka i „Natrag na kolegije” postoje (WorkPage). Putanja je samo „Student A · Rad”; prototip: kolegij · student · vrsta „naslov”. Kolegij i naslov nisu u `teacher.work.get`. | |
| N-06 | rad | zaglavlje h1: „Student A · Seminarski rad „Naslov”” | odstupa | odstupa | WF:63; M6:22; messages `titleUnavailable` neiskorišten | h1 je „{ime} · Rad”, bez vrste zadatka i naslova. Ruta `teacher.work.get` ne vraća naslov; `institution.assignment.get` ga ima (po assignmentId), spoj nije napravljen. | |
| N-06 | rad | puno (predano): redak stanja „Predano … · rok … · verzija … · zapis cjelovit/praznine” | odstupa | postoji | M6:28-34; n06/messages.hr.ts `submitted`; n06/model.test.ts | Sve četiri činjenice iz potvrde. Format datuma je dugi („2. studenoga 2026. u 09:50”), prototip i N-07 imaju brojčani („2. 11. 2026. u 9:50”), vidi novi redak. | |
| N-06 | rad | nakon-roka: oznaka uz predaju | nedostaje | postoji | M6:30; messages `submitted` (`, nakon roka (rok …)`) | Uz potvrdu; bez potvrde „Predano, nakon roka · vrijeme, rok i verzija nisu dostupni”. | |
| N-06 | rad | uzivo: „U pisanju · … · zadnja promjena … · rok …” (+ „rok produljen do”) | odstupa | odstupa | M6:36-38; messages `live`, `lastChange`, `dueLine`, `extended` (poruke postoje, nitko ih ne zove) | Prikazuje se samo „U pisanju · prikaz se osvježava dok student piše”. Nema zadnje promjene, roka ni produljenja: ruta ne daje rok ni vrijeme zadnje promjene. | |
| N-06 | rad | nije-predano: redak „Nije predano · rok … je prošao · prikazan je zadnji tekst (…)” | nedostaje | nedostaje | M6:36-38; messages `notSubmitted` neiskorišten | `nije_predano` se uvijek crta kao „uživo” jer ruta ne razlikuje uživo i istek roka. Poruka postoji, ne poziva se. | Ne (ovisi o ugovoru: rok na ruti) |
| N-06 | rad | nije-predano: banner „Rad nije predan do roka…” + „Produljenje roka” | nedostaje | nedostaje | WF:20,77-79; M6:63-64; PG:164 | Komponenta i ruta produljenja postoje (`/nastavnik/zadatak/[id]/produljenje`), ali `deadlinePassed` nitko ne prosljeđuje (PG:164) pa je banner nedohvatljiv u hostu. | |
| N-06 | rad | seqList: slijed rada | nedostaje | odstupa | WF:51,66; M6:40-43 | Postoji popis s jednom stavkom „Predano … · verzija n”, inače „Još ništa nije poslano…”. Nema „Poslano na pregled … · verzija 1” ni „Zatražena dorada … · rok za doradu …”: zahtjevi za doradu se čitaju u RS, ali ne ulaze u slijed. | |
| N-06 | rad | rd-links: „Što je student predao” (samo predano) | odstupa | postoji | M6:47-51 | Naziv točan, samo za predano. | |
| N-06 | rad | rd-links: „Sažetak procesa” | odstupa | postoji | M6:52; PG:101 | Vodi na zasebnu stranicu `/sazetak` (N-10). | |
| N-06 | rad | rd-links: „Reprodukcija” | odstupa | postoji | M6:53; messages `linkReplay` | Naziv „Reprodukcija”. | |
| N-06 | rad | rd-links: „Usporedba verzija” (samo predano) | nedostaje | postoji | M6:54; PG:101 (`comparison`), n11/Compare.tsx | Ruta `/nastavnik/rad/[id]/usporedba` i stranica postoje. | |
| N-06 | rad | rd-links: „Konzultacije” | postoji | postoji | M6:56 | Jednako. | |
| N-06 | rad | gumb „Zatraži doradu” u zaglavlju (samo predano) | nedostaje | postoji | RS:94; WF:71 | Samo kad poslužitelj kaže predano/nakon roka. | |
| N-06 | rad | stepWork „Prethodni rad” / „Sljedeći rad” (aria-disabled na rubu) | nedostaje | postoji | WF:53-58,72 | Iz `prevDocumentId`/`nextDocumentId`; na rubu `aria-disabled`. | |
| N-06 | rad | dorada: doradaBanner „otvoren” | nedostaje | odstupa | RS:73-84; revision/model.ts bannerOf | Banner s citatom upute, napomenom o stanjima i oznakom stanja. U zaglavlju bannera nema „· rok za doradu …” jer lista zahtjeva klijentu ne vraća rok. | Ne (ovisi o ugovoru: rok u listi) |
| N-06 | rad | dorada: „student navodi da je proveden” + „Prihvati doradu” / „Ponovno otvori” | nedostaje | postoji | RS:77-83; revision/port.ts; revision/model.test.ts, port.test.ts | Gumbi samo u stanju „responded”; prikazan i tekst „student navodi da ne može provesti” za odbijanje. | |
| N-06 | rad | dorada: „prihvaćen” i „ponovno otvoren” | nedostaje | postoji | revision/messages.hr.ts `states`; model.ts | Bez gumba, kao u prototipu. | |
| N-06 | rad | accept: toast „Dorada je prihvaćena.” | nedostaje | postoji | RS:67-72; toast/outcome-toast.ts (3200 ms, tek nakon potvrde) | `toastWhenConfirmed`. | |
| N-06 | rad | reopen: toast „Zahtjev za doradu je ponovno otvoren.” | nedostaje | postoji | RS:77-83 | Isto. | |
| N-06 | rad | praznine: banner + „Otvori sažetak procesa” (C-18) | odstupa | postoji | WF:52,76; M6:57-62 | Tekst jednak prototipu („Od verzije … do verzije …”, „Tekst predane verzije je potpun.”), samo za predano, poveznica na `/sazetak`. Nema vlastitog e2e (e2e mock vraća 404 za sažetak); pokriveno unit testom model.test.ts. | |
| N-06 | rad | tekst rada: papirni list, samo za čitanje, odlomci, naslovi, citat, popis | odstupa | odstupa | WF:34 (`sheetLabel`), PG:166-171; src/components/teacher/LiveText.tsx | List postoji; nema h1 naslova rada ni retka „Vrsta · student · Kolegij” (nema naslova zadatka na ruti). | |
| N-06 | rad | tekst rada: oznaka komentara (.ed-mark) | postoji | odstupa | PG:171 (`openMarks`), LiveText.tsx | Radi za v1 tekst. Kad se čita v2/v3 putem TextElementsView (PG:166-170), nema oznaka komentara ni odabira za novi komentar (samo čitanje). | |
| N-06 | rad | tekst rada: prijedlog u tekstu (`<del>`/`<ins>` + „prijedlog”) | nedostaje | odstupa | proposals/ProposalsPanel.tsx; src/components/editor/suggestions/SuggestionCard.tsx:51-53 | del/ins i oznaka postoje samo u kartici u bočnom panelu, ne u tekstu rada. | |
| N-06 | rad | tekst rada: navod (.ed-cite) | nedostaje | odstupa | text-elements/TextElements.tsx:16; PG:149,166 | Navod je crtan, ali samo kad dijeljeni čitač ne prikaže dokument (`view.document === null` i `retrying`). Za uobičajeni put tekst ide kroz LiveText bez navoda. | |
| N-06 | rad | tekst rada: otvoreno mjesto za izvor (.ed-open) | nedostaje | odstupa | TextElements.tsx:17 | Isti uvjet kao za navod. | |
| N-06 | rad | tekst rada: fusnote (.ed-notes) | nedostaje | odstupa | TextElements.tsx:48-55 | Isti uvjet; fusnote s povratnim vezama. | |
| N-06 | rad | prijedlog: prihvaćen prijedlog s oznakom „prihvaćen prijedlog mentora” | nedostaje | odstupa | ProposalsPanel.tsx:49; suggestions/messages.hr.ts:36 | Oznaka je uz karticu u panelu, ne u tekstu rada. | |
| N-08 | rad | panel „Komentari i prijedlozi”: naslov i napomena | odstupa | postoji | CP:13; comments/messages.hr.ts:3-4 | Naslov i napomena točno kao u prototipu. | |
| N-08 | rad | nit komentara: unosi (autor · vrijeme), oznaka otvoreno/riješeno | odstupa | postoji | CP:62-77; comments/model.ts:23-27 | „Vi/Nastavnik/Student · vrijeme”, naslov „Komentar uz „…””. Dodatno: „odgovoreno” i „uz verziju Vn”. Vrijeme u dugom formatu. | |
| N-08 | rad | Odgovori (fokus na polje, placeholder) | odstupa | postoji | CP:41-45,78-93 | Umjesto fokusa na zajedničko polje, svaka otvorena nit ima polje s placeholderom „Odgovor na komentar…”; Ctrl+Enter/Esc. Toast „Komentar je dodan…” nakon potvrde poslužitelja (CP:35-37). Funkcijski ekvivalent. | |
| N-08 | rad | Označi kao riješeno / Ponovno otvori | odstupa | postoji | CP:68-76; messages `resolve`, `reopen` | Nazivi točni. | |
| N-08 | rad | nit prijedloga: „na čekanju / povučen / prihvaćen” | nedostaje | postoji | PG:193; proposals/ProposalsPanel.tsx:38-45; suggestions/SuggestionCard.tsx | Odvojen panel „Prijedlozi izmjene” umjesto istog popisa kao komentari; naslov kartice „Prijedlog n” umjesto „Prijedlog u „4. Rasprava””; dodano stanje „odbijen”. | |
| N-08 | rad | Povuci prijedlog: toast „Prijedlog je povučen. Tekst rada nije promijenjen.” | nedostaje | postoji | ProposalsPanel.tsx:25-29; proposals/model.ts `withdrawToast`; proposals/model.test.ts | Toast samo nakon uspjeha. | |
| N-08 | rad | novi komentar: „Novi komentar” + „Dodaj komentar” | odstupa | odstupa | CP:96-125,185-191; PG:149-158 | Komentar je uvijek vezan uz označeni tekst (B-10); obrazac se pojavi tek nakon označavanja, uz uputu „Označite tekst u radu za komentar.”. Prototipov općeniti komentar („Komentar uz rad”) ne postoji. e2e: „the anchored comment is shown after the server confirms…”. | Da: potvrditi da općeniti komentar ostaje izvan opsega (B-10) |
| N-08 | rad | novi komentar: toast „Komentar je dodan. Isti komentar vidi i student.” | nedostaje | postoji | CP:164-166,194-197; COMMENT_TOAST_MS 3200 | Prikazuje se tek nakon odgovora poslužitelja; nije zajednički `TeacherToastRegion` nego lokalni `role=status`. | |
| N-08 | rad | bez niti: „Još nema komentara.” | odstupa | postoji | CP:170; messages `empty` | Točan tekst. | |
| N-06 | rad | prazno (rad nije započet) + prethodni/sljedeći rad | odstupa | odstupa | WF:20,80; src/lib/i18n/messages.hr.ts:1274 | Poruka „Rad još nije započet. Student još nije potvrdio obavijest…” i grana `started=false` postoje, ali `started` nitko ne prosljeđuje (PG:164): prikazuje se „Student još nije poslao tekst.”. Ruta nema podatka o potvrdi obavijesti. | |
| N-06 | rad | ucitavanje: „Učitavam rad s poslužitelja…” + kosturi | odstupa | postoji | WF:40; n06/messages.hr.ts `loading` | Skeleton s točnim tekstom. Prije njega kratko „Provjeravam pristup radu…” (work/messages.hr.ts). | |
| N-06 | rad | greska: „Rad trenutačno nije moguće učitati…” + „Pokušaj ponovno” | odstupa | odstupa | WF:42-47; PG:60-63,124 | Okvir ima točan tekst i gumb. Uz njega još dva stanja: „Pristup radu trenutačno nije moguće provjeriti.” (probe/rad.txt to potvrđuje u izvođenju za pad pristupa) i „Tekst rada trenutačno nije dostupan…” bez gumba. | |
| N-07 | predaja | prazno / nije predano: „Ovaj rad nije predan, pa potvrde nema. {redak stanja}.” + „Natrag na rad” | odstupa | odstupa | RM:78-83; RP:166-169 | Rečenica točna, ali {redak stanja} je „U pisanju · prikaz se osvježava…” (ruta ne razlikuje istek roka), ne „Nije predano · rok … je prošao”. „Natrag na rad” postoji. | |
| N-07 | predaja | ucitavanje: „Učitavam potvrdu s poslužitelja.” | odstupa | postoji | RP:49-51; n07/messages.hr.ts `loading` | Točan tekst + `Lines` kosturi. | |
| N-07 | predaja | greska: „Potvrdu trenutačno nije moguće učitati. Ako je rad predan…” + „Pokušaj ponovno” | odstupa | postoji | RP:52-58; messages `error`; e2e „access and receipt errors show a retry…” | Točan tekst i gumb; e2e dokaz. | |
| N-07 | predaja | okvir: traka „Natrag na rad”, h1 „Što je student predao”, uvod | odstupa | postoji | RP:139-153; messages `title`, `intro` | Uvod samo u stanju s potvrdom. Putanja u traci je samo ime studenta. | |
| N-07 | predaja | beforePanel „Sažetak procesa (Prije predaje)” | nedostaje | odstupa | pre-submit/PreSubmitPanel.tsx; RP:160 | Ploča, lijepljenja, „Pravila oblika” („Provjera oblika još nije pokrenuta.”) i poveznica „Otvori puni sažetak procesa” postoje. „Mjesta za izvor” kaže „Popis … trenutačno nije dostupan” (sažetak ih ne nosi; mogli bi se izvesti iz v3 dokumenta). Nema varijante ploče za zadatak t0. | |
| N-07 | predaja | receiptPanel ceka: „Predaja u obradi” | odstupa | odstupa | RM:85-93 | Naslov i rečenica točni. Nedostaje redak „Rok” (u stanju čeka ruta ne daje dueAt); dodan gumb „Provjeri stanje predaje”. Nema oznake vrste zadatka. | |
| N-07 | predaja | receiptPanel nedovrseno: „Predaja nije dovršena: zamjenski postupak” | nedostaje | odgođeno po planu | pre-submit/model.ts:30-41 (`fallbackText`), PreSubmitPanel.tsx:40; RP:162 | Odluka orkestratora 22. 11.: stanje s poslužitelja, inače „nedostupno”. Panel prikazuje „Stanje zamjenskog postupka trenutačno nije dostupno.” za čeka/grešku; punu varijantu crta kad poslužitelj vrati stanje (FPZG Q-3, `teacher.submission-receipt.get` nema varijantu). | Da: Q-3 (FPZG) |
| N-07 | predaja | puno: naslov „Predano {vrijeme}” + oznaka vrste zadatka | odstupa | odstupa | RM:100-104; RS WorkPanel bez `tag` | Naslov točan (uz „, nakon roka”). Oznake vrste zadatka nema (ruta je ne daje). | |
| N-07 | predaja | puno: Vrijeme predaje, Rok, Potpisivanje, Verzija (zoned) | odstupa | odstupa | RM:105-110 | Sva četiri retka sa „(UTC+n)”. Verzija je „verzija n (predana)” bez „· verzija 1 poslana na pregled …”. | |
| N-07 | predaja | puno: details „Točne vrijednosti iz potvrde (UTC)” | odstupa | postoji | RM:111-115; RP:60-64 | requestedAt, dueAt, signedAt; test ReceiptPanel.test.tsx. | |
| N-07 | predaja | puno: otisak u skupinama po četiri | postoji | postoji | RM:46,117 | Isto. | |
| N-07 | predaja | puno: naslov i pojašnjenje otiska | odstupa | postoji | messages `fingerprintTitle`, `fingerprintNote` | Točni tekstovi. | |
| N-07 | predaja | puno: gumb „Kopiraj otisak” | odstupa | postoji | RP:66; copy RP:128-131 | Točan naziv. | |
| N-07 | predaja | toast „Otisak je u međuspremniku (64 znaka, bez razmaka).” | postoji | postoji | RP:129-131 | Toast tek nakon uspjeha međuspremnika; uz grešku zaseban tekst. | |
| N-07 | predaja | puno: Stanje zapisa | odstupa | postoji | RM:118; RP:67 | „Zapis je cjelovit./ima praznine.” + „Zapis je neizmijenjen od primitka na poslužitelj.”. | |
| N-07 | predaja | Provjera potvrde: tekst + poveznica /provjera | nedostaje | postoji | RM:75-80; RP:68-69; public/verify/model.ts | Umjesto prototipnog toasta prava poveznica na `/provjera` s već ispunjenim kodom u fragmentu. | Da: C-6 (je li to konačni oblik) |
| N-07 | predaja | QR uzorak | nedostaje | postoji | RM:134-148; RP:25-39,70 | Uzorak iz otiska s napomenom; pravi QR ostaje u zapisu koji student preuzme. | Da: C-6 (QR/PDF) |
| N-07 | predaja | varijanta nakon-roka: naslov „Predano …, nakon roka” | odstupa | postoji | RM:101 | Točno. | |
| N-07 | predaja | varijanta cjelovit | odstupa | postoji | RM:118 | Točno. | |
| N-07 | predaja | gumb „Natrag na rad” (kraj stranice) | odstupa | postoji | RP:156,164-166 | Uz traku na vrhu. | |
| N-07 | predaja | gumb „Zatraži doradu” (dd-h) | nedostaje | odstupa | RP:84-101,167; src/components/teacher/revision/ReturnForRevisionDialog.tsx; src/components/teacher/revision/messages.hr.ts | Gumb postoji, ali otvara STARI dijalog „Vrati rad na doradu”: rok neobavezan („bez roka”), drukčiji naslov i tekstovi, toast „Rad je vraćen na doradu.” (prototip i odluka: „Zatražiti doradu?”, rok obavezan, „Zahtjev za doradu je poslan. Student ga vidi uz rad.”). Na `/rad` radi novi dijalog (RS:101-124), pa su dva različita ponašanja. Pogrešan „today” u UTC (RP:94). | |
| N-07 | predaja | gumb „Brz put” | nedostaje | postoji | RP:168; app/[base]/nastavnik/brz-put | Vodi na `/nastavnik/brz-put`. | |
| N-07 | predaja | declPanel „Izjava o korištenju generativne umjetne inteligencije” + „Pregledaj razgovor” + ch-h | nedostaje | odstupa | ai-declaration/AiDeclarationSection.tsx; src/client/declaration.ts:262,287,318 | Odjeljak i dijalog ch-h („Razgovor n · datum”, „Točno kako je zabilježen…”, „Zatvori”) postoje, ali teacher read uvijek vraća `conversations: []` i `transfers: []`: u hostu su „Pregledaj razgovor” i dijalog nedohvatljivi, a „Zabilježeno u Ducturi” prazno. Tekstovi panela iz kataloga („Uporaba AI-ja”), ne prototipa. Naslov dijaloga bi koristio sirovi `confirmedAt` (ISO) jer ga klijent ne formatira. | |

#### 2. Novi retci (nije bilo u staroj reviziji)

| Oznaka | Ekran | Stanje | Stara ocjena | Ocjena danas | Implementacija | Napomena | Vlasnik |
|---|---|---|---|---|---|---|---|
| N-06 | rad | format datuma/vremena u zaglavlju, banneru praznina, slijedu i unosima komentara | novo | odstupa | M6 `formatDateTimeHr` (src/lib/i18n/hr); comments/model.ts:26 | Dugi mjesec („2. studenoga 2026. u 09:50”); prototip i N-07 (`shortTime`) brojčano „2. 11. 2026. u 9:50”. | |
| N-06 | rad | „Zatraži doradu” na `/rad`: dijalog dd-h (naslov, objašnjenje, polje, rok obavezan, „Pošalji zahtjev”, „Odustani”) | novo | postoji | RS:101-124; revision/model.ts `buildRevision`; revision/port.ts (`work.return-for-revision.post`) | Rok obavezan i u budućnosti, bez zadanog datuma (prototip ima zadano „12. 11. 2026. u 23:59”); pogreške ostaju u dijalogu, toast „Zahtjev za doradu je poslan. Student ga vidi uz rad.” nakon potvrde. Nema e2e za radnju, samo unit testovi. | |
| N-06 | rad | zasebna komponenta „nije započeto” / „nije predano” vezana na server | novo | nedostaje | WF:20 (`deadlinePassed`, `started`) | Dva ulaza komponente ostaju neprosljeđena; zadatak: spojiti čim ruta nosi `dueAt` i potvrdu obavijesti. | |
| N-06 | rad | dupli popis poveznica na dnu stranice (Potvrda predaje, Reprodukcija, Konzultacije, Usporedba) | novo | odstupa | PG:173-178 | Isti pogledi već su u `rd-links` u zaglavlju; dnevni popis ne postoji u prototipu. | |
| N-07 | predaja | oznaka vrste zadatka u ploči potvrde | novo | nedostaje | RM:100; WorkPanel `tag` | Isto kao u N-06 naslovu: vrsta ne dolazi s rute. | |
| N-07 | predaja | napomena vježbe (P-D1) | novo | postoji | RP:110-119; n07/practice.ts | Nema u prototipu (vidi „Novo u appu”). | |

#### 3. Novo u appu bez prototipa

- Pripremi razgovor (N-14): poveznica `linkInterview` u rd-links i stranica `/priprema-razgovora` (prototip: nije u prototipu, EQ5 „ne gradi se sada”).
- Mentor (ReadOnlyMentor), Banka komentara (CommentBank), „Promjene od zadnjeg pregleda”, Bibliografija nastavnika, Karta podrijetla (ProvenanceMap), RecordLimits, MobileReview (PG:174-195).
- Ispis/kopiranje konzultacijskih komentara (ConsultationPrint, CP:127-182).
- Oznaka „uz verziju Vn” na nitima komentara (INT-15); stanje niti „odgovoreno”; stanje prijedloga „odbijen”.
- Napomena „Vježba, ne ocjenjuje se” (P-D1) na predaji; gumb „Provjeri stanje predaje” za `ceka`.
- Poruke „Navodi, otvorena mjesta za izvor i fusnote … nisu dostupni” (TextElements) i „Ime studenta nije dostupno”.

#### 4. Prijedlozi zadataka (samo nedostaje/odstupa)

1. **S: Spojiti kontekst na WorkFrame** (retci: nije-predano stanje + banner, prazno/nije započeto, N-07 „nije predano” redak stanja). Proslijediti `deadlinePassed` i `started` iz hosta. Ovisnost: ugovor (rok `dueAt` i potvrda obavijesti na `teacher.work.get` ili čitanje kroz `institution.assignment.get` + live stanje); bez toga ostaju „nedostupno”.
2. **S: Naslov zadatka i putanja** (retci: sticky putanja, h1, naslov i podnaslov na listu, oznaka vrste u N-06/N-07). Spojiti `assignmentId` → `institution.assignment.get` (naslov, vrsta). Ovisnost: server (provjeriti da nastavnik smije čitati; inače ugovor).
3. **S: Jedan dijalog dd-h** (red N-07 „Zatraži doradu”). Na `/predaja` zamijeniti stari ReturnForRevisionDialog dijalogom iz RS (izvesti AskDialog), ujednačiti toast i Zagreb „today”. Bez ovisnosti.
4. **M: Slijed rada i rok dorade** (redci: seqList, dorada banner). Dodati u `sequence()` „Poslano na pregled …” i „Zatražena dorada … · rok za doradu …”. Ovisnost: ugovor (`revision-requests/list` bez roka dorade; „poslano na pregled” iz verzija).
5. **M: Elementi teksta za sve tekstove** (navod, mjesto za izvor, fusnote, oznaka komentara/odabir za v2/v3, prijedlog i prihvaćen prijedlog u tekstu). Danas ide samo kad dijeljeni čitač zakaže. Čitati v3 dokument kao primarni put i dodati del/ins i oznake u tekst. Bez ovisnosti o serveru.
6. **S: Format vremena** (novi redak o formatu): jedan prototipni format u N-06, komentarima, bannerima.
7. **M: Izjava o AI-ju** (redak declPanel). Ovisnost: server/ugovor (popis priloženih razgovora i prijenosa za nastavnika; `conversations: []`/`transfers: []` danas prazno), plus formatiranje `confirmedAt` u naslovu dijaloga i usklađivanje tekstova panela s prototipom.
8. **S: Prije predaje: mjesta za izvor** iz v3 dokumenta umjesto „nedostupno”; opcionalno ploča za t0.
9. **S: Čišćenje**: ukloniti dupli popis poveznica na dnu rada; ujediniti stanja greške (pristup / tekst / okvir) u jedan način s „Pokušaj ponovno”.
10. **S: Komentari u jednom popisu** (nit prijedloga uz komentare, naslov kartice po prototipu) i, ako vlasnik želi, općeniti komentar (vidi odluke).

#### 5. Stavke koje traže vlasnikovu odluku

- **C-6**: je li prava poveznica na `/provjera` i QR uzorak konačan oblik; stvarni QR/PDF (N-07).
- **Q-3 (FPZG)**: zamjenski postupak, stanje s poslužitelja (N-07 nedovrseno).
- **B-10**: samo komentar uz označeni tekst; općeniti komentar iz prototipa („Komentar uz rad”) ostaje izvan opsega ili se dodaje (N-08).
- Rok `dueAt`/potvrda obavijesti na `teacher.work.get`: ugovorna promjena za nije-predano i prazno stanje (ADR/ugovor, ne vlasnička odluka, ali blokira zadatak 1).
- Rok dorade u listi zahtjeva (ugovor) za slijed i banner.
- Popis priloženih razgovora nastavniku (server/ugovor, D-41) za ch-h.

#### Sažetak (retci iz stare tablice, 63)

Brojke po ocjeni danas: postoji 38, odstupa 22, nedostaje 2 (redak „nije predano” i banner „nije predano”), odgođeno po planu 1 (zamjenski postupak). N-06 31 redak, N-08 9, N-07 23.
Novi retci: 5 (1 postoji, 2 nedostaje, 2 odstupa).

### Dio C: Sažetak (N-10), reprodukcija (N-09), usporedba (N-11)

Stanje koda: grana `migracija/wpar2n-paritet2-nastavnik` (HEAD c491455), samo čitanje. Izvor istine: `docs/prototip/INVENTAR-nastavnik.md` §3.9-3.11, `Ductura_nastavnik.html` (r. 976-1134), kartice N-09/N-10/N-11, ODGOVORI-DANIEL-2026-11-19 (B-1, B-2, C-3, C-5, C-10, C-18). Ne ocjenjuju se boja, razmak ni izgled.

Pokrata: `H` = `packages/app/src/host/teacher`; `S` = `packages/app/src/host/teacher/work/pages.tsx`. Ocjena „postoji” znači da je tekst i ponašanje kao u prototipu i da je ekran dohvatljiv u hostu (rute `app/[base]/nastavnik/rad/[id]/{sazetak,reprodukcija,usporedba}/page.tsx` montiraju `TeacherWorkPage`, pages.tsx:55-63,118-138; ne `PendingPage`).

Izvođenje (probe `scratchpad/probe/rad-sazetak.txt`, `rad-reprodukcija.txt`, `rad-usporedba.txt`): sva tri ekrana u scenariju VIZ „puno” prikazuju samo naslov i „Pristup radu trenutačno nije moguće provjeriti.” + „Pokušaj ponovno” (scenarij nema `teacher.access.get`). To nije nedostatak aplikacije, ali znači da nijedna ocjena u tablici NIJE potvrđena izvođenjem; sve se temelji na kodu, unit testovima i e2e (`teacher-work.spec.ts`). Probe potvrđuju samo da su rute dohvatljive u hostu i da pokazuju ispravan naslov (Sažetak procesa, Reprodukcija rada, Usporedba verzija) te stanje greške pristupa s gumbom za ponovni pokušaj. Preporuka: ponoviti probu sa scenarijem koji ima `teacher.access.get`, `projection.process-summary*`, `work.versions.get`, `work.compare.get` i `evidence.replay.post`.

Dohvatljivost u hostu (sva tri ekrana): iz rada `H/n06/model.ts:54-56` (`links()`: Sažetak procesa, Reprodukcija, Usporedba verzija samo uz predan rad), iz popisa u tekstu rada `S:173-178` (reprodukcija uvijek, usporedba kroz `N11Entry` samo uz predan rad), iz banera praznina `H/n06/WorkFrame.tsx:76`, iz koraka „Prije predaje” `H/pre-submit/PreSubmitPanel.tsx:35`. Dokaz: e2e `packages/app/e2e/teacher-work.spec.ts:94-113` (klik na Reprodukciju, prazno stanje reprodukcije, ulaz u sažetak s potvrde, naslov i „Natrag na rad”); N-11 ima samo unit testove (`H/n11/*.test.ts`, `Compare.test.ts` provjerava tek prvi prikaz) i vizualni probni skup `e2e/viz/usporedba.viz.ts`.

#### 1. Tablica

Stupac „Vlasnik” = stavka traži vlasnikovu odluku (vidi odjeljak 4).

| Oznaka | Ekran | Stanje | Stara ocjena | Ocjena danas | Implementacija (datoteka:redak) | Napomena (što točno) | Vlasnik |
|---|---|---|---|---|---|---|---|
| N-10 | sazetak | Zasebna radna stranica (`sb-two`: sažetak lijevo, karta desno) | nedostaje | postoji | `S:122-125`; `H/n10/SummaryPage.tsx:150-189`; `app/[base]/nastavnik/rad/[id]/sazetak/page.tsx` | Ruta i stranica postoje, dvostupčasti raspored (`two`), sažetak u `WorkPanel sm-h`, karta `km-h` desno. Isti sažetak za studenta i nastavnika (nema role propa). Test `H/n10/SummaryPage.test.ts`, e2e teacher-work.spec.ts:111-114. | |
| N-10 | sazetak | Zaglavlje: „Isti sažetak vide student i nastavnik. Vremena su po zagrebačkom vremenu, zaokružena na minutu.” | odstupa | postoji | `H/n10/messages.hr.ts:7`; `SummaryPage.tsx:83` | Jedna rečenica na jednom mjestu, doslovno kao u prototipu. | |
| N-10 | sazetak | Odjeljak „Razdoblje rada” | postoji | postoji | `SummaryPage.tsx:84-91`; `H/n10/model.ts:97-100,118-126` | Prvi/posljednji događaj izvedeni iz sesija; oblik „20. 10. 2026. u 18:05” kao u prototipu; oznaka „opaženo” uz naslov. Bez sesija: „Trenutačno nije dostupno.” (messages:47, nije u prototipu). | |
| N-10 | sazetak | Odjeljak „Sesije”: broj i prag 30 min | odstupa | postoji | `SummaryPage.tsx:92-98`; `H/n10/messages.hr.ts:5-6,48-49` | „Sesije iz primljenih odsječaka · N sesija” i rečenica „Sesija je niz promjena bez prekida duljeg od 30 minuta (prag P-01, postavka fakulteta). Raspon praznine nije uračunat.” (uz praznine), doslovno. Prag iz poslužitelja (`breakAboveMinutes`). | |
| N-10 | sazetak | `details` „Popis sesija” | postoji | postoji | `SummaryPage.tsx:95-97`; `H/n10/model.ts:103-107` | Oblik „20. 10. 2026., 18:05 do 19:40”, kao u prototipu. | |
| N-10 | sazetak | Odjeljak „Aktivno vrijeme uređivanja” + napomena | postoji | postoji | `SummaryPage.tsx:99-102`; `H/n10/model.ts:135-138`; `H/n10/port.ts:12-24` | „Zbroj trajanja N sesija · 8 h 05 min” i napomena „Vrijeme uređivanja nije mjera truda…” doslovno. Podatak iz `projection.process-summary-details.post`; ako ne stigne: „Trenutačno nije dostupno.” (nije u prototipu). | |
| N-10 | sazetak | Odjeljak „Verzije” (poslano na pregled / predano) | nedostaje | postoji | `SummaryPage.tsx:103-106`; `H/n10/model.ts:146-154`; `H/n10/port.ts:42` (`work.versions.get`) | Samo predane verzije, najnovija „predano”, starije „poslano na pregled”, „28. 10. 2026. u 10:50 · poslano na pregled” kao u prototipu. Prazno: „Još ništa nije poslano na pregled ni predano.” | |
| N-10 | sazetak | Odjeljak „Lijepljenja”: popis (vrijeme, znakovi, „Izvor nije opažen.”, prag, „Bez zbroja”) | odstupa | postoji | `SummaryPage.tsx:107-117`; `H/n10/messages.hr.ts:15-17,50-51`; `H/n10/model.ts:110-115` | „22. 10. 2026., odsječak oko 10:35 · 640 znakova” + „Izvor nije opažen.” + meta „Popisano je svako lijepljenje dulje od 200 znakova (prag P-02…). Vrijeme je zaokruženo na odsječak zapisa. Bez zbroja.” Bez lijepljenja: „Nema lijepljenja iznad praga.” (nije u prototipu). | |
| N-10 | sazetak | „Prikaži mjesto u radu” (`act:jump` na `pv-paste`) | nedostaje | nedostaje | `SummaryPage.tsx:27-30,112` | `Jump` se crta samo ako je sidro u `anchors`; domaćin `anchors` ne prosljeđuje (pages.tsx:124-125), a karta nema označeni tekst (vidi redak „tekst rada s označenim odsječcima”), pa poveznica u hostu nikad nije vidljiva. Komponenta i test (`SummaryPage.test.ts`) spremni. Ovisi o ugovoru za označeni tekst. | |
| N-10 | sazetak | Odjeljak „AI pomoćnik” (prijenosi: vrijeme, pružatelj, model, svrha, znakovi, citat) | nedostaje | odstupa | `SummaryPage.tsx:118-128`; `H/n10/model.ts:156-158`; `H/n10/messages.hr.ts:30-33` | Odjeljak se crta: popis prijenosa (`keyEvents` kind `ai-transfer`) s vremenom odsječka i meta „Popisano je svako prenošenje…”. Pružatelj, model, svrha, broj znakova i citat ne postoje: redak „Pružatelj, model, svrha i preneseni tekst nisu dostupni.” (ugovor `keyEvents` nosi samo `kind` i `at`, migration-contract-types.generated.ts:898-903). Ovisi o ugovoru. | |
| N-10 | sazetak | „Prikaži mjesto u radu” (`act:jump` na `pv-ai`) | nedostaje | nedostaje | `SummaryPage.tsx:123` | Isto kao za lijepljenja: nema sidra u karti. | |
| N-10 | sazetak | Odjeljak „Praznine u zapisu” | odstupa | postoji | `SummaryPage.tsx:129-132`; `H/n10/messages.hr.ts:34-35,53-54` | „Od verzije {od} do verzije {do}. Poslužitelj je primio obje verzije, ali ne i odsječke između njih, pa promjene u tom rasponu nisu zabilježene pojedinačno.” i „Zapis nema praznina.” doslovno. | |
| N-10 | sazetak | Odjeljak „Napomene studenta” („Nema napomena.”) | nedostaje | nedostaje | `SummaryPage.tsx:133-135`; `H/n10/messages.hr.ts:36` | Okvir odjeljka postoji, ali sadržaj uvijek „Trenutačno nije dostupno.”: napomene čita samo student (`student.submission-notes.get` traži `assignmentId`, migration-contract-types.generated.ts:1052); nastavnički ugovor za čitanje ne postoji. C-5 = Da. Tekst „Nema napomena.” nije u kodu. Ovisi o ugovoru. | |
| N-10 | sazetak | Odjeljak „Stanje zapisa” | odstupa | postoji | `SummaryPage.tsx:137-140`; `H/n10/messages.hr.ts:37-39` | „Zapis je cjelovit.” / „Zapis ima praznine (vidi popis).” + „Zapis je neizmijenjen od primitka na poslužitelj.” doslovno (stanje se izvodi iz popisa praznina, ne iz `recordState`). | |
| N-10 | sazetak | Odjeljak o izjavi (skriven, `declStep = false`) | odgođeno | odgođeno po planu | — | Izvor: INVENTAR §3.9, kartice N-10 „Odlučeno 18. 11. (dopuna)”: ne prikazuje se dok ne nastane studentski korak Izjava. Taj je korak sada u hostu (routes.ts:97, predaja/izjava), a nastavnik izjavu već vidi na potvrdi (`H/n07/ReceiptPage.tsx:163`, `H/ai-declaration/AiDeclarationSection.tsx`). Uvjet iz plana možda je ispunjen. | DA (odjeljak izjave u sažetku i rečenica o razgovorima; C-3, uvjet iz kartice N-10) |
| N-10 | sazetak | Karta podrijetla `km-h`: naslov, uvod, „Ductura ne zna tko je tipkao.” | nedostaje | postoji | `H/provenance/ProvenanceMap.tsx:45-47`; `H/provenance/messages.hr.ts:4-6`; `SummaryPage.tsx:184` | Komponenta se montira na stranici sažetka (i u asideu rada, `S:198`). Tekstovi doslovno kao u prototipu (B-1, B-2 odobreni). | |
| N-10 | sazetak | Karta: prekidač „Podrijetlo teksta” (zadano uključen) | nedostaje | postoji | `ProvenanceMap.tsx:50-53`; `H/provenance/model.ts:24` | `data-sw="origin"`, `DEFAULT_SWITCHES = {origin: true, typed: false}` kao u prototipu (`App.state.map`). | |
| N-10 | sazetak | Karta: prekidač „Napisano u Ducturi” (onemogućen bez origin) + objašnjenje | nedostaje | postoji | `ProvenanceMap.tsx:54-58`; `H/provenance/model.ts:26-27` | `disabled={!origin}`, objašnjenje „„Napisano u Ducturi” znači da je tekst nastao u uređivaču…” doslovno. | |
| N-10 | sazetak | Karta: legenda (zalijepljeno / AI / uvezeno / izmjena nastavnika / mjesto za izvor / napisano u Ducturi) | nedostaje | postoji | `ProvenanceMap.tsx:59-63`; `H/provenance/model.ts:32-42`; `H/provenance/messages.hr.ts:11-16` | Šest stavki, „napisano u Ducturi” samo uz oba prekidača; natpisi s opisom crte doslovno. | |
| N-10 | sazetak | Karta: tekst rada s označenim odsječcima i sidra `#pv-paste`, `#pv-ai` (+ meta „Uvoza iz datoteke i izmjena nastavnika u ovom radu nema.”) | nedostaje | nedostaje | `ProvenanceMap.tsx:64-69`; `H/provenance/messages.hr.ts:22` | Umjesto teksta: „Tekst rada s označenim mjestima još nije dostupan.” Čita se samo prisutnost oznaka (`work.origin-composition.get`, `H/provenance/read.ts`); ugovor za označene odsječke teksta ne postoji. Dodatni odjeljak „Podudaranje s odgovorom pomoćnika” postoji (`AssistantMatchSection.tsx`, nije u prototipu). Ovisi o ugovoru. | |
| N-10 | sazetak | Karta bez oznaka (`bez-oznaka`) | nedostaje | postoji | `ProvenanceMap.tsx:64`; `H/provenance/model.ts:25`; `H/provenance/messages.hr.ts:21` | „U ovom radu nema lijepljenja, uvoza ni prijenosa iz AI pomoćnika, pa karta nema oznaka.” doslovno (kad nijedan označeni oblik nema postotak > 0). | |
| N-10 | sazetak | cjelovit (zapis bez praznina) | postoji | postoji | `SummaryPage.tsx:129-139` | „Zapis nema praznina.” i „Zapis je cjelovit.” Testirano u `SummaryPage.test.ts`. | |
| N-10 | sazetak | prazno: „Rad još nije započet, pa sažetka procesa nema.” | nedostaje | postoji | `SummaryPage.tsx:178`; `H/n10/model.ts:48-49`; `H/n10/messages.hr.ts:12` | Zasebno stanje kad nema sesija, lijepljenja ni praznina; doslovno. | |
| N-10 | sazetak | ucitavanje: „Učitavam sažetak procesa…” + kostur | odstupa | postoji | `SummaryPage.tsx:168-169`; `H/n10/messages.hr.ts:8` | Tekst doslovno, `role=status`, kosturi w80/w60/w40, `aria-busy`. | |
| N-10 | sazetak | greska + „Pokušaj ponovno” | odstupa | postoji | `SummaryPage.tsx:170-176`; `H/n10/messages.hr.ts:9-10` | „Sažetak procesa trenutačno nije moguće učitati. Pokušajte ponovno; zapis time nije zahvaćen.” + gumb „Pokušaj ponovno” (ponovno čita). | |
| N-09 | reprodukcija | Ruta i ulaz (poveznica iz rada) | postoji | postoji | `app/[base]/nastavnik/rad/[id]/reprodukcija/page.tsx`; `S:136-138,175`; `H/n06/model.ts:55` | Poveznica „Reprodukcija” u okviru rada i u popisu ispod teksta; „Natrag na rad” na stranici. e2e `teacher-work.spec.ts:100-104`. Nastavnik smije gledati i prije predaje: nema zapreke po stanju predaje. | |
| N-09 | reprodukcija | Uvodni tekst („…Bez vremenske osi i bez trajanja.”) | odstupa | postoji | `H/n09/messages.hr.ts:5`; `H/n09/ReplayPage.tsx:223` | Cijela rečenica doslovno. (Stari tekst `messagesHr.replay` više se ne koristi za nastavnika.) | |
| N-09 | reprodukcija | Podnožje („Isti prikaz vide student, mentor i nastavnik zadatka. Reprodukciju smijete gledati i prije predaje; student to zna iz obavijesti o zadatku.”) | odstupa | postoji | `H/n09/messages.hr.ts:6`; `ReplayPage.tsx:225` | Doslovno. Vidi novi redak o obavijesti studentu. | |
| N-09 | reprodukcija | „Pokreni” / „Zaustavi” (interval 900/brzina ms) | odstupa | postoji | `ReplayPage.tsx:112-116,125`; `H/n09/model.ts:9`; `H/n09/messages.hr.ts:12-13` | Natpisi kao u prototipu, `aria-pressed`, `setTimeout` 900/brzina ms, na kraju staje, s kraja kreće od prve promjene. Gumb onemogućen kad nema koraka. | |
| N-09 | reprodukcija | „Prethodna promjena” / „Sljedeća promjena” | odstupa | postoji | `ReplayPage.tsx:126-127`; `H/n09/messages.hr.ts:14-15` | Natpisi doslovno; onemogućeni na krajevima (`disabled`). | |
| N-09 | reprodukcija | Brzina 1× / 2× / 4× | postoji | postoji | `ReplayPage.tsx:128-132`; `H/n09/model.ts:3` | Isto; natpis „Brzina”. | |
| N-09 | reprodukcija | Select „Skok na” → „Sesija n” | nedostaje | nedostaje | `ReplayPage.tsx:133-139`; `H/n09/messages.hr.ts:17-20` | Mjesto kontrole postoji, ali je onemogućena („nedostupno”) uz napomenu „Skok na sesiju nije dostupan: zapis ne nosi sesije.” Zapis `evidence.replay` nema sesija; komentar u kodu upućuje na D-239 (reprodukcija samo redoslijed, bez trajanja). | DA (D-239: smiju li sesije u reprodukciju) |
| N-09 | reprodukcija | Klizač `#rp-r` | postoji | postoji | `ReplayPage.tsx:140-146`; `H/n09/messages.hr.ts:21-22` | `aria-valuetext` „Promjena n od N”; indeks po koracima, počinje od prve promjene (`playable`, model.ts:22). | |
| N-09 | reprodukcija | Živi redak „Promjena n od N · sesija · izvor ove promjene: …” | odstupa | odstupa | `ReplayPage.tsx:147-152`; `H/n09/messages.hr.ts:22-23` | „Promjena n od N · izvor ove promjene: utipkano” u `role=status` `aria-live=polite`, uz skriveni opis promjene za čitač. Nedostaje „sesija s” (isti uzrok kao „Skok na”). | DA (isto: D-239) |
| N-09 | reprodukcija | Izvori: utipkano / zalijepljeno / prijenos iz AI pomoćnika / praznina u zapisu | odstupa | odstupa | `H/n09/model.ts:14-18`; `H/n09/messages.hr.ts:24-26`; `packages/editor-core/src/document/forensics/evidence-segment-v2.ts:27-36` | „utipkano”, „zalijepljeno” i „praznina u zapisu” kao u prototipu. „Prijenos iz AI pomoćnika” ne može se prikazati: zapis ima samo izvore editor/paste/cut/drop/composition/system-replacement/keyless-input/unattributed. Ostali izvori prikazuju se vlastitim tekstom aplikacije (`messagesHr.replay.sources`). Ovisi o ugovoru. | |
| N-09 | reprodukcija | Prikaz teksta: istaknut dodani tekst (`.rp-new`) | odstupa | odstupa | `ReplayPage.tsx:27-57,157` | Ističe se cijeli odlomak koji je promjena dotakla (`touched`), ne samo umetnuti tekst; promjena se opisuje i riječima (`describeChange`). Namjerno bez boje presude (D-128); granularnost se razlikuje od prototipa. Ne traži zadatak osim ako vlasnik želi isticanje samo umetnutog. | |
| N-09 | reprodukcija | Poruka o praznini (`.rp-gap`) | odstupa | odstupa | `ReplayPage.tsx:101,153-156`; `src/components/replay/replay-view.ts:116-128`; `src/lib/i18n/messages.hr.ts:2078-2084` | Blok „Praznina u zapisu” s tekstom „Između promjene a i promjene b nema zabilježenih promjena.” + „Reprodukcija se nastavlja od sljedeće zabilježene promjene.”; tri vrste (`starts_later`, `resumed`, prekid). Nema datuma primljenih verzija iz prototipa („poslužitelj je primio verzije 26. 10. … i 28. 10. …”). | |
| N-09 | reprodukcija | praznine (zapis s prazninom) | postoji | postoji | `ReplayPage.tsx:150,153-156,188-202` | Praznina je vidljiva na mjestu (oznaka u retku + blok) i u popisu „Praznine u zapisu” s „Idi na promjenu n”. | |
| N-09 | reprodukcija | prazno: „Nema promjena za prikaz: rad još nije započet.” | odstupa | postoji | `ReplayPage.tsx:219-220`; `H/n09/messages.hr.ts:10` | Doslovno, kad nema promjena ni praznina. e2e `teacher-work.spec.ts:103`. | |
| N-09 | reprodukcija | ucitavanje: „Učitavam promjene rada…” + kostur | postoji | postoji | `ReplayPage.tsx:211-216`; `H/n09/messages.hr.ts:7` | Isti tekst (s trotočkom) i kosturi, `aria-busy`. | |
| N-09 | reprodukcija | greska + „Pokušaj ponovno” | odstupa | postoji | `ReplayPage.tsx:228-234`; `H/n09/messages.hr.ts:8-9` | „Promjene rada trenutačno nije moguće učitati. Pokušajte ponovno.” + gumb koji ponovno čita (`retry`). | |
| N-11 | usporedba | Ruta „Usporedba verzija” i ulaz iz rada (samo uz predan rad) | nedostaje | postoji | `app/[base]/nastavnik/rad/[id]/usporedba/page.tsx`; `S:118-121,177`; `H/n11/Entry.tsx:16`; `H/n06/model.ts:56` | Ruta montirana. Ulaz samo uz najmanje jednu predanu verziju (`hasSubmission`), i u okviru rada i u popisu. Unit testovi `H/n11/model.test.ts`; nema e2e klika. | |
| N-11 | usporedba | Jedan izbornik „Usporedi s …” (zadano prethodna) + naslov „Predana verzija · … · verzija n” + pomoćni tekst | odstupa | postoji | `H/n11/Compare.tsx:64-85`; `H/n11/model.ts:41-57`; `H/n11/messages.hr.ts:15-16` | Jedan `select#f-cmp` s „Poslano na pregled · … · verzija n”, popis samo poslanih verzija starijih od zadnje, zadano prethodna, pomoćni tekst doslovno. Opcija ima onoliko koliko je poslanih verzija (prototip jednu). | |
| N-11 | usporedba | Brojke „Dodano n riječi” / „Uklonjeno n riječi” + „Broj riječi je opis, bez boje i bez praga.” | odstupa | odstupa | `Compare.tsx:48-54`; `H/n11/model.ts:62-69`; `H/n11/messages.hr.ts:18-19` | Dva retka i napomena doslovno. Brojanje je po cijelim blokovima iz `work.compare.get` (changed paragraf = cijeli uklonjeni + cijeli dodani blok), pa brojke nisu razlika riječi nego zbroj riječi u promijenjenim odlomcima. | |
| N-11 | usporedba | Tekst s ins/del i riječima „dodano:” / „uklonjeno:” (čitači zaslona) | postoji | odstupa | `Compare.tsx:55-59`; `packages/ui/src/components/diff-view/DiffView.tsx:24-35` | Za čitač zaslona „Dodano: ”/„Uklonjeno: ” u `ins`/`del` postoji. Razlika: prikaz je po blokovima, ne unutar odlomka kao u prototipu („…kandidat, ~~osobito u manjim sredinama~~ što je u Gradu A…”); promijenjen odlomak = cijeli precrtani + cijeli podcrtani odlomak. Nepromijenjeni blokovi crtaju se kao običan `p` (naslovi i popisi gube vrstu bloka), a DiffView uz svaki promijenjeni blok ponavlja vidljivu legendu. Rješivo klijentski (`work.version.get` ×2 + `src/domain/diff/diff.ts`) ili proširenjem ugovora. | |
| N-11 | usporedba | prazno: „Postoji samo jedna poslana verzija…” + „Otvori reprodukciju” | odstupa | postoji | `Compare.tsx:69-71`; `H/n11/messages.hr.ts:13-14`; `S:119-120` | Tekst i poveznica doslovno; `replayHref` vodi na reprodukciju. | |
| N-11 | usporedba | ucitavanje: „Učitavam poslane verzije…” | odstupa | postoji | `Compare.tsx:14-16,109`; `H/n11/messages.hr.ts:7` | Doslovno + kosturi; za usporedbu zasebno „Učitavam usporedbu…” (nije u prototipu). | |
| N-11 | usporedba | greska + „Pokušaj ponovno” | odstupa | postoji | `Compare.tsx:20-27,110`; `H/n11/messages.hr.ts:9` | „Verzije trenutačno nije moguće učitati. Pokušajte ponovno.” + gumb koji radi. Greška usporedbe: „Usporedbu trenutačno nije moguće učitati…” (messages:10). | |
| N-09/10/11 | sazetak, reprodukcija, usporedba | `novo` Natrag na rad (sticky traka `.sb-bar`) | novo | postoji | `H/n07/WorkPage.tsx:13-25`; `H/n10/messages.hr.ts:2`; `H/n09/messages.hr.ts:3`; `H/n11/messages.hr.ts:5` | „Natrag na rad” na sva tri ekrana (u prototipu `workPage`). | |
| N-09/10/11 | sazetak, reprodukcija, usporedba | `novo` Oznaka vrste rada uz naslov panela („Seminarski rad”) | novo | nedostaje | `H/n07/WorkPage.tsx:28-41` (`tag` se ne prosljeđuje) | Prototip: `panel('sm-h','Sažetak procesa','Seminarski rad',…)`, isto za `rp-h` i `cp-h`. Aplikacija ne šalje `tag`; `teacher.work.get` ne nosi vrstu zadatka (migration-contract-types.generated.ts:188). Ovisi o ugovoru. | |
| N-10 | sazetak | `novo` Ulaz u sažetak: banner praznina „Otvori sažetak procesa” (C-18) i poveznica „Otvori puni sažetak procesa” iz „Prije predaje” | novo | postoji | `H/n06/WorkFrame.tsx:76`; `H/n06/messages.hr.ts:40`; `H/pre-submit/PreSubmitPanel.tsx:35`; `H/pre-submit/messages.hr.ts:16` | Prototip rad r. 849 i predaja r. 921. Tekst banera doslovno (`n06/messages.hr.ts` `gaps`). e2e `teacher-work.spec.ts:111`. | |
| N-09 | reprodukcija | `novo` Student zna iz obavijesti da nastavnik smije gledati reprodukciju prije predaje | novo | odstupa | `src/lib/i18n/messages.hr.ts:1560` | Obavijest o zadatku kaže da će nastavnik (mentor) moći reproducirati nastanak rada, ali ne kaže „i prije predaje” (kartica N-09: „Obavijest studentu mora reći…”). Studentski ekran, provjeriti uz dio za studenta. | |
| N-11 | usporedba | `novo` Pomoćna rečenica o oznakama („Dodano je podvučeno punom crtom i nosi riječ „dodano”… Student i mentor vide istu usporedbu.”) | novo | nedostaje | `H/n11/messages.hr.ts` (nema ključa) | Rečenica pod tekstom u prototipu (r. 1131) ne postoji u kodu. Tekstualna sitnica. | |

#### 2. Novo u appu bez prototipa

- N-10: odjeljak „Pravila fakulteta” (jedna od tri oznake po vrsti izvora: u skladu / za pregled / prekoračeno, P-1 pravilo 12): `H/n10/SummaryPage.tsx:58-72,136`, `H/n10/port.ts:26-36` (`work.origin-thresholds.get`).
- N-10: odjeljak „Podudaranje s odgovorom pomoćnika” u karti: `H/provenance/AssistantMatchSection.tsx`.
- N-10/N-06: kartica sažetka (`SummaryCardBody`) i karta podrijetla (`ProvenanceMap`) također u asideu rada uživo (`S:197-198`); prototip sažetak u radu nema (osim kartice u Brzom putu).
- N-10: zasebna stanja bez zapisa u prototipu: „Sažetak ovog rada nije dostupan ovom računu.” (`notFound`), „Trenutačno nije dostupno.” po odjeljku, vlastita greška karte i prijava istekla (`provenance/messages.hr.ts:23-25`).
- N-09: „Što se reproducira” (cijeli rad / jedan odlomak, izbor odlomka uključujući obrisane), tablica „Povijest odlomka” s podrijetlom verzija, opis promjene riječima za čitač, prikaz citata/fusnota (v3): `H/n09/ReplayPage.tsx:174-187,158-173,27-41`; `src/lib/i18n/messages.hr.ts:2062-2105`.
- N-09: popis „Praznine u zapisu” s „Idi na promjenu n” i tri vrste praznina.
- N-11: „Nema razlike između odabranih verzija.” (`messages:11`), izbor više starijih poslanih verzija.

#### 3. Prijedlozi zadataka (samo nedostaje/odstupa)

Veličina: S do ~100 redaka, M do ~400, L veći.

| # | PR (naslov) | Pokriva retke | Vel. | Ovisnost |
|---|---|---|---|---|
| C-1 | N-11: usporedba riječ po riječ unutar odlomka (klijentski diff dviju verzija), zadržati vrstu bloka, jedna legenda, točne brojke, pomoćna rečenica o oznakama | N-11 „Tekst s ins/del”, „Brojke”, novi redak „Pomoćna rečenica” | M | Bez servera: `work.version.get` ×2 (`readTimeMachineVersion`) + `src/domain/diff/diff.ts`; ili novo polje u `work.compare.get` |
| C-2 | Karta podrijetla: označeni tekst rada i sidra + „Prikaži mjesto u radu” za lijepljenja i AI (spojiti `anchors` u `S:124`) | N-10 „tekst rada s označenim odsječcima”, 2× „Prikaži mjesto u radu” | L | Ugovor: čitanje teksta s odsječcima podrijetla za nastavnika (nema ga u izvlečku) |
| C-3 | Sažetak: detalji AI prijenosa (pružatelj, model, svrha, znakovi, citat) i izvor „prijenos iz AI pomoćnika” u reprodukciji | N-10 „AI pomoćnik”, N-09 „Izvori promjene” | M | Ugovor: proširenje `keyEvents` u `process-summary-details` i izvora u zapisu reprodukcije |
| C-4 | Sažetak: „Napomene studenta” (C-5) | N-10 „Napomene studenta” | S/M | Ugovor: nastavničko čitanje studentskih napomena uz predaju; klijent samo prikaz |
| C-5 | Reprodukcija: sesija u živom retku i „Skok na” sesiju | N-09 „Skok na”, „Živi redak” | M | Ugovor (sesije u zapisu reprodukcije) + odluka D-239 |
| C-6 | Reprodukcija: poruka o praznini s datumima primljenih verzija | N-09 „Poruka o praznini” | S/M | Provjeriti: povezati prazninu u zapisu s vremenima iz sažetka (`gaps.items`) bez novog ugovora; inače ugovor |
| C-7 | Oznaka vrste rada uz naslov panela (N-09/10/11) | novi redak „Oznaka vrste rada” | S | Ugovor: vrsta zadatka u `teacher.work.get` |
| C-8 | Obavijest studentu: „nastavnik smije gledati reprodukciju i prije predaje” | novi redak „Student zna iz obavijesti” | S | Bez servera (tekst, studentski dio); uskladiti s dijelom za studenta |

#### 4. Stavke koje traže vlasnikovu odluku

1. **Izjava u sažetku (N-10, C-3).** Odjeljak izjave i rečenica o razgovorima skriveni su „dok ne nastane studentski korak Izjava”. Korak sada postoji i nastavnik izjavu vidi na potvrdi; treba izričito reći prikazuje li se i u sažetku (i kad).
2. **Sesije u reprodukciji (N-09, D-239).** Prototip ima „Skok na sesiju” i „sesija” u retku, a D-239 kaže „bez trajanja”. Odluka: ulaze li sesije u reprodukciju (traži i izmjenu zapisa na poslužitelju) ili se kontrola uklanja iz prototipa.
3. **Dodaci reprodukcije bez prototipa (N-09).** Zadržati „Što se reproducira” (jedan odlomak, obrisani odlomci) i „Povijest odlomka”? (Analogno A-10 „Zadržati”, ali A-10 govori o ekranima, ne o funkcijama unutar ekrana.)
4. **„Pravila fakulteta” u sažetku (N-10).** Oznake „u skladu / za pregled / prekoračeno” nisu u prototipu; potvrditi uz „brojevi uz događaje kao činjenice, bez zbirne ocjene” (kartica N-10, D-61) i PRODUCT §5.
5. **Dvostruki prikaz u radu (N-10/N-06).** Sažetak i karta podrijetla u asideu rada uživo uz zasebnu stranicu; prototip ih ima samo na stranici sažetka. Ostaju li oboje?
6. **Isticanje promjene u reprodukciji (N-09).** Cijeli dotaknuti odlomak (D-128, bez boje presude) ili samo umetnuti tekst kao u prototipu `.rp-new`.

### Dio D: Konzultacije (N-12), produljenje (N-13), izvoz za Merlin (N-18)

Stanje koda: grana migracija/wpar2n-paritet2-nastavnik, samo čitanje. Živa aplikacija: `packages/app/src/host/teacher/{n12,n13,merlin}`, rute u `packages/app/app/[base]/nastavnik/...`. Putanje ispod su relativne na `packages/app/src/host/teacher/` osim gdje piše drukčije. Izvor istine: INVENTAR-nastavnik 3.12 do 3.14, Ductura_nastavnik.html (blokovi N-12, N-13, N-18), kartice, ODGOVORI (B-4, B-6, C-15, C-16).

Što se promijenilo od stare revizije: sva tri ekrana sada postoje u hostu kao zasebne komponente (N12Consultations, N13Extensions, Merlin/MerlinPage) s tekstom iz prototipa, tostom od 3200 ms tek nakon potvrde poslužitelja (N-12) odnosno bannerom (N-13, kao u prototipu), stvarnim ugovorima (`work.consultation-records.*`, `teacher.deadline-extension*.`, `teacher.merlin-*`). Stara tvrdnja "N-18 nema rute u hostu" i "N-12/N-13 odstupaju u tekstu" više ne vrijedi. Glavni ostatak: N-12 nema "Prije prve verzije" i datum uz verziju; N-13 ulaz iz banera na radu ne radi jer `WorkFrame` ne dobiva `deadlinePassed`; N-18 sitne razlike (naslov u izborniku zadatka, tekst tosta).

Ocjene: postoji / odstupa / nedostaje / odgođeno po planu. "Vlasnik" = stavka traži vlasnikovu odluku (vidi dio 4).

#### 1. Tablica

| Oznaka | Ekran | Stanje | Stara ocjena | Ocjena danas | Implementacija (datoteka:redak) | Napomena (što točno) | Vlasnik |
|---|---|---|---|---|---|---|---|
| N-12 | konzultacije | Ruta i ulaz iz rada | postoji | postoji | `packages/app/app/[base]/nastavnik/rad/[id]/konzultacije/page.tsx`; `work/pages.tsx:59,113-116`; `n06/model.ts:58`; `n12/N12Consultations.tsx:49` | Ulaz je poveznica „Konzultacije" u traci poveznica okvira rada (N-06). Dokaz: `packages/app/e2e/teacher-work.spec.ts:117-123`. Izvođenje (probe/rad-konzultacije.txt) pokazuje samo „Pristup radu trenutačno nije moguće provjeriti." jer scenarij „puno" nema `teacher.access.get`; ostali N-12 retci temelje se na kodu i e2e, ne na izvođenju. „Natrag na rad" isti tekst kao prototip, vodi na rad. | |
| N-12 | konzultacije | puno: tablica zapisa (Datum / Tema / Verzija rada), poveznica na zapis | postoji | postoji | `n12/N12Consultations.tsx:107-124`; `n12/model.ts:22` | Stupci i `aria-label` „Zapisi konzultacija" kao prototip; datum je poveznica na `?zapis=`; poredak silazno po datumu (prototip: redoslijed unosa). Vidi novi redak o verziji. | |
| N-12 | konzultacije | puno: napomena „Zapise vide mentor i student. Dopunjuje ih samo mentor." | nedostaje | postoji | `n12/N12Consultations.tsx:125`; `n12/messages.hr.ts:11` | Doslovno kao prototip. | |
| N-12 | konzultacije | Gumb „Novi zapis konzultacije" (`act:new`) | postoji | postoji | `n12/N12Consultations.tsx:126,104` | Vodi na `?novi=1`; prisutan i u praznom stanju. | |
| N-12 | konzultacije | novi: polja datum, verzija rada (select), tema, dogovoreno | odstupa | postoji | `n12/N12Consultations.tsx:188-203`; `n12/model.ts:12-17` | Datum je zadan na današnji (`todayIso`), natpisi isti, select verzija s poslužitelja („Učitaj starije verzije", „Rad još nema dostupnih verzija."). Datum je `type="date"`, prototip tekst (izgled, ne ocjenjuje se). | |
| N-12 | konzultacije | novi: tema obvezna, „Upišite temu konzultacije." kao toast | odstupa | postoji | `n12/N12Consultations.tsx:166-173,203`; `n12/model.ts:36-39` | Obrazac je `noValidate` (:197), pa poruka stvarno stiže; toast kroz `useTeacherToasts` (3200 ms), fokus na polje teme. Dodano „Upišite datum i odaberite verziju rada." | |
| N-12 | konzultacije | novi: napomena „Zapis vide mentor i student. Zapis je vezan uz verziju rada. Nakon bilježenja zapis se ne briše ni ne prepravlja; može ga dopuniti samo mentor." | odstupa | postoji | `n12/messages.hr.ts:30`; `n12/N12Consultations.tsx:204` | Doslovno kao prototip. | |
| N-12 | konzultacije | novi: uspjeh, toast „Konzultacija je zabilježena. Isti zapis vidi i student." | odstupa | postoji | `n12/N12Consultations.tsx:77-82,176-182` | Toast se prikazuje tek nakon potvrde poslužitelja (B-6) i prelazi na zapis kao prototip. Neuspjeh: toast „Spremanje zapisa nije potvrđeno…" i obrazac ostaje. | |
| N-12 | konzultacije | novi: „Zabilježi konzultaciju" i „Odustani" | postoji | postoji | `n12/N12Consultations.tsx:206-209` | Tijekom spremanja „Spremam…", „Odustani" se skriva; gumb onemogućen dok nema verzija. | |
| N-12 | konzultacije | zapis: naslov, datum, tema, verzija rada, „Dogovoreno" | odstupa | postoji | `n12/N12Consultations.tsx:94,246-250`; `n12/messages.hr.ts:12,23` | Naslov „Konzultacija {datum}" i prazno „Nije upisano." kao prototip. Verzija rada vidi novi redak. | |
| N-12 | konzultacije | zapis: popis „Dopune" (tko · vrijeme, tekst) / „Nema dopuna." | odstupa | postoji | `n12/N12Consultations.tsx:251-258`; `n12/messages.hr.ts:33-34` | Svaka dopuna „Vi · 4. 11. 2026. u 8:30" (`momentHr`, Europe/Zagreb). | |
| N-12 | konzultacije | zapis: obrazac „Dopuna zapisa" + „Dodaj dopunu"; napomena da se zapis ne briše | odstupa | postoji | `n12/N12Consultations.tsx:259-265`; `n12/messages.hr.ts:36-38` | Pomoćni tekst pod poljem i redak „Isti zapis i dopune vidi i student." doslovno kao prototip. | |
| N-12 | konzultacije | zapis: prazna dopuna → toast „Upišite dopunu." | odstupa | postoji | `n12/N12Consultations.tsx:225-232`; `n12/model.ts:42-45` | `noValidate`, `aria-invalid`, fokus na polje, toast. | |
| N-12 | konzultacije | zapis: uspjeh, toast „Dopuna je dodana. Vidi je i student." | odstupa | postoji | `n12/N12Consultations.tsx:236-242`; `n12/messages.hr.ts:39` | Toast nakon potvrde poslužitelja; dopuna se dodaje u popis bez ponovnog učitavanja; obrazac se prazni. Greška: toast „Spremanje dopune nije potvrđeno…". | |
| N-12 | konzultacije | zapis: „Svi zapisi" (`act:list`) | postoji | postoji | `n12/N12Consultations.tsx:265` | | |
| N-12 | konzultacije | prazno: „Još nema zapisa konzultacija uz ovaj rad." + „Novi zapis konzultacije" | postoji | postoji | `n12/N12Consultations.tsx:102-106` | | |
| N-12 | konzultacije | ucitavanje: „Učitavam zapise konzultacija…" | postoji | postoji | `n12/N12Consultations.tsx:60-67` | Tekst + kostur, `aria-busy`. | |
| N-12 | konzultacije | greska: „Zapise konzultacija trenutačno nije moguće učitati. Pokušajte ponovno." + gumb | odstupa | postoji | `n12/N12Consultations.tsx:69-75`; `n12/messages.hr.ts:6-7` | Tekst doslovno kao prototip, gumb „Pokušaj ponovno" ponovno čita. | |
| N-12 | konzultacije | verzija rada u popisu i zapisu: „Verzija 1, poslana 28. 10. 2026." | novo | odstupa | `n12/model.ts:9,24-29`; `n12/N12Consultations.tsx:120,248` | U popisu i zapisu stoji samo „Verzija N" (`revisionLabel`); ugovor `work.consultation-records.*` ne vraća datum verzije. Datum se vidi samo u izborniku pri unosu („Verzija 2, predana 5. 11. 2026."). Traži ili dodatno polje u ugovoru ili dohvat verzije. | |
| N-12 | konzultacije | verzija „Prije prve verzije" (konzultacija prije nego što rad ima verziju) | novo | nedostaje | `src/client/migration-contracts.generated.json:2169` (`revision` minimum 1) | Prototip ima zapis „Izbor medija za analizu" s verzijom „Prije prve verzije". Ugovor traži cijeli broj ≥ 1, a obrazac je onemogućen dok rad nema verzija (`N12Consultations.tsx:206`, `emptyVersions`). Zahtijeva izmjenu ugovora/baze. | OC: smije li zapis bez verzije |
| N-13 | produljenje | Ruta (jedan zadatak) i ulaz iz kartice kolegija | postoji | odstupa | `packages/app/app/[base]/nastavnik/zadatak/[assignmentId]/produljenje/page.tsx`; `assignment-card/AssignmentCards.tsx:129`; `overview.tsx:59-62` | Ruta radi (UUID provjera, `notFound`). Poveznica „Produljenje roka" je na kartici kolegija (N-01) kao u prototipu, ali vodi samo na jedan, „sljedeći" zadatak (`next`), a skrivena je suradniku. Iz Zbirnog pregleda poveznice više nema (stara je tvrdnja bila netočna za N-17 kartice); prototip je ni nema ondje. | |
| N-13 | produljenje | Zaglavlje: „Produljenje roka" + lede s imenom zadatka, kolegijem i rokom | odstupa | postoji | `n13/messages.hr.ts:4-8`; `n13/Extensions.tsx:67-69`; `overview.tsx:36-52` | Lede „Zadatak „X", Kolegij A · rok … Produljenje pokrećete samo Vi; student ga ne traži kroz Ducturu." Dijelovi koje čitanje ne da izostavljaju se. Izvođenje (probe/produljenje.txt): cijeli tekst, 4 studenta i popis prikazani. Vrsta rada („Seminarski rad") se ne piše, nego „Zadatak". | |
| N-13 | produljenje | Obrazac: „Za koga" jedan student / svi studenti zadatka (n) | odstupa | postoji | `n13/Extensions.tsx:90-96`; `n13/messages.hr.ts:15-16` | Radio gumbi „Jedan student" / „Svi studenti zadatka (4)" s brojem. „Jedan student" se ne nudi ako popis studenata nije dostupan (tada poruka i samo „svi"). | |
| N-13 | produljenje | Obrazac: student (`#f-ps`, samo za jednog) | postoji | postoji | `n13/Extensions.tsx:99-105` | Select iz `teacher.assignment-overview.get`; „Ime nije dostupno" za neimenovanog. | |
| N-13 | produljenje | Obrazac: novi rok (Europe/Zagreb) | odstupa | postoji | `n13/Extensions.tsx:107`; `n13/messages.hr.ts:19-20` | Pomoć „Datum i sat po zagrebačkom vremenu (Europe/Zagreb)." + „Novi rok mora biti kasniji…". Polje prazno (prototip zadano „15. 11. 2026. u 23:59"); `datetime-local`. Funkcijski jednako, zadana vrijednost nije potrebna. | |
| N-13 | produljenje | Obrazac: razlog s popisa + „bez slobodnog teksta, vidite ga samo Vi i …" | odstupa | postoji | `n13/Extensions.tsx:108-116`; `n13/messages.hr.ts:21-23`; `src/client/deadline-extensions.ts:19-20` | Četiri razloga kao prototip; „Produljenje za sve" nudi se samo uz „Svi studenti" (prototip ga nudi uvijek). Pomoć „Razlog se bira s popisa, bez slobodnog teksta. Vidite ga samo Vi i ovaj student / studenti zadatka." doslovno. | Q-5 ADR (popis razloga) |
| N-13 | produljenje | Gumbi „Zabilježi produljenje" i „Odustani" (`go:kolegiji`) | odstupa | postoji | `n13/Extensions.tsx:117-119` | „Odustani" je poveznica na `/nastavnik` (kolegiji). Tijekom spremanja „Bilježi se…". | |
| N-13 | produljenje | Obvezna polja / pogreška unosa | odstupa | postoji | `n13/Extensions.tsx:45-50`; `n13/messages.hr.ts:41,43` | Prototip nema provjeru. App: banner „Odaberite studenta, novi rok i razlog." i „Produljenje nije zabilježeno. Provjerite da je novi rok kasniji…". Dodatak, vidi "Novo u appu". | |
| N-13 | produljenje | odobreno: „Produljenje je zabilježeno. Student vidi novi rok uz zadatak. Razlog vidite samo Vi i taj student." | odstupa | postoji | `n13/messages.hr.ts:38-39`; `n13/model.ts:61-63`; `n13/Extensions.tsx:55-61,81-85` | Banner bez tosta (kao prototip), puni tekst; samo nakon potvrde poslužitelja; obrazac se prazni, popis se ponovno čita. | |
| N-13 | produljenje | sukob: „Student A je predaju zatražio … prije ovog produljenja. …" | odstupa | odstupa | `n13/model.ts:61-66`; `n13/messages.hr.ts:40` | Banner „{ime|Student} je predaju zatražio prije ovog produljenja. Produljenje ne mijenja tu predaju; bilježi se kao dopuna uz nju." prikazuje se nakon spremanja (oznaka poslužitelja `existingSubmissionsUnchanged`), ne uz odabir studenta. Izostavljeno je vrijeme predaje („5. 11. 2026. u 21:14"). | |
| N-13 | produljenje | za-sve: bez studenta, „Novi rok vrijedi za sve studente zadatka. Studenti koji su već predali zadržavaju svoju predaju." | odstupa | postoji | `n13/Extensions.tsx:97-98`; `n13/messages.hr.ts:17` | Doslovno. | |
| N-13 | produljenje | Popis „Produljeni rokovi" (tko, novi rok, stari rok, razlog, tko i kada) | odstupa | postoji | `n13/Extensions.tsx:121-140`; `n13/model.ts:68-83` | Redak „{tko} · novi rok …" + „Stari rok … · razlog: … · zabilježio Vi/drugi nastavnik, vrijeme" i napomena „Zapis o produljenju (stari i novi rok, tko i kada) se ne briše." Izvođenje potvrđuje „zabilježio Vi / drugi nastavnik, 21. 11. 2026. u 10:15" i skriveni razlog. Prototip piše „zabilježio Nastavnik A"; app ne imenuje drugog nastavnika, a razlog drugog nastavnika skriva („Vidi ga nastavnik koji je zabilježio produljenje"), u skladu s pravilom da razlog vide samo nastavnik i student. | |
| N-13 | produljenje | prazno: „Nijedan rok nije produljen." | postoji | postoji | `n13/Extensions.tsx:128`; `n13/messages.hr.ts:32` | | |
| N-13 | produljenje | ucitavanje: „Učitavanje rokova…" | odstupa | postoji | `n13/Extensions.tsx:70-75`; `n13/messages.hr.ts:11` | Stanje po ekranu s kosturom (više nije opće „Učitavanje…"). | |
| N-13 | produljenje | greska: „Rokove trenutačno nije moguće učitati. Pokušajte ponovno." + „Pokušaj ponovno" | odstupa | postoji | `n13/Extensions.tsx:76-81,123-127`; `n13/messages.hr.ts:12-14` | Tekst kao prototip; gumb „Pokušaj ponovno" i za pad cijelog čitanja i za pad samo popisa („Produljeni rokovi trenutačno nisu dostupni…"). | |
| N-13 | produljenje | ulaz iz banera „Rad nije predan do roka…" + poveznica „Produljenje roka" (na ekranu rada) | novo | odstupa | `n06/WorkFrame.tsx:77-79`; `n06/model.ts:68-73`; `n06/messages.hr.ts:40-41`; `work/pages.tsx:164` | Tekst i poveznica postoje, ali `WorkFrame` se u `pages.tsx` zove bez `deadlinePassed` (zadano `null`), pa `showNotSubmittedBanner` nikad nije istina i banner se ne vidi. Treba izvor "rok je prošao" (iz `teacher.work.get` ili čitanja zadatka). Spada u N-06, ali je jedini ulaz u N-13 iz rada. | |
| N-18 | izvoz | Ruta „Izvoz za Merlin" u živoj aplikaciji | nedostaje | postoji | `packages/app/app/[base]/nastavnik/zadatak/[assignmentId]/merlin/page.tsx`; `merlin/MerlinPage.tsx:39-71`; `src/routes.ts:125-126` | Ruta montirana u hostu (UUID provjera), shell „side". Čita preko `src/client/merlin-export.ts`; `no-direct-api.test.ts`. | |
| N-18 | izvoz | Ulaz u ekran (poveznica „Izvoz za Merlin" s „Moji kolegiji") | nedostaje | postoji | `assignment-card/AssignmentCards.tsx:131-132`; `assignment-card/messages.hr.ts:34` | Poveznica na kartici kolegija, ali vodi na prvi zadatak kolegija (`assignments[0]`), a ostali se biraju izbornikom „Zadatak" na ekranu; skrivena suradniku (`role !== "collaborator"`). | |
| N-18 | izvoz | Zaglavlje „Izvoz za Merlin" + lede | postoji | postoji | `merlin/MerlinPage.tsx:49-52`; `merlin/messages.hr.ts:4-5` | Doslovno. | |
| N-18 | izvoz | Odabir zadatka (`#f-ex`) | odstupa | odstupa | `merlin/Merlin.tsx:87-93`; `merlin/MerlinPage.tsx:68` | Select „Zadatak" postoji (izvođenje: opcije su samo naslovi zadataka) i mijenja adresu. Natpis opcije je samo naslov zadatka („Naziv zadatka nije dostupan" kad ga nema), bez vrste rada i „rok je prošao" kao u prototipu; promjena je puni prijelaz stranice, a fokus se ne vraća na select. Ako čitanje kolegija padne, select se ne prikazuje. | |
| N-18 | izvoz | Pregled CSV-a: tablica s 8 stupaca po prezimenu | odstupa | postoji | `merlin/Merlin.tsx:14,126-137`; `merlin/model.ts:44-62`; `merlin/messages.hr.ts:18-27` | Izvođenje (probe/merlin.txt): osam stupaca, „da/ne/nema", napomena i „Otisci" prikazani; redoslijed redaka lažnog poslužitelja nije po prezimenu (Anić, Šimić, bez imena), pa klijent ne sortira. Osam stupaca s natpisima kao prototip (Prezime, Ime, Predano, Vrijeme predaje, Nakon roka, Naziv datoteke u zipu, Otisak PDF, Otisak .docx); bez predaje „ne" i „nema". Napomena ispod doslovno kao prototip. Poredak „po prezimenu" određuje poslužitelj, klijent ne sortira (`src/client/merlin-export.ts:97`): neprovjereno u ovom repou. | D-292 (naziv datoteke) |
| N-18 | izvoz | Kartica „Otisci" | postoji | postoji | `merlin/Merlin.tsx:139-143`; `merlin/messages.hr.ts:31-34` | Tri rečenice doslovno. | |
| N-18 | izvoz | „Pripremi paket za Merlin" (`act:prep`, onemogućen tijekom pripreme) | postoji | postoji | `merlin/Merlin.tsx:57-68,151`; `src/client/merlin-export.ts` (`requestMerlinPackage`) | Izvođenje (probe/merlin.txt): oba gumba vidljiva. Stvarno traži paket pod ključem zahtjeva (ponavljanje = isti paket); `busy` dok traje; skriven kad nema predaja; nakon završetka „Pripremi novi paket". | |
| N-18 | izvoz | „Preuzmi samo popis" (`act:csv`) | postoji | postoji | `merlin/Merlin.tsx:152`; `merlin/model.ts:35-38` (`merlinCsvPath`) | Preglednik dobiva CSV putanju iz ugovora `teacher.merlin-roster-csv.get`. | |
| N-18 | izvoz | priprema: „Paket se priprema. Možete napustiti stranicu; paket ostaje u pripremi." | odstupa | postoji | `merlin/Merlin.tsx:41-45,107-110`; `merlin/messages.hr.ts:42` | Puni tekst + spinner (`sb-spin`), `role=status`; ponovno čitanje svake 3 s (`POLL_MS`). | |
| N-18 | izvoz | spreman: banner „Paket je spreman. … Poveznica vrijedi 24 h, do …" | odstupa | postoji | `merlin/Merlin.tsx:111-125`; `merlin/messages.hr.ts:43-44` | Doslovno, uključujući „za odabrani zadatak". Istek se prati vremenom (`setTimeout`); poslije isteka „Poveznica … istekla je … Pripremite novi paket." | |
| N-18 | izvoz | spreman: „Otisak paketa" (grupe od 4 znaka) + objašnjenje | postoji | postoji | `merlin/Merlin.tsx:117-119`; `packages/ui/src/fingerprint/index.tsx:26-30` | | |
| N-18 | izvoz | spreman: „Preuzmi paket" (`act:dl`) | postoji | postoji | `merlin/Merlin.tsx:70-81,121` | Prije preuzimanja ponovno čita stanje i preuzima samo ako je paket još spreman (C-16). | |
| N-18 | izvoz | spreman: „Kopiraj otisak" + toast „Otisak paketa je u međuspremniku (64 znaka, bez razmaka)." | odstupa | odstupa | `packages/ui/src/fingerprint/index.tsx:16-33`; `packages/ui/src/fingerprint/messages.hr.ts:2-4`; `packages/ui/src/components/toast-queue.ts:11` | Natpis gumba „Otisak u međuspremnik" je odobreno (B-4). Tekst tosta skraćen: „Otisak je u međuspremniku (64 znaka, bez razmaka)." (bez „paketa"). Toast je 3200 ms, greška „Prijenos otiska u međuspremnik nije uspio." ostaje do zatvaranja. | |
| N-18 | izvoz | prazno: „Nema predanih radova" / „Paket se može pripremiti kad bude barem jedan predani rad." | odstupa | postoji | `merlin/Merlin.tsx:96-103` | Prikazuje se samo izbornik zadatka i kartica „Nema predanih radova", kao prototip (CSV, „Otisci" i gumbi se više ne crtaju). | |
| N-18 | izvoz | ucitavanje: „Učitavanje predaja…" | nedostaje | postoji | `merlin/MerlinPage.tsx:53-58`; `merlin/messages.hr.ts:7` | Tekst + kostur u kartici. | |
| N-18 | izvoz | greska: „Predaje trenutačno nije moguće učitati. Pokušajte ponovno." + „Pokušaj ponovno" | odstupa | postoji | `merlin/MerlinPage.tsx:59-64` | Tekst i gumb kao prototip; popis se ne prikazuje prazan. | |

Brojke (49 starih redaka + 4 nova): vidi sažetak na kraju datoteke.

#### 2. Novo u appu bez prototipa

- N-12: greška „Verzije rada trenutačno nije moguće učitati." s ponovnim pokušajem i stranicanje starijih verzija u izborniku (`n12/N12Consultations.tsx:140-200`); poruka „Zapis konzultacije nije pronađen." za nepoznat `?zapis=`; provjera „Upišite datum i odaberite verziju rada.".
- N-13: provjera obveznih polja („Odaberite studenta, novi rok i razlog.") i poruka o odbijenom unosu; poruke „Zadatak ili student više nisu dostupni." i „Nije poznato je li produljenje zabilježeno. Osvježite stranicu prije novog pokušaja." (`n13/messages.hr.ts:41-45`); stanje kad popis studenata nije dostupan (samo „svi").
- N-18: kartica „Vaši razlozi produljenja" s napomenom da razloge vidi samo nastavnik (`merlin/Merlin.tsx:144-149`; prema C-16 „popis razloga produljenja", ali u prototipu nema); stanja „Paket nije pripremljen.", „Poveznica … istekla je …", „Zadatak više nije dostupan.", „Stanje paketa trenutačno nije moguće provjeriti…"; izbornik zadatka čita kolegije.

#### 3. Prijedlog zadataka (samo nedostaje/odstupa)

PR-1 (S, bez ugovora): **N-13/N-06 ulaz iz banera rada.** Pokriva redak „ulaz iz banera… (na ekranu rada)" i dio retka „Ruta i ulaz". Proslijediti `deadlinePassed` u `WorkFrame` (`work/pages.tsx:164`) iz čitanja roka zadatka ili iz `teacher.work.get`; test da se banner i poveznica prikazuju samo za „nije predano" i prošao rok. Ovisnost: ako `teacher.work.get` ne nosi rok, treba dodati polje u ugovor (tada M).

PR-2 (S, bez ugovora): **N-13 sitnice teksta i ulaza.** Redak „Ruta (kartica kolegija)" i „sukob". Poveznica „Produljenje roka" s kartice treba izbor zadatka ili dopuštenje da se bira na samom ekranu (sada samo „sljedeći" zadatak); u banneru „sukob" dodati vrijeme predaje ako ga ugovor ima (inače ostaje bez). Ovisnost: vrijeme predaje u odgovoru `teacher.deadline-extension.post` (ugovor).

PR-3 (S, bez ugovora): **N-18 izbornik i toast.** Retci „Odabir zadatka" i „Kopiraj otisak". Natpis opcije s vrstom rada i „rok je prošao" (zahtijeva podatak u `teacher.courses.get`); vratiti fokus na izbornik; ponovno uskladiti tekst tosta („Otisak paketa je u međuspremniku…") u `packages/ui/src/fingerprint/messages.hr.ts` samo uz odluku, jer je to zajednička komponenta (utječe i na studentske ekrane).

PR-4 (M, ugovor/server): **N-12 datum verzije u zapisu.** Redak „verzija rada u popisu i zapisu". Dodati u odgovor `work.consultation-records.get/post` vrijeme i vrstu verzije (poslana/predana) ili dohvatiti verziju po `revision`; prikazati „Verzija 1, poslana 28. 10. 2026." u popisu i zapisu. Ovisnost: ugovor i poslužitelj.

PR-5 (L, ugovor + baza): **N-12 „Prije prve verzije".** Redak „verzija Prije prve verzije". Dopustiti zapis bez verzije (`revision` nullable ili 0), promijeniti ugovor, RLS/pgTAP retke i obrazac (opcija na vrhu izbornika, dopuštena kad rad nema verzija). Ovisnost: vlasnikova odluka (dio 4), ugovor i migracija.

Napomena: sve ostalo u N-12, N-13 (osim gore) i N-18 je `postoji`. Provjereno čitanjem koda i postojećih testova (`n12/model.test.ts`, `n13/*.test.ts`, `merlin/*.test.ts`, `packages/app/e2e/teacher-work.spec.ts:117-123`); za N-13 i N-18 nema e2e koji prolazi puni tok (samo a11y/viz prolaz za N-13 i viz za N-18), pa se preporučuje e2e za tok produljenja i za pripremu/preuzimanje paketa (S, uz PR-1 ili zasebno).

#### 4. Stavke koje traže vlasnikovu odluku

1. **Q-5 / ADR §8a–8d (N-13):** oblik i popis razloga produljenja (u prototipu „primjer": Opravdan razlog, Tehnička poteškoća, Dogovor s nastavnikom, Produljenje za sve). ADR ima rok 30. 11. 2026., ali gradnja ga ne čeka (C-15, PLAN-MIGRACIJE r. 1080). App već koristi taj popis; ako ADR promijeni popis, treba promijeniti `EXTENSION_REASONS` (`src/client/deadline-extensions.ts:20`) i ugovor. Također: nudi li se „Produljenje za sve" i uz jednog studenta (prototip da, app samo uz „sve").
2. **N-12 „Prije prve verzije":** smije li konzultacija postojati prije prve verzije rada (prototip ima takav zapis; ugovor traži `revision` ≥ 1).
3. **N-12 datum verzije:** je li „Verzija 1, poslana 28. 10. 2026." obvezna u popisu/zapisu ili je dovoljno „Verzija 1".
4. **D-292 (N-18):** naziv datoteke u CSV-u i u zipu (djelomično odlučeno: ostaje jedan stupac, naziv PDF-a; .docx isti naziv s drugim nastavkom). Provjeriti odgovara li to poslužitelj. D-291 (broj stranica PDF-a) ne utječe na ovaj ekran.
5. **Natpis i tekst kopiranja otiska (N-18):** B-4 je prihvaćen za natpis; tekst tosta bez „paketa" nije izričito odlučen. Zajednička komponenta utječe i na studentske ekrane.
6. **Poredak CSV-a po prezimenu (C-16):** klijent ne sortira; potvrda da poslužitelj vraća po prezimenu (nije provjerljivo iz ovog repoa).
7. **Ulaz u Produljenje i Izvoz s kartice kolegija:** vodi na „sljedeći" odnosno prvi zadatak; želi li vlasnik izbor zadatka na ekranu (kao izbornik u N-18) i za produljenje. Nije izričita odluka, nego prijedlog.

#### Sažetak

Stari redci: 49 (N-12: 18, N-13: 15, N-18: 16). Novi redci: 4 (N-12: 2, N-13: 1, N-18: 0, plus 1 N-13 ulaz s rada). Ukupno 53 retka.

| Ocjena danas | Broj |
|---|---|
| postoji | 41 |
| odstupa | 9 |
| nedostaje | 1 |
| odgođeno po planu | 0 |

Po ekranu (postoji / odstupa / nedostaje): N-12 (20 redaka) 18 / 1 / 1; N-13 (16 redaka) 12 / 4 / 0; N-18 (16 redaka) 13 / 3 / 0. Stara revizija: postoji 16, odstupa 25 (N-12 10, N-13 12, N-18 7 uz 3 nedostaje; vidi staru tablicu), nedostaje 4 (N-18) + 1 (N-12).

Najvažnija 3 nalaza:
1. Sva tri ekrana su sada u hostu s tekstom iz prototipa; od 49 starih redaka većina je prešla u `postoji`. Preostaje samo N-12 „Prije prve verzije" (traži izmjenu ugovora/baze).
2. Jedini ulaz u N-13 s ekrana rada (banner „Rad nije predan do roka…") ne radi jer `WorkFrame` ne dobiva `deadlinePassed` (`work/pages.tsx:164`); kod i tekst postoje, ali se nikad ne prikazuju.
3. Verzija rada u zapisima konzultacija prikazuje se bez datuma (ugovor ga ne vraća); u N-18 ostaju samo sitne razlike (naslov opcije u izborniku, tekst tosta zajedničke komponente), a CSV poredak po prezimenu ovisi o poslužitelju.
## PRIJEDLOG ZADATAKA (objedinjeno)

Detaljni prijedlozi (retci koje pokrivaju, ovisnosti) nalaze se u dijelovima A do D gore. Zadaci su veličine jednog PR-a (S do oko 150 redaka, M do oko 400, L razbiti). Samo „nedostaje” i „odstupa”; ID-jevi nisu dodijeljeni, prioritet određuje Linear/orkestrator. Redoslijed prijedloga po vrijednosti:

| # | Zadatak | Dio | Veličina | Ovisnost |
|---|---|---|---|---|
| 1 | Mrtve veze: brz put s `?zadatak=` ili izbornikom zadatka, „Dodaj zadatak” na ispravnu rutu, query kod preusmjerenja `kolegiji` | A (PR-A, PR-B) | S + M | klijent |
| 2 | Spojiti kontekst na `WorkFrame` (`deadlinePassed`, `started`, naslov i vrsta zadatka, ulaz u produljenje iz rada) | B (1, 2), D (PR-1) | S + S | ugovor: rok i potvrda obavijesti na ruti rada |
| 3 | Zbirni i popis studenata: poveznica na rad, stanje „u pisanju”, dorada, vrijeme/verzija | A (PR-C, PR-D) | M + M | klijent; dorada po studentu možda ugovor |
| 4 | Obrazac zadatka: grupe, vanjski alati, „samo sažimanje” | A (PR-E) | M | ugovor ima polja; odluka o „samo sažimanju” |
| 5 | Zajednički toast 3200 ms tek nakon potvrde (objava, odobri/odbij) | A (PR-F) | S | nema |
| 6 | Jedan dijalog dd-h na radu i predaji | B (3) | S | nema |
| 7 | Slijed rada i rok dorade | B (4) | M | ugovor: rok dorade u listi zahtjeva |
| 8 | Elementi teksta rada: navodi, mjesta za izvor, fusnote, prijedlozi del/ins u tekstu | B (5) | M | nema |
| 9 | Format vremena po prototipu i komentari u jednom popisu | B (6, 10) | S + S | nema |
| 10 | Usporedba riječ po riječ (N-11) | C (C-1) | M | nema |
| 11 | Karta podrijetla s označenim tekstom rada | C (C-2) | L | novi ugovor |
| 12 | Razlog odbijanja mentorstva vidljiv studentu | A (PR-G) | M | ugovor i server |
| 13 | Razgovori i prijenosi u izjavi o AI-ju (ch-h, N-07) | A (PR-H), B (7) | L + M | ugovor i server (D-41) |
| 14 | N-16 podaci (kolegij/tema, vrijeme predaje, verzija) i N-01 akcije po kolegiju | A (PR-I, PR-J) | M + S | ugovor i server za N-16 |
| 15 | Ostalo iz dijelova C i D (sesije u reprodukciji, napomene studenta, N-12 datum verzije, N-13 vrijeme predaje u sukobu, redoslijed CSV-a) | C, D | S–M svaki | dio traži ugovor/server |
| 16 | Proširiti scenarij VIZ „puno” čitanjima rada (`teacher.access.get`, sažetak, usporedba, reprodukcija) da se ekrani rada mogu provjeriti izvođenjem | ovaj izvještaj | S | nema |

## Stavke koje traže vlasnikovu odluku (objedinjeno)

Pojedinosti su u dijelovima A do D (točka „Stavke koje traže vlasnikovu odluku”). Sažeto:

- **Nakon pilota / pravno:** razgovori i prijenosi uz izjavu (C-3/C-4, D-41), izvori iz D-260 t. 5 (nije u ovom opsegu).
- **Odluke ugovora:** C-6 (prava poveznica `/provjera` i QR), Q-3 (zamjenski postupak, FPZG), Q-5 / ADR §8a–8d (razlozi produljenja), B-10 (opći komentar bez označenog teksta), D-239 (sesije u reprodukciji), D-292 (naziv datoteke u CSV-u).
- **Sadržaj:** što znači „samo sažimanje” u obrascu zadatka; hoće li poslužitelj pri objavi stvarno stvoriti obavijest (C-17); smije li se „Produljenje roka” nuditi za zadatke s prošlim rokom; smije li zapis konzultacije biti „prije prve verzije”; odjeljak izjave i „Pravila fakulteta” u sažetku (C-3); zadržati dodatke reprodukcije bez prototipa (jedan odlomak, povijest odlomka); dvostruki prikaz sažetka i karte u asideu rada; tekst tosta pri kopiranju otiska; poredak CSV-a po prezimenu; izbor zadatka na ekranu produljenja.

## Nepotvrđeno

Dvije tvrdnje dijela A označene su „potvrditi”: da banner „prekinuto” na N-01 ne radi zbog gubitka query parametra pri preusmjerenju te stvara li poslužitelj obavijest pri objavi zadatka.

