# F4-PREGLED-WEB: ciljani pregled klijentske strane

Datum: 24. 11. 2026. Slot: `claude:wf4pregled-web:frontend`. Koordinacija: Ductus#2055.

- **Baza:** `migracija/kopija-ductus-front` @ `1eebb89` (F4-SYNC-WEB #572, squash).
- **Opseg:** samo čitanje. Pregledani su sesija i prijava/odjava, lokalni dnevnik i njegov opseg (scope), potpisana potvrda primitka (ACK, SYNCED) i predaja. Pregled je napravljen nad živim putem: host `packages/app/src/host/`, `src/client/*`, `src/components/editor/*` i `packages/editor-core`. Stari Next kod u `src/app` pregledan je samo kad ga host koristi.
- **Ishod:** nalazi postaju zadaci. Ovaj pregled nije kanonski neovisni pregled iz `docs/ENGINEERING_SYSTEM.md`. Slot pisca i model nisu dokaz neovisnosti, pa ovdje nema redaka `Agent-Review`, `Review-*` ni `QA-*`. Codex pregled prije spajanja u `main` radi orkestrator.

Svaki nalaz je provjeren čitanjem koda na `1eebb89`. Prijedlozi zadataka su najmanji popravak. Ozbiljnost: **V** visoka, **S** srednja, **N** niska.

## Sažetak

| ID | Ozb. | Područje | Nalaz |
|---|---|---|---|
| F4W-01 | V | dnevnik, odjava | Odjava iz ljuske ne čita i ne briše lokalni dnevnik i ne upozorava na nespremljeno (D-118). |
| F4W-02 | V | sesija | Host ne bilježi oznaku sesije, pa odjava iz ljuske i nova prijava ne gase druge kartice. |
| F4W-03 | V | predaja, izjava | Potvrda izjave bez izričitog izbora upisuje „AI nije korišten”, i kad je ispis priložen. |
| F4W-04 | S | dnevnik, sesija | Istek sesije na poslužitelju (401) ne zaustavlja otvoreni list. |
| F4W-05 | S | ACK | Ključevi za provjeru potvrde dolaze iz istog odgovora otvaranja, bez sidra (pitanje za vlasnika). |
| F4W-06 | S | predaja | Nakon povlačenja zaslon potvrde i dalje pokazuje „Predano”. |
| F4W-07 | N | ACK | Skup ključeva vrijedi do kraja sesije stranice; rotacija daje grešku do osvježavanja. |
| F4W-08 | N | ACK | `principalId` iz potvrde se ne uspoređuje. |
| F4W-09 | N | dnevnik | Izlazne kopije teksta u `localStorage` nikad se ne brišu. |
| F4W-10 | N | sesija | Redoslijed sesija u hostu određuje sat računala. |
| F4W-11 | N | sesija | Kolačići `ductus-ended-*` nemaju gornju granicu. |
| F4W-12 | N | prijava (D-09) | Prosljeđivanje `/__lazni/*` ovisi samo o `NODE_ENV !== "production"`. |
| F4W-13 | N | sesija | Osobni rječnik pravopisa dijele svi računi preglednika; komentar u `session.ts` tvrdi brisanje kojeg nema. |
| F4W-14 | N | sesija | Host ne šalje CSP ni zaštitu od uokvirivanja. |
| F4W-15 | N | predaja | Ponovljeno povlačenje nakon izgubljenog odgovora daje pogrešnu poruku. |
| F4W-16 | N | predaja | Poruka „Tekst je spremljen na uređaju” prikazuje se bez provjere. |
| F4W-17 | N | predaja | Faza roka računa se samo pri otvaranju stranice. |
| F4W-P1 | proces | F4-PR-WEB | Sukob u `src/client/no-direct-api.test.ts` pri spajanju baze u `main`. |

## Visoka ozbiljnost

### F4W-01 · Odjava iz ljuske ne dira lokalni dnevnik

- **Gdje:**
  - `packages/app/src/host/SignOut.tsx:36-45`: `SignOutDialogButton` zove samo `signOutHere`.
  - `src/client/logout-request.ts:67-79`.
  - Isti gumb je u `packages/app/src/host/signin/SignInScreen.tsx`.
  - U `packages/app/src` nigdje se ne zove `destroyForLogout`, `clearWithoutEditor`, `readLogoutHold` ni `shellLogoutStep`.
  - Stari `src/components/shell/ShellLogout.tsx` to radi, ali u hostu nije montiran.
- **Scenarij:**
  - Student piše u editoru i ode na „Moji radovi”. Odjavi se iz bočne ljuske.
  - Baza `ductus-journal-v1-<scope>` ostaje na uređaju s punim tekstom, segmentima dokaza i provjerenim otvaranjima. Ostaje i ako je sve potvrđeno.
  - Dijalog ne kaže da na uređaju ostaje nepotvrđen tekst (D-118).
  - Pri sljedećoj prijavi `hasPendingLogout` dovršava samo brisanje koje je bilo ograđeno, pa se ova baza ne briše.
  - Na zajedničkom računalu podaci ostaju idućem korisniku istog profila preglednika.
  - Nijedan test ne pokriva ovaj put.
- **Dohvatljivo kroz:** student → bilo koja stranica hosta bez editora → „Odjava” → potvrda.
- **Prijedlog zadatka (WEB, kritično):**
  - Prije zahtjeva odjave pročitati stanje dnevnika (`readLogoutHold` i `shellLogoutStep`, kao `ShellLogout`) i pokazati upozorenje D-118.
  - Nakon potvrde poslužitelja obrisati ili ograditi dnevnik tog opsega (`clearWithoutEditor` ili `destroyForLogout`), uz ista pravila kao odjava iz editora.
  - Testovi: dnevnik potvrđen → obrisan; nepotvrđen → upozorenje i čuvanje po D-118.

### F4W-02 · Host ne bilježi oznaku sesije

- **Gdje:**
  - `packages/app/src/host/Host.tsx:45`: `readSession()` vraća sesiju bez oznake (`src/client/api.ts:453-460`).
  - Host ne montira `SessionObserver` (osim u `RecoveryOffer`) i ne zove `observeSession`.
  - `SignOut.tsx` zove `signOutHere(null, …)`. Tada `currentSession(store)` vraća `null`, a `endAfterLogout` (`src/client/session-marks.ts:155-161`) vraća `[]`. Ništa se ne zapisuje, kolačić `ended` se ne postavlja i ništa se ne objavljuje.
  - Nastavnički prikazi dobivaju oznaku iz `src/client/teacher-work.ts` i slušaju kraj sesije (`packages/app/src/host/teacher/work/pages.tsx:104`), ali je nikad ne bilježe kao tekuću.
  - Stari ugovor ljuske (F-113, `src/components/shell/shell-session.ts`) tražio je oznaku na svakoj stranici.
- **Scenarij:**
  - Nastavnik u kartici B ima otvoren rad studenta (uživo, reprodukcija ili sažetak), a u kartici A klikne „Odjava”.
  - Ako u tom pregledniku nije radio studentski editor, kartica B ne dobiva nikakav signal. Tekst studenta ostaje na zaslonu.
  - Isto vrijedi kad se druga osoba prijavi bez odjave: starije kartice nastavnika, administratora i ljuske se ne gase.
  - Na stranicama ljuske nema ni ponovne provjere na `pageshow`.
- **Dohvatljivo kroz:** „Odjava” iz ljuske ili nova AAI prijava dok je otvorena nastavnička ili druga kartica bez editora.
- **Prijedlog zadatka (WEB, kritično):**
  - Host čita `sessionTag` (iz `profile.me.get` ili iz rute sesije), montira `SessionObserver` na svakoj stranici i tu oznaku predaje `signOutHere` umjesto `null`.
  - Test: odjava u kartici A gasi nastavnički prikaz u kartici B.

### F4W-03 · Izjava: zadano „not_used” i uz priloženi ispis

- **Gdje:**
  - `src/client/declaration.ts:259-261`: `use = draft?.ai.use ?? (tools.length > 0 || attachments.length > 0 ? "used" : "not_used")`.
  - `packages/app/src/host/student/submission/declaration/step-ports.ts:415` uvijek predaje `attachments = []`. Ispisi učitani izvan Ducture idu kao `externalAttachmentIds` (`declaration.ts:198-221`) i ne utječu na `use`.
  - Izbor „Obrazac izjave” u `DeclarationStep.tsx:184-190` ne prikazuje se jer `viewOf` vraća prazne `recorded` i `chats`, a izabrano se ni ne šalje.
- **Scenarij:**
  - Student je koristio vanjski AI alat. Kako tekst izjave traži, priloži ispis razgovora i potvrdi izjavu.
  - Potvrdni PUT šalje `use: "not_used"` uz `externalAttachmentIds: [ispis]`.
  - Nastavnik u `readTeacher` (`declaration.ts:310`) dobiva `no_use`, a priloženi ispis se odbacuje. Zapis izjave tako tvrdi suprotno od onoga što je student izjavio.
  - Ako poslužitelj tu proturječnost odbije, student ne može potvrditi izjavu i stoji na 409 `declaration_required`.
- **Dohvatljivo kroz:** /rad/<id>/predaja/izjava → „Uredi izjavu” → priloži ispis → „Potvrđujem izjavu”.
- **Prijedlog zadatka (WEB, kritično, predaja):**
  - `use` se nikad ne postavlja zadano: potvrda traži izričit izbor iz sučelja.
  - Neprazan `externalAttachmentIds` znači „used” ili se odbija.
  - Nastavnička grana `no_use` uz priložene ispise pokazuje ispise ili vraća „nedostupno”.
  - Test: `use: null` uz ispis i potvrdu.

## Srednja ozbiljnost

### F4W-04 · 401 ne zaustavlja otvoreni list

- **Gdje:**
  - `packages/editor-core/src/sync/drain.ts:934-936`: `unauthenticated` zadržava red.
  - `src/components/editor/evidence-session.ts:264-276`: na v1 se nastavlja sa spremljenim dnevnikom kad otvaranje nije `opened`.
  - `retryOpen` (`evidence-session.ts:~612`) ponavlja otvaranje bez kraja.
  - List se zaustavlja samo kad ovaj preglednik zabilježi kraj sesije (`src/client/session-marks.ts:126-137`, `LocalDocument.tsx:458-479`).
- **Scenarij:**
  - Rad ostane otvoren bez odjave, a sesija istekne na poslužitelju.
  - List i dalje pokazuje tekst i prima unos. Ono što netko drugi upiše za tim računalom ulazi u dnevnik prve osobe kao njezin dokaz i šalje se pod njezinim identitetom pri idućoj prijavi.
- **Napomena:** dio toga je namjeran (pisanje bez mreže, offline-first). Treba odluka: završava li 401 s poslužitelja sesiju lista jednako kao lokalna odjava.
- **Dohvatljivo kroz:** /rad/<id> otvoren, sesija istekne bez odjave.
- **Prijedlog zadatka:** `unauthenticated` iz otvaranja ili commita tretirati kao kraj sesije (`stop()`), uz test. Pisanje bez mreže (bez odgovora) ostaje kakvo jest.

### F4W-05 · Sidro povjerenja za ključeve potvrde (pitanje za vlasnika)

- **Gdje:**
  - `src/client/evidence-ingest.ts:220-262`: `openedWorkFrom` uzima `receiptKeys` iz odgovora `evidence.open.post`. Iz istih ključeva izvodi i `evidenceDomainId`.
  - `createReceiptVerifier` (`evidence-ingest.ts:398-421`) provjerava potpis tim ključevima.
  - Nema ugrađenog ni zapamćenog skupa ključeva ni usporedbe s ranije viđenima.
- **Scenarij:** tko kontrolira API sloj ili registar ključeva može u odgovoru otvaranja navesti vlastiti Ed25519 ključ i potpisivati potvrde.
  - Preglednik tada prikaže „Spremljeno na poslužitelju” i obriše redove iz dnevnika (`atomic-dexie-journal.ts:893-897`).
  - Odjava zatim smije obrisati dnevnik, iako ništa nije pohranjeno.
  - D-71 drži KMS ključ izvan web procesa upravo zato.
- **Stanje:** kod slijedi specifikaciju (ključeve poslužuje ruta otvaranja), pa ovo nije greška koda nego pitanje za Owner queue. Pinning ima smisla samo ako se statični paket poslužuje iz druge domene povjerenja od API-ja.
- **Prijedlog:** odluka vlasnika. Mogućnosti:
  - (a) otisci ključeva ugrađeni u build;
  - (b) prvi skup ključeva po radu zapamćen u dnevniku, a nenajavljena promjena se odbija;
  - (c) ostaje kako jest, uz zapis rizika.

### F4W-06 · Nakon povlačenja zaslon i dalje kaže „Predano”

- **Gdje:**
  - `packages/app/src/host/student/submission/index.tsx:241-245`: `WithdrawSubmission` nema povratni poziv na `shown.reload`.
  - `src/components/predaja/ReceiptPanel.tsx:39` vraća `potvrdeno` bez obzira na `workState`.
- **Scenarij:**
  - Kartica kaže „Predaja je povučena”, a isti zaslon i dalje pokazuje „Predano …”, zapis PDF i „Paket za referadu”.
  - Nema poveznice za ponovnu predaju, iako tekst nudi „predati ponovno”.
  - Ponaša li se jednako i nakon osvježavanja ovisi o tome što `student.submission.get` vraća nakon povlačenja (provjeriti na SRV).
- **Dohvatljivo kroz:** /rad/<id>/predaja/potvrda → „Povuci predaju” → potvrdi.
- **Prijedlog zadatka (WEB, predaja):**
  - `onWithdrawn` poziva `shown.reload()`.
  - `potvrdeno` se pokazuje samo kad je `workState === "submitted"`.
  - Dodati poveznicu na korak predaje.

## Niska ozbiljnost

- **F4W-07** · `src/components/editor/evidence-session.ts:611-633`: `retryOpen` vraća odmah čim postoji `this.work`, pa skup ključeva vrijedi do kraja sesije stranice.
  - Opozvan ključ vrijedi do osvježavanja.
  - Nakon rotacije svaka potvrda daje `key_unknown`, što vodi u FATAL pa ERROR; ručno ponavljanje ne pomaže do osvježavanja. Ponašanje je fail-closed, ali ruši dostupnost.
  - Prijedlog: na `key_unknown` ili `key_revoked` jednom ponovno otvoriti rad i osvježiti ključeve (ovisi o F4W-05).
  - Dohvatljivo kroz: rotacija ključa dok je editor otvoren.
- **F4W-08** · `src/client/evidence-ingest.ts:398-421`: verifier veže `documentId`, `clientTransactionId`, `revision`, domenu i `segmentHash`, ali ne i `principalId`.
  - Sam verifier (`packages/editor-core/src/document/forensics/evidence-receipt-verifier.ts`) kaže da tu usporedbu radi pozivatelj.
  - Odgovor otvaranja nema `principalId`, pa ga preglednik ne može usporediti.
  - Prijedlog: SRV vraća `principalId` pozivatelja u odgovoru otvaranja i WEB ga uspoređuje, ili ugovor izričito zapisuje da se ta provjera ne radi.
  - Dohvatljivo kroz: 200 odgovor `evidence.commit.post`.
- **F4W-09** · `packages/app/src/host/editor/save-status/recovery.ts:19-28` zapisuje `ductura:editor-exit:<scope>:<rad>:<uuid>` s čistim tekstom pri svakoj odjavi s nespremljenim tekstom (`LocalDocument.tsx:1007-1014`).
  - Ništa ne zove `removeItem`; „Sakrij” u `RecoveryOffer.tsx` samo skriva ponudu.
  - Kopija ostaje i kad brisanje dnevnika uspije. Aplikacija nudi samo vlastite kopije, ali tekst ostaje čitljiv na uređaju.
  - Prijedlog: brisanje nakon preuzimanja ili nastavka i rok trajanja.
  - Dohvatljivo kroz: editor → nespremljen tekst → „Odjava”.
- **F4W-10** · `src/components/editor/EditorPage.scope.ts:71` i `RecoveryOffer.tsx` označavaju sesiju s `Date.now()` iz preglednika, a `observeSession` i `hasEnded` (`session-marks.ts`) uspoređuju `at`.
  - Komentar u `session-marks.ts:7-10` traži vrijeme poslužitelja.
  - Vraćen sat (nastavak VM-a, ručna promjena) znači da nova sesija ne postaje tekuća i da stara kartica ostaje otvorena.
  - Prijedlog: vrijeme poslužitelja iz rute sesije, ili svaka različita oznaka vrijedi kao novija.
  - Dohvatljivo kroz: kartica s radom, vraćen sat, prijava druge osobe u drugoj kartici.
- **F4W-11** · `src/client/session-marks.ts:111-118`: jedan kolačić `ductus-ended-<tag>` (oko 80 B, 24 h) po odjavi. `ENDED_LIMIT` ograničava samo popis u `localStorage`.
  - Na računalu u knjižnici ili praktikumu zaglavlje `Cookie` može prijeći granice posrednika (8 KB). Zahtjevi tada dobivaju 400/431, uključivo prijavu.
  - Prijedlog: ograničiti broj kolačića ili ih spojiti u jedan.
  - Dohvatljivo kroz: mnogo uzastopnih odjava iz editora u istom pregledniku.
- **F4W-12** · `packages/app/src/rewrites.ts:24-29`: `/__lazni/*` se prosljeđuje poslužitelju kad god je `NODE_ENV !== "production"`.
  - Build za staging ili pregled s `NODE_ENV=test` ili `staging` izlaže tu putanju kroz front. Radi li tada prijava, ovisi o vratima na poslužitelju.
  - D-09 dopušta lažnog pružatelja samo lokalno i u CI-ju (i izričit staging način STG-PRIJAVA).
  - Prijedlog: uključiti samo uz izričitu lokalnu ili CI zastavicu.
  - Dohvatljivo kroz: postavljen build s `NODE_ENV` različitim od `production`.
- **F4W-13** · `src/components/editor/spelling/store.ts:8`: osobni rječnik `ductura.pravopis.v1` nije vezan uz račun, pa riječi jednog studenta (imena, pojmovi rada) dobiva drugi u istom pregledniku.
  - `src/client/session.ts:68-71` tvrdi da odjava briše pohranu preglednika, a to ne radi nijedan put.
  - Prijedlog: ključ po opsegu (scope) i brisanje pri odjavi, ili ispravak komentara.
  - Dohvatljivo kroz: prijava druge osobe u istom pregledniku.
- **F4W-14** · `packages/app/next.config.ts` nema `headers()`, a `packages/app` nema middleware. `src/middleware.ts` pokriva samo stari korijenski app.
  - Na `next start` ili Vercelu (`packages/app/vercel.json`) stranice se mogu uokviriti (clickjacking potvrda), osim ako zaglavlja ne doda rub.
  - Prijedlog: CSP s `frame-ancestors 'none'` u hostu ili potvrda da ih rub postavlja.
  - Dohvatljivo kroz: izravno postavljen `packages/app`.
- **F4W-15** · `packages/app/src/host/student/submission/withdraw/contract.ts:108,139` i `model.ts:165`.
  - Kad se odgovor 200 izgubi (`nepoznato`), ponovni klik dobiva 409 `not_started` ili `conflict`. To se prikazuje kao „Povlačenje predaje više nije moguće.”, a ne kao već povučeno.
  - Prijedlog: nakon `nepoznato` prije novog pokušaja ponovno pročitati stanje.
  - Dohvatljivo kroz: povlačenje → istek ili 503 → ponovno povlačenje.
- **F4W-16** · `packages/app/src/host/student/submission/submit/messages.hr.ts:252,279-281`: „Tekst je spremljen na uređaju” prikazuje se bez provjere dnevnika.
  - Tvrdnja nije točna na drugom uređaju ili nakon brisanja pri odjavi.
  - Prijedlog: ukloniti tu rečenicu ili je prikazati tek nakon čitanja dnevnika.
  - Dohvatljivo kroz: korak 4 na drugom uređaju → 409 `blocked/no_evidence`.
- **F4W-17** · `packages/app/src/host/student/submission/index.tsx:212`: `submitStageOf(..., Date.now())` računa se pri otvaranju stranice.
  - Stranica otvorena prije roka i predana nakon njega ne pokazuje upozorenje „Rok je prošao…”. `afterDeadline` s poslužitelja na potvrdi i dalje je točan.
  - Prijedlog: računati fazu pri otvaranju dijaloga.

## Proces: F4-PR-WEB

### F4W-P1 · Sukob u `src/client/no-direct-api.test.ts`

- Probno spajanje `origin/migracija/kopija-ductus-front` (`1eebb89`) u `origin/main` (`a59455a`), napravljeno 24. 11. ovim pregledom, daje **jedan** sukob: `src/client/no-direct-api.test.ts`.
- Uzrok: #572 je spojen squashom, pa `main` nije git predak baze (merge-base je `92701ac`).
- Verzija na bazi je nadskup verzije s `main`: sadrži iznimke vezane uz SHA-256 iz #55 (DAN-888) i dodaje `BASELINE` (`no-direct-api.baseline.json`) te pravila za `_cekanje`, CSS i generirane ključeve `from`/`to`.
- **Prijedlog za F4-PR-WEB:** sukob razriješiti uzimanjem verzije s baze i provjeriti da testovi iz #55 (`contentSha256`, zatvoren popis iznimaka) i dalje postoje i prolaze.
- **Napomena uz BASELINE:**
  - Popis ima 53 datoteke. Na živom putu su `src/components/editor/LocalDocument.tsx`, `OpenWork.tsx` (`fetch`), `document-saver.ts`, `evidence-session.ts`, `live-hold.ts` i `packages/app/src/rewrites.ts`.
  - Provjereni pogoci „API URL” u tim datotekama su komentari, a `OpenWork.tsx:66` predaje `fetch` u `openWork`.
  - Ključevi za `packages/editor-core/src/document/document/edit-step.ts` sadrže krhotine koda (`import );…`), jer `bareImports` pogrešno čita taj izvor.
  - Prije `main` je dobro da zaseban mali zadatak suzi BASELINE na stvarne nalaze.

## Provjereno, bez nalaza

- **Prijava (D-09):**
  - Zaslon prijave nudi samo poveznicu na `auth.login.get` iz ugovora: bez lozinke, e-pošte i izbora uloge.
  - Kod hosta ne uvozi lažnu prijavu ni `test-fakes`.
  - Putanje prijave i odjave čitaju se iz ugovora i moraju biti lokalne (`src/client/api.ts:121-130`, `560-568`).
- **returnTo:**
  - Odbijaju se `//`, `\`, kontrolni znakovi, `/api` (dekodirano do tri puta) i preduga vrijednost (`api.ts:160-187`).
  - Odredište je uvijek unutar `/app/web` ili `/app/chrome`.
- **Tajne sesije:** token sesije nije u `localStorage`, `sessionStorage` ni URL-u, nego samo sažetak `sessionTag`.
- **Mutacije:** idu kroz isti izvor, JSON i `redirect: "manual"`; poslužitelj odbija cross-site zahtjeve.
- **Odjava iz editora:**
  - Prvo zaustavi pisanje, zatim zabilježi kraj i objavi ga.
  - Potvrđen dnevnik briše i kad poslužitelj ne odgovori.
  - Nepotvrđen dnevnik čuva po D-118.
- **Opseg dnevnika:**
  - `journalScope` i `sessionTag` dolaze s poslužitelja i strogo se provjeravaju.
  - Jedna baza po opsegu, a hash se provjerava u konstruktoru.
  - `documentId` dolazi samo iz odgovora otvaranja, nikad iz URL-a.
  - Neslaganje v1/v3 je fail-closed.
  - Dexie v5 samo dodaje.
  - Ograda odjave provjerava se u istoj transakciji kao svako pisanje.
  - Jedan pisac po dokumentu (Web Lock).
- **ACK i SYNCED:**
  - Verifier ponovno računa JCS SHA-256 i provjerava Ed25519 nad točnim D-92 bajtovima, svrhu `receipt`, opoziv i `validTo`.
  - `segmentHash` dolazi iz poslanog retka, ne iz odgovora.
  - 200 bez potpisane potvrde je `invalid`. Kasni odgovor ne mijenja ništa. Ponovno korišten `txid` vodi u DIVERGED i RECOVERY_REQUIRED.
  - SYNCED se pokazuje samo kad je u ovoj sesiji stranice potvrđen korak (`syncedHere`). SYNCED vraćen iz dnevnika prikazuje se kao LOCAL_DURABLE.
  - Nema zastavice, lažnog porta ni puta kroz `dev-server.mjs` koji preskače provjeru. Put v3 koristi isti verifier.
- **Predaja:**
  - Potvrda nije optimistična: „predano” se pokazuje samo uz 200 čija potvrda imenuje poslani zadatak, dokument i reviziju. 408, 5xx i prekid vode u „možda predano” uz provjeru stanja.
  - Revizija dolazi iz `evidence.open.post`, a tekst se provjerava hashom.
  - `oneAtATime` i zaštita `sending` sprječavaju dvostruko slanje. Rok provodi poslužitelj, a povlačenje se nudi samo kad poslužitelj kaže `withdrawable`.
  - Nastavnik ne može predati ni povući u ime studenta.

## Nije pregledano ili pokrenuto

- Javna stranica `/provjera` i verifieri potvrde predaje.
- RLS i rute poslužitelja: to je F4-PREGLED-SRV.
- Testovi nisu pokrenuti za ovaj pregled jer PR mijenja samo ovaj dokument; vidi opis PR-a.
- Lokalni stog (poslužitelj, lažni OIDC) nije pokrenut u oblaku. Scenariji su izvedeni iz koda, ne kliknuti.
