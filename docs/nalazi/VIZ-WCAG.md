# VIZ-WCAG – ručna matrica pristupačnosti

Matrica pokriva 55 ekrana aplikacije `packages/app`: 44 ekrana iz `e2e/a11y/screens.ts` i 11 ruta koje taj popis još nema. Svaki ekran provjeren je tipkovnicom, vidljivim fokusom, stablom pristupačnosti (kako ga vidi čitač zaslona) i rasporedom na sedam širina: 320, 390, 768, 1024, 1280, 1440 i 1920 px. Svaka širina provjerena je u svijetloj i tamnoj temi. Ćelija je PROLAZ ili nalaz s kriterijem WCAG 2.2 i koracima.

Ovaj dokument samo bilježi nalaze. Kontrast se popravlja tokenom u zasebnom VIZ zadatku, a axe ostaje uključen u `e2e/a11y`. Svi podaci su izmišljeni (lažni poslužitelj, scenarij VIZ „puno”).

## Sažetak

| Područje | Ishod |
|---|---|
| Tipkovnica: redoslijed, zamke, prečaci | PROLAZ na svih 55 ekrana. Nema zamke fokusa. Izbornik i dijalog odjave zatvaraju se tipkom Esc i vraćaju fokus. |
| Vidljiv fokus | PROLAZ. Svaka stanica fokusa ima vidljiv obrub kontrasta najmanje 3:1 u obje teme (2.4.7; kontrast obruba 1.4.11). |
| Čitač zaslona: imena, uloge, žive regije | PROLAZ za imena i uloge: točno jedan `h1` i jedan `main` po ekranu, navigacija „Radni prostor”, nijedna kontrola bez imena. 11 ekrana preskače razinu naslova (napomena uz 1.3.1). |
| Raspored 320–1920, svijetla i tamna | Jedan NALAZ 1.4.10: „Predaje zadatka” na 320 i 390 px. Svi ostali ekrani PROLAZ na svim širinama u obje teme. |
| Veličina cilja (2.5.8) | Jedan NALAZ: izbor oblika PDF/DOCX na „Predaje zadatka”. Ostali potvrdni okviri i izbornici 18×18 ili 20×20 px imaju oznaku visine 44 px koja je dio cilja: PROLAZ. |

## Nalazi

### N1 – „Predaje zadatka” ne prelama se na mobitelu (1.4.10 Reflow, AA)

Ruta: `/nastavnik/zadatak/{id}/predaje`, uloga nastavnik, obje teme.

Koraci:

1. Otvorite ekran kao nastavnik na širini 320 px (ili 390 px).
2. Stranica se pomiče vodoravno: širina sadržaja je 704 px, odnosno 384 px viška na 320 px i 314 px na 390 px.
3. Zaglavlje stranice (`div.pagehead`), odlomak „Predane verzije rada…” i odjeljak „Skupno preuzimanje predaja” s poljem „Oblik predanog rada” ostaju široki 640 px. Tekst je odrezan na desnom rubu (snimka `nastavnik-predaje-zadatka-390.png`).

Na 768 px i šire ekran se prelama ispravno. Popravak: zaglavlje i odjeljak trebaju se slagati u jedan stupac ispod 640 px, kao na ostalim nastavničkim ekranima.

### N2 – Izbor PDF/DOCX ima premalen cilj (2.5.8 Target Size Minimum, AA)

Isti ekran, polje „Oblik predanog rada”. Izbornici PDF i DOCX imaju gumb 18×18 px i oznaku visine 20 px (53×20 i 68×20 px). Stoje jedan uz drugi bez razmaka, pa ne vrijedi ni iznimka za razmak od 24 px.

Koraci: otvorite ekran na bilo kojoj širini i izmjerite oznake „PDF” i „DOCX”. Visina je 20 px, a krug od 24 px oko „PDF” siječe cilj „DOCX”.

Popravak: oznaka visine najmanje 24 px (ostali izbornici u aplikaciji imaju 44 px) i razmak između opcija.

### N3 – Preskočene razine naslova (napomena uz 1.3.1 i 2.4.6)

Na 11 ekrana iza `h1` odmah dolazi `h3`. To nije pad kriterija, ali čitač zaslona u popisu naslova pokazuje rupu u strukturi. Popravak ide u zaseban zadatak: `h3` postaje `h2` gdje nema nadređenog `h2`.

| Ekran | Prvi naslov iza `h1` |
|---|---|
| administrator: kolegiji | „Metodologija” |
| administrator: korisnici | „Čekaju potvrdu uloge” |
| administrator: pragovi po vrsti podrijetla | „Tipkano u Ducturi” |
| nastavnik: Merlin | „Popis (CSV)” |
| nastavnik: postavke profila | „Jezik sučelja” |
| nastavnik: predaje zadatka | „Skupno preuzimanje predaja” |
| student: postavke profila | „Jezik sučelja” |
| student: predaja, izjava | „Zabilježeno u Ducturi” |
| student: predaja, izjava o radu | „Zabilježeno u Ducturi” |
| student: predaja, potvrda | „Povlačenje predaje” |
| student: zahtjev za mentorstvo | „Novi zahtjev” |

### N4 – Nema poveznice za preskakanje navigacije (preporuka, 2.4.1)

Nijedan ekran nema poveznicu „Preskoči na sadržaj”. Kriterij 2.4.1 je zadovoljen orijentirima (`main`, `nav`, tehnika ARIA11), pa ovo nije pad. Na 1024 px i šire korisnik tipkovnice ipak prolazi oko 12 stanica navigacije prije sadržaja na svakom ekranu. Preporuka: skrivena poveznica koja se pokaže na fokusu, kao prva stanica.

### N5 – 19 ekrana provjereno samo u stanju greške (ograničenje provjere)

Ni lažni poslužitelj `e2e/a11y/fake-server.ts` ni VIZ scenarij „puno” ne daju podatke za 19 ekrana. Oni zato pokazuju poruku „…trenutačno nije moguće…”, a matrica za njih vrijedi samo za to stanje (oznaka `greška*`). Tu su:

- svi nastavnički pregledi rada (rad studenta, predaja, reprodukcija, konzultacije, priprema razgovora, sažetak, usporedba);
- studentski editor i radni prostor, upis, zadatak, dnevnik pristupa, podrijetlo teksta, koraci predaje;
- mentorstva, nova verzija zadatka, zbirno po kolegiju, čuvanje podataka.

U lažnom poslužitelju za a11y bilo je čak 35 takvih ekrana. Scenarij „puno” spustio je taj broj na 19.

Preporuka: dopuniti `test-fakes` scenarijem s podacima za te rute i dodati 11 novih ruta (popis niže) u `e2e/a11y/screens.ts`, kako bi axe i ova matrica pokrivali i stanje s podacima. Do tada ova matrica ne pokriva alatnu traku editora.

## Što je provjereno dodatno

- Izbornik na mobitelu (320–1023 px): `aria-expanded` se mijenja, Esc ga zatvara i vraća fokus na gumb „Izbornik”. Otvara se u toku stranice, ne kao prekrivač, pa Tab koji nastavlja u sadržaj nije zamka. PROLAZ na svim ekranima.
- Dijalog odjave: nativni modalni `<dialog>` s imenom „Odjava”. Fokus počinje na „Ostani”, Tab kruži između „Ostani” i „Odjavi se”, a Esc zatvara i vraća fokus. PROLAZ (2.1.2, 2.4.3).
- Greške obrazaca (upis u kolegij): polje dobiva `aria-invalid` i `aria-describedby`, a poruka „Kod ima od 8 do 32 slova i brojke…” je u regiji `alert`. PROLAZ (3.3.1, 4.1.3).
- Produljenje roka: polje datuma i vremena ima šest podpolja. Tab ih prolazi pa ide na izbornik i gumbe, a sonda koja je to prijavila kao zamku dala je lažan nalaz. PROLAZ.
- Potvrdni okviri 18×18 px (pravila, kolegiji, izjava, produljenje, jezik rada): oznaka je dio cilja i visoka je 44 px. PROLAZ za 2.5.8.

## Što nije u ovoj matrici

- `/prijava` i `/operater/mjerila-pilota` nisu provjereni: nema ih ni u `screens.ts` ni u ovoj sondi. Treba ih dodati zajedno s rutama niže.
- Stupac „Čitač zaslona” izveden je iz stabla pristupačnosti u Chromiumu: imena, uloge, orijentiri, naslovi i žive regije. Stvarni prolaz s NVDA i VoiceOverom ostaje u `packages/app/e2e/a11y/RUCNA-PROVJERA.md`.
- Kontrast boja nije ovdje: axe ga provjerava u `e2e/a11y`, a popravci idu tokenom u zasebnom VIZ zadatku.

Nove rute koje treba dodati u `screens.ts`: podrijetlo teksta, razgovor o radu, moji kolegiji (popis), studenti kolegija, zbirno po kolegiju, priprema razgovora, sažetak rada, usporedba verzija, Merlin, predaje zadatka i nepoznata ruta (404).

## Matrica

Stanje „podaci” znači da je ekran prikazao podatke scenarija „puno”, a `greška*` da je prikazao poruku o grešci (vidi N5). Broj stanica je broj zaustavljanja tipke Tab na 1280 px u svijetloj temi. Raspored je PROLAZ kad nema vodoravnog pomicanja stranice ni na jednoj od sedam širina.

| Ekran | Ruta | Stanje | Tipkovnica | Vidljiv fokus | Čitač zaslona | Raspored 320–1920, svijetla | Raspored 320–1920, tamna |
|---|---|---|---|---|---|---|---|
| administrator: čuvanje podataka | `/ustanova/cuvanje` | greška* | PROLAZ · 16 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| administrator: izvoz podataka studenta | `/ustanova/izvoz-podataka` | podaci | PROLAZ · 15 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| administrator: kolegiji | `/ustanova/kolegiji` | podaci | PROLAZ · 21 stanica | PROLAZ | NAPOMENA 1.3.1: h1→h3 „Metodologija” | PROLAZ | PROLAZ |
| administrator: korisnici | `/ustanova/korisnici` | podaci | PROLAZ · 17 stanica | PROLAZ | NAPOMENA 1.3.1: h1→h3 „Čekaju potvrdu uloge” | PROLAZ | PROLAZ |
| administrator: pragovi po vrsti podrijetla | `/ustanova/pragovi` | podaci | PROLAZ · 34 stanica | PROLAZ | NAPOMENA 1.3.1: h1→h3 „Tipkano u Ducturi” | PROLAZ | PROLAZ |
| administrator: pravila | `/ustanova/pravila` | podaci | PROLAZ · 25 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| administrator: ustanova | `/ustanova` | podaci | PROLAZ · 14 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| izjava o pristupačnosti | `/pristupacnost` | podaci | PROLAZ · 4 stanice | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: brz put | `/nastavnik/brz-put` | podaci | PROLAZ · 12 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: jezik rada | `/nastavnik/zadatak/{id}/rad/{id}/jezik` | podaci | PROLAZ · 14 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: kolegiji | `/nastavnik` | podaci | PROLAZ · 33 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: konzultacije | `/nastavnik/rad/{id}/konzultacije` | greška* | PROLAZ · 13 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: mentorstva | `/nastavnik/mentorstva` | greška* | PROLAZ · 13 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: Merlin | `/nastavnik/zadatak/{id}/merlin` | podaci | PROLAZ · 16 stanica | PROLAZ | NAPOMENA 1.3.1: h1→h3 „Popis (CSV)” | PROLAZ | PROLAZ |
| nastavnik: moji kolegiji (popis) | `/nastavnik/kolegiji` | podaci | PROLAZ · 33 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: nova verzija zadatka | `/nastavnik/zadatak/{id}/uredi` | greška* | PROLAZ · 14 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: novi zadatak | `/nastavnik/zadatak/novi` | podaci | PROLAZ · 15 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: postavke profila | `/profil` | podaci | PROLAZ · 14 stanica | PROLAZ | NAPOMENA 1.3.1: h1→h3 „Jezik sučelja” | PROLAZ | PROLAZ |
| nastavnik: predaja | `/nastavnik/rad/{id}/predaja` | greška* | PROLAZ · 13 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: predaje zadatka | `/nastavnik/zadatak/{id}/predaje` | podaci | PROLAZ · 21 stanica | PROLAZ | NAPOMENA 1.3.1: h1→h3 „Skupno preuzimanje predaja” | NALAZ 1.4.10: 320 (+384 px), 390 (+314 px) | NALAZ 1.4.10: 320 (+384 px), 390 (+314 px) |
| nastavnik: priprema razgovora | `/nastavnik/rad/{id}/priprema-razgovora` | greška* | PROLAZ · 13 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: produljenje roka | `/nastavnik/zadatak/{id}/produljenje` | podaci | PROLAZ (datum-vrijeme ima 6 podpolja, Tab zatim ide dalje) · 15 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: rad studenta | `/nastavnik/rad/{id}` | greška* | PROLAZ · 13 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: reprodukcija | `/nastavnik/rad/{id}/reprodukcija` | greška* | PROLAZ · 13 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: sažetak rada | `/nastavnik/rad/{id}/sazetak` | greška* | PROLAZ · 13 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: studenti kolegija | `/nastavnik/kolegiji/{id}/studenti` | podaci | PROLAZ · 14 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: usporedba verzija | `/nastavnik/rad/{id}/usporedba` | greška* | PROLAZ · 13 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: zbirni pregled | `/nastavnik/zbirni` | podaci | PROLAZ · 14 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nastavnik: zbirno po kolegiju | `/nastavnik/kolegiji/{id}/zbirno` | greška* | PROLAZ · 13 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nema ovlasti | `/nema-ovlasti?kind=denied` | podaci | PROLAZ · 1 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| nepoznata ruta (404) | `/ne-postoji-izmisljeno` | podaci | PROLAZ · 14 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| preuzimanje izvoza podataka | `/izvoz-podataka/IzmisljeniTokenZaProvjeruPristupacnosti_001` | podaci | PROLAZ · 2 stanice | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| prijava istekla | `/nema-ovlasti?kind=expired` | podaci | PROLAZ · 2 stanice | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| provjera potvrde | `/provjera` | podaci | PROLAZ · 4 stanice | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| stanje sustava | `/stanje` | podaci | PROLAZ · 2 stanice | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: dnevnik pristupa | `/rad/{id}/dnevnik-pristupa` | greška* | PROLAZ · 15 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: kako Ductura radi | `/kako-radi` | podaci | PROLAZ · 13 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: moji kolegiji | `/zadaci/kolegiji` | podaci | PROLAZ · 16 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: moji radovi | `/zadaci/radovi` | podaci | PROLAZ · 19 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: moji zadaci | `/zadaci` | podaci | PROLAZ · 20 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: podrijetlo teksta | `/rad/{id}/podrijetlo` | greška* | PROLAZ · 14 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: postavke profila | `/profil` | podaci | PROLAZ · 15 stanica | PROLAZ | NAPOMENA 1.3.1: h1→h3 „Jezik sučelja” | PROLAZ | PROLAZ |
| student: predaja, izjava | `/rad/{id}/predaja` | podaci | PROLAZ · 17 stanica | PROLAZ | NAPOMENA 1.3.1: h1→h3 „Zabilježeno u Ducturi” | PROLAZ | PROLAZ |
| student: predaja, izjava o radu | `/rad/{id}/predaja/izjava` | podaci | PROLAZ · 17 stanica | PROLAZ | NAPOMENA 1.3.1: h1→h3 „Zabilježeno u Ducturi” | PROLAZ | PROLAZ |
| student: predaja, potvrda | `/rad/{id}/predaja/potvrda` | greška* | PROLAZ · 16 stanica | PROLAZ | NAPOMENA 1.3.1: h1→h3 „Povlačenje predaje” | PROLAZ | PROLAZ |
| student: predaja, pregled | `/rad/{id}/predaja/pregled` | greška* | PROLAZ · 19 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: predaja, slanje | `/rad/{id}/predaja/slanje` | greška* | PROLAZ · 15 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: rad | `/rad/{id}` | greška* | PROLAZ · 11 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: radni prostor | `/rad` | greška* | PROLAZ · 11 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: razgovor o radu | `/rad/{id}/razgovor` | podaci | PROLAZ · 14 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: reprodukcija | `/rad/{id}/reprodukcija` | podaci | PROLAZ · 14 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: upis kodom | `/upis` | podaci | PROLAZ · 14 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: upis u kolegij | `/upis/kolegij/{id}` | greška* | PROLAZ · 15 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: zadatak | `/zadatak/{id}` | greška* | PROLAZ · 15 stanica | PROLAZ | PROLAZ | PROLAZ | PROLAZ |
| student: zahtjev za mentorstvo | `/zadaci/mentorstvo` | podaci | PROLAZ · 18 stanica | PROLAZ | NAPOMENA 1.3.1: h1→h3 „Novi zahtjev” | PROLAZ | PROLAZ |
