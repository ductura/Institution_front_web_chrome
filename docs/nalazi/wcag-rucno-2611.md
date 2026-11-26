# WCAG-RUCNO – ručna provjera na stvarnom stogu (26. 11. 2026.)

Zadatak: WCAG-RUCNO (DAN-428). Ručna provjera prema WCAG 2.1 AA na lokalnom stvarnom stogu: SRV `0260a28d`, WEB `51d3e8e0`, edge `:8000`, lažni OIDC `:8090`. Svi podaci su izmišljeni (demo fakultet, demo računi). Provjera je napravljena u Chromeu (Claude in Chrome). Za svaki ekran provjereni su:

- tipkovnica: Tab, Shift+Tab, Enter, strelice i Esc;
- vidljivost fokusa;
- stablo pristupačnosti: nazivi, uloge, naslovi, orijentiri i žive regije;
- kontrast izračunat iz stilova;
- raspored na 320 px, mjeren u okviru širine 320 px, što odgovara zumu od 400 %.

Dokument samo bilježi nalaze, bez proizvodnog koda. Svaki nalaz je prijedlog zadatka za Orkestratora. Raniju matricu na lažnom poslužitelju vidi u [VIZ-WCAG](VIZ-WCAG.md).

## Pokriveni tokovi

| Tok | Ekrani |
|---|---|
| Prijava | „Demo prijava” (lažni OIDC, samo lokalno i u CI-ju) |
| Student | `/zadaci`, `/zadatak/{id}` (upute i potvrda obavijesti), `/rad/{id}` (prije početka i editor), `/rad/{id}/predaja/izjava`, dijalog „Odjava” |
| Nastavnik | `/nastavnik` (Moji kolegiji), `/nastavnik/zadatak/{id}/predaje`, `/nastavnik/brz-put` |

## Sažetak

| Područje | Ishod |
|---|---|
| Tipkovnica | PROLAZ. Nema zamke fokusa. „Preskoči na sadržaj” postoji i radi. Alatna traka editora koristi jedan Tab i strelice (roving tabindex). Izbornici editora rade sa strelicama, a Esc vraća fokus na gumb. Dijalozi „Odjava” i „Prvi koraci” drže fokus i zatvaraju se tipkom Esc. |
| Vidljiv fokus | PROLAZ na svim provjerenim ekranima: zlatni obrub. |
| Nazivi, uloge, orijentiri | Uglavnom PROLAZ: `lang="hr"`, naslovi stranica, `main`, nijedna kontrola bez naziva, sva polja imaju oznaku. Tablica predaja ima `caption`, `scope`, `aria-sort` i najavu sortiranja. Koraci predaje imaju `aria-current`. Nalazi W2, W3, W4 i W7. |
| Kontrast | Jedan NALAZ (W1). Ostali tekst prolazi 4,5:1 odnosno 3:1. |
| Raspored 320 px | `/zadaci` i `predaje` PROLAZ. Editor NALAZ (W6). |
| Ranije VIZ-WCAG stavke | N1 (predaje na 320 px), N2 (cilj PDF/DOCX, sada 58×44 i 73×44 px) i N4 (poveznica za preskakanje) su na stvarnom stogu **popravljeni**. |

## Nalazi

### W1 – Broj na zvonu obavijesti je nevidljiv u tamnoj temi (1.4.3 Contrast Minimum, AA)

Pojavljuje se na svim ekranima s bočnom trakom, i za studenta i za nastavnika. Značka s brojem nepročitanih obavijesti (`NotificationBell` badge) u tamnoj temi ima bijeli tekst `#FFFFFF` od 11 px na podlozi `#FAF9F5`, što je kontrast 1,05:1, pa se broj ne vidi. U svijetloj temi kontrast je ispravan (bijelo na `#242422`).

Čitač zaslona broj ipak dobiva, jer je značka `aria-hidden`, a gumb ima naziv „Obavijesti, nepročitanih: 1”. Vidljivi tekst svejedno mora imati kontrast.

Koraci: prijavite se kao demo student ili nastavnik u tamnoj temi i pogledajte zvono u bočnoj traci.
Prijedlog: u tamnoj temi koristiti tamni tekst na svijetloj znački ili tamnu podlogu značke (token).

### W2 – Pet gumba izbornika u editoru nema `aria-expanded` (4.1.2 Name, Role, Value, A)

Ekran: `/rad/{id}`, traka editora. Gumbi „Umetni”, „Pretvori”, „Posebni znak”, „Prikaz” i „Izvezi” imaju `aria-haspopup="menu"`, ali nemaju `aria-expanded`, ni kad je izbornik zatvoren ni kad je otvoren. Čitač zaslona zato ne javlja stanje. Gumbi „Čitaj naglas” i „Pomoć” to rade ispravno.

Koraci: otvorite editor, fokusirajte „Umetni” i pritisnite Enter. Izbornik se otvori i fokus prijeđe na stavku, ali `aria-expanded` ostaje bez vrijednosti.
Napomena: kod je na putanji editora koju ima Lab, pa zadatak ide vlasniku te putanje.

### W3 – „Otvori predanu verziju” ne premješta fokus i ništa ne najavljuje (2.4.3 Focus Order, A; 4.1.3 Status Messages, AA)

Ekran: `/nastavnik/zadatak/{id}/predaje`. Gumb prikazuje predanu verziju ispod tablice (`h3` „Predana verzija: …”). Fokus ostaje na gumbu i nema žive regije. Kad u tablici ima šest redaka, sadržaj se pojavi izvan vidljivog dijela ekrana, pa korisnik tipkovnice ili čitača zaslona ne zna da se išta dogodilo.

Koraci: kao nastavnik otvorite „Predaje” za zadatak s više predaja, Tabom dođite do „Otvori predanu verziju” i pritisnite Enter.
Prijedlog: premjestiti fokus na naslov prikazane verzije (`tabindex="-1"`), a nakon „Zatvori” ga vratiti na gumb.

### W4 – Studenti se u tablici predaja i u nazivima gumba prikazuju kao UUID (2.4.6 Headings and Labels, AA; 2.4.4 Link Purpose)

Isti ekran. U stupcu „Student” i u nazivima gumba piše, na primjer, „Otvori predanu verziju: 367b9c9b-d29f-…” i „Povijest predaja: …”. Čitač zaslona čita cijeli UUID, a vizualno se 36 znakova lomi u pet redaka.

Treba provjeriti je li to namjerna pseudonimizacija (anonimno ocjenjivanje). Ako jest, prijedlog je kratka oznaka („Student 1”…). Ako nije, treba prikazati ime iz upisa.

### W5 – Natpisi u bočnoj traci lome se usred riječi (preporuka; 1.4.8 i 1.4.12)

Pojavljuje se na svim ekranima s bočnom trakom na širini računala (provjereno na 1904 px). Traka je široka oko 40 px, pa se natpisi lome usred riječi: „Radni prosto / r”, „Moji kolegij / i”, „Izjava o prim- / pad- / nosti”, „Radovi uz mento / ra”. „Odjava” i „Postavke profila” su izvan ekrana, pa do njih treba pomicati traku. Nazivi kontrola su ispravni, pa ovo nije pad kriterija A ili AA, ali se teško čita i pogađa korisnike s povećanim tekstom.

Prijedlog: šira traka ili samo ikone s vidljivim opisom pri fokusu ili prelasku mišem, bez lomljenja riječi.

### W6 – Gornja traka editora na 320 px postaje uzak klizni prozor (1.4.10 Reflow, AA)

Ekran: `/rad/{id}` u okviru širine 320 px. Stranica se ne pomiče vodoravno (širina sadržaja 301 px), ali dio gornje trake (`WorkspaceTopBar` slot, `overflow-x: auto`) širok je samo 34 px i skriva 376 px kontrola: „Prečaci”, „Povijest”, „Kasparovi”, „Tamni list” i „Predaja rada”. Do njih se dolazi samo vodoravnim pomicanjem unutar 34 px.

Koraci: otvorite editor na 320 px ili zumirajte na 400 % na 1280 px.
Napomena: `WorkspaceTopBar.tsx` je Lab putanja.

### W7 – Struktura naslova (napomena uz 1.3.1)

- `/rad/{id}` prije početka rada („Rad još nije započet”) nema nijedan naslov. „Počnite pisati…” izgleda kao naslov, ali nije. Nakon „Započni rad” postoji `h1` s naslovom rada.
- `/rad/{id}/predaja/izjava`: nakon `h2` „Vaša izjava” dolazi `h4` „Izjava o ljudskoj pomoći”, što preskače razinu.

### W8 – Greška spremanja izjave ne kaže uzrok (3.3.1 Error Identification, A; 3.3.3 Error Suggestion, AA)

Ekran: `/rad/{id}/predaja/izjava`, „Spremi izjavu”. Poruka u živoj regiji glasi samo „Izjavu nije bilo moguće spremiti. Pokušaj ponovno.” Ne kaže što ne valja ni što učiniti. Poruka se obraća korisniku s „ti”, a ostatak sučelja s „Vi” (za lekturu).

Na demo stogu spremanje nije uspjelo ni nakon „Spremi popis alata”, a preglednik nije poslao nijedan zahtjev (vidi funkcionalna zapažanja). Zato predaja nije provedena do kraja (koraci 3–5).

### W9 – Potvrda obavijesti gubi fokus (2.4.3 Focus Order, niska važnost)

Ekran: `/zadatak/{id}`, „Potvrdi i otvori editor”. Gumb se zamijeni okvirom „Potvrđeno … Otvori editor” i fokus padne na `body`. Sljedeći Tab dolazi na „Otvori editor”, pa to nije zamka, ali čitač zaslona ne čuje potvrdu.
Prijedlog: fokus na novi okvir ili na „Otvori editor”.

## Funkcionalna zapažanja (izvan WCAG-a, za Orkestratora)

1. **Editor:** pri brzom tipkanju u `/rad/{id}` konzola javlja `Maximum update depth exceeded`, a stog prolazi kroz `Editor.emit` (tiptap) i `forceStoreRerender`. Tekst se vidi upisan, ali treba provjeriti gubi li se spremanje. Ovo je Lab putanja editora.
2. **Izjava:** „Spremi izjavu” na demo stogu ne šalje nijedan zahtjev i odmah javlja grešku (W8). Treba provjeriti je li to klijentska provjera bez objašnjenja ili prekinut tok.

## Ograničenja provjere

- Nije korišten pravi čitač zaslona (NVDA). Nazivi i uloge čitani su iz DOM-a i stabla pristupačnosti u Chromeu.
- Zum od 200 % nije mjeren zasebno. Raspored na 320 px (jednako zumu od 400 % na 1280 px) je stroži uvjet.
- Svijetla tema provjerena je samo za W1. Ostalo je provjereno u tamnoj temi.
- Nisu obuhvaćeni „Radovi uz mentora”, „Zbirni”, recenzija među studentima ni koraci predaje 3–5 (zbog W8).
