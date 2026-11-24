# Val 21: razlika (V21-PREGLED `val21-razlika`)

Datum: 24. 11. 2026. Pisac: `claude:wv21pregled:frontend`. Nalog: orkestrator, Ductus#2055 (komentar 7147316636), po odluci vlasnika („Može, idemo na sve valove”; `ductura/.github` `docs/plan/NOVE-FUNKCIJE.md` t. 8, PR #85; `PLAN-MIGRACIJE.md` val 21). **Samo dokumentacija; kod se ne mijenja.** Oblik po uzoru na `val20-razlika.md`.

Pregledane baze:

| Repo | Grana | SHA |
|---|---|---|
| WEB `ductura/Institution_front_web_chrome` | `migracija/kopija-ductus-front` | `ff7d6798efbe1e0e5f87629ef79e5df5a2a6f5b3` |
| SRV `ductura/Institution_server` (javno) | `migracija/kopija-ductus-backend` | `abf94a9431fddc85631570b8d258816384bf18de` (zadnja migracija `20261218100000_origin_segments.sql`) |

Nije učinjeno: plan `NOVE-FUNKCIJE.md` nije čitan (oblak nema pristup `ductura/.github`); aplikacija, server, baza i Docker nisu pokretani, sve je izvedeno čitanjem koda i ugovora; **dokument vala 18 ne postoji** ni u jednoj bazi (nema `docs/nalazi/val18-*`, nema PR-a s „val18”), pa se društvene znanosti oslanjaju samo na ono što je stvarno u kodu (§2.1). Otvoreni PR-ovi nakon gornjih SHA-ova provjereni su samo po naslovu grane (u tijeku je val 20: PR-ovi #644 do #651; nijedan ne dira putanje ovog vala).

Pravila za sve zadatke ispod: bez rangiranja studenata i bez automatskih sankcija; samo izmišljeni podaci; podaci samo kroz `/api/v1`; komponente iz `@ductura/ui`; vizualni smjer „papir i grafit”; tekst sučelja na hrvatskom kroz katalog poruka i skener zabranjenih izraza; aplikacija živi **isključivo** u `packages/app/src/host/`. Nema plaćenog API-ja, tuđeg servisa ni novog računa. Rezultat bilo koje provjere koda nikad ne ulazi u ocjenu, izvoz ocjene ni dokaz o izvornosti.

## 1. Sažetak nalaza

1. **Glavna prepreka STEM-u nije sučelje nego shema v4.** Formula, blok koda, okvir, tablica i slika postoje samo u shemi v4. U `packages/editor-core` v4 je gotov (čvorovi, validacija, `createEditorExtensionsV4`), ali ga **nijedan ekran ne koristi**: pravi editor gradi shemu 1 ili 3 (`src/components/editor/LocalDocument.tsx:367`), a host uvozi samo v3 pomoćnike. Poslužitelj ima v4 domenski (`server/domain/document/schema.ts`, validacija, vektori), ali ga **ne otvara**: ugovor `student.work.open` dopušta `schemaVersion` samo 1, 2 ili 3 (`server/contracts/routes/evidence.ts:165`), a rekonstrukcija predaje zna samo v1 do v3 (`server/evidence/submission-reconstruction.ts:167-181`, inače `document_version_unknown`). Nastavnički prikaz rada u hostu odbija sve osim v1 i v2 (`packages/app/src/host/teacher/submissions/model.ts:27`). Prema pravilu „shema ide samo kroz kritični zadatak” (usporedi PIL-K-SHEMA-V3) otvaranje v4 je **predusvjet** (§3), ne zadatak ovog popisa.
2. **Postoji više gotovih, ali nemontiranih dijelova:** izvoz u LaTeX (`host/editor/stem/LatexExport.tsx`, `latex.ts`), kartica provjere navoda (`QuoteReviewCard.tsx`), stari dijalog formule i KaTeX (`src/components/editor/rich/blocks/*`, `katex` samo u `src/components/package.json`, **ne** u `packages/app`). Stari kod se ne dira i ne uvozi; host dobiva svoje datoteke.
3. **Alati po području samo se prikazuju.** `host/editor/rules/profiles.ts` (`AREAS`, `UNIT_TOOLS`) kaže da je za prirodne i tehničke znanosti ponuđen „Formula, Kod”, ali ništa ne uključuje u editoru (`RulesHost.tsx` samo ispisuje `toolsText`).
4. **Programski zadaci s testovima** ne postoje nigdje (ni ruta, ni tablica, ni izvršitelj). Izvršavanje tuđeg koda **na poslužitelju** traži izolaciju (kontejner, sandbox, poseban servis) koje poslužitelj nema (jedini worker je za PDF, `server/import/pdf/worker.ts`): **ne gradi se**. Bez novog servisa i računa moguće je samo izvršavanje **u pregledniku studenta**, u izoliranom okviru bez mreže, za JavaScript. Rezultat tada nije dokaz ničega pa ostaje u pregledniku (§5, zadatak 13). Python (Pyodide) i druge jezike ovaj val ne gradi: velik paket (proračun veličine) i nepotvrđena licenca; u §7.
5. **Društvene znanosti** su u kodu pokrivene samo kao profil područja `dru` (bez alata, stil APA, bez popisa kratica). Tablice rezultata, slike i popisi tablica traže v4 (val 10). Ovaj val zato dodaje samo ono što ne traži v4: kostur odjeljaka i popis ručnih provjera po području (zadaci 1 i 2). APA stil dolazi iz vala 20 (PR #647).

## 2. Što već postoji

### 2.1 Društvene znanosti

| Stavka | Putanja | Stanje |
|---|---|---|
| Profil područja `dru` | `packages/app/src/host/editor/rules/profiles.ts`: `AREAS.dru = { tools: [], style: "apa", abbr: false }`; ustanove `df`, `ef`, `pr` (izmišljeni „… Primjer”) | postoji; `ef` dobiva alat `formula` kroz `UNIT_TOOLS` |
| Popis zahtjeva rada | `rules-model.ts` (`setupOf`, `itemsOf`), `RulesHost.tsx`, montirano u `host/student/work.tsx` | postoji; `manualChecks` po profilu (ručno, bez automatske provjere) |
| Odjeljci po profilu | `RuleProfile.sections` u `profiles.ts` | postoje kao tekst; **ne umeću se u rad** |
| Provjera navoda prema izvoru | `host/editor/stem/QuoteReviewCard.tsx`, `quote-review.ts`, `quote-check.ts` | gotovo, **nije montirano** (paritet-editor-2.md, prijedlog 11: ne ponavlja se ovdje) |
| Pojmovnik, bilježnica izvora | `host/editor/right/PregledGroup.tsx` (podprikaz Pojmovnik), `host/editor/source-notebook/` | postoje |
| Tablica, slika, popis tablica | shema v4 | **nema u hostu** (val 10, predusvjet §3) |
| Stilovi citiranja (APA, Chicago) | val 20: `config/citation-styles/*.json` (PR #647) | u izradi |
| Server: vrsta rada | `workType` (`short_paper`, `essay`, `seminar_paper`, `bachelor_thesis`, `master_thesis`, `specialist_thesis`, `doctoral_thesis`), `server/contracts/routes/institution.ts:107`, `faculty-rules.ts:14` | postoji; **područja nema** u ugovoru (`pri`, `dru`… postoje samo u WEB profilima) |

### 2.2 STEM: formule

| Stavka | Putanja | Stanje |
|---|---|---|
| Čvor formule u dokumentu v4 | SRV `server/domain/document/schema.ts` (`MAX_FORMULA_TEX_CODE_POINTS = 4000`, `MAX_INLINE_FORMULA_TEX_CODE_POINTS = 1000`), `validate-v4.ts`; WEB kopija `packages/editor-core/src/document/document/` (isto) | postoji, vektori `golden-vectors-v4.*` |
| Čvorovi u Tiptapu | `packages/editor-core/src/editor/extensions-v4.ts`: `InlineFormula` (r. 451), atomski blok `formula`, `CodeBlock` (r. 196), `Box` (r. 271) | postoje, **ne montiraju se** |
| KaTeX | `src/components/editor/rich/blocks/katex-render.ts` (trust isključen, `throwOnError` isključen, `maxExpand` 500), dijalog `FormulaDialog.tsx`, `formula-templates.ts`; `katex@0.16.22` u `src/components/package.json` | stari direktorij; host ga ne uvozi; `packages/app/package.json` nema `katex` |
| Alat u izborniku | `host/editor/toolbar/StudentToolbar.tsx`: Umetni ima samo Fusnotu, Unakrsnu referencu, Za provjeru, Dijelove rada | formule nema |
| Izvoz u LaTeX | `host/editor/stem/LatexExport.tsx`, `latex.ts` (čista funkcija nad dokumentom v4; formula izlazi kao `$…$`/`equation`) | gotovo, **nije montirano** (paritet-editor-2.md prijedlog 11) |

### 2.3 STEM: kod i bilježnice

| Stavka | Putanja | Stanje |
|---|---|---|
| Blok koda u v4 | `schema.ts`: `CodeBlockNode` (`language` ∈ `c, html, java, javascript, python, r, sql`, `caption` ≤ 300), samo tekst bez oznaka osim `paste`/`imported`; Tab umeće 4 razmaka (`extensions-v4.ts`) | postoji, **ne montira se** |
| Bojenje, brojevi redaka, popis ispisa | stari `src/components/editor/rich/blocks/messages.hr.ts` (samo tekstovi) | **ne postoji** u hostu (paritet-editor-2.md C-66, C-75) |
| Bilježnice (`.ipynb`) | pretraga `ipynb`, `notebook` u `packages/app`, `src`, SRV: samo „bilježnica izvora” (nešto drugo) | **ne postoji** |
| Uvoz tekstnih datoteka | `host/editor/import/ImportHost.tsx`, `import-model.ts`; SRV `server/contracts/routes/import.ts` (`schemaVersion: 2`), `server/import/` | postoji za dokumente; uvezeni tekst nosi oznaku `imported` |
| Izvršavanje koda | SRV: nema izvršitelja; `server/code-generation.integration.test.ts` je test generiranja koda ugovora, ne izvršavanja studentskog koda | **ne postoji** |
| Testovi uz zadatak | pretraga ruta i migracija (`code_test`, `code-tests`): 0 pogodaka; zadatak ima `workType`, upute, rokove, AI politiku (`institution.course-assignments.post`) | **ne postoji** |

### 2.4 Nastavnik i predaja

| Stavka | Putanja | Stanje |
|---|---|---|
| Nastavnički čitač rada | `host/teacher/submissions/model.ts:27` (`schemaVersion` 1 ili 2) | v3 i v4 prikazuju grešku |
| Rekonstrukcija predaje | `server/evidence/submission-reconstruction.ts` | v1 do v3 |
| Otvaranje rada | `server/contracts/routes/evidence.ts:165` | `1 | 2 | 3` |

## 3. Predusvjeti izvan ovog popisa (kritični, drži ih orkestrator)

Nijedan se ne gradi u ovom valu; zadaci ispod koji ih trebaju imaju ovisnost.

- **KR-V4-SRV:** `student.work.open` i dokazni zapis prihvaćaju `schemaVersion` 4 (`server/contracts/routes/evidence.ts`), commit i replay za v4, rekonstrukcija predaje (`submission-reconstruction.ts`), projekcije. Prema obrascu v3: ugovor, migracija i vektori jednim kritičnim zadatkom.
- **KR-V4-WEB:** `LocalDocument` s `createEditorExtensionsV4`, spremanje i dnevnik za v4 (usporedi PIL-K-SHEMA-V3).
- Odluka vlasnika „ulazi li v4 u pilot ili nakon pilota” (paritet-editor-2.md, otvoreno 1) i dalje stoji. Bez nje zadaci označeni „v4” ostaju u redu čekanja, a zadaci bez v4 (1, 2, 3, 4, 7a, 10, 11, 12) mogu ići.

## 4. Ostala područja: popis s procjenom (bez zadataka)

Procjena je okvirna (S ≤ ~120, M ≤ ~400, L = više PR-ova), izvedena iz profila u `profiles.ts` i iz ovdje opisanog stanja.

| Područje | Što bi trebalo | Što već postoji | Što blokira / zašto nema zadatka | Procjena |
|---|---|---|---|---|
| Pravo | oblici navođenja zakona, odluka i sudske prakse; popis propisa | profil `pr` (područje `dru`, APA); stil `fusnote` je u katalogu poslužitelja, ali nije izraziv u modelu dokumenta | oblici zahtijevaju tuđe izvore (Narodne novine, sudska praksa) i fusnotni stil (kritični zadatak nad modelom dokumenta); izričito izvan vala | L |
| Medicina | Vancouver (val 20, PR #644), kemijske formule (`chem`, mhchem), popisi za provjeru (npr. etička napomena) | profil `mf` (`bm`: `chem`, Vancouver) | podaci o pacijentima: samo izmišljeni; mhchem je dodatak KaTeX-u (provjera licence i veličine); popisi kontrole kvalitete traže pravna pitanja | M do L |
| Jezici | pravopis, gramatika, strani jezik, kontrastna analiza | oznaka `lang` u v4; Lekta „nedostupno” do Q-11 | Lekta paket, pravopis i gramatika čekaju licence (isključeno u valu 20) | L |
| Arhitektura i umjetnost | slike i crteži velike razlučivosti, portfelj, opisi | profil `af` (`umj`, Chicago); slika u v4 | slike kao privitci rada traže tablicu s RLS-om i pohranu objekata (SRV), predusvjet v4; EXIF/GPS je zaseban SRV-10C-EXIF | L |
| Učiteljski | pripreme za sat, obrasci opažanja | nema profila | rad s maloljetnicima i stvarnim razredima: privatnost i DPIA; obrasci fakulteta nisu zadani | M |
| Biotehnika | formule i kemija (`bt`: `formula`, `chem`) | profil `bf` | kao STEM formule i medicina (kemija); nema zasebnog zadatka | M |

## 5. Zadaci koji nedostaju (14)

Oznake: S ≤ ~120 redaka koda, M ≤ ~400. „Server ugovor prije weba” nastaje samo u skupini programskih zadataka (9 → 10 → 11, 13). Prefiks SRV nosi samo posao na poslužitelju. Putanje su nove datoteke u novim direktorijima; zajednički redci montiranja navedeni su jednom po zadatku i svaki ima ovisnost da se dva zadatka ne preklapaju.

**Zajedničke točke montiranja** (po jedan redak, svaka samo u jednom zadatku odjednom): `host/student/work.tsx` (zadaci 5, 6, 13, redom 5 → 6 → 13); `host/editor/toolbar/StudentToolbar.tsx` (5, 6, 9: isti redoslijed, 9 nakon 6); `host/editor/rules/rules-model.ts` (2); `host/editor/import/ImportHost.tsx` i `import-model.ts` (7); `host/teacher/submissions/model.ts` (8); `packages/app/package.json` i `pnpm-lock.yaml` (3 za `katex`, 6 za biblioteku bojenja, redom 3 → 6). SRV: `server/contracts/routes/index.ts`, `server/http/index.ts`, `server/database/index.ts` (po jedan redak izvoza u zadatku 11), `db/main/tests/030-institution-access-matrix.sql` i `db/main/migrations.sum` (zadatak 10). **Jedina datoteka ugovora** koja se dira je nova `server/contracts/routes/assignment-code-tests.ts` (zadatak 11, jedini vlasnik); nijedan zadatak ne dira postojeće rute ugovora. Nijedan ne dira `packages/ui/src/tokens/globals.css`, `packages/editor-core` ni `src/**`.

### Društvene znanosti

1. **WEB-V21-DRU-KOSTUR** (S). Kostur odjeljaka za područje `dru`: dijalog „Kostur rada” nudi odjeljke iz `RuleProfile.sections` (ako profil nema, zadani popis: Uvod, Teorijski okvir, Metodologija, Rezultati, Rasprava, Zaključak, Literatura); student potvrđuje i bira odjeljke; umeću se samo naslovi (blokovi koje shema 1 i 3 već poznaju) na kraj rada, bez dupliciranja naslova koji već postoje. Nema API-ja ni novih polja; tekst ne napušta preglednik. Test: bez potvrde dokument je nepromijenjen; već postojeći naslov se ne ponavlja; prazan profil daje zadani popis. Veličina: S. Ovisi o: ništa. Putanje: `packages/app/src/host/editor/areas/skeleton/{skeleton.ts,SkeletonDialog.tsx,messages.hr.ts,skeleton.test.ts}`; ulaz iz izbornika „Dijelovi rada” bira pisac u istom PR-u, najviše jedan redak u `StudentToolbar.tsx` (ovisnost: ide prije zadatka 5).
2. **WEB-V21-DRU-ZAHTJEVI-PODRUCJA** (S). Popis ručnih provjera po području u kartici „Zahtjevi rada” (npr. „Navedena je metoda istraživanja”, „Opisan je uzorak i način odabira”, „Navedena su ograničenja istraživanja”, „Etička napomena, ako se istraživanje provodi na ljudima”). Sve su to ručne kvačice (kind `manual`), bez automatske provjere i bez ikakvog zaključka o radu; tekst bez zabranjenih izraza. Nema API-ja. Test: svaka stavka ima ključ i tekst; samo područje `dru` dobiva popis; kvačica se ne šalje poslužitelju. Veličina: S. Ovisi o: ništa. Putanje: `packages/app/src/host/editor/rules/area-checks.ts`, `packages/app/src/host/editor/rules/area-checks.test.ts`; montiranje: jedan redak u `rules-model.ts` (`itemsOf`).

### STEM: formule, kod, bilježnice i izvoz (v4 gdje je navedeno u „Ovisi o”)

3. **WEB-V21-STEM-KATEX-JEZGRA** (M). Lokalni prikaz formula u hostu: `renderTex(tex, display)` nad `katex@0.16.22` (ista verzija kao u starom paketu), `trust` isključen (`\href`, `\url`, `\includegraphics` odbijeni), `throwOnError` isključen (napola upisana formula pokazuje izvor), granice 4000 odnosno 1000 točaka koda iz sheme, izlaz `htmlAndMathml` (čitači zaslona); KaTeX CSS i fontovi lokalno, bez CDN-a. Dodaje `katex` i `@types/katex` u `packages/app/package.json` i lockfile. Nema API-ja. Test: prazan ulaz → nije ok; `\href{…}` odbijen; 4001 točka koda odbijena; neispravna formula ne baca; CSS bez vanjskih URL-ova. Veličina: M. Ovisi o: ništa (ne treba v4). Putanje: `packages/app/src/host/editor/formula/{render.ts,limits.ts,render.test.ts,limits.test.ts}`; zajedničko: `packages/app/package.json`, `pnpm-lock.yaml`.
4. **WEB-V21-STEM-FORMULA-DIJALOG** (M). Dijalog „Formula” i „Formula u retku” iz `@ductura/ui`: polje za LaTeX, pregled uživo (jezgra iz zadatka 3), predlošci s izmišljenim primjerima (razlomak, korijen, suma, integral, matrica), poruka o grešci uz zadržan unos; izlaz je `{ kind: "block" | "inline", tex }` kroz povratni poziv. Ne montira se (montira ga zadatak 5). Test: pregled prati unos; predložak mijenja polje; prekoračenje granice onemogućuje potvrdu; Esc zatvara bez izmjene. Veličina: M. Ovisi o: WEB-V21-STEM-KATEX-JEZGRA. Putanje: `packages/app/src/host/editor/formula/{FormulaDialog.tsx,templates.ts,messages.hr.ts,formula-dialog.test.ts}`.
5. **WEB-V21-STEM-FORMULA-UREDNIK** (M). Formula u editoru: čvor `formula` i `inlineFormula` s prikazom (jezgra iz 3), naredba umetanja i izmjene (dvoklik otvara dijalog iz 4), stavka „Formula…” u izborniku Umetni, **uključena samo kad je rad u shemi v4 i područje ima alat `formula`** (`setupOf(profile).tools`), inače onemogućena s razlogom (kao `atomAvailability` u `footnote-model.ts`). Samo dokument; bez zapisa na poslužitelj mimo postojećeg sinkroniziranja. Test: umetanje i izmjena daju točan v4 čvor; na shemi 3 stavka je onemogućena s razlogom; formula preko granice odbijena. Veličina: M. Ovisi o: **KR-V4-WEB**, **KR-V4-SRV**, WEB-V21-STEM-FORMULA-DIJALOG, WEB-V21-DRU-KOSTUR (redoslijed zajedničkih redaka). Putanje: `packages/app/src/host/editor/formula/{FormulaHost.tsx,formula-view.ts,formula-commands.ts,formula-view.test.ts,formula-commands.test.ts}`; montiranje: po jedan redak u `host/student/work.tsx` i `host/editor/toolbar/StudentToolbar.tsx`.
6. **WEB-V21-STEM-KOD-BLOK** (M). Blok koda **samo za prikaz i uređivanje teksta, bez izvršavanja**: umetanje, jezik iz `CODE_LANGUAGES`, naslov ispisa (≤ 300 znakova), brojevi redaka, bojenje lokalnom bibliotekom bez mreže (prijedlog: `highlight.js` jezgra s 7 jezika, licenca BSD-3; licenca i prirast veličine paketa potvrđuju se prije spajanja, vidi §7), Tab/Shift+Tab već daje `extensions-v4.ts`. Akcije uz blok (npr. „Pokreni testove”) dolaze preko izloženog prop-a `actions`, koji puni zadatak 13. Test: jezik izvan popisa odbijen; oznake teksta izvan `paste`/`imported` odbijene (shema); bojenje ne mijenja tekst dokumenta; bez bojenja (biblioteka nedostupna) blok se i dalje prikazuje. Veličina: M. Ovisi o: **KR-V4-WEB**, **KR-V4-SRV**, WEB-V21-STEM-FORMULA-UREDNIK (zajednički redci, i `package.json` iza zadatka 3). Putanje: `packages/app/src/host/editor/code-block/{CodeBlockHost.tsx,highlight.ts,code-commands.ts,messages.hr.ts,highlight.test.ts,code-commands.test.ts}`; montiranje: po jedan redak u `work.tsx` i `StudentToolbar.tsx`; zajedničko: `packages/app/package.json`, `pnpm-lock.yaml`.
7. **WEB-V21-STEM-IPYNB-UVOZ** (M). Bilježnica s kodom **samo za prikaz**: uvoz `.ipynb` (JSON, ≤ 1 MiB, ≤ 200 ćelija) pretvara se u blokove dokumenta, nikad se ne izvršava: tekstne (markdown) ćelije postaju odlomci i naslovi kao običan tekst (bez HTML-a), ćelije koda postaju blokovi koda (jezik iz `kernelspec` ako je u `CODE_LANGUAGES`, inače bez jezika), izlazi samo `stream` i `text/plain` kao blok s naslovom „Izlaz”; HTML, JavaScript, slike i ostali izlazi odbacuju se uz broj odbačenih u poruci. Svi uvezeni blokovi nose oznaku `imported`. Samo izmišljene bilježnice u testovima. Nema API-ja. Dio 7a (parser i pretvorba u blokove, čista funkcija) ne traži v4; dio 7b (umetanje u dokument) traži. Test: ćelija sa `<script>` ostaje običan tekst; izlaz `text/html` odbačen i prebrojan; 201. ćelija i 1 MiB + 1 odbijeni; neispravan JSON daje grešku, ne rušenje. Veličina: M. Ovisi o: WEB-V21-STEM-KOD-BLOK (za 7b: KR-V4-WEB). Putanje: `packages/app/src/host/editor/import/ipynb/{parse.ts,to-blocks.ts,messages.hr.ts,parse.test.ts,to-blocks.test.ts}`; montiranje: po jedan redak u `ImportHost.tsx` i `import-model.ts` (prihvaća `.ipynb`).
8. **WEB-V21-STEM-NASTAVNIK-PRIKAZ** (M). Nastavnik čita rad u v4 samo za čitanje: formula (KaTeX iz 3), blok koda s brojevima redaka, okvir, tablica i mjesto slike; `model.ts` prihvaća `schemaVersion` 4 uz postojeća dva, a nepoznata verzija i dalje daje grešku (ne praznu stranicu). Nema novih ruta: koristi što postojeće rute čitanja daju kad KR-V4-SRV prihvati v4. Test: v4 dokument iz fixturea (`fixture-v4.ts`) daje sve blokove; v5 i oštećen dokument daju grešku; učitavanje i greška nisu „nema podataka”. Veličina: M. Ovisi o: **KR-V4-SRV**, WEB-V21-STEM-KATEX-JEZGRA. Putanje: `packages/app/src/host/teacher/submissions/v4-view/{V4Blocks.tsx,messages.hr.ts,v4-view.test.ts}`; montiranje: izmjena `host/teacher/submissions/model.ts` (jedina izmjena zajedničke datoteke, usko).
9. **WEB-V21-STEM-LATEX-IZVOZ** (S). Montira postojeći `LatexExport.tsx` kao stavku „LaTeX (rad.tex)” u izborniku Izvezi; preuzimanje datoteke u pregledniku, bez poslužitelja; stil navođenja kroz `TexCitations` iz stila ustanove (val 20). Slike nisu u datoteci (napomena umjesto njih, kao u `latex.ts`). **Preklapanje:** ako ga preuzme zadatak 11 iz `paritet-editor-2.md`, ovdje otpada. Test: isti dokument daje iste bajtove; formula izlazi kao `$…$`; stavka je onemogućena s razlogom ako rad nije u v4. Veličina: S. Ovisi o: **KR-V4-WEB**, WEB-V21-STEM-KOD-BLOK (redoslijed `StudentToolbar.tsx`). Putanje: `packages/app/src/host/editor/stem/latex-export-menu.ts` (novo), `packages/app/src/host/editor/stem/latex-export-menu.test.ts` (novo); montiranje: jedan redak u `StudentToolbar.tsx`.

### Programski zadaci s testovima (samo u pregledniku, bez novog servisa)

Odluka (Pretpostavka): server **ne izvršava** studentski kod. Nastavnik uz zadatak zapisuje do 10 vidljivih testova za JavaScript; student ih pokreće u svom pregledniku. Testovi su **vidljivi** studentu (isporučuju se u preglednik, pa „skriveni” testovi ne postoje). Oblik testa: kod studenta definira funkciju `solve(input)`; test je `{id, title, input, expected}` (JSON vrijednosti), usporedba je duboka jednakost, ograničenje trajanja 2 s po testu. Rezultat ostaje u pregledniku: ne šalje se, nije dokaz točnosti ni izvornosti i ne ulazi u ocjenu.

10. **SRV-V21-KOD-TESTOVI-DB** (M). Nova migracija (verzija iza vrha baze; prije commita provjeri `git ls-tree --name-only origin/<baza> db/main/migrations/ | tail -1`): tablica `institution.assignment_code_tests` samo za dodavanje (`assignment_id`, `revision_no`, `language` zatvoren popis `javascript`, `tests jsonb` ≤ 16 KiB, ≤ 10 testova, `created_by`, `created_at`), RLS i `GRANT` samo potrebnim ulogama; RPC `institution.set_assignment_code_tests` (nastavnik kolegija, identitet iz `current_actor()`, nikad iz parametra) i `institution.get_assignment_code_tests` (nastavnik kolegija i student upisan na kolegij zadatka). pgTAP retci u matrici: nastavnik kolegija piše i čita; nastavnik drugog kolegija, student drugog kolegija i račun bez uloge ne vide ništa; student ne piše; dodavanje ne mijenja stare revizije. Nova polja API-ja: nema (ruta u zadatku 11). Veličina: M. Ovisi o: ništa. Putanje: `db/main/migrations/<verzija iza vrha>_assignment_code_tests.sql`, `db/main/tests/<broj>-assignment-code-tests.sql`; zajedničko: `db/main/migrations.sum` (`pnpm db:sum`), redci u `db/main/tests/030-institution-access-matrix.sql`.
11. **SRV-V21-KOD-TESTOVI-RUTA** (M). Nove rute u novoj datoteci ugovora (jedini vlasnik): `teacher.assignment-code-tests.get` (GET `/api/v1/teacher/assignments/{assignmentId}/code-tests`), `teacher.assignment-code-tests.put` (PUT istog puta, tijelo `{language: "javascript", tests: [{id, title, input, expected}]}`, ≤ 16 KiB, `application/json`, zaštita porijekla zahtjeva kao ostale mutacije), `student.assignment-code-tests.get` (GET `/api/v1/student/assignments/{assignmentId}/code-tests`, samo čitanje, odgovor `{revisionNo, language, tests}`). Tuđi, nepoznat i neispravan `assignmentId` = 404; student koji piše = 403; prekoračenje granice = 422 (`invalid_code_tests`). Adapter `server/database/assignment-code-tests/`, rukovatelj `server/http/assignment-code-tests/index.ts`, vektori, generirani ugovori i `openapi/v1.json` (regenerirati, ne uređivati ručno), redci u fiksnim testovima ugovora, lažnom dev serveru (`packages/test-fakes/dev-server`) i testu 401 za montirane rute. Veličina: M. Ovisi o: SRV-V21-KOD-TESTOVI-DB. Putanje: `server/contracts/routes/assignment-code-tests.ts`, `server/contracts/vectors/{teacher.assignment-code-tests.get,teacher.assignment-code-tests.put,student.assignment-code-tests.get}.json`, `server/http/assignment-code-tests/index.ts`, `server/database/assignment-code-tests/index.ts` + testovi, `packages/test-fakes/dev-server` (handleri); po jedan redak izvoza u `server/contracts/routes/index.ts`, `server/http/index.ts`, `server/database/index.ts`; generirano se regenerira.
12. **WEB-V21-KOD-TESTOVI-OBRAZAC** (M). Nastavnik u obrascu zadatka dodaje, uređuje i briše testove (do 10), vidi ograničenja i pregled kako ih student vidi; spremanje kroz `teacher.assignment-code-tests.put`; stanja učitavanja, greške i „nema testova” razlikuju se; tuđi zadatak = 404 prikazan kao „nije dostupno”. Ruta nije u izvatku dok SRV zadatak 11 ne uđe: orkestrator je dodaje u izvadak, pisac spaja tu granu; bez nje PITANJE s točnim imenom. Test: neispravan JSON ulaz odbijen u obrascu; 11. test onemogućen; 503 ≠ prazno; nastavnik drugog kolegija ne vidi obrazac (404). Veličina: M. Ovisi o: SRV-V21-KOD-TESTOVI-RUTA. Putanje: `packages/app/src/host/teacher/code-tests/{CodeTestsForm.tsx,model.ts,port.ts,fake-port.ts,messages.hr.ts,model.test.ts,port.test.ts,no-direct-api.test.ts}`; montiranje: jedan redak u `host/teacher/assignment-form/` (datoteku u kojoj je obrazac zadatka određuje pisac, usko).
13. **WEB-V21-KOD-POKRETANJE** (M). Student pokreće testove nad kodom iz bloka koda (jezik `javascript`) gumbom uz blok (preko `actions` iz zadatka 6): kod se izvršava u `iframe` s `sandbox="allow-scripts"` (neprozirno porijeklo, bez kolačića i pohrane) i CSP-om `default-src 'none'; worker-src blob:` (bez `connect-src`), a stvarno izvršavanje u Web Workeru koji se prekida (`terminate()`) nakon 2 s; testovi se čitaju kroz `student.assignment-code-tests.get`. Rezultat po testu (prošao, pao, vrijeme isteklo, greška) prikazuje samo studentu uz stalnu napomenu „Pokrenuto u vašem pregledniku; to nije provjera nastavnika i ne ulazi u ocjenu.” Pisac testom u Chromiumu, Firefoxu i WebKitu potvrđuje da `fetch`, `XMLHttpRequest`, `WebSocket` i `importScripts` iz koda ne uspijevaju i da beskonačna petlja ne zamrzava stranicu; ako to u nekom pregledniku ne vrijedi, zadatak se zaustavlja i javlja PITANJE (izvršavanje se **ne** seli na poslužitelj). Rezultat se ne šalje, ne zapisuje u dnevnik i ne pokazuje nastavniku. Test: točan kod prolazi; netočan pada s očekivanim i dobivenim; `while(true){}` istječe; pokušaj mrežnog poziva pada; kod bez funkcije `solve` daje poruku; bez testova gumb nije ponuđen. Veličina: M. Ovisi o: WEB-V21-STEM-KOD-BLOK, SRV-V21-KOD-TESTOVI-RUTA (izvadak), WEB-V21-STEM-LATEX-IZVOZ (redoslijed `work.tsx`: nakon 6; ne dira istu datoteku istodobno). Putanje: `packages/app/src/host/editor/code-run/{runner.ts,runner-frame.ts,CodeRunPanel.tsx,port.ts,fake-port.ts,messages.hr.ts,runner.test.ts,port.test.ts,no-direct-api.test.ts}`; montiranje: jedan redak u `host/student/work.tsx`.

### Provjera cijelog toka

14. **WEB-V21-E2E** (S). Playwright tok na lokalnom stogu (lažni OIDC) kao izmišljeni student i nastavnik: umetni formulu i blok koda, osvježi stranicu (ostaje uz „Spremljeno na poslužitelju”), uvezi izmišljenu bilježnicu (HTML izlaz odbačen), pokreni testove (prošao i pao), nastavnik vidi rad s formulom i kodom; axe na 1250 i 400 px; tuđi rad i tuđi zadatak → 404. Dijelovi koji čekaju predusvjete označeni su `test.fixme` s razlogom i ID-em predusvjeta (ne briše se i ne preskače tiho). Veličina: S. Ovisi o: WEB-V21-STEM-FORMULA-UREDNIK, WEB-V21-STEM-IPYNB-UVOZ, WEB-V21-STEM-NASTAVNIK-PRIKAZ, WEB-V21-KOD-POKRETANJE, WEB-V21-KOD-TESTOVI-OBRAZAC. Putanje: `e2e/val21-razlika.spec.js` (novo).

## 6. Redoslijed i preklapanja

```
(bez v4)  DRU-KOSTUR, DRU-ZAHTJEVI-PODRUCJA, KATEX-JEZGRA → FORMULA-DIJALOG
          SRV KOD-TESTOVI-DB → SRV KOD-TESTOVI-RUTA → KOD-TESTOVI-OBRAZAC
(v4)      KR-V4-SRV + KR-V4-WEB → FORMULA-UREDNIK → KOD-BLOK → IPYNB-UVOZ, LATEX-IZVOZ, KOD-POKRETANJE
          KR-V4-SRV + KATEX-JEZGRA → NASTAVNIK-PRIKAZ
          sve gore → E2E
```

- Prvi val bez ovisnosti: 1, 2, 3, 10. Odmah iza: 4, 11, 12.
- Jedna datoteka ugovora ima jednog vlasnika (zadatak 11); izvadak ugovora u WEB-u dopunjuje orkestrator prije zadatka 12 i 13.
- Zajednički redci montiranja idu strogim redom: `work.tsx` 5 → 6 → 13; `StudentToolbar.tsx` 1 → 5 → 6 → 9; `package.json` 3 → 6. Tko dođe kasnije, spaja bazu.

## 7. Otvoreno i granice

- **Shema v4** (§3): otvaranje, spremanje i rekonstrukcija su kritični zadaci izvan popisa. Do odluke vlasnika zadaci 5 do 9 i 14 (dijelom) čekaju.
- **Dokument vala 18** ne postoji u repoima; društvene znanosti ovise o njemu samo gdje on dodaje nešto što ovdje nije (nije utvrđeno). Ako ga orkestrator ima, dopuna ide u ovaj dokument.
- **Biblioteka bojenja i licence** (zadatak 6, `highlight.js` BSD-3) i **proračun veličine** (`size-budget`) potvrđuje vlasnik ili pisac prije spajanja; `katex` je MIT, ista verzija kao u starom paketu. **mhchem** (kemijske formule) nije u ovom valu.
- **Python i drugi jezici** za programske zadatke: Pyodide ili slično bio bi lokalan paket bez servisa, ali je velik i licenca nije potvrđena; izvršavanje na poslužitelju bi tražilo izolaciju koje nema. Izvan vala; odluka vlasnika.
- **Skriveni testovi i rezultat u ocjeni** nisu mogući ovim modelom (testovi su vidljivi, rezultat je samo studentov); tko to želi, traži poslužiteljsku izolaciju i novu odluku vlasnika.
- **Područja pravo, medicina, jezici, arhitektura, učiteljski** samo su popisana (§4). Narodne novine, sudska praksa, Lekta, pravopis, gramatika i Struna ostaju izvan vala.
- **Neutvrđeno pri pisanju:** nastavnički ekran `live.document.get` nije posebno pregledan za v3/v4 (vrijedi samo `submissions/model.ts`); točna datoteka obrasca zadatka za zadatak 12 i izbornik „Dijelovi rada” za zadatak 1 utvrđuju pisci.

## 8. Tablica za orkestratora

| ID | r | deps | paths |
|---|---|---|---|
| WEB-V21-DRU-KOSTUR | S | - | `packages/app/src/host/editor/areas/skeleton/**`; `host/editor/toolbar/StudentToolbar.tsx` (1 redak) |
| WEB-V21-DRU-ZAHTJEVI-PODRUCJA | S | - | `packages/app/src/host/editor/rules/area-checks.ts`, `.../area-checks.test.ts`; `rules-model.ts` (1 redak) |
| WEB-V21-STEM-KATEX-JEZGRA | M | - | `packages/app/src/host/editor/formula/{render,limits}.ts` + testovi; `packages/app/package.json`, `pnpm-lock.yaml` |
| WEB-V21-STEM-FORMULA-DIJALOG | M | WEB-V21-STEM-KATEX-JEZGRA | `packages/app/src/host/editor/formula/{FormulaDialog.tsx,templates.ts,messages.hr.ts}` + test |
| WEB-V21-STEM-FORMULA-UREDNIK | M | KR-V4-WEB, KR-V4-SRV, WEB-V21-STEM-FORMULA-DIJALOG, WEB-V21-DRU-KOSTUR | `packages/app/src/host/editor/formula/{FormulaHost.tsx,formula-view.ts,formula-commands.ts}` + testovi; `host/student/work.tsx`, `StudentToolbar.tsx` (po 1 redak) |
| WEB-V21-STEM-KOD-BLOK | M | KR-V4-WEB, KR-V4-SRV, WEB-V21-STEM-FORMULA-UREDNIK | `packages/app/src/host/editor/code-block/**`; `work.tsx`, `StudentToolbar.tsx` (po 1 redak); `packages/app/package.json`, `pnpm-lock.yaml` |
| WEB-V21-STEM-IPYNB-UVOZ | M | WEB-V21-STEM-KOD-BLOK (7b: KR-V4-WEB) | `packages/app/src/host/editor/import/ipynb/**`; `ImportHost.tsx`, `import-model.ts` (po 1 redak) |
| WEB-V21-STEM-NASTAVNIK-PRIKAZ | M | KR-V4-SRV, WEB-V21-STEM-KATEX-JEZGRA | `packages/app/src/host/teacher/submissions/v4-view/**`; `host/teacher/submissions/model.ts` (usko) |
| WEB-V21-STEM-LATEX-IZVOZ | S | KR-V4-WEB, WEB-V21-STEM-KOD-BLOK | `packages/app/src/host/editor/stem/latex-export-menu.{ts,test.ts}`; `StudentToolbar.tsx` (1 redak) |
| SRV-V21-KOD-TESTOVI-DB | M | - | `db/main/migrations/<iza vrha>_assignment_code_tests.sql`, `db/main/tests/<broj>-assignment-code-tests.sql`, `db/main/migrations.sum`, redci u `db/main/tests/030-institution-access-matrix.sql` |
| SRV-V21-KOD-TESTOVI-RUTA | M | SRV-V21-KOD-TESTOVI-DB | `server/contracts/routes/assignment-code-tests.ts` (jedini vlasnik), `server/contracts/vectors/*assignment-code-tests*.json`, `server/http/assignment-code-tests/**`, `server/database/assignment-code-tests/**`, `packages/test-fakes/dev-server`; po 1 redak u `routes/index.ts`, `server/http/index.ts`, `server/database/index.ts`; generirano |
| WEB-V21-KOD-TESTOVI-OBRAZAC | M | SRV-V21-KOD-TESTOVI-RUTA | `packages/app/src/host/teacher/code-tests/**`; 1 redak u `host/teacher/assignment-form/` |
| WEB-V21-KOD-POKRETANJE | M | WEB-V21-STEM-KOD-BLOK, SRV-V21-KOD-TESTOVI-RUTA, WEB-V21-STEM-LATEX-IZVOZ | `packages/app/src/host/editor/code-run/**`; `host/student/work.tsx` (1 redak) |
| WEB-V21-E2E | S | WEB-V21-STEM-FORMULA-UREDNIK, WEB-V21-STEM-IPYNB-UVOZ, WEB-V21-STEM-NASTAVNIK-PRIKAZ, WEB-V21-KOD-POKRETANJE, WEB-V21-KOD-TESTOVI-OBRAZAC | `e2e/val21-razlika.spec.js` |

## Pretpostavke

- Dokument vala 18 ne postoji; društvene znanosti ograničene na ono što je u kodu (§2.1).
- Izvršavanje koda samo u pregledniku, samo JavaScript, samo vidljivi testovi, rezultat samo za studenta (§5).
- Imena ruta zadatka 11 (`teacher.assignment-code-tests.*`, `student.assignment-code-tests.get`) izabrana su po obrascu postojećih `teacher.*` i `student.*` ruta; orkestrator ih smije preimenovati prije SRV zadatka.
- Predusvjeti KR-V4-SRV i KR-V4-WEB nisu razrađeni (kritični zadaci s vlastitim opisom); ovdje su samo imenovani.

## Trag

- Base SHA: WEB `ff7d6798efbe1e0e5f87629ef79e5df5a2a6f5b3` (`origin/migracija/kopija-ductus-front`), SRV `abf94a9431fddc85631570b8d258816384bf18de`.
- Pokrenuto: pretraga i čitanje koda u obje baze; provjera duplikata (`val21-razlika`: nema PR-a).
- Nije pokrenuto: `pnpm typecheck`, `pnpm test` (nema koda), aplikacija, server, baza, Docker.
- Otvoreno: odluka o v4 (pilot ili poslije), dokument vala 18, licence i veličina biblioteke bojenja, izbor jezika za programske zadatke.
- Sljedeći korak: orkestrator dodjeljuje zadatke iz tablice §8 po redoslijedu §6.
