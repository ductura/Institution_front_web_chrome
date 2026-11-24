# Plan: editor do kraja, identičan prototipu (Lab, DESKTOP-4ESPOSP)

Vlasnik izvedbe: sesija Lab na stolnom računalu (`lab:desktop-4esposp`), po odluci vlasnika 24. 11. 2026. da jedan tok vodi cijeli editor do kraja. Pregled i spajanje: orkestrator. Baza svih koraka: `migracija/kopija-ductus-front`. Svaki korak je jedan PR; javlja se na Ductus#2055 s „SPREMAN <PR> <SHA>”, a na kraju „GOTOVO”.

## Izvori

- `docs/nalazi/nove-funkcije-2-radni-prostor-editor.md`: stavke P-1 do P-26 i odluke vlasnika (svih 26 u pilotu, 23. 11. 2026.; Asistent u pilotu radi);
- `docs/nalazi/paritet-editor-2.md`: razlike aplikacije i prototipa, prijedlozi P2-1 do P2-25;
- `docs/prototip/INVENTAR-editor.md` (§2.8 NF2-P1…P26, ASIST-1…9; §5.1 poslužitelj) i `docs/prototip/editor/` (`nf2.js` v0.28 i ostali moduli): ciljani izgled i ponašanje;
- `ductura/.github` `docs/plan/PLAN.md`: prioriteti i stupac „nužno za probu”;
- rute samo iz `src/client/migration-contracts.generated.json` (245 operacija). Kad ruta ne postoji, sučelje pošteno kaže „još nije dostupno”, korak dobiva oznaku **BLOK** na #2055 i rad se nastavlja sljedećim korakom.

## Isključeno

Ritam unosa (NF5-Q4), autotipkač (A1), „Poruka sebi” (WEB-NF6-SIFRA), sve „nakon pilota”, imena pružatelja ili modela (samo „Asistent”, Q-10), ocjena (ostaje u Merlinu i Studomatu, Ductura je ne bilježi).

## Pravila za svaki korak

- Najprije provjera na bazi: je li stavka već izgrađena (pretraga koda, lažni poslužitelj VIZ „puno”, stvarni lokalni stog). Ako jest, to se zapisuje u PR i ne gradi se ponovo.
- Testovi: jedinični (vitest), e2e (Playwright), axe bez novih kršenja, 390 i 1280 px, svijetla i tamna tema, tipkovnica.
- Hrvatski tekst bez tehničkih izraza, kroz skener zabranjenih izraza (PRODUCT §5); „spremljeno na poslužitelju” samo uz potpisanu potvrdu (B-6).
- Izmišljeni podaci. Bez rebasea, force pusha i `--no-verify`; `git add` samo s putanjama; ništa u `main`; CI i axe se ne slabe.
- Playwright se ne pokreće usporedno s `next build` (RAM).
- Najprije funkcije, dizajn na kraju (ED-60+).

## Provjera na stvarnom stogu (24. 11. 2026.)

Lokalni stog: poslužitelj `migracija/kopija-ductus-backend` (c8e5dab), front ove grane, edge :8000, lažni OIDC, lokalni S3. Prijava, „Moji zadaci”, obavijest i stranica rada rade. **Nalaz:** „Započni rad” je neistinit tok. Poslužitelj odgovara 200 `{workId, rulesVersion, language}` (ugovor `student-work.start.post`), a `src/client/student-work.ts` provjerava staru lokalnu shemu (`assignmentId`, `documentId`, `created`, `workLanguage`, `facultyRulesVersion`, 200/201) i 409 `not_accepting` umjesto `conflict`. Zato rad bude započet, a student vidi „Nije poznato je li rad započet” i editor se ne otvara. Popravak je u ED-01a.

## Već spojeno (GOTOVO)

| Stavka | PR |
|---|---|
| Ljuska, traka, statusna traka i traženje po prototipu (VIZ-E1) | #449 |
| Komentari u editoru (PIL-K-KOMENTARI-EDITOR) | #496 |
| Živi sadržaj (PIL-K-SADRZAJ) | #500 |
| Fusnote: host dijaloga, verzija sheme, vidljiva oznaka (PIL-K-FUSNOTA, INT-24) | #526, #528, #535 |
| Traka alata montirana u utor (PIL-K-TRAKA) | #527 |
| Spremanje, ključ sheme, oporavak, rad bez mreže za v3 (PIL-K-SPREMANJE-V3, SHEMA-V3, V3-OPORAVAK, V3-BEZ-MREZE) | #530, #531, #532, #533 |
| Fusnote u kopiranom tekstu | #534 |
| Ponovno izvođenje v3 i živi prikaz v3 (INT-23, INT-26) | #536, #537 |
| Provjera podudaranja s pomoćnikom po promijenjenim segmentima | #508 |
| Lažni poslužitelj hrani svaki ekran, 13 ruta u axe | #559 |
| VIZ scenariji lažnog poslužitelja (puno, prazno, učitavanje, greška, dugi tekst) | #544 |
| Preskoči na sadržaj, bez preskakanja razina naslova (VIZ-WCAG-NASLOVI) | #566 |
| Tamna tema (VIZ-TAMNA) | #554 |

## Koraci

Oznake: izvor (NF2-P-n, P2-n), datoteke, rute iz izvatka, ovisnosti. Testovi su uvijek oni iz pravila; ovdje se navodi samo ono što je posebno.

### Nužno za probu (WEB-NUZ-EDITOR-1)

**ED-01a „Započni rad” po ugovoru.** Izvor: WEB-NUZ-EDITOR-1 (mrtav tok probe), NF2-P1. Datoteke: `src/client/student-work.ts`, `packages/app/src/host/student/start-work/*`, `packages/app/e2e/start-work.spec.ts`, lažni poslužitelj ako vraća staru shemu. Ruta: `student-work.start.post` (200 `{workId, rulesVersion|null, language}`; 409 `conflict` vodi na obavijest zadatka). Poseban test: odgovor iz izvatka ugovora prolazi, stari oblik ne; živa proba na stogu („Započni rad” otvara editor).

**ED-01b Otvaranje rada: uzrok i izlaz.** Izvor: NF2-P1 (G-1, G-2). Datoteke: `src/components/editor/EditorPageWork.tsx`, katalog poruka (`openRetry`, `openReloadButton`, `openNoticeLink`), `host/student/work/frame.tsx`. Rute: `evidence.open.post`, `student.notice.get` (poveznica), `/me`. Ishodi: nema mreže (Pokušaj ponovno), nema pristupa ili istekla prijava (Prijavi se), rad ne postoji (natrag na zadatke), greška poslužitelja (Pokušaj ponovno), stara verzija stranice (Učitaj ponovno), zadatak ne prima rad (Pročitaj obavijest). `role=alert`, jedna rečenica za okvir i list.

**ED-01c Stanje spremanja: smirene najave i povratak veze.** Izvor: NF2-P2 (G-9, G-10). Datoteke: `host/editor/save-status/*`, `src/components/editor/StatusBar.tsx`, `OfflineBanner`. Rute: nema novih (`evidence.commit.post` postoji). Najava samo pri promjeni razine; „Veza je vraćena. Šalje se n izmjena.” dok ne stigne potpis; „čeka slanje: n” uz „Izvan mreže”. Ovisi o ED-01b.

**ED-02 Lažni poslužitelj VIZ „puno” otvara editor.** Izvor: NF2-P22, P2-25. Datoteke: `packages/app/test-fakes/*`. Najprije provjera je li riješeno s #544 i #559; ako jest, samo zapis.

### Ostale NF-2 stavke

| Korak | Izvor | Što | Rute | Ovisi o |
|---|---|---|---|---|
| ED-03 | NF2-P5, P2-2 | Jedan popis prečaca (Ctrl+/ i „Prečaci”), test da svaki redak radi; razlog uz sive `/` naredbe | nema | – |
| ED-04 | NF2-P6 | Opseg riječi: tihi prag i najava prijelaza | `student.assignment-requirements.get` | – |
| ED-05 | NF2-P20 | Vodič „Prvi koraci”: oznaka nakon završetka, fokus na naslov, uz prvi rad | nema | – |
| ED-06 | NF2-P23 | Sitnice: „Ductura” kroz bazni put, poruka međuspremnika, „Pregled ispisa” u Izvezi, razlog uz jednu verziju | nema | – |
| ED-07 | NF2-P18 | „Slanje je zaustavljeno”: Javi problem (bez sadržaja rada) | `support.problem-report.post` | ED-01c |
| ED-08 | NF2-P3 (tekst) | Sukob: rečenica ne obećava izbor; dijalog odluke **BLOK** dok poslužitelj ne odredi ishod (INVENTAR §5.1) | `evidence.replay.post` | ED-01c |
| ED-09 | NF2-P9 | Kartica Asistent: „Pravila za ovaj zadatak”; „Prvi redak” dobiva upute zadatka | `student.notice.get` | – |
| ED-10 | NF2-P10, ASIST-1…9 | Kartica Asistent radi (zahtjev, zapis razgovora, „Priloži izjavi”), samo „Asistent”; `aiSummaryOnly`, popis grešaka, ograničenje i prekidač OC-1 **BLOK** (nema u ugovoru) | `student.assistant-request.post`, `student.assistant-conversation.get`, `student.declaration-attachments.post` | ED-09 |
| ED-11 | NF2-P11 | Redak izjave čita stanje s poslužitelja; „Što je zabilježeno u Ducturi” | `student.declaration.get` | ED-10 |
| ED-12 | NF2-P12, P2-19 | Dijalog „Izjava o korištenju alata” u editoru | `student.declaration.get`, `student.declaration.put` | ED-11 |
| ED-13 | NF2-P13 | Podudaranje: „Objasni, ako želiš” | `work.assistant-match-explanation.post` | – |
| ED-14 | NF2-P7, P2-10a | Dohvat izvora po DOI-ju i ISBN-u preko poslužitelja | `sources.lookup.post` | – |
| ED-15 | NF2-P8, P2-10b | Zatražene potvrde u kartici Izvori; preporučeni izvori **BLOK** (nema studentske rute) | `student.source-proof-requests.get`, `student.source-proofs.*` | – |
| ED-16 | NF2-P14, P2-20 | Jedan ulaz „Povijest i usporedba”, samo poslane verzije | `work.versions.get`, `work.version.get`, `work.compare.get` | – |
| ED-17 | NF2-P15 | Vraćanje s pregledom razlike | `work.compare.get`, `work.restore.post` | ED-16 |
| ED-18 | NF2-P16, P2-21 | Proba predaje: stvarni podaci i razlog umjesto „nedostupno” | `student.source-proof-requests.get`, `student.declaration.get` | ED-11, ED-15 |
| ED-19 | NF2-P17 | „Predaja rada” uvijek cijela (1050, 400 px) i broj blokada | nema | ED-18 |
| ED-20 | NF2-P19 | Uvoz DOCX/PDF, tekst označen kao uvezen | `work.imports.post`, `work.imports.confirm.post` | – |
| ED-21 | NF2-P21 | Pristupačnost izvora, povijesti i koraka predaje; `isTrusted`-zaštite uz Sigurnost; `RecoveryOffer` live | nema | ED-14…ED-17 |
| ED-22 | NF2-P26 | Rad otvoren na drugom uređaju: razlog i vrijeme; ako `evidence.open` nema vrijeme zadnjeg potpisa, **BLOK** | `evidence.open.post` | ED-01b |
| ED-23 | NF2-P24 | Stilovi citiranja po ustanovi: napomena u „Dodaci editora”; vrijednosti osim `fpzg` **BLOK** (ugovor ima samo `fpzg`) | – | – |
| ED-24 | NF2-P25 | `/tablica`, `/slika` „nije u pilotu” uz „Ograničenja pilota” (sama shema v4 **BLOK**) | nema | ED-03 |
| ED-25 | NF2-P4 (dio) | Ciljevi 44 px na ≤ 640 px; numerirani popis uz shemu v3 | nema | ED-30 |

### Paritet (paritet-editor-2)

| Korak | Izvor | Što | Rute |
|---|---|---|---|
| ED-30 | P2-1a, #527 | `StudentToolbar` s `behaviour`: Više, sklapanje po širini, opisi alata | nema |
| ED-31 | P2-1b | Prilagodi traku, kontekstni gumb, veličina teksta, mobilni „Brzi alati” | nema |
| ED-32 | P2-3 | Montirati `MentorCard` u karticu Mentor | `mentorship.*`, `teacher.mentorship.get` (samo čitanje za studenta gdje postoji) |
| ED-33 | P2-2 | Prečaci Alt+Shift+↑/↓ (`ChapterMove`), Alt+↑/↓, Ctrl+Alt+M, Alt+F10, bez sudara s PIL-D8-PRECACI | nema |
| ED-34 | P2-9 | Poveznica na `/rad/<id>/podrijetlo` (naredba `/podrijetlo`, grupa Rad), „Traži” u traci | nema |
| ED-35 | P2-4 | Konzultacije u kartici Mentor; kriteriji ocjene **BLOK** | `work.consultation-*` |
| ED-36 | P2-5 | Pomoć u pisanju `host/editor/assist/*` i „Nit rada” (tri PR-a) | nema |
| ED-37 | P2-6 | Lijevi panel: redak poglavlja, podnožje, rokovi i napredak | `mentorship.key-dates.get` |
| ED-38 | P2-7 | Desni panel: brojači kartica, opseg poglavlja, „Uz tekst” | nema |
| ED-39 | P2-8 | Dijalog „Prilagodi panel” | nema |
| ED-40 | P2-11 | `QuoteReviewCard` u Provjere, popover navoda, LaTeX izvoz | nema |
| ED-41 | P2-12 | `TextFixesPanel`, „Prije i poslije”, poništavanje sitnica | nema |
| ED-42 | P2-13 | Prijedlozi nastavnika (`SuggestionCard`), „Što sam promijenio/la”, „Novo” | `work.comments.*` |
| ED-43 | P2-15 | „Pošalji doradu”: ako ruta `send` ne postoji, **BLOK** i dijalog po ugovoru | `collaboration.revision-requests.post` (provjeriti) |
| ED-44 | P2-16 | Izbornici Umetni, Uredi/Oznake (`DraftPanelHost`), Prikaz (dva PR-a) | nema |
| ED-45 | P2-17 | Popoveri oznaka u tekstu | nema |
| ED-46 | P2-18 | Naredbena paleta i `/` naredbe | nema |
| ED-47 | P2-22 | „Kako vidi nastavnik”: ako ruta pogleda nastavnika ne postoji, **BLOK** i pošten opis | – |
| ED-48 | P2-24 | Manji dodaci (bez „Poruka sebi”) | nema |

P2-14 (nastavnička traka) pripada nastavničkom editoru i ostaje izvan ovog plana osim ako orkestrator ne odluči drukčije.

### Vizualni paritet (na kraju)

**ED-60…** jedan PR po ekranu prototipa (`docs/prototip/editor/index.html` i stanja iz „Stanja radnog prostora”): snimke usporedbe prototip i aplikacija na 390 i 1280 px, svijetla i tamna tema, prag piksela iz VIZ prolaza (#543). Prvi je tipografija lista i zaglavlje (P2-23).

## Stanje

Svaki spojeni korak upisuje se ovdje kao GOTOVO s brojem PR-a; svaki BLOK s rutom koja nedostaje.
