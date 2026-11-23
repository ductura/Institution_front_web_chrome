# Nove funkcije, dio 2: Radni prostor i editor (otvaranje rada, pisanje, spremanje i rad bez mreže, izvori i navodi, AI pomoć i izjava, povijest verzija, prijelaz prema predaji)

Zadatak NF-2 `nove-funkcije-editor`. Plan: `ductura/.github`, `docs/plan/NOVE-FUNKCIJE.md`, dio 2 (Danielova odluka 23. 11. 2026.). Oblik i razina detalja po uzoru na `docs/nalazi/nove-funkcije-1-student-zadaci.md` (WEB #551). Ovaj dokument je samo pregled; kod se ne mijenja. Sama predaja (pet koraka, potvrda) je dio 3; ovdje je opisana samo granica prema njoj.

## 0. Izvori, način pregleda i ograničenja

Pročitano:
- prototip: `docs/prototip/INVENTAR-editor.md` (§1 raspored, §2 funkcije po modulu, §3 prozori i prečaci, §4 student/nastavnik, §5 podaci i poslužitelj, §7 valovi, §8 pitanja), `docs/prototip/editor/` (izvori prototipa), `docs/prototip/Ductura_student.html` i `INVENTAR-student.md` samo za granice ekrana;
- Danielovi odgovori `docs/prototip/ODGOVORI-DANIEL-2026-11-19.md` (A-4 osam stanja spremanja, A-12 druga kartica, A-13 vanjski zahtjevi, B-2 podudaranje s pomoćnikom, B-5 „izvornost” kao navod službenog obrasca, B-6 „spremljeno” samo uz potvrdu poslužitelja, B-8 navod prema izvoru, C-3 izjava prije D-194, C-10 usporedba verzija, C-13 pomoćnik zadnji, C-14 diktiranje i čitanje naglas, C-18 banner o prazninama „nije”);
- revizije `docs/nalazi/paritet-editor-2.md` (493 stanja, provjera 23. 11. 2026.) i `docs/nalazi/paritet-student-2.md`;
- aplikacija: `packages/app/src/host/student/work.tsx`, `student/work/`, `student/start-work/`, `student/onboarding/`, `host/editor/*` (toolbar, save-status, status, left, right, work, mentor, sources-mention, bibliography, source-notebook, assistant-match-notice, assist, export, import, shortcuts), `host/student/submission/`, `time-machine/`, `statement/`, i komponente u `src/components/editor/` koje host montira;
- ugovori u izvatku `src/client/migration-contracts.generated.json` (245 operacija; za ovaj dio: `student-work.start.post`, `evidence.open|commit|replay.post`, `live.document.put`, `work.versions.get`, `work.version.get`, `work.compare.get`, `work.restore.post`, `work.source-notes.*`, `student.work-sources.*`, `student.source-proofs.*`, `sources.lookup.post`, `student.declaration.get|put`, `student.assistant-request.post`, `student.assistant-conversation.get`, `work.assistant-match.*`, `work.export-pdf.get`, `work.imports.*`, `submission.submit.post`, `student.submission-withdrawal.*`, `support.problem-report`).

Što nije učinjeno, izričito:
- aplikacija **nije pokrenuta** s lažnim poslužiteljem (scenarij VIZ „puno”) u ovoj sesiji. Ponašanje je izvedeno iz izvornog koda, tekstova u katalozima `messages.hr.ts` i testova; uz to je preuzeta živa provjera iz `paritet-editor-2.md` (23. 11. 2026., Chromium 1440, 1250, 1050 i 400 px). Gdje stavka ovisi o stvarnom prikazu (razmaci, preklapanje, veličina ciljeva, redoslijed Tab, čitač zaslona), označena je „provjeriti u pregledniku”;
- kako ta revizija navodi, sam VIZ „puno” ne otvara editor (`/me` nema `journalScope` i `sessionTag`), pa bez dopune scenarija ovaj dio nitko ne može proći klikom na lažnom poslužitelju (prijedlog P-22);
- baza i Docker nisu pokretani; stanja SYNCED, sukob i oporavak nisu izazivana;
- opisi sličnih alata u dijelu 3 su iz općeg poznavanja takvih alata, ne iz uživo provjere njihovih trenutačnih verzija; ništa se ne kopira (ni izgled ni tekst);
- ništa nije provjeravano na stvarnim studentima; svi primjeri su izmišljeni (kolegij „Uvod u medije”, student „Student A”, mentor „Nastavnik A”).

Ograničenja plana koja vrijede za sve prijedloge: rok funkcija pilota 15. 1. 2027. se ne pomiče; prijava studenata samo AAI@EduHr (D-09, D-16); server se ne izmišlja (uz svaki prijedlog stoji postoji li ruta u izvatku ili treba novo polje); prototip ostaje izvor istine (što Daniel stavi „za pilot” najprije ulazi u prototip i INVENTAR-editor); pravila PRODUCT §5 i rječnik zabranjenih izraza vrijede za svaki novi tekst. Odluke koje se ne ponavljaju kao pitanja: Q-10 odgođen (ne bira se pružatelj ni model), pomoćnik ide zadnji (C-13), shema v3 samo kroz PIL-K-SHEMA-V3, sadržaj tipki samo u polju editora i samo kao zasebna klasa podataka (Ustav v1.9; sa stvarnim studentima tek nakon pravnog mišljenja i DPIA, dotad samo demo s izmišljenim podacima).

---

## 1. Tok korisnika od početka do kraja

Ruta u aplikaciji (host): `/rad/{id}` (editor), `/zadatak/{id}` (obavijest, dio 1), `/rad/{id}/predaja/*` (dio 3), `/rad/{id}/podrijetlo`. Student u ovom dijelu dolazi iz „Moji zadaci” ili iz obavijesti (dio 1).

### 1.1 Otvaranje rada (`WorkPage`, `host/student/work.tsx`)
1. Student klikne „Otvori rad” ili „Započni rad” (dio 1). `StartWork` (`host/student/start-work/`) zove `student-work.start.post`; gumb je „Započni rad” s `aria-label` „Započni rad: {naslov}”, dok traje „Otvara se…” (dvostruki klik se ignorira). Pri uspjehu `role=status`: „Rad je otvoren. Jezik rada: hrvatski. Pravila fakulteta: verzija N.”, zatim prijelaz na `/rad/{id}`.
2. `WorkPage` paralelno čita `student.assignments.get`, `student.assignment-work.get` i opseg riječi. Ishodi: odjavljen vodi na prijavu; obavijest nije potvrđena vodi na `/zadatak/{id}` (zamjena rute); nepoznat rad daje „stranica ne postoji”; inače jedan od okvira `puno`, `prazno`, `predano`, `greska`.
3. Okvir „učitavanje”: kostur (`aria-busy`, „Učitavanje…”), žeton spremanja „Učitavanje…”, „Predaja rada” je `aria-disabled`.
4. Okvir `prazno`: „Rad još nije započet. Započnite ga da biste mogli pisati.”, sivi „Počnite pisati…” i `StartWork`; žeton „Novi rad, još ništa nije upisano”.
5. Okvir `greska`: `role=alert` „Rad trenutačno nije moguće otvoriti. Tekst spremljen na ovom uređaju ostaje netaknut.” s gumbom „Pokušaj ponovno” (ponovno čita cijelu stranicu); žeton „Greška pri otvaranju”.
6. Okvir `puno` montira `EditorPageWork`: čita lokalni opseg dnevnika (`journalScope`, `sessionTag`; oba moraju imati točan oblik, inače se otvaranje zatvara na „ne može”), zatim zove `evidence.open.post` ({assignmentId, start}). Tijekom otvaranja: „Otvaram rad…”. Ishodi: otvoreno (list se puni dokumentom, `documentId`, `currentRevision`), `not_found`/`not_accepting` („Obavijest zadatka se promijenila ili zadatak trenutačno ne prima rad.”), `upgrade_required` („Ova verzija stranice više ne može otvoriti rad. Učitajte je ponovno.”).
7. Prvi put u životu: automatski se prikaže vodič „Prvi koraci” (tri koraka: „Pisanje i oblikovanje”, „Naredbe u tekstu”, „Spremanje rada”; „Oko 2 minute”; Natrag, Dalje, „Preskoči vodič”, „Završi vodič”). Oznaka „viđeno” zapisuje se **prije** prikaza (ključ `ductura:editor-onboarding:v1:{scope}`); ponovno se otvara samo preko izbornika „Pomoć”.

### 1.2 Raspored zaslona
- **Zaglavlje radnog prostora:** poveznica „Ductura” (na `/zadaci`), oznaka kolegija, prekidač „Pisanje / Kako vidi nastavnik” (drugi je onemogućen s napomenom „Pogled nastavnika još nije spojen na poslužitelj ustanove.”), „Prečaci”, „Raspored ▾” (Samo naslovi; širine Uska/Srednja/Široka), prekidač teme lista („Bijeli list” / „Tamni list”, `aria-pressed`), „Predaja rada” (poveznica na `/rad/{id}/predaja`).
- **Alatna traka** (`StudentToolbar`): Poništi, Ponovi; stil bloka (Odlomak, Naslov 1–3); Podebljano, Kurziv; popis, citat; izbornici „Umetni ▾” (fusnota, unakrsna referenca, mjesto „za provjeru”, dijelovi rada), „Pretvori ▾”, „Posebni znak ▾”, „Prikaz ▾” (tamni/bijeli list, postavke navoda), „Izvezi ▾” („Stavi tekst rada u međuspremnik”); „Pomoć ▾” (Prvi koraci, Pomoć u tekstu, Prvi redak), „Naredbe” (Ctrl+K), „◎” fokus (Ctrl+.). Numerirani popis namjerno nije na traci (shema v1).
- **List** (Tiptap, shema v1): naslov rada kao prvi redak, odlomci, naslovi, popisi, citat, navodi, fusnote, unakrsne poveznice, mjesta „za provjeru” [?]/[izvor].
- **Lijevi panel „Struktura rada”** (raspored kartica): poglavlja, „Zahtjevi”, „Prikazi i fusnote”, „Odloženo”, „Napredak”, „Rokovi”, „Nit rada”, „Povijest dokumenta”.
- **Desni panel „Bočni panel”**: kartice Izvori (zadano), Komentari, Pregled (Nacrt, Pojmovnik, Provjere), „Mentor” (puni naziv „Mentor i predaja”: Proba predaje, zahtjevi za doradu, „Usporedi s …”), Asistent (kartica „uskoro”).
- **Statusna traka** (`footer`): žeton spremanja, „340 riječi · opseg 1.200 do 1.600 · vidite samo Vi”, „označeno: N riječi”, „ništa za provjeru” / broj mjesta za provjeru.
- Prijelomne točke (`layout-settings.ts`): lijevi panel postaje ladica na ≤1250 px (☰), desni na ≤1050 px, mreža 760, telefon ≤640 px (prisilno raspored „mobilni”). Nema granice 800 px koju je pretpostavio plan; vrijedi 640.

### 1.3 Pisanje i oblikovanje
1. Student tipka u listu; svaka izmjena ide u lokalni dnevnik (Dexie), nakon stanke u potpisani segment `evidence.commit.post` ({documentId, clientTransactionId, baseRevision, segments[1], document}); povratni potpis potvrđuje „Spremljeno na poslužitelju”.
2. Izbornici: `/` (naredbe: Navod, „Za provjeru [?]”, „Za provjeru [izvor]”, poglavlje, potpoglavlje, citat, popis, fusnota; onemogućene u hostu: fraza, slika, tablica, ref, fakultet, sastavnice, podrijetlo, predaje, runda) i `@` (do 8 izvora + njihove bilješke, „Dodaj novi izvor…”). Tipkovnica: strelice, Enter/Tab, Esc; `role=listbox`, `aria-activedescendant`.
3. Prečaci koji rade: Ctrl+Z, Ctrl+Y, Ctrl+B, Ctrl+I, Ctrl+K (naredbe), Ctrl+/ (popis), Ctrl+F (traženje), Ctrl+. (fokus), Alt+F10, Mod+Alt+0..3 (odlomak i naslovi), Esc. Oglašeni, a ne spojeni: Mod+Alt+M, Alt+↑/↓, Mod+\ (vidi G-7).
4. Fokus (◎): izbornici se skrivaju, toast „fokus” i gumb za izlaz.

### 1.4 Spremanje i rad bez mreže
1. Osam stanja (A-4): „Uređivanje”, „Spremam lokalno”, „Spremljeno na uređaju”, „Sinkroniziram”, „Spremljeno na poslužitelju”, „Sukob”, „Greška”, „Potreban oporavak”; uz njih „Dokument je otvoren u drugoj kartici.”. Statusna traka sažima EDITING, SAVING_LOCAL i SYNCING u „Sprema se…”; „Spremljeno na poslužitelju” prikazuje se samo uz potpis provjeren u ovoj sesiji stranice (nakon osvježavanja stoji „Spremljeno na uređaju”).
2. Veza pada: obavijest „Bez mreže. Tekst se i dalje sprema na ovom uređaju.” (uz „Slanje na poslužitelj nastavlja se kad se mreža vrati.”), žeton dobiva prefiks „Izvan mreže · ”, „Predaja rada” postaje onemogućen gumb s napomenom „Predaja rada traži vezu s mrežom.”. Veza se vrati: obavijest nestaje, nema vlastite poruke.
3. Druga kartica: Web Lock, jedna kartica piše (A-12); druga prikazuje „Ova kartica ništa ne sprema dok je druga otvorena. Kad je zatvorite, tekst se ovdje ponovno učitava.”.
4. Neuspjesi (`role=alert`): „Rad na poslužitelju razlikuje se od teksta na ovom uređaju…” (sukob), „Tekst je spremljen na uređaju, ali ga poslužitelj nije primio. Ponovno učitajte stranicu.”, „Slanje na poslužitelj je zaustavljeno… Izvezite tekst i javite se podršci.”, „Lokalni zapis nije moguće pouzdano pročitati…”, kvota/nedostupno/stari zapis. Uz bilo koji alarm vidljiv je „Izvezi tekst”.
5. Odjava s neposlanim tekstom: dijalog (fokus na „Ostani”) nudi „Izvezi tekst” kao glavnu radnju i „Odjavi se bez izvoza”; kopija teksta ostaje na uređaju i pri sljedećoj prijavi nudi je `RecoveryOffer` („Nastavi rad”, „Preuzmi kopiju teksta”, „Sakrij obavijest”).

### 1.5 Izvori i navodi
1. Kartica **Izvori**: popis „Literatura” (n izvora · citirano n · s potvrdom n), „Navodi bez izvora (n)” s „Pokaži”, „Poveži s izvorom”, „Dodaj izvor”; „Bilježnica izvora” (bilješke po izvoru: `work.source-notes.*`; „Umetni kao citat”/„Umetni navod”); „Potvrde iz izvora” (slika ili PDF, povuče se okvir oko dijela; šalje se samo isječak; „Doslovni tekst navoda”; `student.source-proofs.*`).
2. Dodavanje izvora: „Brzi izvor” (polja prema vrsti; polje „DOI ili ISBN” i „Dohvati podatke”), uvoz BibTeX/RIS (tekst ili datoteka do 1 MB, lokalno), „Skeniraj crtični kod” (samo ako preglednik ima BarcodeDetector, inače upis ISBN-a).
3. Navod u tekstu: `@` ili gumb „Navod” otvara „Umetni navod” (izvor, „Stranica”, npr. „14 ili 14–16”); „:14” + razmak iz prototipa nije provjereno kao spojeno (neprovjereno). Navod je čvor sa `sourceId` i `locator`; izvori su atribut dokumenta.
4. Ispod lista: „Navodi bez izvora: n” i „Sljedeći navod bez izvora”. Uklanjanje citiranog izvora traži drugi klik („Izvor je citiran n×. Kliknite Ukloni još jednom za potvrdu.”), a navodi postaju mjesta [izvor] za pregled.
5. Stanje izvora („Treba nabaviti / Imam / Pročitano”) čuva se samo na uređaju (`localStorage`); tekst to kaže.

### 1.6 AI pomoć i AI izjava
1. U pilotu je kartica **Asistent** samo obavijest („uskoro”): „Asistent u pilotu nije uključen. Vanjske alate možete koristiti prema pravilima fakulteta i navesti ih u izjavi pri predaji. …” (nema polja ni mrežnog poziva).
2. Pravilo zadatka (`aiPolicy`, `aiPurposes`: formatiranje, lektura, traženje literature, transkripcija, prijevod) student vidi na obavijesti prije pisanja (dio 1). **Unutar editora ga ne vidi** (dijalog „Prvi redak” dobiva `instructions: null`).
3. U pozadini radi usporedba s odgovorom pomoćnika (`AssistantMatchNoticeHost`): nakon 3 s mirovanja šalje promijenjene segmente (`work.assistant-match.post`), a nalaz se prikazuje kao „Dio teksta podudara se s odgovorom pomoćnika” + „Ovo je obična usporedba teksta i ništa ne govori o autorstvu.”. U pilotu je uključena (Daniel 22. 11.).
4. Izjava je u predaji (dio 3): „Izjava o korištenju generativne umjetne inteligencije” (po čl. 9 i 15 pravilnika), „Zabilježeno u Ducturi” + „Vaša izjava”, razgovor kao dijalog („Točno kako je zabilježen i kako će ga vidjeti nastavnik.”), potvrda „Potvrđujem izjavu”; ugovor `student.declaration.get|put` (stanja none, draft, confirmed, stale, bound). U kartici Mentor „Proba predaje” ima redak „Izjava o korištenju AI-ja: Potvrđena./Još nije potvrđena.” koji čita **lokalnu** oznaku, ne stanje poslužitelja.

### 1.7 Povijest verzija i vraćanje
1. Lijevi panel „Povijest dokumenta” (nalazi se u ladici ispod 1250 px): popis poslužiteljskih verzija (`work.versions.get`, najnovije prve; „Verzija n · datum”, „Predaja n”), odabir verzije otvara tekst samo za čitanje (`work.version.get`); „Prikazane su samo najnovije verzije…” kad ih je više od stranice.
2. „Povijest verzija” (TimeMachine): izbornici „Starija verzija” / „Novija verzija” + „Usporedi” (`work.compare.get`), traži najmanje dvije verzije.
3. „Vrati raniju verziju” (P-D7, ugrađeno): „Vratiti ovu verziju?” → „Da, vrati”; tekst se piše kroz isti put spremanja, nova verzija se bilježi (`work.restore.post` {fromRevision}); „Vraćanje stvara novu verziju; nijedna ranija verzija se ne briše.”.
4. U kartici Mentor: gumb „Usporedi s …” (dijalog, samo poslane verzije, nikad trenutni nacrt; „Za usporedbu su potrebne dvije poslane verzije.”).
5. Nema imenovanih točaka spremanja (prototipova `S.points`); verzije su kontrolne točke poslužitelja i predaje.

### 1.8 Prijelaz prema predaji (granica dijela 3)
1. „Proba predaje” (kartica Mentor): „Ništa se ne predaje. Ovo je popis onoga što bi mentor i referada dobili da rad predate sada.” Odjeljci: „Blokira predaju” (mjesta ostavljena za kasnije), „Dijelovi rada”, „Za pogledati”, „Opseg”, Sažetak, Summary, Ključne riječi, Izjava, „Komentari mentora (Otvoreno: n)”, „Suglasnost mentora”, „Kako će izgledati ispis”. Redovi „Zahtjevi fakulteta”, „Potvrde koje traži mentor” i „Obrasci fakulteta” uvijek pišu „Podatak trenutačno nije dostupan.”.
2. „Predaja rada” u zaglavlju je poveznica na tok predaje (ne predaje sama); nakon predaje je skrivena. Bez veze je onemogućena.
3. Predaja zaključava list: „Predano {vrijeme}. Rad je predan, pa se ovdje više ne može pisati.”, mentor i komentari samo za čitanje. Povlačenje (dok rok traje) otvara editor ponovno (dio 3).

---

## 2. Gdje zapinje

Oznake: **G-n** je nalaz; uz svaki ekran, element, stanje i je li provjereno u kodu ili treba preglednik.

### 2.1 Koraci i tok

- **G-1 Otvaranje: više uzroka, jedna poruka, bez izlaza.** Ekran: list kad `evidence.open` ne uspije. Nedostatak `journalScope`/`sessionTag` (npr. istek sesije prije prvog čitanja) i mrežna greška daju istu rečenicu „Rad trenutačno nije moguće otvoriti.” u običnoj bilješci lista, bez `role=alert` i **bez gumba**. U katalogu već postoje `openRetry`, `openReloadButton` („Učitaj ponovno”) i `openNoticeLink`, ali ih `EditorPageWork` ne prikazuje; za `upgrade_required` student treba ručno osvježiti stranicu, za `not_accepting` nema poveznice na obavijest. Provjereno u kodu.
- **G-2 Dvije različite poruke za isti kvar.** Okvir `greska` (`ErrorCard`: „…Tekst spremljen na ovom uređaju ostaje netaknut.” + „Pokušaj ponovno”) i bilješka u listu (G-1) govore različito o istom problemu; prva obećava da je tekst sačuvan, druga ne. Provjereno u kodu.
- **G-3 Prvi dojam: vodič se troši prije nego se vidi.** `claimOnboarding` zapisuje oznaku prije prikaza; ako student zatvori karticu ili osvježi stranicu u prvih sekundi, vodič se nikad više ne pojavi sam (ostaje „Pomoć → Prvi koraci”). U automatskom načinu fokus ostaje u listu, pa kartica nije izvan live regije u kojoj se najavljuje tek tekst. Provjereno u kodu; ponašanje s čitačem zaslona provjeriti u pregledniku.
- **G-4 Prečaci: dva popisa i neistiniti redci.** Popis iz „Naredbe → Prečaci” (Ctrl+/) i gumb „Prečaci” u zaglavlju (znak `?`) prikazuju različite skupove; potonji oglašava Mod+Alt+M (komentar uz označeni tekst), Alt+↑/↓ (premjesti rečenicu), Mod+\ (struktura rada) i vjerojatno Mod+Shift+7 (numerirani popis), koji nisu spojeni. Test `shortcut-parity.test.ts` provjerava samo kodove koje `editorShortcut` obrađuje, pa to ne hvata. Potvrđuje i `paritet-editor-2.md` (#473). Provjereno u kodu.
- **G-5 Alatna traka: sloj ponašanja nije montiran.** `StudentToolbar` ne daje `behaviour`, pa ne rade: „Više” i sklapanje po širini, opisi alata, „Prilagodi alatnu traku”, kontekstni gumb, veličina teksta, mobilna traka „Brzi alati”. Posljedica: traka lomi u više redaka na 1440 px (do ~226 px prema reviziji), „Kako vidi nastavnik” je onemogućen. Poznato iz `paritet-editor-2.md` (regresija #527); ovdje samo kao ulaz za P-4.
- **G-6 Numerirani popis ne postoji.** Namjerno izostavljen zbog sheme v1 (`omit=["numberedList"]`), ali student ga očekuje (Word, Docs). Nema poruke zašto; izbornik `/` ga ne nudi. Provjereno u kodu.
- **G-7 Naredbe `/` koje su uvijek sive.** `/` izbornik prikazuje fraza, slika, tablica, ref, fakultet, sastavnice, podrijetlo, predaje, runda kao onemogućene bez objašnjenja; student ne zna jesu li pokvarene ili „još ne”. Provjeriti u pregledniku (izgled onemogućenih stavki).
- **G-8 Brojač riječi bez značenja.** Statusna traka piše „340 riječi · opseg 1.200 do 1.600”, ali nema oznake „ispod/iznad opsega” ni najave čitaču; opseg je pravilo zadatka (`wordMin`, `wordMax`). Student mora sam usporediti dva broja. Provjereno u kodu.
- **G-9 Spremanje: žeton je sam live regija.** `SaveState` je `role=status`; `LocalSaveChip` ima zasebnu skrivenu regiju koja se najavljuje samo kad se tipkalo, ali host koristi `SaveStatus`/`SaveState`, pa se „Sprema se…” ↔ „Spremljeno na uređaju” može najavljivati pri svakoj stanci u tipkanju. Provjeriti čitačem zaslona.
- **G-10 Povratak mreže se ne najavljuje, a „mreža” je samo `navigator.onLine`.** Kad se veza vrati, obavijest samo nestaje; nema „Veza je vraćena, šalje se n izmjena”. `onLine === true` ne znači da poslužitelj odgovara, pa student može dugo vidjeti „Spremljeno na uređaju” bez objašnjenja zašto nije na poslužitelju. Provjereno u kodu.
- **G-11 Sukob bez odluke.** Stanje „Sukob”: „Rad na poslužitelju razlikuje se… Tekst ostaje na uređaju i ništa se ne šalje dok ne odlučite kako dalje.” Ekran **ne nudi nikakvu odluku**, samo „Izvezi tekst”. Rečenica obećava izbor kojeg nema. Provjereno u kodu (alarm i izvoz su jedine radnje).
- **G-12 „Slanje je zaustavljeno” bez puta prema pomoći.** Poruka kaže „javite se podršci”, ali nema poveznice ni gumba, iako ugovor `support.problem-report` postoji i u aplikaciji postoji `ProblemReportHelp`. Provjereno u kodu.
- **G-13 Oporavak nije najavljen.** `RecoveryOffer` („Na ovom uređaju čuva se Vaš tekst od prethodne odjave.”) je `section` bez live regije; čitač ga ne mora pročitati pri otvaranju. Dohvatljivo samo uz iskorištenu sesiju (ako je oznaka sesije istekla, ponuda se ne pokaže). Provjeriti u pregledniku.
- **G-14 Izvori: dohvat DOI/ISBN prikazan, ne radi.** „Brzi izvor” ima polje „DOI ili ISBN” i „Dohvati podatke”, no `lookupSource` je zadano „nedostupno” (ne prosljeđuje se iz `SourcesMention` ni `LiteratureList`), pa student dobiva „Dohvat podataka trenutačno nije dostupan. Izvor možete unijeti ručno.” iako ruta `sources.lookup.post` ({kind: doi|isbn, identifier}) postoji, a A-13 je odobrio dohvat preko poslužitelja. Provjereno u kodu.
- **G-15 Izvori: „zatražene potvrde” i „preporučeni izvori” uvijek „nedostupno”.** Nastavnik ih u ugovoru može zadati (`teacher.source-proof-request.*`, `teacher.source-recommendation.*`), a student ih vidi samo kao „zasad nisu dostupne”. Je li za studenta postoji čitajuća operacija nije vidljivo iz izvatka koji sam čitala; ne izmišljam (pitanje 3). Također: `student.work-sources.get|put|delete` nemaju pozivatelja (izvori žive u atributu dokumenta).
- **G-16 Izvori: stil navoda samo FPZG, mrtva komponenta.** Ugovor ima `citationStyle: "fpzg"`; prototip ima šest stilova (C-12: Lekta je Danielov proizvod, odlučuje on). `SourcesPanel` („Literatura”, „Dodaj i citiraj”, „Samo u Literaturu”) nije montiran nigdje, a tri slična sučelja za literaturu (LiteratureList, bibliografija, bilježnica) dijele jedan prostor. Dodatno, tri komponente reagiraju samo na `event.isTrusted`, što može tiho blokirati pomoćne tehnologije koje sintetiziraju klik. Provjereno u kodu.
- **G-17 Uvoz teksta iz datoteke je slijepa ulica.** `ImportHost` dobiva `unavailableTransport` (`work.tsx`); stringovi „Uvezi tekst iz datoteke” postoje, a ruta `work.imports.post` u ugovoru. Student koji ima tekst u Wordu mora kopirati i zalijepiti (oznaka „uvezeno/zalijepljeno” iz prototipa nije provjerena). Provjereno u kodu.
- **G-18 AI: pravilo zadatka nestaje u editoru.** Student je pravilo (dopuštene svrhe) vidio jednom na obavijesti; u editoru ga nigdje nema (`instructions: null`; `InstructionsPanel` je samo u parkiranom `_cekanje/`). Kartica Asistent kaže „Vanjske alate možete koristiti prema pravilima fakulteta”, ali ne kaže koja su. Provjereno u kodu.
- **G-19 AI: izjava se otkriva tek pri predaji.** Student do trenutka predaje ne vidi što je Ductura zabilježila o pomoćniku (prijenosi, razgovori), a redak „Izjava” u probi čita lokalnu oznaku, dok poslužitelj odlučuje o predaji (`declarationRequired`: „Ovaj zadatak traži izjavu, a poslužitelj nema potvrđenu izjavu za ovu verziju teksta. Rad nije predan.”). Student može vidjeti „Potvrđena.” u probi i odbijenicu pri predaji. Provjereno u kodu.
- **G-20 AI: obavijest o podudaranju bez puta „Objasni”.** Komentar u datoteci kaže da nema rute za spremanje objašnjenja, a ugovor sada ima `work.assistant-match-explanation.post` i stringovi „Objasni, ako želiš…”/„Pošalji objašnjenje” postoje; je li port spojen nije potvrđeno (neprovjereno).
- **G-21 Povijest: tri ulaza, dva načina usporedbe.** Povijest je u lijevoj ladici (skrivena ispod 1250 px), usporedba „Usporedi s …” u kartici Mentor (desna ladica ispod 1050 px), a „Povijest verzija” (Starija/Novija) u lijevom panelu. Odluka 2160 kaže jedan izbornik i samo poslane verzije, a lijevi panel ima dva izbornika; ruta `/rad/{id}/povijest` ne postoji („Stranica ne postoji”, iz revizije). Student koji želi „vidjeti što sam jučer napisao” mora otvoriti ladicu, pa odabrati verziju. Provjereno u kodu i reviziji.
- **G-22 Povijest: vraćanje bez pregleda razlike.** „Vratiti ovu verziju?” pita bez prikaza što će se promijeniti; razlika postoji (`work.compare.get`), ali nije povezana s koracima vraćanja. Provjereno u kodu.
- **G-23 Prijelaz: „Predaja rada” i zaglavlje na uskim zaslonima.** Revizija je našla da je gumb „Predaja rada” odsječen na 1050 i 400 px (traka se vodoravno pomiče; naslov rada je sakriven ≤640). Student koji piše na mobitelu teško pronalazi izlaz prema predaji. Preuzeto iz `paritet-editor-2.md`; provjeriti u pregledniku.
- **G-24 Prijelaz: proba predaje ne zna sve.** Tri retka su zauvijek „nedostupno”, a nema ni sažetka „što još fali” izvan kartice Mentor (koju ladica skriva). Student ne vidi iz zaglavlja je li išta blokirano. Provjereno u kodu.
- **G-25 Sitnice.** (a) „Ductura” u zaglavlju ide na golu `/zadaci`, ne kroz bazni put (`appHref(base)`); (b) „Stavi tekst rada u međuspremnik” guta neuspjeh bez poruke; (c) „Izvezi → međuspremnik” i „Pregled ispisa” su dva odvojena puta (DOCX u reviziji javio „Preuzimanje rada nije uspjelo”, moguće samo lažni poslužitelj). Provjereno u kodu.

### 2.2 Stanja

- **Učitavanje:** kostur u okviru; „Otvaram rad…” u listu bez vremenskog ograničenja (ni „još uvijek otvaram” poruke ako poslužitelj ne odgovara). Provjeriti usporenom mrežom.
- **Prazno:** `prazno` je jasno („Počnite pisati…”). Prazna literatura: „Dodajte ih u kartici Literatura.”; prazan popis verzija i jedna verzija: usporedba se ne nudi, a razlog je tek „Za usporedbu su potrebne dvije poslane verzije.” (nema objašnjenja za „Povijest verzija”).
- **Greška:** okvir ima „Pokušaj ponovno”, list (G-1) nema. Greška vraćanja verzije i greška izvoza nisu jednoobrazne (neprovjereno u pregledniku).
- **Dvostruki klik:** `StartWork` ima `busy`; „Vrati” ima dvostupanjsku potvrdu; ostalo nije provjereno.
- **Predano / samo za čitanje:** jasno („Predano {vrijeme}…”), ali izmjene napravljene nakon predaje ostaju „samo na ovom uređaju” (poruka postoji); student može pomisliti da su poslane. Provjeriti u pregledniku.
- **Drugi uređaj:** nije definirano što student vidi kad isti rad otvori na mobitelu dok je na računalu otvoren; blokada kartice vrijedi po pregledniku (A-12), a ne po uređaju (neprovjereno, ovisi o poslužitelju).

### 2.3 Pristupačnost (iz koda; čitačem provjeriti)

- Dobro: `role=listbox/option/aria-activedescendant` u izbornicima `@` i `/`; `role=alert` unaprijed prisutan u alarmima spremanja; modalni dijalozi s fokusom na sigurnu radnju (odjava: „Ostani”); gumbi izbornika `aria-haspopup="menu"`; `aria-label` „Otvori rad: {naslov}”.
- Pitanja: (1) žeton spremanja kao `role=status` (G-9); (2) brojač riječi bez `aria-live` i bez praga (G-8); (3) `RecoveryOffer` nije live (G-13); (4) vodič u automatskom načinu ne prima fokus (G-3); (5) `isTrusted` zaštite (G-16); (6) onemogućene stavke `/` (G-7); (7) Dialog unutar ladice traži poseban rad s Esc (već riješeno u probi predaje, ne za ostale dijaloge); (8) axe spec postoji samo za raspored panela (`EditorPanelLayout.axe.spec.mjs`), ne za izvore, povijest i korake predaje; (9) kontrast i fokus: `VIZ-WCAG.md` pokriva paket `ui`, ne ove ekrane posebno.

### 2.4 Mobitel (provjeriti u pregledniku; granice 640/760/1050/1250 px)

- Ispod 1250 px i izvori i povijest i proba predaje su iza ladica (☰ i ikona panela); do bilo čega osim lista treba dva dodira (ladica, zatim kartica).
- Alatna traka ≤640 px: ikone 40×40 px (ispod 44), riječi skrivene; nema „Brzi alati” (G-5). Ciljevi 34–38 px: komentari, konzultacije, poveznica zaglavlja (36 px), sažetak ljuske (36 px).
- Zaglavlje: naslov rada skriven, traka se pomiče vodoravno, „Predaja rada” odsječena (G-23).
- Potvrde iz izvora: „Slikaj” (kamera) i PDF s povlačenjem okvira; tipkovnička zamjena je u tekstu (strelice), dodir nije izravno provjeren.
- Skener crtičnog koda: samo u preglednicima s BarcodeDetector; inače upis ISBN-a.
- Asistent kartica: samo tekst; prekidač „Kako vidi nastavnik” onemogućen.
- Redci literature imaju svaki svoj „Pokaži”/„Uredi”: dugi redoslijed Tab na mobitelu i na tipkovnici.

### 2.5 Greške i oporavak

- Istek prijave usred pisanja: obavijest „Prijava više ne vrijedi, pa ova kartica više ne prikazuje rad. Rad nastavljate kad se ponovno prijavite.” + „Prijavi se”; tekst ostaje na uređaju. Dobro; nije provjereno vraća li se student na isti rad nakon prijave (dio 1: povratak na stranicu).
- Oporavak nakon odjave: `RecoveryOffer` s datumom, „Nastavi rad”, „Preuzmi kopiju teksta”; dobro, ali vidi G-13. Ako je `keepCopy` neuspješan jer je sesija već završila, dijalog to ne kaže.
- Sukob i zaustavljeno slanje: vidi G-11 i G-12; izvoz teksta je jedini put.
- Zadatak promijenjen tijekom pisanja: „Obavijest zadatka se promijenila…” (bez poveznice, G-1).
- Neuspjeh vraćanja verzije: nova verzija „čeka potvrdu poslužitelja” je ispravno; što ako potvrda ne dođe dugo, nije opisano.

---

## 3. Što nude slični alati i što traže pilot, privatnost i pravila o AI izjavi

### 3.1 Slični alati (opisno, iz općeg poznavanja, bez kopiranja izgleda)

- **Uređivači teksta u oblaku (tipa Google Dokumenti, Word na webu):** spremanje bez klika s jasnim „Spremljeno”, rad bez mreže uz sinkronizaciju, povijest verzija s imenovanjem točaka i usporedbom u jednom prozoru, numerirani popisi i tablice, brojač riječi, prijedlozi i komentari. Mana koja se često spominje: stanje sinkronizacije se pokazuje ikonom bez riječi, a sukobi se rješavaju bez pitanja korisnika.
- **Uređivači s navodima (tipa Zotero i Mendeley uz dodatak, Overleaf):** biblioteka izvora odvojena od teksta, dohvat podataka po DOI-ju ili ISBN-u, stilovi citiranja po izboru, popis literature se gradi sam; kod LaTeX-a stalna pretpostavka da student zna sintaksu. Očekivanje studenata: „zalijepi DOI, dobij ispunjen zapis”.
- **Alati za pomoć u pisanju (tipa provjera pravopisa i stila u pregledniku ili uredniku, alati s AI pomoćnikom):** podcrtavanje u tekstu, prijedlozi uz odlomak, objašnjenje svrhe prijedloga; kod AI alata različite razine uključenosti, od lekture do generiranja teksta. Studenti očekuju znati što smiju koristiti, a pravilo često živi u dokumentu mimo alata.
- **Sustavi za predaju i provjeru podudaranja (tipa Turnitin, sustavi u Moodleu/Merlinu):** potvrda o predaji s vremenom, ponekad „predaj nacrt i dobij izvješće”. Problem koji ovdje izbjegavamo: neprozirna procjena; Ductura prikazuje podudaranje teksta i bilježi događaje, ne procjenjuje autorstvo (PRODUCT §5).
- **Bilježnice za istraživanje (tipa Notion, Obsidian ili obični dokumenti uz izvore):** bilješka vezana uz izvor i stranicu, povratak na mjesto u izvoru.

Zajedničko što studenti očekuju: (1) uvijek vidi je li tekst spremljen i gdje; (2) povijest je blizu, a vraćanje ne gubi ništa; (3) izvori se unose brzo (DOI), a literatura se slaže sama; (4) jasno je što je dopušteno koristiti i što će se bilježiti; (5) predaja je zaseban, svjestan korak s pregledom.

### 3.2 Što traže pilot, privatnost i AI izjava za ovaj dio

- **Pilot:** prijava samo AAI@EduHr (D-09, D-16); rok funkcija 15. 1. 2027.; sve novo najprije u prototip i INVENTAR-editor; pilot je s izmišljenim podacima dok ne stignu pravno mišljenje i DPIA. Komponente iz `packages/ui` bez lokalnog stila; vizualni prolaz je centralan (Daniel 22. 11.), pa prijedlozi ne traže izgled.
- **Privatnost:** sadržaj tipki smije se bilježiti samo u polju za pisanje u editoru, kao zasebna klasa podataka, briše se nakon izračuna, najkasnije 30 dana nakon predaje, nikad se ne prikazuje kao zapis tipki (Ustav v1.9); ritam unosa isključuje samo nastavnik (P-1), pa se u ovom dijelu ne dodaje nikakvo novo bilježenje. Novi prijedlozi (npr. P-26) ne smiju uvesti zapis izvan editora ni nove podatke o procesu. Dohvat DOI/ISBN šalje poslužitelju samo identifikator izvora (A-13); potvrde iz izvora šalju samo označen isječak, PDF ostaje na uređaju (tako je danas).
- **Spremanje i obećanja (B-6):** nijedna poruka ne smije tvrditi „spremljeno na poslužitelju” bez potpisane potvrde; poruke „poslano” kad je poslužitelj odgovorio „možda”. Svaka nova poruka (npr. povratak mreže) mora to poštovati.
- **AI izjava:** nastavnik postavlja pravilo uporabe alata (FPZG čl. 8, `aiPurposes`); student ga vidi prije pisanja; izjava (declaration-v1, #499) je verzionirani obrazac fakulteta (OD-11: samo test-izjava dok je fakulteta ne objavi), s `humanHelp {kind,text}` (OD-12, zatvoren skup) i prilozima ispisa; izjava o AI-ju je dijalog `ch-h` (odluka 2165); „izvornost” smije stajati samo kao doslovni naziv službenog obrasca (B-5). OC-1: prekidač alata u `config/faculties`, zadano isključeno, mijenja ga samo vlasnik. Q-10 odgođen: **ne bira se pružatelj ni model**, a kartica Asistent ostaje „uskoro”.
- **Podudaranje s pomoćnikom i postotci:** podudaranje (8+ riječi, deterministički) je u pilotu uključeno (22. 11.); uvijek uz napomenu „nije dokaz autorstva”, ne blokira, ne ulazi u ocjenu ni izvoz, student vidi isto što i nastavnik. Postotak sličnosti s izvorima i udio iz zabilježenih događaja (C-6) ne grade se bez zadatka orkestratora; ovaj dokument ih ne predlaže.
- **Zabranjeni izrazi:** svaki novi tekst kroz skener (PRODUCT §5). Posebno oprez kod tekstova o opsegu riječi (opisuje zadatak, ne student), o povratku mreže (ne obećava poslužitelj) i o izjavi (ne tvrdi autorstvo ni nastanak rada).

---

## 4. Numerirani prijedlozi

Veličina: S (do ~150 redaka koda), M (150–400), L (više od 400 ili više PR-ova). „Server” = treba li novo polje ili ruta; „ne, postoji” znači da je operacija u izvatku ugovora. „Prototip” = dodiruje li prototip i INVENTAR-editor (što bi se najprije izmijenilo). Preklapanja s revizijom paritet-editor-2 (§PRIJEDLOG ZADATAKA) označena su „vidi P2-n”; ovdje se ne ponavljaju kao novi zadaci, nego se samo ocjenjuje njihovo mjesto u pilotu.

**P-1 Otvaranje rada: razlikovati uzroke i dati izlaz.**
- Opis: u `EditorPageWork` prikazati `role=alert` s gumbom po uzroku: nema opsega/sesije (`noScope`) → „Prijava više ne vrijedi” + „Prijavi se”; mrežna/neuspjela čitanja → „Pokušaj ponovno” (ista rečenica o spremljenom tekstu kao u okviru `greska`); `upgrade_required` → „Učitaj ponovno”; `not_accepting` → poveznica „Pročitaj obavijest zadatka” (stringovi `openRetry`, `openReloadButton`, `openNoticeLink` već postoje). Jedna poruka za oba mjesta (G-2).
- Korist: rješava G-1 i G-2; student nikad ne ostaje na praznom listu bez radnje.
- Veličina: S. Rizik: nizak (prikaz, tekstovi već u katalogu; jedan DOM test po ishodu). Server: ne, postoji. Prototip: ne (prototip ne zna za dnevnik i sesiju).

**P-2 Stanje spremanja: smirene najave i poruka povratka veze.**
- Opis: (a) žeton spremanja ne najavljuje pri svakoj stanci: najava samo pri prijelazu između razina („Spremljeno na uređaju” ↔ „Spremljeno na poslužitelju” ↔ greška) kao u `LocalSaveChip`; (b) pri povratku veze jedna poruka „Veza je vraćena. Šalje se {n} izmjena.” dok se ne potvrdi, zatim nestaje (ne tvrdi „spremljeno na poslužitelju” prije potpisa, B-6); (c) uz „Izvan mreže” navesti „čeka slanje: n izmjena” kad dnevnik zna broj (odjava ga već piše).
- Korist: G-9 i G-10; student zna kad je sigurno zatvoriti karticu.
- Veličina: S do M. Rizik: srednji (dira poruke o spremanju, B-6, i `aria-live`; test prijelaza i tekstova skenerom). Server: ne. Prototip: da (A-4 popis tekstova stanja treba dodati „povratak veze” i „čeka slanje”).

**P-3 Sukob: ponuditi odluku koju poruka obećava.**
- Opis: u stanju „Sukob” uz „Izvezi tekst” ponuditi dvije radnje: „Zadrži tekst s ovog uređaja” (nova revizija iznad poslužiteljske) i „Pogledaj verziju s poslužitelja” (samo za čitanje, uz razliku), s potvrdom i uvijek prvim korakom izvoza. Dok odluka ne padne, stanje ostaje „Sukob”.
- Korist: G-11; poruka više ne obećava ono što ekran ne nudi.
- Veličina: L. Rizik: visok (dira sinkronizaciju i potpisani lanac; ide kao kritična promjena uz plan napada). Server: **treba potvrdu** koju rutu i koji ishod sukoba predviđa poslužitelj (`evidence.commit` s `baseRevision`; `evidence.replay`); ne izmišljam polje, nego pitam (pitanje 2). Dok toga nema, preporuka je manja ispravka: promijeniti rečenicu da ne obećava izbor (S). Prototip: da (prototip nema sukob).

**P-4 Alatna traka: spojiti sloj ponašanja, numerirani popis, ciljevi 44 px.**
- Opis: spojiti `behaviour` (Više, sklapanje po širini, opisi, prilagodba, kontekstni gumb, veličina teksta, „Brzi alati” na mobitelu); ciljevi na dodir 44 px; numerirani popis tek uz shemu v3 (PIL-K-SHEMA-V3), do tada razlog u opisu alata.
- Korist: G-5 i G-6; bez ovoga mobitel nije upotrebljiv za pisanje.
- Veličina: L (dva PR-a prema P2-1). Rizik: srednji (dira zajedničku traku i `@ductura/ui`; ide kroz centralni prolaz stila). Server: ne. Prototip: da (INVENTAR §1.3, toolbar2). Vidi P2-1.

**P-5 Jedan popis prečaca koji govori istinu.**
- Opis: jedan izvor popisa (`shortcut-definitions`) za Ctrl+/ i za gumb „Prečaci”; svaki redak ima test da kod doista radi (proširiti `shortcut-parity` s popisa, ne samo s `editorShortcut`); nespojeni se skidaju dok ne postoje (ili se spajaju: Mod+Alt+M, Alt+↑/↓, Mod+\ prema P2-2). Isto za `/`: onemogućene stavke dobivaju razlog (npr. „uskoro”) ili se skrivaju (G-7).
- Korist: G-4 i G-7; popis koji ne laže. Veličina: S. Rizik: nizak. Server: ne. Prototip: da (INVENTAR §3.6 popis prečaca). Vidi P2-2.

**P-6 Opseg riječi: tihi prag u statusnoj traci.**
- Opis: uz „340 riječi · opseg 1.200 do 1.600” dodati činjeničnu oznaku „još 860 do donje granice” / „iznad gornje granice za 40”, bez boja upozorenja i bez blokade; najava čitaču samo pri prijelazu granice (`aria-live=polite`). Tekst opisuje zadatak, ne studenta.
- Korist: G-8; student s opsegom 1.200–1.600 ne računa sam. Veličina: S. Rizik: nizak (granice iz `readWordRange`). Server: ne, postoji (`wordMin`, `wordMax`). Prototip: da (statusna traka, INVENTAR §3.1).

**P-7 Dohvat izvora po DOI-ju i ISBN-u kroz poslužitelj.**
- Opis: poslati `lookupSource` u „Brzi izvor” (i `LiteratureList`) na `sources.lookup.post` ({kind, identifier}); odgovor `{source}` ili `null` („Izvor nije pronađen, unesite ga ručno”); polja se popunjavaju, student ih potvrđuje prije spremanja. Bez izravnih poziva iz preglednika (A-13).
- Korist: G-14; najčešći način unosa izvora u drugim alatima. Veličina: S do M. Rizik: nizak do srednji (identifikator napušta preglednik prema poslužitelju; zapisati u obavijest o privatnosti što se šalje). Server: ne, postoji. Prototip: da (INVENTAR §5, „traženje izvora preko poslužitelja”, val 6).

**P-8 Student vidi zatražene potvrde i preporučene izvore.**
- Opis: kartica „Potvrde iz izvora” prikazuje „Zatražene potvrde” i „Preporučeni izvori” iz podataka koje nastavnik zada (oznaka `need-proof`, „cit. prema”, `has-proof`).
- Korist: G-15; zahtjev nastavnika dolazi do studenta. Veličina: M (dva PR-a prema P2-10). Rizik: srednji (student vidi što nastavnik traži; mentorove radne bilješke ostaju skrivene, PRODUCT §5 pravilo 5). Server: **postoji nastavnička strana** (`teacher.source-proof-request.*`, `teacher.source-recommendation.*`); studentska operacija čitanja **nije potvrđena** u izvatku, pa SRV zadatak „student.* čitanje” ako je nema (pitanje 3). Prototip: da (S.recs, S.proofReq; INVENTAR §2.4).

**P-9 Pravilo uporabe alata vidljivo u editoru.**
- Opis: u desnom panelu, na kartici Asistent (zamjena „uskoro” kratkim sadržajem), prikazati „Pravila za ovaj zadatak”: dopušteno ✓ / nije dopušteno × iz `aiPurposes` (isti `student.notice.get` kao dio 1), jedna rečenica „Navedite alate u izjavi pri predaji” i poveznica na obavijest; dijalog „Prvi redak” dobiva `instructions` zadatka umjesto `null`.
- Korist: G-18; pravilo ostaje pred studentom dok piše. Veličina: S do M. Rizik: nizak (samo prikaz podataka koje imamo; tekst kroz skener). Server: ne, postoji. Prototip: da (kartica Asistent u prototipu je puna; INVENTAR §2.5 i §8).

**P-10 Kartica Asistent: iskreno stanje i granice.**
- Opis: dok je asistent isključen (OC-1) tekst kaže što je isključeno i do kada, bez imena modela ili pružatelja; kad ga fakultet uključi, kartica se puni po D-194 (tek kad Daniel odluči Q-10). Ništa se ne gradi na pružatelju.
- Korist: rubni slučaj do odluke; student ne očekuje ono što ne postoji. Veličina: S. Rizik: nizak. Server: ne (kontrakti `student.assistant-*` ostaju bez pozivatelja). Prototip: da (C-13).

**P-11 Izjava bez iznenađenja: stanje izjave tijekom pisanja.**
- Opis: (a) redak „Izjava o korištenju AI-ja” u probi čita `student.declaration.get` (stanje none/draft/confirmed/stale/bound, `declarationRequired`) umjesto lokalne oznake; (b) kartica ili odjeljak „Što je zabilježeno” (prijenosi iz pomoćnika, razgovori bez prijenosa, prilozi) dostupna iz editora samo za čitanje, s napomenom da izjavu student potvrđuje pri predaji.
- Korist: G-19; „Potvrđena.” u probi više ne proturječi odbijenici pri predaji. Veličina: M. Rizik: srednji (izjava je pravno osjetljiva; tekstovi kroz pravni pregled; čuvanje i prikaz kao u declaration-v1). Server: ne, postoji. Prototip: da (E-9, INVENTAR §4.1 „Predaja”).

**P-12 Izjava o AI-ju kao dijalog u editoru (odluka 2165).**
- Opis: dijalog `ch-h` dostupan i iz editora („Izjava o korištenju alata”), s istim ugovorom i istim obrascem; naziv „izvornost” samo kao navod službenog obrasca (B-5).
- Korist: student ažurira izjavu čim upotrijebi alat, a ne u zadnjoj minuti. Veličina: M. Rizik: srednji (isti kao P-11). Server: ne, postoji. Prototip: da. Vidi P2-19.

**P-13 Podudaranje s pomoćnikom: provjera cjeline.**
- Opis: provjeriti je li port `work.assistant-match-explanation.post` spojen; ako jest, ukloniti zastarjeli komentar; ako nije, spojiti „Objasni, ako želiš…”. Tekst nalaza ostaje bez riječi o autorstvu; prikaz je jednak za studenta i nastavnika.
- Korist: G-20. Veličina: S. Rizik: nizak. Server: ne, postoji. Prototip: da (B-2).

**P-14 Jedan ulaz „Povijest i usporedba”.**
- Opis: povijest verzija, usporedba i vraćanje dostupni iz jedne stavke (npr. u zaglavlju radnog prostora ili na vrhu lijevog panela, s poveznicom iz kartice Mentor), jedan izbornik „Usporedi s …” samo s poslanim verzijama (odluka 2160) uz pregled zasebno „Poslane i spremljene”; ruta `/rad/{id}/povijest` kao izravna poveznica.
- Korist: G-21; student ne traži povijest po ladicama. Veličina: M. Rizik: nizak do srednji (dira dva panela; ne mijenja podatke). Server: ne, postoji (`work.versions.get`, `work.compare.get`). Prototip: da (C-10, INVENTAR §3.5). Vidi P2-20.

**P-15 Vraćanje s pregledom razlike.**
- Opis: u koraku „Vratiti ovu verziju?” prikazati sažetak razlike (broj izmijenjenih odlomaka, prvih nekoliko) iz `work.compare.get` prije „Da, vrati”.
- Korist: G-22; student zna što vraća. Veličina: S do M. Rizik: nizak (samo čitanje prije postojeće radnje). Server: ne, postoji. Prototip: da (P-D7 „vraćanje vlastitog teksta”).

**P-16 Proba predaje: stvarni podaci umjesto „nedostupno”.**
- Opis: redove „Potvrde koje traži mentor” i „Zahtjevi fakulteta” puniti iz P-8 i iz pravila fakulteta kad postoje; „Obrasci fakulteta” iz declaration-v1 `currentForm`; ako podatak ne postoji, reći zašto („Fakultet još nije objavio pravila”, Q-11), ne „nedostupno”.
- Korist: G-24. Veličina: S do M. Rizik: nizak. Server: djelomično (ovisi o P-8; Lekta paket je pod Q-11). Prototip: da (INVENTAR §2.5, Proba predaje).

**P-17 Predaja rada uvijek dohvatljiva i sažetak „što još fali”.**
- Opis: gumb „Predaja rada” ostaje cijeli na 1050 i 400 px (zaglavlje prelama ili skuplja druge elemente); uz njega broj blokada iz probe („2 stvari prije predaje”), bez otvaranja kartice Mentor.
- Korist: G-23 i G-24. Veličina: S do M. Rizik: nizak (zaglavlje je dio VIZ-S1; ide kroz zajednički PR ljuske, ne ovdje). Server: ne. Prototip: da (INVENTAR §1.2 ne navodi „Predaja rada” u zaglavlju, odluka orkestratora WEB-23; potvrditi, pitanje 7). Vidi P2-23.

**P-18 „Slanje je zaustavljeno”: put prema podršci.**
- Opis: uz poruku gumb „Javi problem” (postojeći `ProblemReportHelp`, `support.problem-report`) koji u prijavu stavlja samo oznaku stanja (ne tekst rada); „Izvezi tekst” ostaje prvi.
- Korist: G-12. Veličina: S. Rizik: nizak do srednji (prijava smije sadržavati tehničku šifru, nikad sadržaj rada). Server: ne, postoji. Prototip: ne.

**P-19 Uvoz teksta iz datoteke (DOCX/PDF) spojiti na poslužitelj.**
- Opis: spojiti `ImportHost` na `work.imports.post` i `work.imports.confirm.post`; uvezeni tekst ostaje označen kao uvezen (tekst iz datoteke, ne dokaz nastanka).
- Korist: G-17; student s tekstom u Wordu ne kopira ručno. Veličina: M do L. Rizik: srednji do visok (oznake porijekla, PDF worker SRV-1804, privatnost sadržaja datoteke, shema v3). Server: ne, postoji; novi čvorovi traže PIL-K-SHEMA-V3. Prototip: da (INVENTAR §2.6).

**P-20 Vodič „Prvi koraci”: potvrda tek nakon završetka.**
- Opis: oznaka „viđeno” zapisuje se pri „Završi vodič”/„Preskoči vodič”, a ne pri prikazu; u automatskom načinu fokus prelazi na naslov vodiča.
- Korist: G-3. Veličina: S. Rizik: nizak (lokalni ključ, bez poslužitelja). Server: ne. Prototip: da (onboarding nije u INVENTAR-editor, dodati).

**P-21 Pristupačnost izvora, povijesti i koraka predaje.**
- Opis: axe spec za Izvore, Povijest dokumenta i korake predaje; ukloniti `isTrusted`-only zaštite ili ih zamijeniti drugim sigurnosnim mehanizmom koji ne blokira pomoćne tehnologije; `RecoveryOffer` kao live regija; jednoobrazne greške.
- Korist: G-13, G-16 i 2.3. Veličina: M. Rizik: srednji (zaštita od klika je sigurnosna; mijenja se u dogovoru s Sigurnosti). Server: ne. Prototip: ne. Ide u centralni prolaz pristupačnosti.

**P-22 Lažni poslužitelj VIZ „puno” otvara editor.**
- Opis: scenarij daje `/me` s `journalScope` i `sessionTag` i ispravne vektore za `evidence.open` (i dorada/predano), da se ovaj dio može proći klikom i snimiti (`packages/app/test-fakes`).
- Korist: bez toga nitko ne može provjeriti prijedloge P-1 do P-18 na stvarnom ekranu. Veličina: S. Rizik: nizak (test-fakes). Server: ne. Prototip: ne. Vidi P2-25.

**P-23 Sitnice (jedan PR).**
- Opis: (a) poveznica „Ductura” kroz `appHref(base)`; (b) povratna poruka „Tekst je stavljen u međuspremnik” / „Nije uspjelo” za „Izvezi → međuspremnik”; (c) „Pregled ispisa” i „Izvezi” u istom izborniku; (d) razlog uz sivu „Povijest verzija” kad je jedna verzija.
- Korist: G-25 i 2.2. Veličina: S. Rizik: nizak. Server: ne. Prototip: ne.

**P-24 Stil citiranja po ustanovi.**
- Opis: dodati stilove uz „fpzg” (APA, Chicago, IEEE, Vancouver, fusnote) kao postavku ustanove; Lektini profili pod C-12.
- Korist: studenti drugih fakulteta; za pilot na FPZG-u nije nužno. Veličina: L. Rizik: srednji (ugovor ima `citationStyle: const "fpzg"`). Server: **da** (proširiti vrijednost postavke, ne izmišljam polje). Prototip: da (faks.js, INVENTAR §6.1).

**P-25 Tablica, slika, formula (shema v4).**
- Opis: odgođeno po planu (val 10); ovdje samo zapisano da student u pilotu to neće moći umetnuti i da `/` to ne smije obećavati (vidi P-5).
- Veličina: L. Rizik: visok. Server: da (shema). Prototip: da.

**P-26 Povratna informacija o izmjenama iz drugog uređaja.**
- Opis: kad je isti rad otvoren u dva uređaja, druga kartica prikazuje jasan razlog i vrijeme zadnjeg spremanja s prvog (ne samo „otvoren u drugoj kartici”).
- Korist: 2.2 „Drugi uređaj”. Veličina: S do M. Rizik: srednji (ne smije otkriti ništa osim vremena i vrste uređaja; bez novog bilježenja). Server: **provjeriti** postoji li vrijeme zadnjeg potpisa u `evidence.open` (`currentRevision`, `documentHash`); ne izmišljam. Prototip: da (A-12).

---

## 5. Tablica za Danielovu odluku

Preporuka je moja; odluka je vaša. „Pilot” = ulazi u funkcije pilota 15. 1. 2027. (najprije u prototip i INVENTAR-editor). Redoslijed unutar „pilot” je po koristi za studenta.

| # | Prijedlog | Veličina | Server | Moja preporuka | Razlog | Vaša odluka |
|---|-----------|----------|--------|----------------|--------|-------------|
| P-1 | Otvaranje rada: uzroci i izlaz | S | ne (postoji) | **za pilot** | Prazan list bez radnje je prvi dojam; stringovi već postoje | ☐ pilot ☐ nakon pilota ☐ ne |
| P-22 | VIZ „puno” otvara editor | S | ne | **za pilot** | Bez toga se dio ne može provjeriti klikom | ☐ pilot ☐ nakon pilota ☐ ne |
| P-2 | Spremanje: smirene najave, povratak veze, „čeka slanje” | S do M | ne | **za pilot** | Jedino što student mora znati: jesam li sigurno | ☐ pilot ☐ nakon pilota ☐ ne |
| P-9 | Pravilo uporabe alata u editoru | S do M | ne (postoji) | **za pilot** | Pravilo nestaje nakon obavijesti; blizu pisanja | ☐ pilot ☐ nakon pilota ☐ ne |
| P-11 | Izjava: stanje s poslužitelja, „što je zabilježeno” | M | ne (postoji) | **za pilot** | Proba i predaja se ne smiju razilaziti | ☐ pilot ☐ nakon pilota ☐ ne |
| P-5 | Jedan popis prečaca, razlog uz sive naredbe | S | ne | **za pilot** | Popis ne smije lagati | ☐ pilot ☐ nakon pilota ☐ ne |
| P-6 | Opseg riječi: tihi prag | S | ne (postoji) | **za pilot** | Opseg je pravilo zadatka; jeftino | ☐ pilot ☐ nakon pilota ☐ ne |
| P-7 | Dohvat DOI/ISBN preko poslužitelja | S do M | ne (postoji) | **za pilot** | Najčešći unos izvora; ruta i odluka A-13 već postoje | ☐ pilot ☐ nakon pilota ☐ ne |
| P-4 | Alatna traka: ponašanje, 44 px (P2-1) | L | ne | **za pilot** | Regresija i mobitel; bez toga nema pisanja na telefonu | ☐ pilot ☐ nakon pilota ☐ ne |
| P-14 | Jedan ulaz „Povijest i usporedba” (P2-20) | M | ne (postoji) | **za pilot** | Povijest je obećanje proizvoda; sad skrivena | ☐ pilot ☐ nakon pilota ☐ ne |
| P-17 | „Predaja rada” uvijek vidljiva, broj blokada | S do M | ne | **za pilot** (ide u VIZ-S1) | Prijelaz prema predaji ne smije nestati | ☐ pilot ☐ nakon pilota ☐ ne |
| P-16 | Proba predaje: stvarni podaci | S do M | djelomično | **za pilot** (nakon P-8) | Tri retka uvijek „nedostupno” | ☐ pilot ☐ nakon pilota ☐ ne |
| P-8 | Student vidi zatražene potvrde i preporuke | M | provjeriti studentsku operaciju | **za pilot** ako ruta postoji | Zahtjev nastavnika mora do studenta | ☐ pilot ☐ nakon pilota ☐ ne |
| P-12 | Izjava kao dijalog u editoru | M | ne | nakon pilota | Odluka 2165; za pilot dovoljna je predaja | ☐ pilot ☐ nakon pilota ☐ ne |
| P-15 | Vraćanje s pregledom razlike | S do M | ne | **za pilot** | Vraćanje je nepovratno za osjećaj korisnika | ☐ pilot ☐ nakon pilota ☐ ne |
| P-18 | „Slanje zaustavljeno”: javi problem | S | ne | **za pilot** | Student ne ostaje bez puta | ☐ pilot ☐ nakon pilota ☐ ne |
| P-13 | Podudaranje: provjera „Objasni” | S | ne | **za pilot** | Pilot ga uključuje (22. 11.) | ☐ pilot ☐ nakon pilota ☐ ne |
| P-20 | Vodič: potvrda nakon završetka | S | ne | **za pilot** | Jeftino | ☐ pilot ☐ nakon pilota ☐ ne |
| P-23 | Sitnice (povratna poruka, base put) | S | ne | **za pilot** | Jedan mali PR | ☐ pilot ☐ nakon pilota ☐ ne |
| P-21 | Pristupačnost izvora, povijesti, predaje; `isTrusted` | M | ne | **za pilot** (centralni prolaz) | Obvezno prije pilota | ☐ pilot ☐ nakon pilota ☐ ne |
| P-3 | Sukob: odluka u sučelju | L (S za tekst) | provjeriti | tekst u pilotu, odluka nakon | Visok rizik; poruka da ne obećava izbor | ☐ pilot ☐ nakon pilota ☐ ne |
| P-10 | Kartica Asistent: iskreno stanje | S | ne | **za pilot** | Pomoćnik zadnji (C-13), tekst treba biti istinit | ☐ pilot ☐ nakon pilota ☐ ne |
| P-19 | Uvoz DOCX/PDF | M do L | ne (postoji) | nakon pilota | Shema v3 i privatnost; kopiranje radi | ☐ pilot ☐ nakon pilota ☐ ne |
| P-26 | Poruka o drugom uređaju | S do M | provjeriti | nakon pilota | Ovisi o poslužitelju | ☐ pilot ☐ nakon pilota ☐ ne |
| P-24 | Stilovi citiranja po ustanovi | L | da | nakon pilota | Pilot je na FPZG-u; Lekta pod C-12/Q-11 | ☐ pilot ☐ nakon pilota ☐ ne |
| P-25 | Tablica, slika, formula (shema v4) | L | da | nakon pilota | Odgođeno po planu | ☐ pilot ☐ nakon pilota ☐ ne |

Pitanja na koja ne mogu odgovoriti sama (iz ovog repoa se ne vidi):
1. Potvrđujete li da pilot ne uključuje asistenta (OC-1 isključeno), pa P-9 i P-10 pune karticu Asistent pravilima zadatka, a ne pomoćnikom?
2. Što poslužitelj predviđa za sukob (P-3): postoji li ruta ili ishod za „zadrži lokalno / uzmi s poslužitelja”, ili ostaje samo izvoz teksta?
3. Postoji li studentska operacija čitanja za zatražene potvrde i preporučene izvore (P-8) ili treba SRV zadatak?
4. Je li povratak mreže dopušteno prikazati kao „Veza je vraćena. Šalje se n izmjena” (P-2), uz uvjet da se „spremljeno na poslužitelju” ne tvrdi prije potpisa?
5. Treba li za pilot numerirani popis (G-6) ili je dovoljno do sheme v3, uz poruku zašto ga nema?
6. Vodič „Prvi koraci” (P-20): treba li ga vezati na prvi rad ili na prvu prijavu (sad: po osobi, jednom)?
7. Potvrđuje li se „Predaja rada” u zaglavlju editora (nije u INVENTAR-editor §1.2, odluka orkestratora WEB-23)?
8. Je li „zapisnik konzultacija” i „Poruka sebi”/„Dokle sam stao” (INVENTAR §8) u pilotu ili nakon? (Ovdje nije obrađeno jer pripada dijelu o mentoru.)

Otvoreno za provjeru u pregledniku (nije moguće iz ovog pregleda): mobitel (2.4), najave čitača zaslona za žeton spremanja i vodič (2.3), izgled onemogućenih `/` naredbi, ponašanje pri sporoj mreži, „:14” + razmak za stranicu u navodu, DOCX izvoz s pravim poslužiteljem.

---

## 6. Provedba u prototipu (Danielova odluka 23. 11. 2026.: svih 26 prijedloga u pilotu)

Prototip: `docs/prototip/editor/nf2.js` (v0.28), `editor.css` (kraj datoteke), `index.html`; popis stavki, stanja i poslužiteljskih ovisnosti: `docs/prototip/INVENTAR-editor.md` §2.8 i §5.1. Odluke: Asistent u pilotu isključen (kartica pokazuje pravila uporabe alata i iskreno stanje), numerirani popis u pilotu, vodič „Prvi koraci” uz prvi rad, „Predaja rada” i prebacivač lista u zaglavlju (INVENTAR §1.2), zapisnik konzultacija i „Dokle sam stao” u pilotu.

| P-n | INVENTAR ID | Element prototipa |
|---|---|---|
| P-1 | NF2-P1 | Traka obavijesti otvaranja rada (nf2.js, `X.hooks.banner`): učitavanje, prazno, greške po uzroku s gumbom |
| P-2 | NF2-P2 | Statusna traka „Izvan mreže · … čeka slanje: n”, traka „Veza je vraćena”, regija `#nf2live` |
| P-3 | NF2-P3 | Traka „Sukob” + dijalog `nf2conf` (server: odluka nedostaje, INVENTAR §5.1) |
| P-4 | NF2-P4 | Ciljevi 44 px na ≤ 640 px (`.tools .tb`); traka i numerirani popis već u toolbar2.js/more2.js |
| P-5 | NF2-P5 | Zaglavlje „Prečaci” i Ctrl+/ = isti dijalog `tbkeys`; `/` naredbe „nije u pilotu” |
| P-6 | NF2-P6 | Oznaka opsega u statusnoj traci (`.nf2-rng`) + najava prijelaza |
| P-7 | NF2-P7 | „Dohvati podatke” u dijalogu „Brzi izvor” (`quick`, `nf2Look`) |
| P-8 | NF2-P8 | Blok „Zatražene potvrde i preporučeni izvori” u kartici Izvori (`RP.HK.srcTop`) |
| P-9 | NF2-P9 | Kartica Asistent: „Pravila za ovaj zadatak” |
| P-10 | NF2-P10 | Kartica Asistent: „isključen u pilotu”, bez modela i pružatelja |
| P-11 | NF2-P11 | Redak izjave u kartici Rad i Predajnom paketu čita stanje; odjeljak „Što je zabilježeno u Ducturi” |
| P-12 | NF2-P12 | Dijalog `nf2decl` „Izjava o korištenju alata” |
| P-13 | NF2-P13 | Traka o podudaranju + dijalog `nf2expl` „Objasni, ako želiš” |
| P-14 | NF2-P14 | Zaglavlje „Povijest” + dijalog `nf2hist` |
| P-15 | NF2-P15 | Korak „Vratiti ovu verziju?” s pregledom razlike u `nf2hist` |
| P-16 | NF2-P16 | Redovi „Potvrde koje traži mentor”, „Zahtjevi fakulteta”, „Obrasci fakulteta” u Predajnom paketu |
| P-17 | NF2-P17 | Zaglavlje „Predaja rada” + broj blokada (`#nf2Sub`) |
| P-18 | NF2-P18 | Traka „Slanje je zaustavljeno” + dijalog `nf2prob` |
| P-19 | NF2-P19 | Dijalog `nf2imp` „Uvezi tekst iz datoteke” |
| P-20 | NF2-P20 | Vodič „Prvi koraci” (`onb`): završetak, fokus na naslov |
| P-21 | NF2-P21 | Uloge traka, ponuda oporavka (`role=status`), axe nad novim elementima |
| P-22 | NF2-P22 | Izvan prototipa (`packages/app/test-fakes`); zamjena: dijalog „Stanja radnog prostora” |
| P-23 | NF2-P23 | `ACT.copy` poruke; razlog uz jednu verziju u `nf2hist` |
| P-24 | NF2-P24 | Napomena o postavci ustanove u dijalogu „Dodaci editora” (`X.more2.modsExtra`) |
| P-25 | NF2-P25 | `/tablica`, `/slika` „nije u pilotu” uz „Ograničenja pilota” |
| P-26 | NF2-P26 | Traka „Rad je otvoren na drugom uređaju…” (`N.other`) |
