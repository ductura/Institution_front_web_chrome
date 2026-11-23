# Inventar nastavničkog prototipa Ducture

Datum: 19. 11. 2026. Izvor zadatka: Daniel, 19. 11. 2026.: „Ovo je prototip editor za nastavnika, želim da bude identičan funkcionalno sa svim ekranima i prozorima”.

Ulazi (samo čitanje):

- `D:\Ductura\_prototipovi\Ductura_nastavnik.html` (1265 redaka), dalje „prototip”
- `D:\Ductura\_prototipovi\Ductura_nastavnik_kartice.html` (880 redaka; odluke 18. 11. 2026.), dalje „kartice”
- `D:\Ductura\Institution_front_web_chrome`, grana `origin/migracija/kopija-ductus-front` @ `761fc42` (19. 11. 00:51). Lokalno je odjavljena `migracija/deploy-render-vercel`. `origin/main` @ `92701ac` donosi „wire the teacher's courses and mentored works” (#57).
- `D:\Ductura\Institution_server`, grana `origin/migracija/kopija-ductus-backend` @ `2bc805e` (19. 11. 00:51). `origin/main` @ `758f685` nema nijedan nastavnički rukovatelj.

Ništa u repoima nije mijenjano, odjavljeno ni pokrenuto. Sve je čitano kroz `git show` i `git ls-tree`.

Tri dijela prototipa nisu proizvod:

- traka prototipa: `#proto-bar`, `#proto-view`, `#proto-variant`, gumb teme, `#proto-reset`
- napomene ekrana (`note`)
- izbornik varijanti

U inventaru se navode samo zato što pokazuju koja stanja prototip predviđa.

---

## 1. Ekrani

Prototip je hash-ruter `App`: `App.register(name, def)`, `App.go`, `App.rerender` i `App.variant()`. Registrirano je 14 ekrana. Tri ekrana su na popisu `LATER` u traci prototipa, onemogućena, i nisu registrirana:

- N-14 Priprema za razgovor
- N-15 Etape
- N-AI-ATT

| # | Ekran (`App.register`) | Oznaka | Ljuska | Varijante (stanja) u prototipu |
|---|---|---|---|---|
| 1 | `kolegiji`: Moji kolegiji | N-01 | bočna, nav „Moji kolegiji” | puno, kod, prekinuto, prazno, ucitavanje, greska |
| 2 | `novi-zadatak`: Novi kolegij i zadatak | N-02/N-03 | bočna, uska | puno, pregled, prazno, kolegij-stvoren, pogreske, ucitavanje, greska, prekinuto |
| 3 | `studenti`: Popis studenata | N-04 | bočna | puno, prazno, ucitavanje, greska, dorada |
| 4 | `mentorstva`: Radovi uz mentora | N-16 | bočna, nav „Radovi uz mentora” | puno, prazno, ucitavanje, greska |
| 5 | `brz-put`: Brz put | N-05 | bočna, nav „Brz put” | puno, prazno, ucitavanje, greska |
| 6 | `zbirni`: Zbirni pregled | N-17 | bočna, nav „Zbirni” | puno, prazno, ucitavanje, greska |
| 7 | `rad`: Rad (prikaz uživo, komentari, dorada) | N-06/N-07/N-08 | bez ljuske, `.sb-bar` „Natrag na kolegije” | puno, uzivo, nakon-roka, praznine, nije-predano, dorada, prijedlog, prazno, ucitavanje, greska |
| 8 | `predaja`: Što je student predao (potvrda) | N-07 | radna stranica, „Natrag na rad” | puno, nakon-roka, cjelovit, ceka, nedovrseno, prazno, ucitavanje, greska |
| 9 | `sazetak`: Sažetak procesa i karta podrijetla | N-10 | radna stranica | puno, cjelovit, bez-oznaka, prazno, ucitavanje, greska |
| 10 | `reprodukcija`: Reprodukcija rada | N-09 | radna stranica | puno, praznine, prazno, ucitavanje, greska |
| 11 | `usporedba`: Usporedba verzija | N-11 | radna stranica | puno, prazno, ucitavanje, greska |
| 12 | `konzultacije`: Konzultacije | N-12 | radna stranica | puno, zapis, novi, prazno, ucitavanje, greska |
| 13 | `produljenje`: Produljenje roka | N-13 („gradnja čeka ADR”, rok 30. 11. 2026.) | bočna, uska | puno, prazno, ucitavanje, greska, odobreno, za-sve, sukob |
| 14 | `izvoz`: Izvoz za Merlin | N-18 | bočna | puno, prazno, ucitavanje, greska, priprema, spreman |
| – | Priprema za razgovor | N-14 | nije u prototipu (`LATER`) | kartice 18. 11.: ne gradi se sada (EQ5) |
| – | Etape | N-15 | nije u prototipu (`LATER`) | kartice 18. 11.: bez ekrana, slijed rada ide u zaglavlje rada (`seqList` u `rad`) |
| – | N-AI-ATT | N-AI-ATT | nije u prototipu (`LATER`) | kartice: čeka Q-10 i M9 |

### Zajednička ljuska (`shell()`)

- Bočna traka od 64 px. Znak „D” vodi na `#kolegiji`.
- `NAV` ima četiri stavke: `kolegiji` „Moji kolegiji”, `brz-put` „Brz put”, `mentorstva` „Radovi uz mentora” i `zbirni` „Zbirni”. Aktivna stavka ima `aria-current`.
- Ispod 800 px pojavljuje se gumb `data-core="menu"` „Izbornik” (`aria-expanded`, `data-open`).
- Podnožje bočne trake ima gumb teme ◐ (`data-core="theme"`, `App.setTheme`, localStorage `ductura-nastavnik-tema`) i gumb „Odjava” (`data-core="logout"`).
- Sadržaj je u `main#sadrzaj`.
- Radne stranice (`page()`/`bar()`) imaju sticky `.sb-bar` s poveznicom natrag i putanjom (`crumbOf`). Za `workPage` je to „Natrag na rad”.

### Zajednička stanja (`std()`, `sideState`, `workState`)

- **ucitavanje:** `loadingBody`, kosturi s `role="status"` i tekstom po ekranu (npr. „Učitavanje rokova…”).
- **greska:** `errorBody`, tekst greške i gumb „Pokušaj ponovno” (`data-core="retry"`, vraća varijantu `puno`).
- **prazno:** tekst i radnja po ekranu (vidi dio 3).
- **toast:** `App.toast(msg)` traje 3200 ms. Svaka radnja koja „piše” u prototipu javlja ishod samo toastom.

---

## 2. Prozori i dijalozi

Svi dijalozi nastaju iz `dialog(id, title, body)`. Svaki ima scrim s `data-core="close"`, `role="dialog"` i `aria-modal="true"`. Fokus drži `trap(stage)`: Tab kruži unutar dijaloga, a Escape zatvara dijalog i postavlja `App.state.dlg = null`.

| # | Dijalog (id naslova) | Naslov | Otvara ga | Sadržaj i gumbi |
|---|---|---|---|---|
| 1 | `dk-h` | „Izdati novi kod za upis?” | `kolegiji`, `data-act="newCode"` (`App.state.dlg = 'kod'`) | objašnjenje da stari kod prestaje vrijediti; `data-act="issue"` „Izdaj novi kod” (toast „Novi kod za upis je izdan.”), „Odustani” (`data-core="close"`) |
| 2 | `do-h` | „Odbiti zahtjev za mentorstvo?” | `mentorstva`, `data-act="no"` (`dlg = 'odbij'`) | obrazac `data-submit="reject"`: neobvezan razlog `#f-ro`; toast „Zahtjev je odbijen. Student vidi odgovor i razlog.” ili, bez razloga, „… Student vidi odgovor.” |
| 3 | `dd-h` | „Zatražiti doradu?” | `rad`, `data-act="askDorada"`; `predaja`, `data-act="dorada"` (postavlja `dlg = 'dorada'` i ide na `rad`) | obrazac `data-submit="sendDorada"`: `#f-dd` što treba doraditi (obvezno, toast „Upišite što treba doraditi.”) i `#f-ddr` rok za doradu (obvezno, toast „Upišite rok za doradu.”); uspjeh: toast „Zahtjev za doradu je poslan. Student ga vidi uz rad.” |
| 4 | `ch-h` | „Razgovor n · datum” | `data-act="chat"` u `declPanel` | **u kodu, nije dohvatljiv.** Prototip u retku 891 kaže da `declPanel` i `chatDialog` čekaju studentski korak Izjava. Gumb „Zatvori”. |

Na ekranima nema drugih prozora. „Popis sesija” u `sazetak` je element `details`, a ne dijalog. Toast nije prozor.

Brojka: 3 dohvatljiva dijaloga i 1 u kodu.

---

## 3. Radnje

Oznake: `go:x` je `data-go`, `act:x` je `data-act`, `submit:x` je `data-submit`, `core:x` je `data-core`.

### 3.0 Ljuska (svi ekrani s ljuskom)

- `core:theme`: mijenja svijetlu i tamnu temu (`App.setTheme`, `App.effectiveTheme`).
- `core:menu`: otvara i zatvara izbornik ispod 800 px.
- `core:logout`: samo toast „Odjava u prototipu nije izvedena.”
- `core:retry`: vraća ekran iz greške u `puno`.
- `core:close`: zatvara dijalog.
- `go:kolegiji`, `go:brz-put`, `go:mentorstva`, `go:zbirni`: navigacija.
- `data-work`: postavlja `App.state.work`, a `VAR_OF` iz toga bira varijantu ekrana `rad`.
- `data-variant`: skok na varijantu ekrana.

### 3.1 `kolegiji` (N-01)

- Gumb u zaglavlju „Novi kolegij i zadatak”: `go:novi-zadatak` s `data-variant="prazno"`.
- **prazno:** „Još nemate kolegija” i isti gumb.
- **prekinuto:** banner da objava zadatka nije potvrđena. Gumb `act:check` „Provjeri popis zadataka” daje toast „Popis zadataka učitan s poslužitelja; zadatak nije objavljen.”
- **Kartica Kolegij A (`#k-a`)** ima polja Uloga (nositelj), Upisano, Kod za upis i Sljedeći rok.
- **varijanta kod:** `.code-once` „KOL-A-7Q4M” s napomenom da je kod vidljiv samo sada i da se čuva samo njegov sažetak.
- **Gumbi kartice:**
  - „Popis studenata”: `go:studenti`
  - `act:addTask` „Dodaj zadatak”: briše `wiz` i vodi na `novi-zadatak`
  - „Produljenje roka”: `go:produljenje`
  - „Zbirni pregled”: `go:zbirni`
  - „Izvoz za Merlin”: `go:izvoz`
  - `act:newCode` „Novi kod za upis”: otvara dijalog `dk-h`
- **Popis zadataka.** Uz svaki zadatak `taskFacts` daje dva retka: „Otvorilo rad: X od Y…” i „Zbroj: …”. Retci studenata (`subRows`) daju „Otvori rad” (`go:rad` + `data-work`) ili tekst „Rad nije započet”. Ispod zadatka t1 je poveznica „Brz put kroz radove” (`go:brz-put`).
- **Kartica Kolegij B (`#k-b`):** uloga suradnik, bez zadataka.
- **Dijalog `dk-h`:** `act:issue` ili „Odustani”.
- Stanja učitavanja i greške su `std`.

### 3.2 `novi-zadatak` (N-02/N-03)

- **prazno**, obrazac kolegija `submit:course`:
  - `#f-kn` naziv kolegija (maxlength 120); prazan naziv daje toast „Upišite naziv kolegija.”
  - `#f-ag` akademska godina (select)
  - uspjeh vodi u **kolegij-stvoren**
- **kolegij-stvoren:**
  - kod „KOL-C-3H8T” (jednokratno vidljiv)
  - `act:toTask` „Dodaj prvi zadatak”: vodi na obrazac zadatka
  - „Na kolegije”: `go:kolegiji`
- **puno**, obrazac zadatka `taskForm` (`submit:review`, `novalidate`). Okvir greške je `#wz-err`. Dijelovi obrasca:
  - zs-1 Osnovno: `#f-nas` naslov (maxlength 160), `#f-vrs` vrsta (Seminarski rad / Esej), `#f-opis` opis
  - zs-2 Rok i opseg: `#f-otv` otvara se, `#f-rok` rok (Europe/Zagreb), `#f-min` i `#f-max` broj riječi, kvačice Grupa 2 i Grupa 4
  - zs-3 Pomoć: radio `ai` (kao kolegij / samo sažimanje / ne) i radio `vanj` vanjski alati (da / ne)
  - zs-4 Što se bilježi: statičan popis s pragovima P-01 (30 min) i P-02 (200 znakova)
  - gumbi „Pregled i objava” (submit) i „Odustani” (`go:kolegiji`)
- **pogreske:** popis grešaka u `#wz-err`. `review` provjerava da naslov nije prazan.
- **pregled** (`taskReview`): sažetak polja kao popis, zatim dva gumba:
  - `act:publish` „Objavi zadatak”: toast „Zadatak je objavljen. Studenti grupa 2 i 4 dobivaju obavijest.”, zatim `kolegiji`
  - `act:edit` „Natrag na obrazac”
- **ucitavanje:** „Objava zadatka u tijeku…”.
- **greska:** „poslužitelj je odbio objavu. Uneseni podaci ostaju”.
- **prekinuto:** banner s poveznicom na `kolegiji` (varijanta prekinuto) i `act:edit`.

### 3.3 `studenti` (N-04)

- **prazno:** „Još se nitko nije upisao” i gumb na `kolegiji` (varijanta kod).
- **puno:** filtar `#f-gr` (`data-filter`: svi / Grupa 2 / Grupa 4, s brojem studenata u svakoj). Promjenu obrađuje `after`.
- **Redak studenta:**
  - ime · grupa
  - `subLine` seminarskog rada
  - kod dorade „Čeka doradu, rok za doradu …” (`DORADA_0`)
  - `subLine` eseja
  - poveznica „Otvori seminarski rad” (`go:rad` + `data-work`)
- **dorada:** prikazuje redak koji čeka doradu.
- Učitavanje i greška su `std`.

### 3.4 `mentorstva` (N-16)

- **Popis radova:** Student A, Student D, a nakon odobrenja i Student B. Svaki ima „Otvori rad” (`go:rad`).
- **Kartica `zm-h` „Zahtjevi za mentorstvo”:**
  - `act:ok` „Odobri”: toast „Zahtjev je odobren; mentorstvo je nastalo.” (`mentReq=false`, `mentAdded=true`)
  - `act:no` „Odbij”: otvara dijalog `do-h`
  - bez zahtjeva: „Nema zahtjeva na čekanju.”
- **prazno:** tekst da nema radova uz mentora.
- Učitavanje i greška su `std`.

### 3.5 `brz-put` (N-05)

- **Popis radova** `.fp-list`: `act:pick` s `data-i` bira rad. Uz svaki rad stoji oznaka stanja.
- **Pojedinosti rada:** Stanje, Zadnja promjena, Lijepljenja bez izvora, Stanje zapisa.
- **Kartice** (`role="tablist"`): `act:tab` s `data-t="tekst"` (tekst rada) ili `data-t="sazetak"` (činjenice i poveznica na `sazetak`). Stanje je u `App.state.fpTab`.
- **Kretanje:** `act:prev` „Prethodni rad” i `act:next` „Sljedeći rad”, s `aria-disabled` na krajevima popisa. Uz to „Otvori rad” (`go:rad`).
- **Nezapočet rad:** „Rad još nije započet…”.
- **prazno:** nema radova za zadatak.
- Učitavanje i greška su `std`.

### 3.6 `zbirni` (N-17)

- **prazno:** tekst i gumb „Dodaj zadatak”.
- **puno:** jedna kartica po zadatku s meta retkom brojeva i tablicom `sumTable`. Stupci tablice:
  - Student (poveznica `go:rad`)
  - Stanje
  - Vrijeme predaje
  - Nakon roka
  - Stanje zapisa
  - Dorada (`doradaLabel`)
- Učitavanje i greška su `std`.

### 3.7 `rad` (N-06, N-07, N-08)

- **Odabir rada:** `workFor(v)` bira rad prema varijanti. Gumb natrag je „Natrag na kolegije”.
- **Nezapočet rad (prazno):** ploča i `workNav`.
- **Zaglavlje `.rd-head`:**
  - h1 naslov rada
  - redak stanja: predano; uzivo („prikaz se osvježava dok student piše”); nije predano
  - `seqList`, slijed rada (zamjena za N-15): poslano na pregled, zatražena dorada s rokom, predano i verzija
- **Poveznice `.rd-links`:**
  - „Što je student predao” (`go:predaja`, samo ako je predano)
  - „Sažetak procesa” (`go:sazetak`)
  - „Reprodukcija” (`go:reprodukcija`)
  - „Usporedba verzija” (`go:usporedba`, samo ako je predano)
  - „Konzultacije” (`go:konzultacije`)
- **Radnje u zaglavlju:**
  - `act:askDorada` „Zatraži doradu”: samo za predan rad, otvara dijalog `dd-h`
  - `act:stepWork` s `data-d="-1"` / `data-d="1"`: „Prethodni rad” / „Sljedeći rad”
- **Banneri:**
  - `doradaBanner` ima četiri stanja: otvoren; student navodi da je proveden; prihvaćen; ponovno otvoren. Radnje su `act:accept` „Prihvati doradu” (toast „Dorada je prihvaćena.”) i `act:reopen` „Ponovno otvori” (toast „Zahtjev za doradu je ponovno otvoren.”).
  - Banner o prazninama ima poveznicu na `sazetak`. Njegov uvjet u kodu sadrži `&& false`, pa se banner nikad ne prikazuje (vidi dio 7).
  - Banner „nije predano” ima poveznicu na `produljenje`.
- **Tekst rada** je `.sheet.ed-sheet`, a gradi ga `body()`. Sadrži:
  - prijedlog izmjene s oznakom `sug-lbl` (del/ins)
  - oznaku komentara `.ed-mark`
  - navod `.ed-cite`
  - otvoreno mjesto za izvor `.ed-open`
  - fusnote
- **Bočni dio `cm-h` „Komentari i prijedlozi”** (`threads()`):
  - nit komentara s unosima
  - `act:reply` „Odgovori”: fokusira `#f-cm`, placeholder „Odgovor na komentar…”, postavlja `replyMode`
  - `act:resolve`: „Označi kao riješeno” / „Ponovno otvori”, s oznakom riješeno / otvoreno
  - nit prijedloga sa stanjima na čekanju / povučen / prihvaćen; `act:withdraw` „Povuci prijedlog” daje toast „Prijedlog je povučen. Tekst rada nije promijenjen.”
  - novi komentari (`newComments`)
  - bez niti: „Još nema komentara.”
  - obrazac `submit:comment` s poljem `#f-cm` i gumbom „Dodaj komentar”: toast „Komentar je dodan. Isti komentar vidi i student.”
- **Varijante:**
  - nakon-roka: oznaka predaje nakon roka
  - praznine: oznake praznina
  - nije-predano: banner
  - dorada: doradaBanner
  - prijedlog: nit prijedloga
- Učitavanje i greška su `workState`.

### 3.8 `predaja` (N-07)

- **Nije predano:** „Ovaj rad nije predan, pa potvrde nema.”
- **`beforePanel` `pp-h` „Sažetak procesa (Prije predaje)”:**
  - otvorena mjesta za izvor
  - lijepljenja
  - pravila oblika: „Provjera oblika još nije pokrenuta.”
  - zadatak t0 ima vlastitu varijantu ploče
- **`receiptPanel` `po-h`:**
  - **ceka:** „Predaja u obradi”.
  - **nedovrseno:** „Predaja nije dovršena: zamjenski postupak”.
  - **Puna potvrda, polja:** Vrijeme predaje (`zoned`), Rok, Potpisivanje potvrde započelo, Verzija.
  - **Puna potvrda, `details` „Točne vrijednosti iz potvrde (UTC)”:** requestedAt, dueAt i signedAt.
  - **Otisak:** prikazan u skupinama po četiri znaka. Gumb `act:copyHash` „Kopiraj otisak” daje toast „Otisak je u međuspremniku (64 znaka, bez razmaka).”
  - **Stanje zapisa.**
  - **Provjera:** poveznica `act:verify`, toast „Provjera potvrde otvara se na stranici /provjera. U prototipu nije izvedena.”
  - **QR uzorak** (`qr()`, `hex()`).
- **Gumbi:**
  - „Natrag na rad”
  - `act:dorada` „Zatraži doradu”: otvara `dd-h` na ekranu `rad`
  - „Brz put” (`go:brz-put`)
- **Varijante:** nakon-roka (oznaka „nakon roka” u naslovu), cjelovit, ceka, nedovrseno.
- **U kodu, nedohvatljivo:** `declPanel` (`iz-h` „Izjava o korištenju generativne umjetne inteligencije”, s `act:chat` i dijalogom `ch-h`).
- Učitavanje i greška su `workState`.

### 3.9 `sazetak` (N-10)

- **Raspored** `sb-two`, lijevo `summary(gaps)`, desno `provMap`.
- **Odjeljci sažetka:**
  - Razdoblje rada
  - Sesije, s `details` „Popis sesija”
  - Aktivno vrijeme uređivanja
  - Verzije
  - Lijepljenja, s `act:jump` `data-to="pv-paste"`
  - AI pomoćnik, s `act:jump` `data-to="pv-ai"`
  - Praznine
  - Napomene studenta
  - Stanje zapisa
  - odjeljak izjave je skriven (`declStep = false`)
- **`provMap` `km-h` „Karta podrijetla”:**
  - prekidač `data-sw="origin"` prikazuje oznake podrijetla
  - prekidač `data-sw="typed"` „Napisano u Ducturi”; onemogućen je kad je origin isključen
  - legenda `pv-legend`
  - rečenica „Ductura ne zna tko je tipkao.”
  - sidra `#pv-paste` i `#pv-ai`
  - klase `pv-off` i `pv-typed-on`
- **bez-oznaka:** „karta nema oznaka”.
- **cjelovit:** zapis bez praznina.
- **prazno:** nema zapisa.
- Učitavanje i greška su `workState`.

### 3.10 `reprodukcija` (N-09)

- **Okviri** `FRAMES` imaju izvor (utipkano / zalijepljeno / prijenos iz AI pomoćnika / praznina u zapisu) i sesiju 1–6.
- **Kontrole:**
  - `act:play`: „Pokreni” / „Zaustavi”, `setInterval` 900/brzina ms
  - `act:step` s ±1: „Prethodna promjena” / „Sljedeća promjena”
  - select `data-rp="speed"`: 1×, 2×, 4×
  - select `data-rp="sess"` „Skok na”: Sesija n
  - klizač `#rp-r` `data-rp="pos"`
- **Živi redak:** „Promjena n od N · sesija · izvor”.
- **Prikaz teksta:** `.rp-new` ističe dodani tekst, a `.rp-gap` nosi poruku o praznini.
- `render()` briše tajmer.
- **prazno:** nema zapisa za reprodukciju.
- **praznine:** okviri s prazninama.
- Učitavanje i greška su `workState`.

### 3.11 `usporedba` (N-11)

- **Odabir verzije:** select `#f-cmp` s jednom opcijom (stanje `cmpWith` se ne koristi).
- **Brojevi:** „Dodano 186 / Uklonjeno 41 riječi”.
- **Tekst** `.cmp`: ins/del s tekstom „dodano:” / „uklonjeno:” za čitače zaslona.
- **prazno:** samo jedna verzija, poveznica na `reprodukcija`.
- Učitavanje i greška su `workState`.

### 3.12 `konzultacije` (N-12)

- **puno:** tablica zapisa; `act:open` s `data-i` otvara zapis. Gumb `act:new` „Novi zapis konzultacije”.
- **novi**, obrazac `submit:save`:
  - `#f-cd` datum
  - `#f-cv` verzija rada (select)
  - `#f-ct` tema (obvezno; toast „Upišite temu konzultacije.”)
  - `#f-cg` dogovoreno
  - uspjeh: toast „Konzultacija je zabilježena. Isti zapis vidi i student.”
- **zapis:**
  - polja zapisa
  - popis „Dopune”
  - obrazac `submit:addDop` s poljem `#f-dop` (prazno daje toast „Upišite dopunu.”; uspjeh daje toast „Dopuna je dodana. Vidi je i student.”)
  - `act:list` „Svi zapisi”
- **prazno:** nema zapisa i gumb `act:new`.
- Učitavanje i greška su `workState`.

### 3.13 `produljenje` (N-13, gradnja čeka ADR)

- **Obrazac `submit:save`:**
  - radio `za` jedan / svi (`data-za`, promjena u `after`, stanje `extFor`)
  - `#f-ps` student, samo za jednog studenta
  - `#f-pr` novi rok (Europe/Zagreb)
  - `#f-pz` razlog iz `EXT_REASONS`: Opravdan razlog, Tehnička poteškoća, Dogovor s nastavnikom, Produljenje za sve
  - gumbi „Zabilježi produljenje” i „Odustani” (`go:kolegiji`)
- **Spremanje:** dodaje redak i prelazi u varijantu odobreno, bez toasta.
- **Popis „Produljeni rokovi”:** tko, novi rok, stari rok, razlog, tko i kada. Napomena „Zapis o produljenju … se ne briše.”
- **odobreno:** banner „Produljenje je zabilježeno. … Razlog vidite samo Vi i taj student.”
- **sukob:** banner „Student A je predaju zatražio … prije ovog produljenja. Produljenje ne mijenja tu predaju; bilježi se kao dopuna uz nju.”
- **za-sve:** obrazac za sve studente.
- **prazno:** „Nijedan rok nije produljen.”
- Učitavanje i greška su `std`.

### 3.14 `izvoz` (N-18)

- **Odabir zadatka:** select `#f-ex` (`data-exp`: t0 / t1).
- **Pregled CSV-a:** tablica s 8 stupaca (studenti po prezimenu). Uz nju je kartica „Otisci”.
- **Gumbi:**
  - `act:prep` „Pripremi paket za Merlin”: `aria-disabled` dok traje priprema; toast „Priprema paketa za Merlin u prototipu nije izvedena.”
  - `act:csv` „Preuzmi samo popis”: toast „Preuzimanje popisa (CSV) …”
- **priprema:** indikator pripreme.
- **spreman:**
  - banner s poveznicom koja vrijedi 24 h
  - otisak .zip paketa
  - `act:dl` „Preuzmi paket”: toast „Preuzimanje paketa u prototipu nije izvedeno.”
  - `act:copyHash` „Kopiraj otisak”: toast „Otisak paketa je u međuspremniku…”
- **prazno:** nema predanih radova.
- Učitavanje i greška su `std`.

### Brojke za dio 3

- 33 različita `data-act` (provjereno pretragom prototipa): accept, addTask, askDorada, chat, check, copyHash, csv, dl, dorada, edit, issue, jump, list, new, newCode, next, no, ok, open, pick, play, prep, prev, publish, reopen, reply, resolve, step, stepWork, tab, toTask, verify, withdraw. Od toga je 32 dohvatljivo, a `chat` (r. 906–907, u `declPanel`) nije.
- 7 `data-submit`: course, review, reject, sendDorada, comment, save (u `konzultacije` i u `produljenje`), addDop.
- 5 `data-core`: theme, menu, logout, retry, close.
- ID-ovi naslova i pomoćnih tekstova (za `aria-labelledby` / `aria-describedby`): ploče `pg-h` (učitavanje i greška radnih stranica i `rad`), `pp-h`, `po-h`, `iz-h`, `sm-h` (`sazetak`), `km-h`, `rp-h` (`reprodukcija`), `cp-h` (`usporedba`); naslovi `cm-h`, `zm-h`, `fp-h` (pojedinosti u `brz-put`), `pl-h` („Produljeni rokovi”), `po-h2` („Podaci zadatka” u `taskReview`); pomoćni tekstovi `ro-h`, `dd-hint`, `dop-h`, `pr-h`, `pz-h`; ostalo `k-a`, `k-b`, `pv-ai`, `pv-paste`, `wz-err`, `sadrzaj`, `stage`, `toast`.
- Imenovane funkcije prototipa (sve `function` deklaracije): ruter `current`, `ctx`; prikaz `shell`, `page`, `bar`, `head`, `note`, `crumbOf`, `panel`, `sec`, `radio`, `dialog`, `trap`, `std`, `sideState`, `workState`, `workPage`, `workFor`, `workNav`, `loadingBody`, `errorBody`, `taskFacts`, `subLine`, `subRows`, `sumTable`, `taskForm`, `taskReview`, `wzKol`, `fv`, `fraw`, `doradaOf`, `doradaLabel`, `doradaBanner`, `seqList`, `threads`, `body`, `beforePanel`, `receiptPanel`, `declPanel`, `chatDialog`, `summary`, `provMap`, `frames`, `render`, `cons`, `exts`, `fname`, `qr`, `finder`, `hex`, `studWord`, `esc`; datum i vrijeme: `parse`, `two`, `off`, `key`, `mod`, `zoned`, `iso`, `late`, `fmt`.
- Ostale kontrole:
  - `data-rp`: speed, sess, pos
  - `data-sw`: origin, typed
  - `data-filter`, `data-exp`, `data-za`
- Polja obrazaca: 24 `#f-*`, klizač `#rp-r` i 3 radio skupine. Popis: `#f-kn`, `#f-ag`, `#f-nas`, `#f-vrs`, `#f-opis`, `#f-otv`, `#f-rok`, `#f-min`, `#f-max`, `#f-gr`, `#f-ro`, `#f-dd`, `#f-ddr`, `#f-cm`, `#f-cmp`, `#f-cd`, `#f-cv`, `#f-ct`, `#f-cg`, `#f-dop`, `#f-pr`, `#f-ps`, `#f-pz`, `#f-ex`, `#rp-r`, te radio skupine `ai`, `vanj` i `za`.
- Stanja po ekranu: vidi tablicu u dijelu 1. Ukupno je 83 varijante na 14 ekrana (prebrojano iz `variants` svakog `App.register`; `std()` daje puno, prazno, ucitavanje, greska).

---

## 4. Podaci

### Ljestvica

| Oznaka | Značenje |
|---|---|
| **M** | Ugovor postoji i ruta je montirana u `server/server.ts` (radi). |
| **U** | Postoji samo ugovor u `server/contracts/routes/*.ts` i `openapi/v1.json`, bez rukovatelja u `server/http`. |
| **B** | Postoji samo migracija baze u `db/main/migrations`, bez ugovora. |
| **K** | Kopirani izvor iz Ductusa koji nije spojen (npr. `server/institution/assignment-route.ts` je još u Next obliku). |
| **—** | Nema ničega. |

Montirano u `server/server.ts`:

- health i ready
- client-context
- evidence open, commit i replay
- downloads manifest
- settings
- profile i me
- problem-report
- `institution.courses.post`, `institution.enrollment-code.post` i `institution.enrollment-code-revocation.post` (`createInstitutionCourseRoutesFor`)
- webauthn i auth
- internal institutions

Sve rute `teacher.*`, `collaboration.*`, `projection.*` i `live.*` imaju samo ugovor (**U**). To vrijedi i za `origin/main` servera. Provjera: blok `startServer` u `server/server.ts` (r. 120–150) pročitan cijeli, uz kontrolni pogodak `createInstitutionCourseRoutesFor` (r. 132); od nastavničkih datoteka u `server/institution` postoje samo `teacher-role-confirmation-route.ts` i `teacher-role-revocation-route.ts` (potvrda i opoziv uloge, ne ekrani prototipa).

Napomena uz front `origin/main` #57 („wire the teacher's courses and mentored works to the institution server”): commit mijenja samo `packages/app` i `src/client`, a čitanja `teacher.courses.get` i `teacher.mentorships.get` testira nad vektorima iz `@ductura/test-fakes`. Klijent je spojen, serverski rukovatelj ne postoji ni na jednoj grani servera koju sam pregledao. Zato su obje rute u valu 1 „port”, ne „već radi”.

### Tablica podataka

| Ekran i podatak | Status | Ruta ili ugovor | Napomena |
|---|---|---|---|
| Ljuska: smije li korisnik vidjeti nastavničke stranice | U | `teacher.access.get` GET `/api/v1/teacher/access` | |
| Ljuska: odjava | M | `auth.logout.post`, `auth.logout-all.post` | tok AAI odjave u prototipu nije opisan |
| N-01 kolegiji i zadaci | U | `teacher.courses.get` GET `/api/v1/teacher/courses` | ugovor nosi pravilo kolegija o AI pomoći; uloga nositelj/suradnik ostaje za provjeru |
| N-01 brojevi u `taskFacts` („Otvorilo rad X od Y”, „Zbroj”) | djelomično, U | `teacher.assignment-submissions.post` | ugovor daje samo tko je predao i `documentId`; „otvorilo rad” i zbroj nisu u njemu |
| N-01 „Sljedeći rok” | U | `teacher.courses.get` (rok zadatka) | |
| N-01 i N-02 novi kod za upis (`act:newCode` / `act:issue`) | M | `institution.enrollment-code.post`, `…/revocation` | |
| N-02 novi kolegij (`submit:course`) | M | `institution.courses.post` | akademska godina `#f-ag` nije provjerena u tijelu ugovora |
| N-02/N-03 novi zadatak (`act:publish`) | K | `server/inventory.ts` `PENDING`: `app/api/institution/courses/[courseId]/assignments/route.ts` | ugovor nedostaje; `server/institution/assignment-route.ts` je nespojena kopija |
| N-03 nova verzija zadatka (uređivanje) | U | `institution.assignment-versions.post` | prototip nema uređivanje objavljenog zadatka, a web kopija ima (`AssignmentVersionForm`) |
| N-02 grupe (Grupa 2 i 4) | B | `20261102160000_course_team_groups.sql` | grupe u tijelu zadatka su neprovjerene |
| N-02 obavijest studentima pri objavi | — | | |
| N-04 popis studenata, grupe, filtar | B | `20261028140000_teacher_rosters.sql` | nema ugovora |
| N-04 stanje dorade po studentu | djelomično, U | `collaboration.revision-requests.post` `list` (po radu) | nema skupnog čitanja |
| N-16 radovi uz mentora | U | `teacher.mentorships.get`, `teacher.mentorship.get` | |
| N-16 zahtjevi: odobri i odbij s razlogom | B | `20261104090000_mentorship_request.sql` | nema ugovora |
| N-05 brz put: tekst, stanje, sažetak po studentu | U | `teacher.fast-path.post` | Stanje zapisa i „Lijepljenja bez izvora” dolaze iz sažetka; „Zadnja promjena” je neprovjerena |
| N-17 zbirni: student, stanje | djelomično, U | `teacher.assignment-submissions.post` | |
| N-17 zbirni: vrijeme predaje, nakon roka, stanje zapisa, dorada | — | | ugovor izričito kaže „No text, name, exact time, deadline, hash or submission id” |
| N-06 tekst uživo | U | `live.document.get` GET `/api/v1/live/{documentId}` | |
| N-06 zaglavlje rada, `seqList` | djelomično | `live.document.get`, `revision-requests list` | vrijeme slanja na pregled i predaje nisu ni u jednom ugovoru |
| N-08 komentari: create, reply, resolve, reopen, delete, list | U | `collaboration.comments.post` `/api/v1/comments/{action}` | |
| N-08 prijedlog izmjene i povlačenje (`act:withdraw`) | — | | `comments` nema prijedlog; `revision-requests` ima `withdraw`, ali za zahtjev za doradu, ne za prijedlog teksta |
| N-07 dorada: zatraži, prihvati, ponovno otvori | U | `collaboration.revision-requests.post` (create, accept, reopen, …) | |
| N-07 rok za doradu `#f-ddr` | — | | tijelo `create` ima `{anchor, documentId, instruction, requestedRevision}`, bez roka |
| N-07 potvrda predaje za nastavnika (vrijeme, rok, potpisano, verzija, otisak, stanje zapisa) | — | | postoji samo studentova `submission.submit.post` (U) i migracije `submission_receipt*`; nastavničkog čitanja nema |
| N-07 provjera potvrde `/provjera` | — | | |
| N-07 „Prije predaje”: otvorena mjesta za izvor, pravila oblika | — | | |
| N-10 sažetak: sesije, lijepljenja, praznine, stanje zapisa | U | `projection.process-summary.post` `/api/v1/process-summary` | oblik `process-summary-shape.ts` ima sessions, pastes, gaps i recordState |
| N-10 aktivno vrijeme, verzije, AI pomoćnik, napomene studenta | — | | nije u obliku `ProcessSummaryV1` (provjereno po ključevima, ne po svakom polju) |
| N-10 karta podrijetla (raspon po izvoru) | — | | kartice: plan napada |
| N-09 reprodukcija | M | `evidence.replay.post` | sesije i izvori okvira dolaze iz segmenata; skok na sesiju se računa na klijentu |
| N-11 popis verzija i usporedba | — | | web ima `src/domain/diff/diff.ts` i `packages/editor-core/.../diff`; serverskog popisa verzija nema |
| N-12 konzultacije: zapis, dopuna, popis | — | | nema ni migracije |
| N-13 produljenje roka | — | | čeka ADR Q-5 |
| N-18 izvoz za Merlin: paket .zip, CSV, otisci, poveznica 24 h | — | | `downloads.manifest.get` služi za desktop instalacije, nije ovo |

---

## 5. Što već postoji u webu

Repo je `Institution_front_web_chrome`. U njemu su tri stabla:

- **(a) `src/app` + `src/components`:** Next.js kopija Ductusa na `migracija/kopija-ductus-front`.
- **(b) `packages/app`:** Vite aplikacija. `routes.ts` zna samo `teacherCourses` i `mentoredWorks`; ostale nastavničke stavke su `pending`.
- **(c) `packages/ui`:** `@ductura/ui`.

Komponente su uspoređene po nazivima ključeva i funkcija (`git show | grep`), ne po svakom polju. „Postoji” ne znači „identično prototipu”.

| Ekran | Web | Stanje u odnosu na prototip |
|---|---|---|
| Ljuska | `src/components/shell/AppShell.tsx`, `ShellRail.tsx`, `nav.ts`, `ShellLogout.tsx`, `ThemeRestore.tsx`, `ErrorScreen.tsx`, `RouteLoading.tsx`, `shell/Dialog.module.css` | **Razlikuje se.** `nav.ts` za nastavnika ima tri stavke (Moji kolegiji, Brz put, Radovi uz mentora); prototip ima i četvrtu, „Zbirni”. Odjava postoji. Gumb „Izbornik” ispod 800 px nije uspoređen. |
| N-01 `kolegiji` | `TeacherCourses.tsx` (24 testa, 5 stanja u katalogu), `/nastavnik` (`/nastavnik/kolegiji` preusmjerava) | **Razlikuje se.** Postoje popis kolegija i zadataka, rok, broj studenata i poveznice. Nema: kartice s gumbima (Popis studenata, Produljenje, Zbirni, Izvoz, Novi kod), `taskFacts`, varijante prekinuto, uloge suradnik i jednokratnog koda `.code-once` na kartici. |
| N-02/N-03 `novi-zadatak` | `TeacherSetup.tsx` (`/nastavnik/zadatak/novi`), `course-create.ts`, `assignment-create.ts`, `enrollment-code-create.ts`, `existing-course.ts`; `AssignmentVersionForm.tsx` (`/nastavnik/zadatak/[id]/uredi`) | **Djelomično.** Postoje kolegij, godine, kod, politike AI, alati, otvara se od, rok i pregled s objavom. Nisu potvrđeni grupe, broj riječi, vrsta rada i zs-4 „Što se bilježi”. |
| N-04 `studenti` | — | **Nema.** |
| N-16 `mentorstva` | `MentoredWorks.tsx` (10 testova), `/nastavnik/mentorstva` | **Razlikuje se.** Popis postoji; kartica „Zahtjevi za mentorstvo” s odobri/odbij i dijalogom `do-h` ne postoji. |
| N-05 `brz-put` | `FastPath.tsx` (`aria-pressed`, `aria-current`, next, summary), `/nastavnik/brz-put` | **Postoji, nije uspoređeno po poljima.** Prema karticama „Otvori rad” je „uskoro”. |
| N-17 `zbirni` | — | **Nema.** |
| N-06/N-08 `rad` | `LiveWorkView.tsx`, `LiveText.tsx`, `TeacherComments.tsx` (create, reply, resolve, reopen, list), `comment-place.ts`, `selection.ts`, `SummaryCard.tsx`, `RecordLimits.tsx`, `/nastavnik/rad/[id]` | **Djelomično.** Postoje tekst uživo i komentari s odgovorom i rješavanjem. Ne postoje: nastavnička strana dorade (`src/components/editor/RevisionPanel.tsx` je studentov i ima samo `respond`), prijedlog izmjene i povlačenje, `seqList`, `stepWork`, banneri i `.rd-links`. |
| N-07 `predaja` | — (`src/components/student/TeacherViewSheet.tsx` je studentski prikaz) | **Nema** za nastavnika. |
| N-10 `sazetak` | `src/components/summary/ProcessSummaryView.tsx` (sesije, lijepljenja, praznine, stanje zapisa), `SummaryCard.tsx` | **Djelomično.** Nema aktivnog vremena, verzija, AI pomoćnika, napomena ni karte podrijetla. |
| N-09 `reprodukcija` | `src/components/replay/ReplayView.tsx` (player, step, session marks), `/nastavnik/rad/[id]/reprodukcija` | **Postoji, nije uspoređeno po poljima.** Odabir brzine (1×/2×/4×) i „Skok na” sesiju nisu nađeni pretragom. |
| N-11 `usporedba` | samo domena `src/domain/diff/diff.ts` i `packages/editor-core/src/document/diff` | **Nema ekrana.** |
| N-12 `konzultacije` | — | **Nema.** |
| N-13 `produljenje` | — | **Nema** (čeka ADR). |
| N-18 `izvoz` | — | **Nema.** |
| Dodatno u webu, nema u prototipu | `WorkLanguageCard`, `WorkLanguageExceptionCard` (`/nastavnik/zadatak/[a]/rad/[d]/jezik`), `AssignmentVersionForm` | **Pitanje za Daniela** (dio 7). |

### `@ductura/ui` za ponovnu upotrebu

`packages/ui/src/index.ts` izvozi:

- `Button`
- `Card`
- `SaveState` i `saveStateContent` / `SAVE_STATES`
- `TextField`
- `readTheme`, `saveTheme`, `toggleTheme` i `THEME_KEY`
- tokene `tokens/globals.css` i fontove (Instrument Sans, Newsreader, JetBrains Mono)

Za prototip se mogu izravno upotrijebiti:

- **Button:** sve `data-act` radnje.
- **Card:** kartice kolegija, `zm-h`, ploče `panel()`.
- **TextField:** polja `#f-*`.
- **SaveState:** stanje spremanja svih nastavničkih upisa (komentar, dorada, konzultacija, produljenje).
- **theme:** gumb ◐.

Paket nema dijalog, kartice (`tablist`), tablicu, banner, toast ni skeleton. Kandidati za premještanje u `@ductura/ui`:

- `shell/Dialog.module.css` i `PanelTabs.tsx` iz `src/components/shell`
- `ErrorScreen.tsx`
- `RouteLoading.tsx`

---

## 6. Prijedlog valova

Redoslijed slijedi što je na serveru već montirano. Svaki val završava ekranima koje Daniel može kliknuti lokalno, uz stvarni server iz `Institution_server` i AAI lažni OIDC za lokalni rad. Server i web grade se zajedno.

„Port” znači prijenos postojećeg ugovora i rukovatelja iz kopije Ductusa. „Novo” znači novi ugovor, tablicu i RLS. Veličine su grube, u PR-ovima do 300 redaka.

### Val 1. Ljuska i kolegiji

- **Ekrani:** ljuska s 4 stavke nav (uključujući „Zbirni” kao prazno mjesto ili bez njega, ovisno o odgovoru u dijelu 7), N-01 `kolegiji` sa svim varijantama, N-02 novi kolegij, dijalog `dk-h` novi kod.
- **Server:**
  - port: `teacher.access.get`, `teacher.courses.get`
  - već montirano: `institution.courses.post`, `institution.enrollment-code.post`, `…/revocation`
- **Web:**
  - `TeacherCourses` proširiti na kartice prototipa
  - `.code-once`
  - nav
- **Veličina:** srednja, oko 4–6 PR-ova.

### Val 2. Novi zadatak i objava

- **Ekrani:** N-02/N-03 `novi-zadatak` sa svim varijantama, uključujući prekinuto, pogreske i pregled. Na N-01 dolazi `taskFacts`.
- **Server:**
  - novo: ugovor za stvaranje zadatka; zatvara `PENDING` u `inventory.ts`, spaja `server/institution/assignment-route.ts`
  - port: `teacher.assignment-submissions.post`
  - grupe zadatka (migracija postoji)
- **Web:** `TeacherSetup` uskladiti s obrascem `taskForm` (zs-1 do zs-4) i `taskReview`.
- **Veličina:** srednja do velika, oko 5–7 PR-ova.

### Val 3. Studenti, mentorstva i zbirni

- **Ekrani:** N-04 `studenti` s filtrom grupa, N-16 `mentorstva` sa zahtjevima i dijalogom `do-h`, N-17 `zbirni`.
- **Server:**
  - novo: ugovor za popis studenata nad `teacher_rosters`
  - novo: ugovor odobri/odbij nad `mentorship_request`
  - novo: zbirno čitanje s vremenom predaje, nakon roka, stanjem zapisa i doradom (prošireno `teacher.submissions` ili nova ruta)
  - port: `teacher.mentorships.get`, `teacher.mentorship.get`
  - RLS po ustanovi i pgTAP retci za sve nove ugovore
- **Veličina:** srednja do velika, oko 6–8 PR-ova.

### Val 4. Rad: uživo, komentari, dorada i brz put

- **Ekrani:** N-06/N-08 `rad` (zaglavlje sa `seqList`, `.rd-links`, `stepWork`, banneri, komentari, prijedlozi), dijalog `dd-h`, N-05 `brz-put`.
- **Server:**
  - port: `live.document.get`, `collaboration.comments.post`, `collaboration.revision-requests.post`, `teacher.fast-path.post`
  - novo: rok za doradu u `create`
  - novo: prijedlog izmjene i povlačenje, ako Daniel potvrdi
- **Web:** `LiveWorkView`, `TeacherComments` i `FastPath` uskladiti s prototipom; nastavnički panel dorade.
- **Veličina:** velika, oko 8–10 PR-ova. Dio je kritičan: dorada i odgovori moraju čekati potvrdu poslužitelja.

### Val 5. Zapis rada: predaja, sažetak, reprodukcija i usporedba

- **Ekrani:** N-07 `predaja` (`receiptPanel`, `beforePanel`), N-10 `sazetak` s kartom podrijetla, N-09 `reprodukcija`, N-11 `usporedba`.
- **Server:**
  - port: `projection.process-summary.post`
  - već montirano: `evidence.replay.post`
  - novo: nastavničko čitanje potvrde predaje
  - novo: proširenje sažetka (aktivno vrijeme, verzije, AI, napomene)
  - novo: karta podrijetla
  - novo: popis verzija
- **Web:** `ProcessSummaryView` i `ReplayView` uskladiti (brzina, skok na sesiju); novi `ReceiptPanel`, karta podrijetla i usporedba nad `diff.ts`.
- **Veličina:** velika, oko 8–10 PR-ova. Dijelovi evidence i potvrde su kritični.

### Val 6. Konzultacije i izvoz, a produljenje uvjetno

- **Ekrani:** N-12 `konzultacije` (puno, novi, zapis, dopune), N-18 `izvoz` (priprema, spreman, CSV, otisci).
- **Server:**
  - novo: tablice, RLS i ugovori za konzultacije i dopune
  - novo: posao izvoza (.zip s PDF i .docx, CSV, otisci, poveznica 24 h)
- **Uvjetno:** N-13 `produljenje` tek nakon ADR-a Q-5 (rok 30. 11. 2026.).
- **Veličina:** velika, oko 8–10 PR-ova (izvoz je najveći dio).

---

## 7. Nejasno: pitanja za Daniela

Ovdje ništa nije odlučeno; sve su to pitanja.

1. **„Identičan sa svim ekranima” prema odlukama od 18. 11.**
   - Prototip sadrži N-13 `produljenje`, a kartice kažu da gradnja čeka ADR Q-5.
   - Kartice za N-14, N-15 i N-AI-ATT kažu „ne gradi se sada”.
   - Vrijedi li nova rečenica ili odluke od 18. 11.? Gradi li se N-13 prije ADR-a samo kao oblik?
2. **Odjava i AAI@EduHr (D-09).** `core:logout` u prototipu je samo toast. Treba li „Odjava” odjaviti i AAI sesiju (`auth.logout.post` naspram `auth.logout-all.post`), i što nastavnik vidi nakon odjave?
3. **„Spremljeno” tek uz potpisanu potvrdu poslužitelja.** Svi nastavnički upisi u prototipu odmah javljaju uspjeh toastom: komentar, dorada, prihvat ili ponovno otvaranje dorade, odobri/odbij mentorstvo, konzultacija, dopuna, objava zadatka i novi kod. Produljenje to radi bannerom bez toasta. Smije li toast reći „je dodan” ili „je poslan” prije potvrde poslužitelja? Treba li uz svaki upis stanje `SaveState` iz `@ductura/ui`?
4. **Zabranjeni izrazi.** Gumb „Kopiraj otisak” (`predaja` r. 939, `izvoz` r. 1244) pogađa pravilo „kopirano” iz `scripts/forbidden-terms/terms.ts`, koje dopušta samo „Kopiraj navod”, „kopiranje navoda” i „Kopirano u međuspremnik”. Treba li drugi naziv (npr. „Otisak u međuspremnik”) ili iznimka na popisu?
   - Ostale stabljike s popisa (sumnj, rizi, anomal, vjerojat, autentic, prepis, skriven, plagi, izvornost, integritet, nepraviln, spremljen) nisu nađene u prototipu.
   - Riječi „Lijepljenja bez izvora” i „praznina u zapisu” nisu na popisu, ali ih treba potvrditi kao smjer „opisuje, ne zaključuje”.
5. **RLS po ustanovi i uloga suradnika.**
   - Kolegij B ima ulogu „suradnik”. Što suradnik smije: komentirati, tražiti doradu, izvoziti?
   - Vidi li suradnik zahtjeve za mentorstvo?
   - Filtar grupa na `studenti` prikazuje brojeve po grupi: smije li suradnik vidjeti sve grupe?
6. **Jednokratni kod `.code-once`.** Kod se vidi samo jednom i čuva se samo sažetak. Je li to i dalje odluka, s obzirom na to da `institution.enrollment-code.post` vraća kod?
7. **Novi kolegij.** Polje akademske godine `#f-ag` postoji. Smije li nastavnik sam stvoriti kolegij ili kolegije uvozi administrator ustanove (A-03)?
8. **Rok za doradu `#f-ddr`.** Ugovor `revision-requests create` nema rok. Dodaje li se rok u ugovor (kartice N-15: „dorada ima svoj rok kad je nastavnik zatraži”)?
9. **Prijedlog izmjene** (nit prijedloga, `act:withdraw`). Je li prijedlog teksta nastavnika dio proizvoda? Nema ga ni u ugovoru ni u webu.
10. **Banner o prazninama na `rad`.** Uvjet sadrži `&& false`, pa se nikad ne prikazuje. Je li isključen namjerno?
11. **`declPanel` i dijalog `ch-h`.** Izjava o AI-ju i razgovori skriveni su do studentskog koraka Izjava. Ulaze li u ovaj plan?
12. **Usporedba verzija.** Select `#f-cmp` ima jednu opciju, a stanje `cmpWith` se ne koristi. S kojim verzijama nastavnik uspoređuje (v1 naspram predane, bilo koje dvije)?
13. **Izvoz.** CSV slaže studente po prezimenu, poveznica vrijedi 24 h, a paket sadrži PDF i .docx. Jesu li to odluke ili primjer? Je li popis razloga produljenja (`EXT_REASONS`) samo primjer? Napomena u prototipu kaže „primjer”.
14. **Nav „Zbirni”.** Web ima tri stavke, a prototip četiri. Ulazi li „Zbirni” u bočnu traku?
15. **Ekrani u webu kojih nema u prototipu:** jezik rada (`WorkLanguageCard`, `WorkLanguageExceptionCard`) i nova verzija zadatka (`AssignmentVersionForm`). Ostaju li?
16. **Obavijest studentima pri objavi** („Studenti grupa 2 i 4 dobivaju obavijest”). Kojim kanalom? Za to nema ugovora.
17. **Provjera potvrde `/provjera`.** Je li to javna stranica izvan prijave? Treba li pritom pravilo D-09 odvojiti od te stranice?
18. **Neskladi sa studentskim prototipom** (iz kartica): potvrda predaje u studentskom prototipu nema redak verzije, a nastavnička ga ima; studentski prototip upućuje na „3. Analiza”, koje nema; u studentskom sažetku stoji riječ s popisa zabranjenih izraza; kolegiji B, C i D tamo imaju nastavnike B, C i D, a ovdje je nastavnik nositelj A i suradnik B. Koji prototip vrijedi za zajedničke podatke?
19. **Brojevi N-xx.** Ovaj inventar koristi oznake iz kartica (N-01 do N-18; provjereno po `data-hash` u karticama). `docs/FEATURES.md` koristi druge brojeve (npr. „N-05 u FEATURES.md nije Brz put”), a EKRANI.md ima zastarjele statuse (N-01, N-16, N-06 kao NEMA; N-15 DJELOMIČNO bez koda). Koji popis je kanonski? Kartice spominju i N-19, koji nije u prototipu ni u fazama.

---

## 8. NF-4: nove stavke (23. 11. 2026.)

Zadatak `nf4-prototip-nastavnik`, slot `claude:wnf4-proto:frontend`. Izvor: `docs/nalazi/nove-funkcije-4-nastavnik-kolegiji-zadaci.md` (NZ-1 do NZ-18) i Danielove odluke („1 da 2. asistent u pilotu radi 3. Da 4. Oboje 5. Da 6. Smije isključiti”; „Asistent radi u pilotu i sve stavke NZ idu u pilot”). Sve stavke ulaze u pilot, uključivo NZ-14, NZ-15 i NZ-9. U prototipu je element označen atributom `data-nf4="NZ-n"`, a napomena „Poslužitelj:” (`.srv`) označava što poslužitelj danas nema. Pružatelj i model se ne imenuju: piše samo „Asistent” (odluka Q-10 nije donesena).

Novi ekrani u prototipu (nisu u kartice od 18. 11.; A-10): `uredi` (NF4-U „Uredi zadatak, nova verzija”) i `tim` (NF4-T „Nastavni tim i grupe”). Novi dijalozi: `di-h` „Dopustiti predaju nakon roka?”, `dz-h` „Spremiti značajnu izmjenu?”, `do2-h` „Opozvati kod za upis?”. Dijalog `dd-h` je sada jedan za rad i za redak studenta (`doradaDlg`), a `dk-h` ima rok koda.

Oznaka stanja: P puno, Pr prazno, U učitavanje, G greška, I ostala stanja iz varijanti prototipa.

| ID | NZ | Ekran i element | Stanja | Serverska ovisnost |
|---|---|---|---|---|
| NF4-NZ1 | NZ-1 | `kolegiji`: redak radnji zadatka „Predaje”, „Uredi (nova verzija)”, „Kopiraj zadatak”, „Produljenje”, „Izvoz”, „Brz put kroz radove”; `brz-put`: izbornik „Zadatak”; `studenti` prazno: „Izdaj novi kod” otvara `dk-h`; `zbirni` prazno: „Dodaj zadatak” vodi na obrazac | P, Pr, U, G (kao ekrani) | ne, postoji. Čuvanje query-ja pri preusmjerenju `/nastavnik/kolegiji` je ponašanje hosta, nije u prototipu |
| NF4-NZ2 | NZ-2 | `kolegiji`: „Produljenje roka…” i „Izvoz za Merlin…” otvaraju izbornik „Zadatak” (varijanta `izbor`); `produljenje` nudi i zadatak s prošlim rokom (banner „Rok ovog zadatka je prošao”); `zbirni`: izbornik „Zadatak” | I (`izbor`), P, Pr, U, G | ne: `teacher.deadline-extension.post`; host danas nudi samo budući rok, pa se promjena dodaje u hostu |
| NF4-NZ3 | NZ-3 | `novi-zadatak` odjeljak Rok i opseg: grupe kao stvarne kućice; odjeljak Pravila o Asistentu i alatima: „Samo sažimanje” je stvarna postavka, „Vanjski alati” stvarna postavka, razlozi kroz `aria-describedby`; pregled prikazuje grupe i alate riječima | P, I (`pogreske`: „odaberite barem jednu grupu”), U, G, I (`pregled`) | čitanje grupa `institution.course-groups.get`, slanje `groupIds`; polja `externalToolsAllowed` i `aiSummaryOnly` su u ugovoru, a obrada na poslužitelju **nedostaje potvrda** |
| NF4-NZ4 | NZ-4 | `novi-zadatak` odjeljak 5 „Pravila predaje” (a) predaja nakon roka, (b) povlačenje, (c) izjava obavezna, uz redak „Student na koraku predaje vidi: …”; isti odjeljak u `uredi`; pri izmjeni nakon objave dijalog `dz-h` s rečenicom „Ova izmjena mijenja pravila koja su studenti već vidjeli” | P, I (`dz-h`), U, G (`uredi`) | (a) polje zabrane predaje nakon roka **nedostaje** (npr. u `institution.course-assignments.post` i `assignment-versions.post`; poslužitelj danas vraća `not_open`); (b) `teacher.submission-withdrawal.post {allowed}`; (c) `teacher.declaration-required.put {required}` |
| NF4-NZ5 | NZ-5 | `studenti` i `zbirni`: radnja „Dopusti predaju nakon roka…” otvara `di-h` (razlog s popisa, rok do kad, kućica „Razlog je vidljiv studentu”, varijanta A i B); zapis u popisu „Produljeni rokovi” s oznakom „iznimka” | P, I (onemogućeno uz razlog kad je student predao prije roka), G (neispravan rok) | varijanta A: `teacher.deadline-extension.post` `scope:"one"`; varijanta B (posebna iznimka s vlastitim zapisom): **nedostaje** polje ili operacija, u prototipu postoji samo lokalno |
| NF4-NZ6 | NZ-6 | `produljenje`: filtar „Prikaži zapise za”, redak „Student vidi: Bio {stari rok}, razlog: opravdano / tehnički / dogovor”, napomena o razlogu drugog nastavnika; u `studenti` i `zbirni` poveznica „Rok produljen do …” na zapis | P, Pr, U, G, I (`odobreno`, `za-sve`, `sukob`) | ne: `teacher.deadline-extensions.get` (`previousDueAt`, `dueAt`, `reasonId`, `scope`); student: `student.deadline-history.get` |
| NF4-NZ7 | NZ-7 | `novi-zadatak` pregled: blok „Ovako će student vidjeti obavijest”; `uredi`: „Što ste promijenili u odnosu na verziju n” (usporedba uživo), dijalog `dz-h` „Studenti će morati ponovno potvrditi obavijest (verzija n+1)”, sukob verzija s „Učitaj ponovno” | P, I (`sukob`), U, G | (a) do (d) postoje: `institution.assignment.get`, `assignment-versions.post` s `expectedVersion`; usporedba verzija na studentskoj strani (NF-1 P-16) traži poslužitelj i ovdje se ne gradi |
| NF4-NZ8 | NZ-8 | `kolegiji`, `studenti`, `zbirni`: „Potvrdilo obavijest: n od m studenata”, po studentu „obavijest potvrđena / nije potvrđena”; nakon značajne izmjene „Potvrdilo 0 od 4 · nova verzija n” | P, I (nova verzija) | **nedostaje potvrda**: `teacher.assignment-overview.get` i `teacher.assignment-submissions.post` ne vraćaju potvrdu obavijesti po studentu ni verziju; treba polje |
| NF4-NZ9 | NZ-9 | `novi-zadatak` odjeljak 6 „Obavijest studentima” i `uredi` odjeljak „Obavijest o izmjeni”: kućica „Obavijesti studente i e-poštom” (zadano isključeno), sadržaj poruke bez naslova rada i bez rada, odjava studenta; poslije objave banner „Poslano n studentima” bez imena | P, I (poslano) | **nedostaje** ruta i polje za slanje (odluka 2147 i DPIA); u prototipu je samo postavka i pregled |
| NF4-NZ10 | NZ-10 | `studenti`: redak po studentu kroz zadatke (poveznica na rad, grupa, stanje, vrijeme i verzija predaje, rok, potvrda obavijesti, dorada); `zbirni`: tablica s 9 stupaca (Student, Stanje, Predaja, Nakon roka, Rok, Obavijest, Stanje zapisa, Dorada, Radnje) | P, Pr, U, G, I (`dorada`) | osnova: overview + submissions + extensions + zahtjevi za doradu postoje; dorada po studentu skupno **nedostaje** (N poziva) |
| NF4-NZ11 | NZ-11 | `studenti` i `zbirni`: filtri „Stanje” (Nije započeo, Piše, Predano, Nakon roka, Dorada), „Grupa”, poredak (prezime, stanje), broj „Nije započelo n”, ispod 760 px redak postaje kartica, onemogućene radnje imaju razlog | P, Pr (nema podudaranja: „Očisti filtre”) | ne |
| NF4-NZ12 | NZ-12 | jedan dijalog `dd-h` na radu (`rad`) i na retku studenta (`studenti`, `zbirni`); „Povuci zahtjev” u banneru dorade i na retku; kartica zadatka „Dorada: n otvorenih, m čeka Vaš pregled”; filtar „Dorada” | P, I, G (prazno obavezno polje) | dijalog i povlačenje postoje (`work.return-for-revision.post`, `collaboration.revision-requests.post`, povlačenje ako je izloženo); skupno čitanje dorada po zadatku **nedostaje** |
| NF4-NZ13 | NZ-13 | `kolegiji`: „Kod za upis: vrijedi do {datum}”, „Opozovi kod” (`do2-h`), „Izdaj novi kod” s izborom roka (`dk-h`, `#f-kv`), „Kopiraj kod”, uputa „upišite kod na stranici Upis”, „Zapišite ga sada; poslije se vidi samo sažetak” | P, I (`kod`, `opozvan`), U, G | ne: `institution.enrollment-code-revocation.post`, `institution.enrollment-code.post` (`validUntil`); kod ne ide u CSV ni u obavijest |
| NF4-NZ14 | NZ-14 | novi ekran `tim`: uloge nositelj, suradnik, mentor s opisom ovlasti, „Dodaj nastavnika”, raspored po grupama; ulaz „Nastavni tim i grupe” s kartice kolegija | P, Pr, U, G, I (`dodan`) | ne: `institution.teaching-team.post`, `institution.course-group-teachers.post`; tko smije dodavati (A-5: ulogu daje administrator) treba potvrditi |
| NF4-NZ15 | NZ-15 | `novi-zadatak` i `uredi`: polje „Pitanje studentu uz izjavu (nije obavezno)”, granica `DECLARATION_QUESTION_MAX` (OD-4), pregled što student vidi | P, I (predugo pitanje) | **nedostaje**: polje u zadatku ili `declaration-v1` i odgovor u izjavi; nastavnički `declPanel` je dio 5 |
| NF4-NZ16 | NZ-16 | `izvoz`: izbornik s vrstom i „rok je prošao”, fokus na izborniku nakon promjene, banner „Datoteka sadrži imena studenata”, isti izvor iz `zbirni` (CSV ostaje 8 stupaca) | P, Pr, U, G, I (`priprema`, `spreman`, `izbor`) | poredak po prezimenu treba potvrditi; e2e pripreme i preuzimanja nije u prototipu |
| NF4-NZ17 | NZ-17 | novi elementi: `fieldset` i `legend`, razlozi preko `aria-describedby`, zaglavlja tablice s ulogama, ciljevi dodira 44 px, mjereno na 390 i 1280 px | sva | ne |
| NF4-NZ18 | NZ-18 | scenarij „puno” za nastavnika: prototip ima varijantu „puno” za svaki novi element; lažni poslužitelj (`teacher.access.get` i čitanja) je u `packages/` i ovdje nije dirnut | sva | test-fakes: **nije napravljeno u ovom zadatku** (traka `packages/`) |

Odluke ovog zadatka (Danielove, 23. 11. 2026.): (1) e-pošta ulazi u pilot uz DPIA, poruka bez naslova rada i bez rada, student se može odjaviti; (2) Asistent u pilotu radi, „samo sažimanje” je stvarna postavka; (3) zabranu predaje nakon roka nastavnik smije mijenjati i nakon objave, uz dijalog; (4) iznimka kasne predaje: varijante A i B, student vidi razlog ako ga nastavnik označi vidljivim; (5) produljenje se nudi i za zadatak s prošlim rokom; (6) nastavnik smije isključiti obaveznu izjavu po zadatku.

---

## 9. NF-5: nove stavke (23. 11. 2026.)

Zadatak `nf5-prototip-pregled-rada`, slot `claude:wnf5-proto:frontend`. Izvor: `docs/nalazi/nove-funkcije-5-nastavnik-pregled-rada.md` (PG-1 do PG-15) i Danielove odluke (doslovno: „Sve u pilotu 1. Ostaje u Merlinu 2. Smije ovo prov 3. Da 4. Smije vidjeti ritam pisanja po dijelu teksta 5. Smije s oznamaka podrijetla izvesti i ispisati”). Svih 15 prijedloga ulazi u pilot. U prototipu je element označen atributom `data-nf5="PG-n"`, a napomena „Poslužitelj:” (`.srv`) označava što poslužitelj danas nema; ne izmišlja se ni ruta ni polje. Novi ekran `pregled` (NF5-P „Pregled rada”) nastavlja se na NF-4; ulaz je poveznica „Pregled rada (jedno mjesto)” u zaglavlju ekrana `rad`. Pružatelj i model se ne imenuju: piše samo „Asistent” (Q-10 nije donesena); ista zamjena provedena je u sažetku, Brzom putu i radu (nalaz pregleda WEB #565).

Odluke ovog zadatka: (1) ocjena ostaje u Merlinu (PG-10 smjer a): pregled kaže „Ocjenu upisujete u Merlin”, Ductura ne bilježi ocjenu; (2) studentovo objašnjenje čita se uz nalaz, u istom prikazu kao student (PG-7); (3) pitanje nastavnika i odgovor studenta uz izjavu: SRV zadatak **SRV-IZJAVA-PITANJE** je otvoren, prototip ga prikazuje u kartici Izjava (PG-6); (4) ritam pisanja po dijelu teksta uz napomenu „zapis o unosu, ne o autorstvu” i stanje „ritam više nije dostupan (briše se 30 dana nakon predaje)”; (5) pregled s oznakama podrijetla i podudaranja smije se izvesti i ispisati, uz upozorenje „Datoteka sadrži tekst rada i ime studenta; čuvajte je prema pravilima fakulteta” i zapis izvoza u dnevnik pristupa. Nikakav automatski zaključak o autorstvu; uz svaki postotak stoji „nije dokaz autorstva”; oznake podrijetla su riječima, ne samo bojom.

Oznaka stanja: P puno, Pr prazno, U učitavanje, G greška, R ritam nedostupan, I ostala stanja iz varijanti prototipa (`dio-greska`, `bez-izjave`, `dorada`, `probni`, `izvoz-greska`).

| ID | PG | Ekran i element | Stanja | Serverska ovisnost |
|---|---|---|---|---|
| NF5-PG1 | PG-1 | `pregled`: zaglavlje s kolegijem, grupom, zadatkom, vrstom rada, rokom i stanjem; kartice (tablist) „Tekst · Sažetak · Podrijetlo · Reprodukcija · Usporedba · Izjava · Što je student dobio · Izvoz i ispis” koje čuvaju rad i odabranu karticu pri „Prethodni/Sljedeći rad”; „Natrag na zadatak” | P, Pr, U, G, I (`probni`) | ne za spoj preko `institution.assignment.get`; naziv zadatka i kolegij u `teacher.work.get` **nedostaju** (ne izmišlja se) |
| NF5-PG2 | PG-2 | kartica Podrijetlo: tekst rada s oznakama podrijetla uz boju i crtu (riječima: „zalijepljeno · izvor nije opažen”, „umetnuto iz Asistenta”), prekidač „Prikaži podrijetlo u tekstu”, „Sljedeće lijepljenje ili prijenos”, tablica „Odsječci teksta” kao alternativa, „Ductura ne zna tko je tipkao” | P, Pr, U, G, R | `work.origin-composition.get`, `work.input-rhythm.get` postoje; **raspon (početak i kraj) po izvoru po odlomku nedostaje**, odsječci nose približno vrijeme |
| NF5-PG3 | PG-3 | kartica Podrijetlo: „Sastav teksta” sa šest vrsta, uz svaku „Što znači” i „Što ne znači” i „nije dokaz autorstva” uz postotak; „Umetnuto iz Asistenta” odvojeno od „Podudara se”; sažetak „Kako čitati ovaj prikaz”; „Pragovi fakulteta nisu postavljeni” | P, Pr, G | ne, postoji (`work.origin-composition.get`, `work.origin-thresholds.get`) |
| NF5-PG4 | PG-4 | kartica Sažetak: „Asistent” (broj razgovora i prijenosa, bez pružatelja i modela), „Podudaranje s odgovorom Asistenta” s greškom jednog dijela i „Pokušaj ponovno”, „Pravila fakulteta: Trenutačno nije dostupno” uz razlog „poslužitelj ovaj dio ne daje”, „Ritam unosa” | P, Pr, U, G, R, I (`dio-greska`) | ne, postoji (`projection.process-summary.post`, `work.assistant-match.get`); pružatelj, model, svrha i preneseni tekst nisu dostupni i ne traže se |
| NF5-PG5 | PG-5 | kartica Reprodukcija: popis „Važna mjesta” (lijepljenje, prijenos iz Asistenta, praznina, predaja) sa „Skoči”, razmak pokreće ili zaustavlja, strelice mijenjaju promjenu, zadana brzina 1×, bez automatskog pokretanja, tajmer bez `aria-live`, „Najavi trenutačnu promjenu” | P, Pr, U, G, I (praznina) | popis iz sažetka i reprodukcije: ne, postoji (`evidence.replay.post`); **sesije u zapisu nedostaju** (D-239), skok na sesiju zamijenjen popisom |
| NF5-PG6 | PG-6 | kartica Izjava: obrazac fakulteta i verzija, „Zabilježeno u Ducturi”, „Izjava studenta” (vanjski alati, svrha, faza, `humanHelp {kind,text}`), „Pitanje nastavnika i odgovor studenta”, „Razgovori uz izjavu” s „Pregledaj razgovor” (`ch-h`), stanje „Izjava nije predana” | P, Pr, U, G, I (`bez-izjave`) | osnova postoji (`teacher.declaration.get`, `teacher.declaration-required.get`); **pitanje i odgovor: nedostaje** (zadatak SRV-IZJAVA-PITANJE otvoren, polje u declaration-v1) |
| NF5-PG7 | PG-7 | kartica Podrijetlo: „Nalazi i objašnjenja studenta”: uz svaki nalaz (nepoznato lijepljenje, podudaranje, praznina) studentovo objašnjenje raširen, „Student još nije dao objašnjenje.”, „Objašnjeno n od m nalaza”; nalaz se ne može označiti riješenim | P, Pr, G, I (`dio-greska`: dio nedostupan ne smije se čitati kao „nema podudaranja”) | čitanje objašnjenja **nedostaje** (postoje samo `work.assistant-match-explanation.post` i `work.event-disputes.get`); objašnjenje uz isti `segmentRef` u jednom čitanju treba novo polje |
| NF5-PG8 | PG-8 | zaglavlje `pregled`: jedan dijalog `dd-h` („Zatraži doradu”), banner dorade u četiri stanja, „Povuci zahtjev”, „Prihvati doradu”, „Ponovno otvori”, „Usporedi s predanom verzijom” | P, I (`dorada`), G (prazno obavezno polje) | ne, postoji (`work.return-for-revision.post`, `collaboration.revision-requests.post`); povlačenje samo ako je operacija izložena |
| NF5-PG9 | PG-9 | kartica „Što je student dobio”: jedan popis (komentar, konzultacija, dorada, nacrt) uz riječima „Student je vidio …”, „Student još nije otvorio”, „Nije objavljeno: student ga ne vidi” | P, Pr | osnova postoji (komentari, nacrti, dorada, konzultacije); **„student je vidio” nedostaje** |
| NF5-PG10 | PG-10 | zaglavlje `pregled`: „Ocjenu upisujete u Merlin”, „nijedna oznaka ne ulazi u ocjenu ni u izvoz”; probni zadatak: „Probni zadatak se ne ocjenjuje i ne izvozi” | P, I (`probni`) | ne (smjer a); `teacher.assignment-grade.get` samo kaže smije li se ocjenjivati; upis ocjene ne postoji i ne gradi se |
| NF5-PG11 | PG-11 | kartica „Izvoz i ispis”: „Izvezi PDF rada”, „Izvezi sažetak procesa”, „Izvezi pregled s oznakama”, „Ispiši pregled”; upozorenje o tekstu rada i imenu studenta; „Dnevnik pristupa (izvoz)”; stanja priprema, spremno, greška; probni zadatak bez izvoza; ispis (`@media print`) sa zaglavljem, tekstom s oznakama, sastavom, sažetkom, izjavom i napomenom | P, Pr, U (priprema), G (`izvoz-greska`), I (`probni`) | PDF rada postoji (`work.export-pdf.get`); **PDF sažetka i pregleda s oznakama nedostaje**; ispis iz preglednika ne traži poslužitelj; zapis izvoza u dnevnik pristupa treba potvrditi |
| NF5-PG12 | PG-12 | tablice sastava i odsječaka postaju kartice ispod 760 px (`data-label`), kartice pogleda prelamaju redak, kontrole 44 px; mjereno na 390 px | sva | ne; `mobile-review/` u hostu nije dirnut |
| NF5-PG13 | PG-13 | `role=tablist` sa strelicama, Home i End; tablice s `caption` i `scope`; oznake podrijetla riječima; `aria-live` samo na zahtjev (`#pg-live`); dijalozi `dd-h` i `ch-h` vraćaju fokus; axe (WCAG 2 A/AA, 2.1 AA, najbolje prakse) bez pogrešaka na 390 i 1280 px, svijetla i tamna tema | sva | ne; e2e s axe u hostu nije u ovom zadatku |
| NF5-PG14 | PG-14 | svi novi tekstovi kroz skener zabranjenih izraza; „dokaz autorstva” samo u negaciji („nije dokaz autorstva”); bez „plagijat”, „varanje”, „sumnjivo”, „provjera AI-ja” | sva | ne |
| NF5-PG15 | PG-15 | varijanta „puno” svakog novog elementa (izmišljeni podaci: Student A, Kolegij A); lažni poslužitelj (`teacher.access.get`, `teacher.work.get`, `teacher.declaration.get`, sastav, nalazi, reprodukcija, objašnjenja) je u `packages/test-fakes` i ovdje **nije dirnut** | sva | test-fakes: **nije napravljeno u ovom zadatku** (traka `packages/`) |
