# Ručna provjera pristupačnosti (WEB-1805, M11.6)

Kontrolni popis za vlasnika. Automatska provjera (`pnpm --filter @ductura/app run test:a11y`) pokriva axe razina A i AA, naslov stranice i vidljiv fokus na svim glavnim ekranima. Ne zamjenjuje čitač zaslona. Dok sve stavke ispod nisu zapisane, izjava ostaje „djelomično usklađena” (`COMPLIANCE` u `app/(host)/pristupacnost/statement.ts`).

Okruženje: Chrome na računalu, NVDA (Windows) i VoiceOver (macOS), lokalni stog s lažnim OIDC-om i izmišljenim računima `demo-student`, `demo-teacher` i `demo-admin`. Uz svaku stavku upiši datum, čitač i ishod (prolazi / ne prolazi + opis).

## 1. Ljuska (svaka uloga)

- [ ] Prvi Tab vodi na logotip; bočna navigacija čita se kao „Bočna navigacija” s popisom stavki, trenutačna stavka najavljena je kao trenutačna stranica.
- [ ] Ispod 800 px gumb izbornika najavljuje „otvoreno/zatvoreno”; Esc zatvara izbornik i fokus se vraća na gumb.
- [ ] Prekidač teme najavljuje svoje stanje; nakon promjene teme fokus ostaje na prekidaču.
- [ ] Poveznice „Kako Ductura radi” i „Izjava o pristupačnosti” dostupne su s tipkovnice i otvaraju svoju stranicu.
- [ ] Odjava: dijalog zadržava fokus, Esc ga zatvara, fokus se vraća na gumb odjave.

## 2. Student

- [ ] Moji zadaci: naslovi kolegija i zadataka čitaju se kao naslovi; rok se čita cijelim datumom.
- [ ] Upis kodom: pogreška (krivi kod, istekao kod) najavi se bez pomicanja fokusa i povezana je s poljem.
- [ ] Obavijest zadatka: potvrda je gumb s jasnim imenom; nakon potvrde stanje se najavi.
- [ ] Editor: list papira čita se kao polje za uređivanje s imenom rada; traka alata je traka alata, strelice se kreću po gumbima, stanje gumba (uključeno/isključeno) se najavljuje.
- [ ] Editor: promjena stanja spremanja („Sinkroniziram”, „Spremljeno na poslužitelju”, „Spremljeno na uređaju”) najavi se bez prekidanja pisanja.
- [ ] Editor: druga kartica s istim radom najavljuje blokadu.
- [ ] Predaja: koraci (izjava, pregled, slanje, potvrda) najavljuju trenutačni korak; potvrda predaje čita se cijela.
- [ ] Dnevnik pristupa i reprodukcija: tablica ima zaglavlja; reprodukcija se može zaustaviti s tipkovnice (WCAG 2.2.2).

## 3. Nastavnik

- [ ] Moji kolegiji i radovi uz mentora: popisi se čitaju kao popisi, poveznice imaju ime rada.
- [ ] Novi zadatak: svako polje ima oznaku; pogreške obrasca najavljuju se i vode na polje.
- [ ] Zbirni pregled: tablica ima zaglavlja stupaca i redaka; razvrstavanje najavljuje smjer.
- [ ] Rad uživo i potvrda predaje: zaključano stanje najavi se tekstom, ne samo bojom.

## 4. Administrator ustanove

- [ ] Kolegiji: izrada kolegija najavljuje pogrešku i uspjeh; gumb tijekom slanja najavljuje zauzetost.
- [ ] Korisnici i pravila: tablice i obrasci kao gore.

## 5. Opće

- [ ] Uvećanje preglednika na 200 % i 400 %: ništa se ne reže i ne preklapa (WCAG 1.4.4, 1.4.10). Pazi na redak računa u uskoj bočnoj traci („Student · Postavke profila · Odjava”) na 1250 px.
- [ ] Razmak teksta (WCAG 1.4.12): s bookmarkletom za razmak teksta sadržaj ostaje čitljiv.
- [ ] Obje teme: kontrast ilustracija na karticama kolegija s tekstom preko njih (axe ga ne može izmjeriti, „incomplete”).
- [ ] Izjava o pristupačnosti: naslovi odjeljaka mogu se preskakati tipkom H; kontakt Povjerenika za informiranje točan je na dan objave.

Nakon zapisa svih stavki bez neprolaza vlasnik odlučuje mijenja li se `COMPLIANCE` u `"full"`; to mijenja i tekst izjave i test u `statement.spec.ts`.
