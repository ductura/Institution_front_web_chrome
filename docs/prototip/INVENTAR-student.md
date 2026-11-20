# Inventar studentskog prototipa Ducture

Izrađeno 19. 11. 2026. na zadatak orkestratora, prema Danielovoj odluci od istog dana: „Isto tako, identično funkcionalno sa svim ekranima i prozorima za studente”.

Izvori, svi samo čitani:
- prototip `D:\Ductura\_prototipovi\Ductura_student.html` (1302 retka s ugrađenim JS-om);
- kartice `Ductura_student_kartice.html` (polazište, provjereno prema kodu);
- web `D:\Ductura\Institution_front_web_chrome`:
  - `origin/main` 92701ac (Vite `packages/app`, `packages/ui`);
  - `origin/migracija/kopija-ductus-front` 761fc42 (doslovna Next.js kopija Ductus fronta);
- server `D:\Ductura\Institution_server` na `origin/migracija/kopija-ductus-backend` 2bc805e:
  - `server/contracts/routes/*`;
  - `server/contracts/inventory.ts` (`CONTRACT_ONLY`, `SERVER_SOURCES`);
  - `server/server.ts` (rute koje se doista montiraju).

Traka prototipa `#proto-bar` (`#proto-view`, `#proto-variant`, gumb teme, `#proto-reset`) služi samo za pregled stanja. Nije dio proizvoda i ne inventarizira se. Stanja koja ona bira („varijante”) jesu dio proizvoda i navedena su uz svaki ekran.

Oznake u ovom dokumentu:
- E-n je ekran;
- PD-n je prozor ili dijalog;
- R-n je radnja;
- PO-n je podatak;
- V-n je val.

---

## 1. Ekrani

Prototip registrira 11 ekrana kroz `App.register(name, def)` s hash usmjeravanjem (`#prijava`, `#pocetna` …). Uz njih je zajednička ljuska (E-0). Ukupno ima 12 jedinica i 71 imenovano stanje.

### E-0 Ljuska (`shell:'side'`)

- **Bočna traka** od 64 px (D-202). Logotip vodi na `#pocetna`.
- **Navigacija `NAV`**, pet stavki:
  - `pocetna` „Moji zadaci”;
  - `kolegiji` „Moji kolegiji”;
  - `radovi` „Moji radovi”;
  - `rad` „Radni prostor”;
  - `upis` „Upis u kolegij”.
  - Aktivna stavka ima `aria-current="page"`.
- **Podnožje trake:**
  - gumb teme ◐ s `aria-label` „Promijeni svijetlu ili tamnu temu” (`data-core="theme"`);
  - „Odjava” (`data-core="logout"`).
- **Ispod 800 px** pojavljuje se gornja traka s gumbom „Izbornik” (`data-core="menu"`, `aria-expanded`). Gumb otvara `.side[data-open]`.
- **Sadržaj** je `main#sadrzaj` s `tabindex=-1`. Uske stranice (upis, obavijest) imaju varijantu `.narrow` širine 640 px.
- **Obavijest** `#toast` ima `role=status` i nestaje nakon 3,2 s (`App.toast`).
- **Tema:**
  - tema aplikacije je `data-theme` na `<html>`;
  - tema lista je zasebna, `.sheet[data-sheet-theme]` (`state.sheetTheme`).
- Ekrani `prijava` i `rad` nemaju ljusku (`shell:'none'`).

### E-1 Prijava (`prijava`, S-01)

Varijante: `zadano`, `preusmjeravanje`, `greska`, `nedostupno`, `bezuloge`, `pomoc`.

**Okvir stranice** `.pj-page`:
- gornja traka „Ductura” i poveznica „Na naslovnicu” (`data-act=naslovnica`);
- lijevi stupac:
  - nadnaslov „Vaš akademski prostor”;
  - h1 „Dobro došli u svoj *prostor.*”;
  - uvod „Jedan ulaz za studente i nastavnike. Pisanje, povratna informacija i razgovor o radu.”;
  - ukrasni `.pj-paper` (`aria-hidden`);
- podnožje „Identitet AAI@EduHr · pristup prema dodijeljenoj ulozi”.

**Kartica, stanje `zadano`** (`aria-labelledby=pj-c`):
- nadnaslov „Prijava”, h2 `#pj-c` „Vaš akademski *identitet.*”;
- napomena o istom identitetu kao za Studomat i Merlin;
- gumb „Prijava sustavom AAI@EduHr” (`data-act=prijava`) i ispod njega „Lozinku upisujete samo kod AAI@EduHr.”;
- redak „Jedan ulaz. Vaš prostor.” („…Ulogu nastavnika potvrđuje administrator fakulteta.”);
- `details` „Prvi dolazak ili imate kod zadatka?”, otvoren. Tekst: kod se upisuje nakon prijave.
- `details` „Trebate pomoć?” (funkcija `help(open)`), s dva retka:
  - „Ne možete se prijaviti računom AAI@EduHr?” uz poveznicu „Službena pomoć AAI@EduHr” (`data-act=pomoc-aai`);
  - „Prijava je uspjela, ali nemate pristup?” s tekstom „Javite se koordinatoru na svojoj ustanovi.”

**Kartica, ostala stanja:**
- **`pomoc`:** pomoć otvorena, prvi `details` zatvoren.
- **`preusmjeravanje`** (`role=status`):
  - h2 „Preusmjeravamo Vas na AAI@EduHr”;
  - animirana traka `.pj-bar`;
  - gumb onemogućen.
- **`greska`** (`role=alert`):
  - „Prijava nije dovršena”, s uputom da se pokuša ponovno, a ako se ponovi, da se javi koordinatoru;
  - gumb „Pokušaj ponovno” i poveznica „Na početnu” (oboje `data-act=ponovno`).
- **`nedostupno`:**
  - „Prijava preko AAI@EduHr trenutačno ne odgovara. Pokušajte ponovno za nekoliko minuta.”;
  - gumb „Pokušaj ponovno”.
- **`bezuloge`** (`role=status`):
  - „Prijava je uspjela”;
  - „Ovaj račun još nema dodijeljenu ulogu, pa se Vaš prostor ne može otvoriti.”;
  - „Javite se koordinatoru…”;
  - sekundarni gumb „Odjava” (`data-act=ponovno`).

### E-2 Početna, „Moji zadaci” (`pocetna`, S-02)

Varijante: `puno`, `prazno`, `kolegijbeztaska`, `ucitavanje`, `greska`.

- **Zaglavlje:** nadnaslov s današnjim datumom, h1 „Vaš studentski *prostor*”, uvod „Zadaci na kolegijima.”
- **`puno`**, tri dijela:
  1. **Kartica „nastavak rada”** `.po-continue` (`aria-labelledby=po-n`). Prikazuje prvi zadatak koji je započet, nije predan i ima potvrđenu obavijest:
     - nadnaslov vrsta · kolegij, zatim naslov;
     - meta „Rad je započet, nije predan · Rok: …”;
     - gumb „Otvori rad”.
  2. **Odjeljak „Moji zadaci”** `#po-h`: ravni popis svih vidljivih zadataka s nadnaslovom kolegija. Retke crta funkcija `task()`.
  3. **Kartica `codeCard()`** `#po-k` „Imate kod novog kolegija?” s obrascem `codeForm()`.
- **`prazno`** (`noCourses()`):
  - „Još nemate kolegija.” i „Ovdje će se prikazati Vaši kolegiji i njihovi zadaci.”;
  - h3 „Imate kod kolegija?” s obrascem;
  - h3 „Što slijedi nakon upisa?” s tri koraka, svaki s kratkim tekstom: Odaberite zadatak, Pročitajte upute, Otvorite rad.
- **`kolegijbeztaska`:** kartica Kolegija A s porukom „U ovom kolegiju zasad nema zadatka.” i `codeCard()`.
- **`ucitavanje`:** kostur (`loading()`, `aria-busy`, `role=status`).
- **`greska`** (`error()`, `role=alert`):
  - „Prikaz trenutačno nije dostupan.”;
  - „Podatke nije bilo moguće učitati. To ne znači da nema kolegija ili radova.”;
  - gumb „Pokušaj ponovno” (`data-act=ponovno`).

**Redak zadatka** `li.item.po-task`, zajednički za E-2, E-3 i E-4:
- Vrsta retka (`kind(t,s)`), redom provjere:
  - `predano` ako je rad predan;
  - `obavijest` ako obavijest nije potvrđena;
  - `rad` ako je rad započet;
  - inače `zadatak`.
- Gumb retka (`btn()`), uvijek `data-act=otvori data-id`:
  - predano: sekundarni „Otvori rad”;
  - obavijest: sekundarni „Pročitaj upute”;
  - rad: primarni „Otvori rad”;
  - zadatak: primarni „Otvori zadatak”.
- Redak datuma (`when()`):
  - „Predano {vrijeme}”, ili
  - „Rok: {rok}”, uz oznaku `.tag.near` (npr. „Rok za 3 dana”) i uz `.tag.open` „Prvo pročitajte obavijest”.

**Obrazac koda** `codeForm()`:
- `form.po-code` s `data-submit=kod` i `novalidate`;
- polje `.input.code name=kod`:
  - `aria-label` „Kod kolegija”;
  - placeholder „KOD-KOLEGIJA”;
  - `autocapitalize=characters`;
- gumb „Upiši”.

### E-3 Moji kolegiji (`kolegiji`, S-03)

Varijante: `puno`, `jedan`, `prazno`, `ucitavanje`, `greska`, `istekla`.

- **Zaglavlje:** h1 „Moji kolegiji”, uvod „Kolegiji na koje ste upisani i njihovi zadaci.”
- **`puno`:** kartice po kolegiju (`groups()` grupira vidljive zadatke, `courseCard()` ih crta). Svaka kartica ima:
  - nadnaslov „Kolegij · 2026./27.” i h2 s imenom;
  - oznake seminarskih grupa (Kolegij A: „Seminarska grupa 2”, „Seminarska grupa 4”);
  - popis zadataka kolegija.
- **`jedan`:** samo jedna kartica.
- **`prazno`:** „Zasad niste upisani ni u jedan kolegij.” i gumb „Upiši kolegij kodom” (`data-act=upis`).
- **`istekla`:**
  - „Prijava nije valjana. Prijavite se ponovno.”;
  - gumb „Prijava sustavom AAI@EduHr” (`data-act=aai`).
- **`ucitavanje`** i **`greska`:** kao na E-2.

### E-4 Moji radovi (`radovi`)

Varijante: `puno`, `prazno`, `ucitavanje`, `greska`.

- **Zaglavlje:** h1 „Moji radovi”, uvod „Vaši radovi na svim kolegijima i njihovo stanje.”
- **`puno`:** popis s `aria-label` „Popis radova”.
  - Stanje svakog rada daje `stateText()`, jedno od:
    - „Predano X”;
    - „Upute još nisu potvrđene”;
    - „Rad je započet, nije predan”;
    - „Rad nije započet”.
  - Rad koji nije predan dobiva i „Rok …”.
- **`prazno`:**
  - „Još nemate radova.”;
  - „Radovi se ovdje prikazuju kad se upišete u kolegij sa zadatkom.”;
  - gumb „Upiši kolegij kodom”.
- **`ucitavanje`** i **`greska`:** kao na E-2.

### E-5 Upis kodom (`upis`, S-04, uska)

Varijante: `puno`, `upisivanje`, `neispravan`, `istekao`, `vecupisan`, `mreza`, `bezzadatka`.

**Obrazac** (h1 `#up-h` „Upiši kolegij”, `data-submit=upisi`):
- oznaka „Kod kolegija”;
- polje `#up-kod`:
  - `autocomplete=off`, `spellcheck=false`;
  - `aria-describedby` je „up-uputa”, a uz grešku i „up-greska”;
  - `aria-invalid` se postavlja za svaku grešku osim `mreza`;
- uputa `#up-uputa`: „Kod Vam daje nastavnik. Razmaci, crtice i velika ili mala slova nisu bitni.”;
- pomoćni redak sa uzorkom koda postoji samo u prototipu.

**Greška** `#up-greska` (`role=alert`), tekstovi iz `MSG`:
- `neispravan`: „Kod ima od 8 do 32 slova i brojke. Provjerite ga i upišite ponovno.”;
- `istekao`: „Kod ne postoji ili je istekao. Provjerite ga s nastavnikom.”;
- `mreza`: „Nema veze s poslužiteljem. Provjerite mrežu i pokušajte ponovno.”

**Ostala stanja:**
- **`upisivanje`:**
  - polje je `readonly`;
  - gumb ima `aria-disabled` i tekst „Upisivanje…”;
  - status „Upisivanje u kolegij…”.
- **`vecupisan`:** „Već ste upisani u ovaj kolegij.” i gumb „Otvori zadatak” (`data-act=otvori`).
- **`bezzadatka`:**
  - „Upisani ste u kolegij, ali u njemu zasad nema otvorenog zadatka. Kad ga nastavnik objavi, vratite se na ovu stranicu.”;
  - poveznica „Upiši drugi kolegij” (`data-act=drugi`).

### E-6 Obavijest o zadatku (`obavijest`, S-05, uska)

Varijante: `puno`, `neprocitano`, `ucitavanje`, `greska`, `nijeotvoren`, `potvrdeno`, `promijenjeno`, `bezprava`.

**Poveznica natrag `BACK`:** „Moji kolegiji i zadaci” vodi na E-3.

**Zaglavlje `hero()`:** nadnaslov „Prije pisanja”, h1 „Prije prve *rečenice*”.

**Tijelo `notice(t)`:**
1. Nadnaslov kolegija, h2 `#up-h2` s naslovom zadatka i „Rok: …”.
2. Opis zadatka (`DESC[t.id]` ili zadani tekst).
3. h3 „Uporaba alata u ovom zadatku (FPZG čl. 8)”, s metom „Pravilo je postavio nastavnik kolegija (Mentor). Razlikuje se od pravila fakulteta.”
   - h4 „Dopušteno u ovom zadatku”: popis `TOOLS_OK` sa ✓, zatim uvjet `CONDITION` („2) U svim navedenim slučajevima…”);
   - h4 „Nije dopušteno”: `TOOLS_NO` i `BANNED` s ×.
4. `details` „Pravilo fakulteta (FPZG čl. 8)” s `FAC_OK` i `BANNED`. Izvor: Smjernice FPZG od 21. 5. 2026., čl. 8.
5. Tri stupca `.up-cols`:
   - **„Što se bilježi”**, četiri stavke:
     - odsječci od 30 s s vremenom zaokruženim na minutu;
     - svaka izmjena, znak po znak, s oznakom načina unosa („Oznaka govori samo kako je tekst ušao u uređivač, ne tko ga je napisao”);
     - ulančani otisak kod svakog spremanja;
     - verzije, predaja i napomene.
   - **„Što se ne bilježi”:**
     - tipke i koliko su dugo pritisnute;
     - mjere brzine i ritma (osim sesija po P-01), a reprodukcija ne preskače stanke;
     - druge aplikacije, kamera, mikrofon i zaslon;
     - IP adresa i podaci o uređaju.
   - **„Što vidi nastavnik (mentor)”:**
     - pogled uživo od prvog dana;
     - reprodukcija;
     - usporedba dviju poslanih verzija, nikad za ocjenu;
     - povijest verzija i sažetak procesa;
     - radne bilješke mentora: student ih ne vidi u aplikaciji, ali ih može zatražiti pravom na pristup; objave ocjena zasad nema.
6. Napomena „Ductura ne procjenjuje autorstvo ni korištenje AI-ja.”
7. Meta o čuvanju: zapis se čuva do roka čuvanja fakulteta, a napomene se samo dodaju.

**Stanje `puno` / `neprocitano`** (obavijest nije potvrđena):
- potvrdni okvir `#up-ack` „Pročitao/la sam obavijest. Znam što se bilježi i što vidi nastavnik (mentor).”;
- gumb `#up-potvrdi` „Potvrdi i otvori editor” (`data-act=potvrdi`), s `aria-disabled` dok okvir nije označen;
- meta „Potvrda nije privola. Prije potvrde ništa se ne šalje na poslužitelj.”

**Stanje `potvrdeno`:**
- nadnaslov „Obavijest o zadatku”, h1 „Pročitana *obavijest*”;
- središnja kartica s kolegijem i naslovom;
- `.ok` „Potvrđeno {ackAt}. Zapis počinje s prvom izmjenom.”;
- gumb „Otvori rad” (`data-act=otvoriRad`);
- `details` „Prikaži obavijest” sa cijelim tijelom.

**Ostala stanja:**
- **`ucitavanje`:** „Učitavanje zadatka…” i kostur.
- **`greska`:** „Zadatak trenutačno nije moguće učitati. Pokušajte ponovno.” i gumb za ponovni pokušaj.
- **`nijeotvoren`:** „Zadatak se otvara 10. 11. 2026., 8:00. Obavijest potvrđujete kad se zadatak otvori.”
- **`promijenjeno`:**
  - oznaka „Nova verzija uputa (v2), još nije potvrđena”;
  - upozorenje „Nastavnik je u međuvremenu objavio novu verziju zadatka. Ponovno učitajte stranicu i pročitajte je.”;
  - gumb „Ponovno učitaj”.
- **`bezprava`:** `.err` „Ovaj račun ne može potvrditi obavijest za ovaj zadatak.” i poveznica natrag.

### E-7 Radni prostor (`rad`, bez ljuske)

Prototip ovdje sam kaže: „uređivač je ovdje samo zamjena; stvarni uređivač već postoji u proizvodu”. Funkcije samog uređivača pripadaju inventaru uređivača. Ovdje je samo okvir.

Varijante: `puno`, `prazno` (novi rad), `ucitavanje`, `greska`, `bez-mreze`, `predano` (samo čitanje).

**Gornja traka `.ed-top`:**
- poveznica „← Moji zadaci” (na E-2);
- naslov i redak „kolegij · vrsta · rok …”;
- gumb lista „Bijeli list” / „Tamni list” (`data-act=sheet`, `aria-pressed`);
- „Predaja rada” (`data-act=review`):
  - vodi na E-9 Izjava (korak 2);
  - skriven kad je rad samo za čitanje;
  - `aria-disabled` u stanjima `ucitavanje` i `greska`.

**List** `article.sheet.ed-sheet`:
- `aria-label` „Tekst rada”, `contenteditable`, `role=textbox`, `aria-multiline`;
- samo za čitanje uz `aria-readonly` kad je rad predan;
- uzorak `BODY` sadrži:
  - naslove;
  - citat `.ed-cite`;
  - fusnotu `sup`;
  - blok-citat;
  - oznaku komentara mentora `.ed-mark` („Komentar mentora”);
  - otvoreno mjesto za izvor `.ed-open`;
  - bilješke `.ed-notes`;
- uzorak `EMPTY` ima placeholder „Počnite pisati…”.

**Trake obavijesti:**
- **`predano`:** „Predano X. Rad je predan, pa se ovdje više ne može pisati.”
- **`bez-mreze`:** „Bez mreže. Tekst se i dalje sprema na ovom uređaju i čeka slanje na poslužitelj kad se veza vrati.”
- **`greska`:** „Rad trenutačno nije moguće otvoriti. Tekst spremljen na ovom uređaju ostaje netaknut.” i gumb za ponovni pokušaj.

**Podnožje `.ed-status`** (`aria-label` „Stanje rada”):
- **Stanje spremanja** `[data-save]` (`role=status`, `aria-live=polite`), jedno od:
  - „Učitavanje…”;
  - „Greška pri otvaranju”;
  - „Predano X”;
  - „Spremljeno na uređaju · čeka slanje”, uz `.ed-net` „Bez mreže”;
  - „Novi rad, još ništa nije upisano”;
  - „Spremljeno na poslužitelju u 21:02”.
- **Broj riječi** `[data-words]`:
  - `wordLabel(n)` + „ · opseg 1.200 do 1.600 · vidite samo Vi”;
  - `words()` ne broji `.ed-notes`;
  - tisućice se odvajaju točkom.

### E-8 Prije predaje (`pregled`, S-30, korak 3)

Varijante: `puno`, `zatvoreno`, `bezmreze`, `predano`, `prazno`, `ucitavanje`, `greska`.

**Zajedničko za E-8 do E-11:**
- ljepljiva traka `bar()`:
  - gumb „Natrag na rad”;
  - put „**Kolegij** · naslov · oznaka”;
- koraci `steps(cur)`: `ol.sb-steps` s `aria-label` „Koraci predaje”:
  - 1 Tekst, 2 Izjava, 3 Prije predaje, 4 Predaja, 5 Potvrda;
  - tekući korak ima `aria-current=step`;
- ploče `panel(id, title, tag, body, extra, h)` u rasporedu u dva stupca `sb-two`.

**Stanje `puno`:**
- uvod „Popis pokazuje je li sve priloženo. Ne ocjenjuje rad.”;
- retci provjere:
  1. „Izjava”: „Potvrđena” ili „Još nije potvrđena.” uz poveznicu „Otvori izjavu”.
  2. „Razgovori uz izjavu”: „Priloženo 2”.
  3. „Mjesta za izvor koja ste ostavili u tekstu”: dvije poveznice na mjesta ili „Nema otvorenih mjesta za izvor.”
  4. „Zalijepljeno (izvor nije opažen)”: poveznica i „Možete dodati oznaku podrijetla. Nije obavezno.”, ili „Oznaka podrijetla dodana uz sva zalijepljena mjesta.”
  5. „Pravila oblika”: „Provjera oblika još nije pokrenuta.”
- poveznica „Dodaj napomenu (nije obavezna)” (`data-act=noteOpen`);
- gumbi „Dalje” (na E-10) i „Natrag” (na E-9);
- desni stupac: ploča sažetka procesa (PD-1) s prazninama.

**Ostala stanja:**
- **`bezmreze`:**
  - `#sb-off` „Nema veze s poslužiteljem. Predaja traži vezu; tekst je spremljen na uređaju i šalje se čim se veza vrati.”;
  - oznaka ploče „Bez veze”.
- **`zatvoreno`:** rad još nije započet. „Rad još nije započet. Započnite ga u radnom prostoru.” i gumb „Otvori radni prostor”.
- **`predano`:** „Predaja ovog rada već je zatražena X.” i gumb „Otvori potvrdu o predaji”.
- **`prazno`:** nema praznina ni otvorenih mjesta.
- **`ucitavanje`:** „Učitavam stanje rada s poslužitelja.”
- **`greska`:** „Stanje rada trenutačno nije moguće učitati, pa se ne vidi je li rad predan… ako je predaja zabilježena, ovdje će stajati potvrda.”

### E-9 Izjava (`izjava`, S-31, korak 2)

Varijante: `puno`, `nesklad`, `prazno`, `ucitavanje`, `greska`.

**Stanje `puno`** (`declPanel`):
- h1 „Izjava o korištenju generativne umjetne inteligencije”, meta „po čl. 9 i 15 pravilnika fakulteta”.
- **Blok „Zabilježeno u Ducturi”** (oznaka „zabilježeno”), dvije stavke:
  - prijenos 28. 10. u 10:05 iz modela M-2 u „2. Teorijski okvir, odlomak 1”;
  - razgovor bez prijenosa 31. 10.;
  - poveznica „Dodaj objašnjenje” (`data-act=todo`).
- **Blok „Vaša izjava”** (oznaka „izjavljeno”):
  - četiri retka: Vanjski alati, Svrha, Faza rada, Ljudska pomoć;
  - poveznica „Uredi izjavu” (`data-act=todo`).
- **h3 „Prilozi”:** „Uz izjavu se prilaže cijeli razgovor, točno kako je zabilježen. Pregledajte ga prije potvrde.”
  - Razgovor 1 · 28. 10. 2026., s napomenom „Obvezno: iz ovog razgovora prenesen je tekst.”, gumb „Pregledaj razgovor” (`data-act=chat data-n=1`);
  - Razgovor 2, gumb „Pregledaj razgovor” (`data-n=2`).
- **h3 „Pitanje nastavnika”:**
  - „Kako ste provjerili sažetke literature koje ste dobili?”;
  - polje `#sb-ans` „Odgovor (nije obavezan)”, sprema se u `S().form`.
- **Potvrda `checkbox(c)`:**
  - potvrdni okvir `#sb-confirm` „Potvrđujem izjavu”;
  - dok nije označen, prikazuje se `#sb-why-d` „Dalje je moguće kad potvrdite izjavu.”;
  - „Dalje” (na E-8) ima `aria-disabled` dok okvir nije označen;
  - „Natrag” vodi na E-7.

**Ostala stanja:**
- **`nesklad`:**
  - izbornik `#sb-form` „Obrazac izjave” s dvije opcije: „…nisam koristio ni koristila” i „…koristio sam ili koristila uz izjavu”;
  - status „Zapis bilježi prijenos iz AI pomoćnika na 2. Teorijski okvir, odlomak 1. Provjerite odabrani obrazac.”
- **`prazno`:**
  - „U ovom radu nije zabilježen razgovor s AI pomoćnikom.”;
  - „Izjava još nije ispunjena.” uz poveznicu „Ispuni izjavu”;
  - „Nema razgovora za prilaganje.”;
  - gumb „Natrag”.
- **Rad predan:** „…Izjava je predana s radom i više se ne mijenja.”
- **Rad nije započet:** ploča „nije započet” kao na E-8.
- **`ucitavanje`:** „Učitavam zabilježene stavke i priloge.”
- **`greska`:** „Zabilježene stavke trenutačno nije moguće učitati. Izjavu zato još nije moguće potvrditi.”

### E-10 Predaja (`predaja`, S-31, korak 4)

Varijante: `puno`, `nakonroka`, `produljen`, `bezmreze`, `utijeku`, `odbijeno`, `nedovrseno`, `nepoznato`, `ucitavanje`, `greska`.

**Ploča `submitPanel`**, h1 „Predati rad?”:
- **Uobičajeni sadržaj:**
  - Rok;
  - „Riječi u predanom tekstu 5.120”;
  - „Razgovori uz izjavu 2”;
  - „Vrijeme predaje je trenutak kad zahtjev za predaju stigne na poslužitelj, ne trenutak klika. Nakon predaje tekst ovog rada više nije moguće mijenjati.”
- **`nakonroka`** (`isLate` prema `SERVER_NOW`): „Rok je bio X… Predaja će biti označena kao predaja nakon roka.”
- **`produljen`:** oznaka „Rok produljen do 15. 11. 2026.” i „Rok je produljen do 15. 11. 2026. u 23:59.”
- **`bezmreze`** (varijanta ili `navigator.onLine===false`): oznaka „Bez veze” i razlog `#sb-why`.
- **Izjava nije potvrđena:** „Predaja je moguća kad potvrdite izjavu.” i poveznica „Otvori izjavu”.
- **`utijeku`:** vrtuljak „Predaja u tijeku…”.
- **Gumbi:**
  - „Predaj rad” (`data-act=ask`); kad je onemogućen, ima `aria-disabled` i `aria-describedby=sb-why`;
  - „Natrag” (na E-8).
- **`odbijeno`:**
  - „Poslužitelj još nije potvrdio cijeli zapis ove verzije teksta. Ostavite radni prostor otvoren s vezom; predaju možete pokušati čim se stanje u radnom prostoru promijeni u „spremljeno na poslužitelju”.”;
  - „Rad nije predan. Tekst je spremljen na uređaju.”;
  - poveznica na radni prostor.
- **`nedovrseno`:**
  - naslov „Predaja nije dovršena: zamjenski postupak”;
  - tekst iz zapisa ne podudara se s tekstom na poslužitelju;
  - vrijeme zahtjeva (X) je zabilježeno i ostaje vrijeme predaje;
  - „Obratite se nastavniku kolegija.”
- **`nepoznato`:**
  - „Predaja ovog rada već je zatražena X.”;
  - upozorenje „Potvrda nije stigla, pa ishod predaje nije poznat. Prije ponovnog pokušaja otvorite ovu stranicu ponovno…”;
  - gumb „Provjeri stanje predaje” (`data-act=check`).
- **`ucitavanje`** i **`greska`:** u istom obrascu kao E-8.

### E-11 Potvrda o predaji (`potvrda`, S-32, korak 5)

Varijante: `puno`, `ceka`, `nakonroka`, `praznine`, `prazno`, `ucitavanje`, `greska`.

**Stanje `puno`:**
- naslov „Predano X” (uz „, nakon roka” kad je rad predan nakon roka);
- retci:
  - „Vrijeme predaje” u zoni, „(UTC+1/2)” prema `zoned()`;
  - „Rok”;
  - „Potpisivanje potvrde započelo”;
- `details` „Točne vrijednosti iz potvrde (UTC)”: `requestedAt`, `dueAt`, `signedAt` (ISO s mikrosekundama);
- h3 „Otisak predanog teksta”:
  - 64 heksadekadska znaka u skupinama po 4 (`hex()`);
  - meta „Niz znakova izračunan iz točnog predanog teksta. Ako se tekst promijeni i za jedan znak, otisak više nije isti.”;
  - gumb „Kopiraj otisak” (`data-act=copy`);
- uz praznine: „Zapis ima praznine.”;
- poveznica „Otvori sažetak procesa” (`data-act=sum`, `aria-expanded`, `aria-controls=sb-sum-h`);
- „Potpis potvrde provjerava se na stranici Provjera potvrde, bez prijave.” i poveznica „Provjera potvrde” (`data-act=verify`);
- QR uzorak `qr()`, meta „QR kod je u preuzetom zapisu. Ovdje je samo uzorak bez sadržaja.”;
- poveznica „Preuzmi zapis (PDF s QR kodom)” (`data-act=pdf`);
- gumb „Na početnu”.

**Ostala stanja:**
- **`ceka`:**
  - naslov „Predaja u obradi”;
  - „Predaja je zabilježena X. Potpis potvrde još se izdaje; vrijeme predaje se time ne mijenja.”;
  - Vrijeme predaje i Rok;
  - „Potpisivanje potvrde započelo: još nije zabilježeno”.
- **`nakonroka`:** vrijeme predaje = rok + 13 min, potpis + 1 min.
- **`praznine`:** isto kao `puno`, uz praznine.
- **`prazno`:** „Ovaj rad još nije predan, pa potvrde nema.”
- **`ucitavanje`:** „Učitavam potvrdu s poslužitelja.”
- **`greska`:** „Potvrdu trenutačno nije moguće učitati. Ako je rad predan, predaja i vrijeme predaje time se ne mijenjaju.”

---

## 2. Prozori i dijalozi

Prozora je ukupno 8: dva modalna dijaloga (PD-2, PD-3) i šest ugrađenih ploča i otvaranja.

### PD-1 Ploča „Sažetak procesa” (`summary(task, o)`, S-33)

Ista je za studenta i nastavnika (PRODUCT §5 pravilo 5). Prikazuje se na E-8 (desni stupac) i na E-11 (otvara se R-34).

- **Prije predaje:** „Rad još nije predan. Sažetak se dopunjuje dok pišete; nastavnik ga može otvoriti u svakom trenutku.”
- **Odjeljci**, svaki s oznakom „opaženo” ili `.tag.open` „izjavljeno”:
  1. **Razdoblje rada:** prvi i zadnji zabilježeni događaj, ili „Do sada”.
  2. **Sesije:** „6 sesija”, meta o P-01 (praznina od 30 min; „Raspon praznine nije uračunat.”) i `details` „Popis sesija” sa šest raspona.
  3. **Aktivno vrijeme uređivanja:** „Zbroj trajanja 6 sesija 8 h 05 min” i napomena „Vrijeme uređivanja nije mjera truda ni vremena razmišljanja.”
  4. **Verzije:** „poslano na pregled” i „predano”.
  5. **Lijepljenja:**
     - stavka s datumom i 640 znakova, „Izvor nije opažen.”;
     - poveznica „Prikaži mjesto u radu”;
     - meta o P-02 (prag od 200 znakova; „Bez zbroja i bez udjela u radu.”).
  6. **AI pomoćnik:**
     - stavka s datumom, Pružateljem A, modelom M-2, svrhom i 96 znakova, uz citat i poveznicu na mjesto;
     - meta „Razgovori se nastavniku prikazuju samo kao prilog izjavi.”
  7. **Praznine u zapisu:** opis praznine ili „Zapis nema praznina.” Prije predaje dodaje se meta „Uz prazninu možete dodati napomenu…”
  8. **Izjava o korištenju generativne umjetne inteligencije:**
     - „Potvrđena X · po čl. 9 i 15”;
     - blok „Zabilježeno u Ducturi” i blok „Izjava studenta”;
     - ili „Izjava još nije potvrđena. Potvrđujete je u koracima predaje.”
  9. **Napomene studenta** `#sb-notes`: popis ili „Nema napomena.”, i obrazac PD-4.
  10. **Stanje zapisa:**
      - „Zapis ima praznine (vidi popis).” ili „Zapis je cjelovit.”;
      - uz predani rad i „Zapis je neizmijenjen od primitka na poslužitelj.”
  11. **Karta podrijetla:** poveznica „Prikaži oznake u tekstu”.

### PD-2 Dijalog „Razgovor N” (`dialog:'chat'`, na E-9)

- Atributi: `role=dialog`, `aria-modal=true`, `aria-labelledby=sb-dlg-h`.
- h2 „Razgovor N · datum”, meta „Točno kako je zabilježen i kako će ga vidjeti nastavnik.”
- Unosi:
  - „Vi · 10:01”;
  - „AI pomoćnik, model M-2 · 10:02”;
  - „Prijenos u tekst · 10:05”.
- Gumb „Zatvori” (`data-act=close`).
- Zastor (scrim) zatvara dijalog (`data-act=close`).
- `trapDialog`:
  - fokus ide na prvi omogućeni gumb;
  - Escape zatvara;
  - Tab i Shift+Tab kruže unutar dijaloga;
  - pri zatvaranju fokus se vraća na gumb koji je dijalog otvorio.
- Postoje dvije instance, n=1 i n=2.

### PD-3 Dijalog „Predati rad?” (`dialog:'submit'`, na E-10)

- Otvara ga R-28 (`ask`).
- h2 „Predati rad?”;
- „Predaje se tekst rada „naslov” spremljen na poslužitelju, s izjavom i dva priložena razgovora.”;
- „Nakon predaje tekst ovog rada više nije moguće mijenjati.”
- Gumbi:
  - „Predaj rad” (`data-act=submit`);
  - „Natrag” (zatvara).
- Za vrijeme slanja (`sending`):
  - oba gumba imaju `aria-disabled`;
  - zastor ne reagira (noop);
  - Escape ne zatvara.
- Zarobljavanje fokusa radi kao kod PD-2.

### PD-4 Obrazac „Napomena uz rad” (`noteForm()`, unutar PD-1)

- `form data-submit=addNote`;
- polje `textarea#sb-note`, `maxlength=600`, oznaka „Napomena uz rad (nije obavezna)”;
- gumbi „Dodaj napomenu” i „Odustani” (`data-act=noteCancel`);
- otvara se s E-8 (`noteOpen`, fokus na `#sb-note`).

### PD-5 Izbornik ljuske ispod 800 px

`data-core="menu"`, `aria-expanded`, `.side[data-open]`.

### PD-6 Razotkrivanja `details`

- E-1: „Prvi dolazak ili imate kod zadatka?” i „Trebate pomoć?”;
- E-6: „Pravilo fakulteta (FPZG čl. 8)” i „Prikaži obavijest”;
- PD-1: „Popis sesija”;
- E-11: „Točne vrijednosti iz potvrde (UTC)”.

### PD-7 Obavijest `#toast`

`role=status`, nestaje nakon 3,2 s.

### PD-8 Otvaranje sažetka na E-11

`showSum` otvara ili zatvara ugrađenu ploču PD-1 i pomiče stranicu do nje.

---

## 3. Radnje

Radnji je ukupno 42. Uz svaku je zapisano što prototip radi. Stanja učitavanja, greške, praznog prikaza i rada bez mreže navedena su posebno, na kraju.

### Ljuska

- **R-1 Promjena teme** (`data-core="theme"`): mijenja `data-theme` na `<html>`.
- **R-2 Izbornik** (`data-core="menu"`): otvara i zatvara `.side`.
- **R-3 Odjava** (`data-core="logout"`): `loggedIn=false`, zatim E-1.
  - Prototip ne pita ništa prije odjave.
- **R-4 Navigacija:** `data-go` na stavkama `NAV` i na logotipu.

### E-1 Prijava

- **R-5 Prijava** (`data-act=prijava`):
  1. stanje prelazi u `preusmjeravanje`;
  2. nakon 900 ms `loggedIn=true` i odlazak na E-2.
  - Dvostruki klik zaustavlja `if (timer) return`.
  - U proizvodu: preusmjeravanje na AAI@EduHr.
- **R-6 Ponovni pokušaj / Na početnu / Odjava bez uloge** (`data-act=ponovno`): `stop()` i natrag na `zadano`.
  - `stop()` se poziva i na `hashchange`.
- **R-7 Na naslovnicu** (`data-act=naslovnica`): u prototipu samo obavijest. U proizvodu vodi na javnu naslovnicu.
- **R-8 Službena pomoć AAI@EduHr** (`data-act=pomoc-aai`): u prototipu obavijest. U proizvodu vanjska poveznica.

### E-2 do E-4

- **R-9 Otvori zadatak / rad** (`data-act=otvori data-id`):
  - postavlja `current`;
  - predan rad vodi na E-11;
  - nepotvrđena obavijest vodi na E-6;
  - inače vodi na E-7.
- **R-10 Upiši kod s početne** (`data-submit=kod`):
  - sprema `pendingCode` (bez razmaka na rubovima, velikim slovima);
  - odlazi na E-5, gdje je polje već popunjeno.
- **R-11 Pokušaj ponovno** (`data-act=ponovno`): ponovno učitavanje.
- **R-12 Upiši kolegij kodom** (`data-act=upis`): odlazi na E-5.
- **R-13 Ponovna prijava nakon isteka** (`data-act=aai`): `loggedIn=false`, zatim E-1.
- **R-14 Nastavi rad:** gumb kartice `.po-continue` (R-9 za taj zadatak).

### E-5 Upis

- **R-15 Upiši** (`data-submit=upisi`), redom:
  1. `norm()` uklanja razmake i crtice i pretvara u velika slova;
  2. kod mora odgovarati `^[A-Z0-9]{8,32}$`, inače stanje `neispravan`;
  3. kod koji ne postoji daje `istekao`;
  4. ako je student već upisan, `vecupisan`;
  5. inače `upisivanje`, pa nakon 700 ms:
     - upis se bilježi;
     - obavijest „Upisani ste u Kolegij D.”;
     - odlazak na E-6 novog zadatka.
  - Mrežna greška daje stanje `mreza`.
  - Kolegij bez zadatka daje `bezzadatka`.
- **R-16 Upiši drugi kolegij** (`data-act=drugi`): prazan obrazac.
- **R-17 Fokus:** `after` stavlja fokus u `#up-kod` (`preventScroll`) kad polje nije `readonly`.

### E-6 Obavijest

- **R-18 Označi potvrdni okvir** `#up-ack`: slušač promjene u `after` uključuje i isključuje `aria-disabled` na `#up-potvrdi`.
- **R-19 Potvrdi i otvori editor** (`data-act=potvrdi`):
  - postavlja `ack`, `started` i `ackAt` (današnji datum i vrijeme);
  - odlazi na E-7.
  - Prije potvrde ništa se ne šalje na poslužitelj.
- **R-20 Otvori rad** (`data-act=otvoriRad`): stanje `potvrdeno`, odlazak na E-7.
- **R-21 Ponovno učitaj** (stanje `promijenjeno`): ponovno čitanje nove verzije.
- **R-22 Natrag** (`BACK`): na E-3.

### E-7 Radni prostor

- **R-23 Pisanje u listu:**
  1. stanje „Spremanje…” (pulsira);
  2. nakon 400 ms „Spremljeno na uređaju” (bez mreže „· čeka slanje”);
  3. nakon još 1500 ms „Spremljeno na poslužitelju u HH:MM”, samo s mrežom.
  - Broj riječi se osvježava.
  - U proizvodu treći korak smije doći tek uz potpisanu potvrdu poslužitelja (SYNCED).
- **R-24 Bijeli ili tamni list** (`data-act=sheet`, `aria-pressed`): mijenja `state.sheetTheme`.
- **R-25 Predaja rada** (`data-act=review`): odlazak na E-9.
- **R-26 ← Moji zadaci:** odlazak na E-2.

### E-8 do E-11 Predaja

- **R-27 Natrag na rad** (`bar()`): odlazak na E-7.
- **R-28 Predaj rad** (`data-act=ask`): otvara PD-3.
  - Gumb je onemogućen bez mreže, bez potvrđene izjave i za vrijeme slanja.
- **R-29 Potvrdi predaju** (`data-act=submit`):
  - `sending` (stanje `utijeku`);
  - nakon 900 ms `submitted[id] = SERVER_NOW`, zatim E-11.
- **R-30 Zatvori dijalog** (`data-act=close`, Escape ili zastor):
  - ne radi dok traje slanje;
  - fokus se vraća na gumb koji je otvorio dijalog.
- **R-31 Pregledaj razgovor** (`data-act=chat data-n`): otvara PD-2.
- **R-32 Potvrđujem izjavu** (`#sb-confirm`):
  - `declared[id]` postaje današnji datum „u 21:10”;
  - „Dalje” se omogućuje;
  - fokus se vraća na okvir.
- **R-33 Odgovor na pitanje nastavnika** (`#sb-ans`): sprema u `S().form`.
- **R-34 Odabir obrasca izjave** (`#sb-form`, stanje `nesklad`).
- **R-35 Dodaj objašnjenje / Uredi izjavu / Ispuni izjavu** (`data-act=todo`): u prototipu samo obavijest. Funkcija nije razrađena.
- **R-36 Dodaj napomenu:** `noteOpen` otvara PD-4. `addNote`:
  - prazan tekst postavlja `aria-invalid` i fokus;
  - inače se dodaje `{text, at}` i prikazuje obavijest „Napomena je dodana.”
  - Napomene se samo dodaju, nema brisanja ni uređivanja.
- **R-37 Odustani od napomene** (`data-act=noteCancel`).
- **R-38 Provjeri stanje predaje** (`data-act=check`): u prototipu obavijest. U proizvodu ponovno čitanje stanja predaje.
- **R-39 Kopiraj otisak** (`data-act=copy`):
  - `navigator.clipboard`;
  - obavijest „Otisak je u međuspremniku (64 znaka, bez razmaka).”
- **R-40 Otvori sažetak procesa** (`data-act=sum`): `showSum`, pomak do ploče.
- **R-41 Provjera potvrde** (`data-act=verify`): u prototipu obavijest s putanjom `/provjera`. U proizvodu javna stranica bez prijave.
- **R-42 Preuzmi zapis (PDF s QR kodom)** (`data-act=pdf`): u prototipu samo obavijest.
- Uz to i poveznice „Otvori izjavu”, „Otvori radni prostor”, „Otvori potvrdu o predaji”, „Prikaži mjesto u radu”, „Prikaži oznake u tekstu” i „Na početnu”. Sve su `data-go` ili `data-act` na postojeći ekran.

### Stanja učitavanja, greške, praznog prikaza i rada bez mreže

| Ekran | Učitavanje | Greška | Prazno | Bez mreže | Ostalo |
|---|---|---|---|---|---|
| E-1 | `preusmjeravanje` | `greska`, `nedostupno` | — | — | `bezuloge` |
| E-2 | da | da | `prazno`, `kolegijbeztaska` | — | — |
| E-3 | da | da | `prazno`, `jedan` | — | `istekla` |
| E-4 | da | da | `prazno` | — | — |
| E-5 | `upisivanje` | `neispravan`, `istekao` | `bezzadatka` | `mreza` | `vecupisan` |
| E-6 | da | da | — | — | `nijeotvoren`, `promijenjeno`, `bezprava`, `potvrdeno` |
| E-7 | da | da | `prazno` | `bez-mreze` | `predano` (samo čitanje) |
| E-8 | da | da | `prazno`, `zatvoreno` | `bezmreze` | `predano` |
| E-9 | da | da | `prazno` | — | `nesklad` |
| E-10 | da, i `utijeku` | `odbijeno`, `nedovrseno`, `nepoznato` | — | `bezmreze` | `nakonroka`, `produljen` |
| E-11 | da | da | `prazno` | — | `ceka`, `nakonroka`, `praznine` |

---

## 4. Podaci

Oznake statusa:
- **IMA** znači da je ruta montirana u `server/server.ts` i ima handler.
- **UGOVOR** znači da je ruta u `/api/v1` ugovorena, ali je na popisu `CONTRACT_ONLY`, pa handlera još nema. Klijent se gradi prema lažnom poslužitelju.
- **DJELOMIČNO** znači da ugovor postoji, ali mu nedostaju polja koja prototip prikazuje.
- **NEMA** znači da nema ni ugovora.

| # | Podatak (ekran) | Ruta | Status |
|---|---|---|---|
| PO-1 | Prijava AAI@EduHr, povratak, odjava (E-1, R-3, R-5) | `auth.login.get` GET `/api/v1/auth/login`, `auth.callback.get`, `auth.logout.post`, `auth.logout-all.post` | IMA. Lažni pružatelj radi samo u razvoju i testu (D-09). |
| PO-2 | Šifre neuspjele prijave (`greska`, `nedostupno`) | `sign-in-failure.json`: `/prijava?greska=login_failed\|provider_unavailable`; callback vraća 400 `login_failed`, 403 `login_refused` i 503 | IMA. Ipak `login_refused` nema svoj tekst u `sign-in-failure.json`. |
| PO-3 | Račun, uloge, ustanova (ljuska, `bezuloge`) | `profile.me.get` GET `/api/v1/me`: `{institution{slug,displayName}, roles[≥1], displayName}`, 401, 403 | IMA. Stanje `bezuloge` mora se preslikati na 403 ili na poseban kod (pitanje N-8). |
| PO-4 | Kolegiji i zadaci (E-2, E-3, E-4) | `student.assignments.get` GET `/api/v1/student/assignments`: `{courses[{id,name,assignments[{id,title,dueAt,noticeFirst}]}]}` | UGOVOR i DJELOMIČNO. Nedostaju akademska godina, seminarske grupe, vrsta zadatka (Esej, Seminarski rad), mentor i produljeni rok. |
| PO-5 | Stanje rada po zadatku (`kind()`, `stateText()`) | `student.assignment-work.get` GET `/api/v1/student/assignment-work`: `not_started\|in_progress\|submitted` | UGOVOR i DJELOMIČNO. Nedostaje vrijeme predaje („Predano X”). Potvrda obavijesti dolazi iz `noticeFirst` u PO-4. |
| PO-6 | Upis kodom (E-5) | `institution.enrollments.post` POST `/api/v1/institution/enrollments`, tijelo `{code ≤64}`, odgovor 200 `{courseId}`; greške 422 `invalid_input`, 422 `refused`, 429 `too_many_attempts`, 403, 503 | UGOVOR. Ugovor ne razlikuje stanja `vecupisan` i `bezzadatka` (pitanje N-3). |
| PO-7 | Tekst obavijesti, pravila alata, pravilo fakulteta, verzija, otisak, „otvara se od” (E-6) | — | NEMA rute za čitanje obavijesti. Ductus kopija čita je u stranici (`assignment-notice-read`). |
| PO-8 | Potvrda obavijesti (R-19) | `institution.acknowledgment.post` POST `/api/v1/institution/assignments/{assignmentId}/acknowledgment`, tijelo `{versionNo, fingerprint}`, odgovor 200 `{acknowledgedAt}`; 409 `conflict` i `notice_changed` (stanje `promijenjeno`), 403 (`bezprava`) | UGOVOR. |
| PO-9 | Otvaranje rada, dokument, revizija (E-7) | `evidence.open.post` POST `/api/v1/evidence/open` | IMA. |
| PO-10 | Spremanje i potpisana potvrda spremanja (SYNCED, R-23) | `evidence.commit.post` POST `/api/v1/evidence/commit` | IMA. |
| PO-11 | Reprodukcija (nije u prototipu, postoji u Ductus kopiji) | `evidence.replay.post` | IMA. |
| PO-12 | Opseg riječi zadatka („opseg 1.200 do 1.600”) | — | NEMA. |
| PO-13 | Sažetak procesa (PD-1) | `projection.process-summary.post` POST `/api/v1/process-summary`, tijelo `{documentId}`, `ProcessSummaryV1` | UGOVOR i DJELOMIČNO. Polja sažetka treba usporediti s 11 odjeljaka PD-1. Izjava i napomene vjerojatno nisu u obliku. |
| PO-14 | Retci provjere prije predaje: mjesta za izvor, lijepljenja bez izvora, pravila oblika (E-8) | — | NEMA zasebne rute. Mjesta za izvor dolaze iz dokumenta, lijepljenja iz sažetka, a „pravila oblika” nemaju izvor. |
| PO-15 | Napomene studenta (PD-4) | — | NEMA. |
| PO-16 | Zabilježeni AI prijenosi i razgovori, izjava, pitanje nastavnika, odgovor (E-9, PD-2) | — | NEMA. Ovisi o D-194 t. 6 i 7 (PRIJEDLOG, Q-10). |
| PO-17 | Predaja (R-29) | `submission.submit.post` POST `/api/v1/submission`, tijelo `{documentId, revision}`, odgovor 200 `{status:"submitted", receipt}`; 409 `blocked` (`segment_unsigned\|record_mismatch\|record_discontinuous\|no_evidence`), `stale_revision`, `already_requested`, `not_acknowledged`, `not_open`; 503 s fazom | UGOVOR. Izjava i napomene ne idu u predaju. Preslikavanje: `odbijeno` je `blocked`, `nepoznato` je istek vremena ili 503, `nedovrseno` je `record_mismatch`. |
| PO-18 | Potpisana potvrda: `requestedAt`, `dueAt`, `afterDeadline`, `signedAt`, `artifactSha256`, `evidenceRecord continuous\|with_gaps`, potpis Ed25519 (E-11) | u odgovoru PO-17 (`SignedSubmissionReceiptV2`) | UGOVOR. Nema rute za ponovno čitanje potvrde nakon osvježavanja stranice (E-11 `ucitavanje`) ni rute za stanje „čeka potpis” (`ceka`). |
| PO-19 | Stanje predaje „Provjeri stanje predaje” (`nepoznato`) | — | NEMA. |
| PO-20 | Javna provjera potvrde `/provjera` | — | NEMA. |
| PO-21 | PDF zapisa s QR kodom | — | NEMA. |
| PO-22 | Produljeni rok (`produljen`) | — | NEMA ni u PO-4 ni u potvrdi. Potvrda ima samo `dueAt`. |
| PO-23 | Jezik sučelja (ne vidi se u prototipu) | `profile.interface-locale.get` i `.post` | IMA. |
| PO-24 | Dnevnik pristupa (u Ductus kopiji, nije u prototipu) | `student.access-log.get` | UGOVOR. |
| PO-25 | Prijava problema (u Ductus kopiji, nije u prototipu) | `support.problem-report.post` | IMA. |

Zbroj: 25 podataka.
- IMA: 8 (PO-1, PO-2, PO-3, PO-9, PO-10, PO-11, PO-23, PO-25).
- Samo UGOVOR: PO-6, PO-8, PO-17, PO-18, PO-24.
- UGOVOR i DJELOMIČNO: PO-4, PO-5, PO-13.
- NEMA: PO-7, PO-12, PO-14, PO-15, PO-16, PO-19, PO-20, PO-21, PO-22.

---

## 5. Što već postoji u webu

### 5.1 `origin/main` (Vite `packages/app`)

Main zasad ima samo ljusku i dvije studentske stranice. Prema odluci od 19. 11. („Sve treba biti na next.js od fronta”) to nije temelj za nastavak.
- `App.tsx` i `routes.ts`:
  - `studentHome` `/zadaci`;
  - `studentCourses` `/zadaci/kolegiji`;
  - ostale stavke navigacije su „pending”;
  - `/` preusmjerava na početnu stranicu uloge.
- Neprijavljen korisnik ide na `goToSignIn` (AAI).
- Nedostupnost prikazuje `ErrorScreen` s ponovnim pokušajem.
- Korisnik bez uloge vidi `t.home.welcome` i `hostText.noRole`.
- `StudentPage` zove `readMyAssignments` i crta `StudentHome` (`view=home|courses`, `enroll={null}`).
- `SignOut` šalje `auth.logout.post` i onda `leaveFor("/")`.

### 5.2 `origin/migracija/kopija-ductus-front` (Next.js, doslovna kopija Ductusa)

| Ekran | Stranica u kopiji | Ocjena |
|---|---|---|
| E-0 | `AppShell`, `ShellRail`, `AppHeader`, `nav.ts`, `ShellLogout`, `ThemeRestore`, `WorkspaceShell` | Odgovara u osnovi. Treba provjeriti pet stavki i izbornik ispod 800 px. Ductus odjava ima `LogoutDialog` (upozorenje na neposlani tekst); prototip ga nema (N-12). |
| E-1 | `src/app/prijava/page.tsx`, `SignInScreen`, `AccessCard` | Razlikuje se. Neuspjela prijava završava na goloj stranici 400/403/503 (kartice). Stanja `nedostupno`, `bezuloge` i `pomoc` treba dodati. |
| E-2 | `zadaci/page.tsx`, `StudentHome`, `MyAssignments`, `EmptyHome` | Djelomično. Nedostaju kartica „nastavak rada”, `codeCard` i stanje `kolegijbeztaska`. Nakon prijave Ductus otvara `/rad`, a prototip `pocetna` (N-1). |
| E-3 | `zadaci/kolegiji/page.tsx` | Djelomično. Nema akademske godine, grupa ni stanja `istekla`. |
| E-4 | `zadaci/radovi/page.tsx` | Djelomično. Kopija ima pretragu i filtar godine kojih prototip nema (N-11). |
| E-5 | `upis/page.tsx`, `upis/kolegij/[courseId]`, `EnrollForm`, `enroll-code` | Djelomično. Duljina koda 8–32 u tekstu naspram ≤64 u ugovoru (N-3). |
| E-6 | `zadatak/[id]/page.tsx`, `AssignmentNotice`, `notice-gate`, `notice-window`, `NoticeCourse` | Postoji. Treba usporediti tekst i tri stupca, te stanja `nijeotvoren`, `promijenjeno` i `bezprava`. |
| E-7 | `rad/page.tsx`, `rad/[assignmentId]` (`StudentWorkspace`, `OpenWork`, `OfflineNotice`, `StatusLength`, `SheetFrame`, `useSheetTheme`, `document-saver`, `evidence-session`, `packages/editor-core`) | Postoji i bogatije je od zamjene u prototipu. Ploča „Rad” (S-15) nedostaje (kartice). |
| E-8, E-10, E-11 | `rad/[assignmentId]/predaja/page.tsx` (`Submission`, `SubmissionView`), sve na jednoj stranici | Razlikuje se. Nema koraka 1–5, dijaloga PD-3 („Z-08”), stanja `ceka`, javne provjere, PDF-a ni ponovnog čitanja potvrde. |
| E-9, PD-2 | — | NEMA. Postoji samo ključ `aiStatement` u `messages.hr.ts`. |
| PD-1 | `ProcessSummaryView`, `summary/zagreb-time` | Djelomično. Napomene i izjava nedostaju. |
| PD-4 | — | NEMA. U tekstovima postoji „Prije konačne predaje uz rad možete dodati napomenu.” |
| Izvan prototipa | `reprodukcija`, `dnevnik-pristupa`, `kako-radi`, `stanje`, `ProblemReport`, `TeacherViewSheet` | Ekrana nema u prototipu (N-11). |

### 5.3 `@ductura/ui` (isti na `main` i u kopiji): što se može ponovno upotrijebiti

- **`Button`**: `tone` je `primary` ili `quiet`; `busy` daje `aria-disabled` i `preventDefault`. Pokriva sve gumbe, uključujući R-15, R-28 i R-29.
- **`Card`**: `title`, `empty`, `busy` („Učitavanje…”), `error` (`role=alert`), `disabled`. Pokriva retke zadataka, kartice kolegija, ploče E-8 do E-11 i stanja učitavanja, greške i praznog prikaza.
- **`TextField`**: `label`, `hint`, `error` daje `aria-invalid` i `aria-describedby`, `busy` daje `readonly`. Ponašanje polja `#up-kod` iz E-5 je točno to.
- **`SaveState` + `SAVE_STATES`**: osam stanja, a SYNCED je „Spremljeno na poslužitelju”.
  - Tekstovi se razlikuju od prototipa: „Spremam lokalno” i „Sinkroniziram” naspram „Spremanje…” i „Spremljeno na uređaju · čeka slanje” (N-6).
- **`readTheme`, `saveTheme`, `toggleTheme`**: R-1.
- **`tokens/globals.css`**.

U `ui` nedostaju, i po odluci DAN-1111 prvo se dodaju tamo:
- dijalog sa zarobljenim fokusom (PD-2, PD-3);
- koraci (`steps`);
- obavijest (toast);
- kostur;
- oznaka (`tag`);
- popis ključ–vrijednost;
- potvrdni okvir;
- izbornik (select);
- višeredno polje (textarea);
- prikaz otiska u skupinama;
- razotkrivanje (`details`);
- izbornik ljuske.

---

## 6. Prijedlog valova

Svaki val gradi server i web zajedno. Svaki završava nečim što Daniel može kliknuti lokalno: `pnpm lokalno` na serveru sa simulatorom AAI@EduHr, plus web u Next.js-u.

**V-1 Ljuska, prijava i pregled** (E-0 do E-4, R-1 do R-14)
- Server: handleri `student.assignments.get` i `student.assignment-work.get`, s proširenjem PO-4 i PO-5 ako Daniel to odobri (N-4).
- Web: ljuska, E-1 sa svim šest stanja, E-2, E-3 i E-4 sa stanjima, komponente u `@ductura/ui`.
- Klik: prijava kroz simulator, pa Moji zadaci, Moji kolegiji i Moji radovi, pa odjava.

**V-2 Upis i obavijest** (E-5, E-6, R-15 do R-22)
- Server: handleri `institution.enrollments.post` i `institution.acknowledgment.post`, te novi ugovor i handler za čitanje obavijesti (PO-7).
- Web: E-5 sa sedam stanja, E-6 s osam stanja.
- Klik: upis kodom, čitanje obavijesti, potvrda, prazan radni prostor.

**V-3 Radni prostor** (E-7, R-23 do R-26)
- Server: `evidence.open` i `commit` već postoje; dodaje se opseg riječi (PO-12) ako se odobri.
- Web: okvir E-7 oko postojećeg uređivača; „Spremljeno na poslužitelju” tek uz potpisanu potvrdu; stanja bez mreže i samo za čitanje; list bijeli ili tamni.
- Klik: pisanje, isključivanje mreže, ponovno uključivanje.

**V-4 Prije predaje, predaja i potvrda** (E-8, E-10, E-11, PD-1, PD-3, PD-4, R-27 do R-30 i R-36 do R-40)
- Server:
  - handleri `submission.submit.post` i `projection.process-summary.post`;
  - novi ugovori za ponovno čitanje potvrde i stanja predaje (PO-18, PO-19);
  - novi ugovor za napomene (PO-15), ako se odobri.
- Web:
  - koraci 3–5 kao zasebni ekrani;
  - dijalog PD-3;
  - sva stanja E-10 preslikana na kodove iz PO-17;
  - E-11 s kopiranjem otiska i sažetkom.
- Ako Daniel ne odluči drukčije, korak 2 se do V-6 preskače, kao u Ductusu danas.
- Klik: cijela predaja od teksta do potvrde, uključujući predaju nakon roka.

**V-5 Provjera potvrde i PDF** (R-41, R-42, PO-20, PO-21)
- Server: javna provjera potpisa bez prijave i PDF s QR kodom.
- Web: stranica `/provjera`.
- Klik: s E-11 na provjeru, preuzimanje PDF-a.

**V-6 Izjava i razgovori** (E-9, PD-2, R-31 do R-35, PO-16)
- Gradi se tek nakon Danielove odluke o D-194 t. 6 i 7 (Q-10, rok 15. 12. 2026.).
- Do tada bi se najviše smjela napraviti statička ljuska na lažnom poslužitelju, i to samo uz izričito Danielovo „da” (N-2).
- Server: ugovori za zabilježene AI stavke, izjavu, priloge i pitanje nastavnika; predaja proširena izjavom.

---

## 7. Nejasno

1. **N-1 Početna nakon prijave.** Prototip otvara „Moji zadaci” (`pocetna`), a Ductus kopija `/rad`. Što je početna studenta?
2. **N-2 Izjava (E-9, PD-2).** Ovisi o D-194 t. 6 i 7, koje su PRIJEDLOG (Q-10). Ugovor predaje prima samo `{documentId, revision}`. Ne gradimo ništa skupo dok ne odlučite. Smije li se dotad napraviti samo ekran na lažnom poslužitelju, ili korak 2 čeka u cijelosti? Isto vrijedi za „Pitanje nastavnika”: ni nastavnički dio ni ugovor za nj ne postoje.
3. **N-3 Kod za upis.**
   - Tekst sučelja kaže 8–32 znaka, a ugovor dopušta ≤64. Koje pravilo vrijedi?
   - Normalizira li razmake i crtice klijent ili server?
   - Ugovor ne razlikuje „već upisan” ni „kolegij bez zadatka”: smije li se ugovor proširiti?
4. **N-4 Podaci kolegija.** Akademska godina, seminarske grupe, vrsta rada, mentor i produljeni rok nisu u `student.assignments.get`. Proširiti ugovor (major izdanje `@ductura/contracts`)?
5. **N-5 Napomene studenta (PD-4).** Ruta ne postoji. Napomene se samo dodaju. Odobravate li novi ugovor? Uz RLS po ustanovi napomene vidi samo nastavnik kolegija.
6. **N-6 Tekstovi stanja spremanja.**
   - Prototip ima četiri teksta, a `@ductura/ui` `SaveState` osam stanja s drugim riječima.
   - „Spremljeno na poslužitelju” smije se pokazati samo uz potpisanu potvrdu.
   - Vrijede li tekstovi prototipa ili tekstovi iz `ui`?
7. **N-7 Potvrda „čeka potpis” (E-11 `ceka`).** Ugovor predaje vraća potpisanu potvrdu odmah. Treba li stanje `ceka` (asinkroni potpis) uopće postojati, i koja ga ruta čita nakon osvježavanja stranice?
8. **N-8 Račun bez uloge.** AAI@EduHr prijava uspije, a uloge nema. Ugovor `/api/v1/me` traži ≥1 ulogu, pa vraća 403. Je li to stanje `bezuloge` i tko je „koordinator” u tekstu?
9. **N-9 Javna provjera i PDF.**
   - Na kojem poslužitelju je `/provjera`: na instanci ustanove ili na zajedničkoj stranici (`ductura.org`)?
   - Kako javna provjera radi uz RLS po ustanovi?
   - Što je u QR kodu?
10. **N-10 Tekst obavijesti (E-6).**
    - Pravila alata po zadatku i pravilo fakulteta (FPZG čl. 8) trebaju izvor podataka: postavlja li ih nastavnik pri izradi zadatka?
    - U tekstu je i „pogled uživo od prvog dana”, sukladno trajnoj odluci o pogledu uživo. Potvrđujete li da ostaje tako napisano?
11. **N-11 Ekrani izvan prototipa.** Ductus kopija ima reprodukciju za studenta, dnevnik pristupa, „Kako radi”, stanje sustava, prijavu problema, te pretragu i filtar godine na „Moji radovi”. Prototip ih nema. Brišemo ih, ili ostaju jer su „identično funkcionalno” samo donja granica?
12. **N-12 Odjava.** Prototip odjavljuje odmah. Ductus ima dijalog koji upozorava na tekst koji još nije poslan. Zadržati dijalog? Bez njega se može izgubiti tekst.
13. **N-13 „Pravila oblika”** (E-8). U prototipu piše „Provjera oblika još nije pokrenuta.” Nema ni funkcije ni podatka. Je li to provjera citatnog stila FPZG?
14. **N-14 Riječi.** Tekst pazi da ništa ne tvrdi otkrivanje varanja. Prototip piše „Izvor nije opažen” i „Ductura ne procjenjuje autorstvo ni korištenje AI-ja”. Zabranjeni izrazi nisu nađeni, ali tekstove treba propustiti kroz skener (PRODUCT §5) prije gradnje.

---

Brojevi:
- 12 ekrana (ljuska i 11 registriranih) sa 71 stanjem;
- 8 prozora i dijaloga, od toga 2 modalna;
- 42 radnje;
- 25 podataka: 8 ima handler, 5 samo ugovor, 3 djelomično, 9 nema ništa;
- 6 valova;
- 14 otvorenih pitanja.
