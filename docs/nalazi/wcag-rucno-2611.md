# WCAG-RUCNO – ručna provjera na stvarnom stogu (26. 11. 2026.)

Zadatak: WCAG-RUCNO (DAN-428). Ručna provjera prema WCAG 2.1 AA na lokalnom stvarnom stogu: SRV `0260a28d`, WEB `51d3e8e0` (`next dev`), edge `:8000`, lažni OIDC `:8090`. Svi podaci su izmišljeni (demo fakultet, demo računi). Provjera je napravljena u Chromeu (Claude in Chrome), na prozoru 1904×629 px. Za svaki ekran provjereni su:

- tipkovnica: Tab, Shift+Tab, Enter, strelice i Esc;
- vidljivost fokusa;
- stablo pristupačnosti: nazivi, uloge, naslovi, orijentiri i žive regije;
- kontrast izračunat iz stilova;
- raspored u okviru širine 640 px (zum 200 % na 1280 px) i 320 px (zum 400 %).

Dokument samo bilježi nalaze, bez proizvodnog koda. Svaki nalaz je prijedlog zadatka za Orkestratora. Raniju matricu na lažnom poslužitelju vidi u [VIZ-WCAG](VIZ-WCAG.md).

## Pokriveni tokovi

| Tok | Ekrani |
|---|---|
| Prijava | „Demo prijava” (lažni OIDC, samo lokalno i u CI-ju) |
| Student | `/zadaci`, `/zadatak/{id}` (upute i potvrda obavijesti), `/rad/{id}` (prije početka i editor), predaja koraci 2–5: `izjava`, `pregled` („Prije predaje”), `slanje` s dijalogom potvrde, `potvrda`; dijalog „Odjava” |
| Nastavnik | `/nastavnik` (Moji kolegiji), `/nastavnik/zadatak/{id}/predaje`, `/nastavnik/brz-put` |

## Sažetak

| Područje | Ishod |
|---|---|
| Tipkovnica | PROLAZ uz W3 i W9. Nema zamke fokusa. „Preskoči na sadržaj” postoji i radi. Alatna traka editora koristi jedan Tab i strelice (roving tabindex). Izbornici editora rade sa strelicama, a Esc vraća fokus na gumb. Dijalozi „Odjava” i „Prvi koraci” drže fokus i zatvaraju se tipkom Esc. Dijalog „Predati rad?” je modalni `<dialog>` s fokusom na prvom gumbu (Esc nije isproban, da se predaja ne bi ponavljala). |
| Vidljiv fokus | PROLAZ na svim provjerenim ekranima: zlatni obrub. |
| Nazivi, uloge, orijentiri | Uglavnom PROLAZ: `lang="hr"`, naslovi stranica, `main`, nijedna kontrola bez naziva, sva polja imaju oznaku. Tablica predaja ima `caption`, `scope`, `aria-sort`, najavu sortiranja i omotač s `aria-labelledby`. Koraci predaje imaju `aria-current`, a promjenu rute najavljuje Next najavljivač (naslov stranice). Nalazi W2, W3, W4 i W7. |
| Kontrast | Jedan NALAZ (W1). Ostali tekst prolazi 4,5:1 odnosno 3:1 prema heurističkoj provjeri iz stilova (vidi ograničenja). |
| Raspored 640 px (zum 200 %) | PROLAZ: `/zadaci`, `/zadatak/{id}`, `potvrda`, `/nastavnik`, `predaje`, `brz-put`. Editor: stranica stane, ali utor gornje trake reže 18 px (W6). |
| Raspored 320 px (zum 400 %) | `/zadaci`, `predaje`, `brz-put`, `/nastavnik`, `potvrda` PROLAZ. Editor NALAZ (W6). |
| Nastavnikov pregled (Brz put) | PROLAZ: navigacija „Studenti” s `aria-current`, „Sljedeći” zadržava fokus, žive regije (`polite`, `status`) dobivaju tekst, nema kontrola bez naziva. Jedini niski kontrast je značka W1. |
| Predaja (koraci 2–5) | PROLAZ uz W7 i W8. Statusne poruke spremanja izjave, potvrde i „Kopiraj otisak” („Otisak je u međuspremniku …”) idu u `role="status"`. |
| Ostalo | W5 (preporuka), W9 (niska važnost). |
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
Napomena: kod je na putanji editora koju ima Lab (`src/components/editor/`), pa zadatak ide vlasniku te putanje.

### W3 – „Otvori predanu verziju” ne premješta fokus (2.4.3 Focus Order, A)

Ekran: `/nastavnik/zadatak/{id}/predaje`. Gumb prikazuje predanu verziju ispod tablice (`h3` „Predana verzija: …” unutar `section` s nazivom). Fokus ostaje na gumbu, a nijedan roditelj prikaza nema živu regiju. Kad u tablici ima šest redaka, sadržaj se pojavi izvan vidljivog dijela ekrana, pa korisnik tipkovnice ili čitača zaslona ne zna da se išta dogodilo.

Prikazana verzija je novi sadržaj, ne statusna poruka, pa je mjerodavan 2.4.3, a ne 4.1.3.

Koraci: kao nastavnik otvorite „Predaje” za zadatak s više predaja, Tabom dođite do „Otvori predanu verziju” i pritisnite Enter.
Prijedlog: premjestiti fokus na naslov prikazane verzije (`tabindex="-1"`), a nakon „Zatvori” ga vratiti na gumb.

### W4 – Studenti se u tablici predaja i u nazivima gumba prikazuju kao UUID (2.4.6 Headings and Labels, AA; 2.4.4 Link Purpose)

Isti ekran. U stupcu „Student” i u nazivima gumba piše, na primjer, „Otvori predanu verziju: 367b9c9b-d29f-…” i „Povijest predaja: …”. Čitač zaslona čita cijeli UUID, a vizualno se 36 znakova lomi u pet redaka.

Brz put za isti zadatak prikazuje studente drukčije (imenom), pa prikaz nije dosljedan. Prijedlog: kratka čitljiva oznaka („Student 1”…) ili ime, prema pravilu prikaza koje odredi vlasnik, ali nikad sirovi UUID kao vidljivi tekst ili naziv kontrole.

### W5 – Natpisi u bočnoj traci lome se usred riječi (preporuka; 1.4.8 i 1.4.12)

Pojavljuje se na svim ekranima s bočnom trakom na širini računala (prozor 1904×629 px). Navigacija je široka 40 px, a stil natpisa je `overflow-wrap: break-word` uz `hyphens: manual`, pa se riječi lome bez crtice. Stvarni prijelomi kod studenta, izmjereni iz DOM-a:

- „Moji / zadaci”, „Upis u / kolegij”;
- „Radni / prosto / r”;
- „Kako / Duct / ura / radi”;
- „Izjava / o / pristup / ačn / osti”;
- „Prijavi / prob / lem”, „Post / avke / profila”, „Odjav / a”.

Kod nastavnika su „Postavke profila” (donji rub na 680 px) i „Odjava” (730 px) ispod visine prozora od 629 px, pa do njih treba pomicati traku. Nazivi kontrola su ispravni, pa ovo nije pad kriterija A ili AA, ali se teško čita i pogađa korisnike s povećanim tekstom.

Prijedlog: šira traka ili samo ikone s vidljivim opisom pri fokusu ili prelasku mišem, bez lomljenja riječi.

### W6 – Gornja traka editora na 320 px postaje uzak klizni prozor (1.4.10 Reflow, AA)

Ekran: `/rad/{id}` (rad u tijeku) u okviru širine 320 px. Stranica se ne pomiče vodoravno (širina sadržaja 305 px), ali utor gornje trake (`WorkspaceTopBar` slot, `overflow-x: auto`) širok je samo 38 px i skriva 376 px kontrola: „Prečaci”, „Povijest” i „Raspored ▾” (u njemu „Samo naslovi”, „Povijest i usporedba” i širine „Uska”, „Srednja”, „Široka”). Do njih se dolazi samo vodoravnim pomicanjem unutar 38 px. I na 640 px (zum 200 %) utor je uži od sadržaja (358 px prema 376 px), pa je dio „Raspored ▾” odrezan.

Koraci: otvorite editor na 320 px ili zumirajte na 400 % na 1280 px.
Napomena: `WorkspaceTopBar.tsx` je Lab putanja.

### W7 – Struktura naslova (napomena uz 1.3.1)

- `/rad/{id}` prije početka rada („Rad još nije započet”) nema nijedan naslov. „Počnite pisati…” izgleda kao naslov, ali nije. Nakon „Započni rad” postoji `h1` s naslovom rada.
- `/rad/{id}/predaja/izjava`: nakon `h2` „Vaša izjava” dolazi `h4` „Izjava o ljudskoj pomoći”, što preskače razinu.

Napomena: oba ekrana su na Lab putanjama (`host/student/work/**`, `host/student/submission/`).

### W8 – Odbijeno spremanje izjave ne kaže uzrok (3.3.1 Error Identification, A; 3.3.3 Error Suggestion, AA)

Ekran: `/rad/{id}/predaja/izjava`, „Spremi izjavu” i „Spremi popis alata”. Na radu koji ima spremljenu reviziju spremanje radi: PUT `/declaration` vraća 200, živa regija javlja „Izjava o pomoći je spremljena na poslužitelju.”, „Potvrđujem izjavu” se sprema i predaja se može dovršiti (koraci 3–5 provedeni do „Predano …”).

Ranije u ovoj provjeri, na istom stogu, „Spremi izjavu” i „Spremi popis alata” nisu poslali nijedan zahtjev i živa regija je prikazala samo „Izjavu nije bilo moguće spremiti. Pokušaj ponovno.” Ponovno izazvati grešku nije uspjelo: rad bez revizije uopće ne pušta na izjavu (preusmjerava na upute). Vjerojatni uzrok, pročitan iz koda (`writeDraft` i `nextDraft` u `src/client/declaration.ts`), jest da klijent sam odbije spremanje kad `currentRevision` nije barem 1 ili kad sesija koraka nema stanje izjave, i tada uvijek pokaže istu generičku poruku. Nalaz je u tome što poruka ne kaže uzrok, a ponovni pokušaj ne pomaže.

Prijedlog: za svaki razlog odbijanja na klijentu posebna poruka koja kaže što učiniti (npr. za rad bez spremljene verzije: „Vratite se u editor i spremite rad.”), a za neuspjeh na poslužitelju poruka s uputom za ponovni pokušaj. Poruka se obraća korisniku s „ti”, a ostatak sučelja s „Vi” (već zabilježeno u lekturi kao L-02-051).
Napomena: `declaration.ts` i `submission/` su Lab putanje.

### W9 – Potvrda obavijesti gubi fokus (2.4.3 Focus Order, niska važnost)

Ekran: `/zadatak/{id}`, „Potvrdi i otvori editor”. Gumb se zamijeni okvirom „Potvrđeno … Otvori editor” i fokus padne na `body`. Sljedeći Tab dolazi na „Otvori editor”, pa to nije zamka, ali čitač zaslona ne čuje potvrdu.
Prijedlog: fokus na novi okvir ili na „Otvori editor”.

Isto ponašanje (fokus na `body`) imaju i prijelazi između koraka predaje („Dalje”), ali tamo Next najavljivač rute pročita naslov nove stranice, pa to nije nalaz.

## Funkcionalna zapažanja (izvan WCAG-a, za Orkestratora)

1. **Editor:** pri brzom tipkanju u `/rad/{id}` konzola javlja `Maximum update depth exceeded`, a stog prolazi kroz `Editor.emit` (tiptap) i `forceStoreRerender`. Viđeno na razvojnom buildu (`next dev`), koji ovakve greške javlja glasnije od produkcijskog. Tekst se vidi upisan, ali treba provjeriti gubi li se spremanje. Ovo je Lab putanja editora.
2. **Izjava:** jednom je „Spremi izjavu” odbijeno bez zahtjeva prema poslužitelju (W8), a kasnije na drugom radu spremanje radi. Točan uvjet nije ponovljen. Treba ga utvrditi testom na Lab putanji `declaration.ts`.

## Ograničenja provjere

- Nije korišten pravi čitač zaslona (NVDA). Nazivi i uloge čitani su iz DOM-a i stabla pristupačnosti u Chromeu.
- Kontrast je izračunat heuristički iz računatih stilova (boja teksta prema prvoj neprozirnoj podlozi roditelja). Tekst na slikama, gradijentima i poluprozirnim podlogama nije obuhvaćen. Po ekranu je ispisano najviše 12 pogodaka, a stvarni pogoci bili su samo W1.
- Zum je simuliran okvirom (`iframe`) širine 640 i 320 px, ne stvarnim zumom preglednika.
- Svijetla tema provjerena je samo za W1. Ostalo je provjereno u tamnoj temi.
- Predaja je provedena do kraja na jednom demo radu („kućno kompostiranje”, demo studentica), pa je taj rad na demo stogu sada predan. Povlačenje predaje nije isprobano.
- Greška iz W8 nije ponovljena; uzrok je vjerojatan, pročitan iz koda.
- Nisu obuhvaćeni „Radovi uz mentora”, „Zbirni” ni recenzija među studentima.
