# Specifikacija: prikaz uživo za nacionalni opseg (NAC-SPEC-UZIVO)

**Status: PRIJEDLOG. Samo dokument.** Ništa se ne gradi dok Daniel ne odgovori
„da” (ovaj prijedlog mijenja ugovor `live.document.*`, pa je odluka vlasnika).
Nema promjene koda, ugovora, staginga ni testa opterećenja.

Izvor odluke: Daniel 27. 11. 2026. u chatu orkestratora („Da, otvori val
nacionalni opseg s fazom 1 nakon F4”). Cilj projektiranja: ~15.000 aktivnih
pisaca uz 2x rezervu; 150.000 kao test izdržljivosti. Ulaz: `model-klijenta.md`
(NAC-F1-WEB), brojevi su procjene iz koda, ne mjerenja.

## 1. Problem (iz modela klijenta)

| # | Danas | Posljedica pri 15.000 pisaca |
| --- | --- | --- |
| P1 | Student objavljuje (`live.document.put`) i **kad nitko ne gleda** (§1.1) | Do 12 PUT/min po aktivnom piscu bez ikakve koristi; 15.000 × 12 = 180.000 PUT/min u najgorem razumnom slučaju |
| P2 | Svaki PUT i svaki 200 GET nosi **cijeli dokument** (D ≈ 3–45 KB) | Bajtovi rastu s duljinom rada, ne s veličinom promjene |
| P3 | Čitatelj pita **svake 1 s** (≤ 60 GET/min po kartici) i bez promjene (§1.2) | n kartica nastavnika = n × 60 GET/min; većina odgovora je 304 bez ikakve informacije |

Evidencija (`evidence.commit.post`) nije dio problema i ovdje se ne dira (§6).

## 2. Prijedlog

### 2.1 Objava samo dok postoji ovlašteni gledatelj

- Student objavljuje stanje uživo **samo dok poslužitelj zna da postoji barem
  jedan ovlašteni gledatelj** tog rada (nastavnik zadatka ili mentor rada, i
  student u istom prikazu; pristup nastaje iz odnosa, Ustav C-23). Uloga sama
  ne daje pristup.
- Gledatelj se prijavljuje kratkim zakupom (lease) koji istječe sam (predloženo
  30 s uz obnovu svakih 15 s). Zakup nestaje i kad kartica postane skrivena
  (danas čitač u tom slučaju staje, `live-reader.ts:199-202`) i na `pagehide`.
- Student saznaje „ima/nema gledatelja” iz odgovora na vlastiti zahtjev ili iz
  kanala obavijesti (§2.3); **ne zna tko gleda** ni koliko ih je, samo
  logičku vrijednost. Bez gledatelja: ne šalje ništa; zadnje stanje čeka
  lokalno (kao danas pod `held`, `live-publisher.ts:151`).
- Kad gledatelj stigne: student odmah pošalje **jedno** cijelo stanje
  (početna točka), zatim razlike (§2.2).
- Otvoreno stanje „nema ovlaštenog gledatelja” je **pošteno stanje**, ne
  greška: nastavnik koji otvori rad dobiva zadnje poslano stanje (ako postoji)
  s oznakom starosti, pa čim student primi zakup, osvježenje.

### 2.2 Razlike umjesto cijelog dokumenta

- Nakon početne točke student šalje **razliku između dva kanonska dokumenta**
  (stanje A → stanje B), ne cijeli dokument. Svaka razlika nosi `baseHash`
  (SHA-256 stanja na koje se primjenjuje) i `resultHash` (SHA-256 JCS bajtova
  stanja koje nastaje).
- Čitatelj primijeni razliku samo ako je `baseHash` jednak hashu dokumenta koji
  drži; zatim **sam izračuna JCS bajtove i provjeri `resultHash`**. Nepodudaranje
  ili nepoznat `baseHash` = traži cijelo stanje (početna točka). Time ostaje
  postojeće pravilo da se dokument prikazuje samo iz točnih JCS bajtova čiji je
  SHA-256 jednak ETag-u (`live-reader.ts:15-18`).
- Početna točka i periodički „ključni okvir” (predloženo svakih 50 razlika ili
  kad zbroj razlika prijeđe polovicu D) ograničavaju lanac koji novi čitatelj
  mora primijeniti.
- **Ograničenje sadržaja razlike (granica prema PRODUCT §5, pravilo 4):**
  razlika opisuje samo razliku između dva **objavljena kanonska stanja**; ne
  smije sadržavati korake uređivanja, ključeve tipki, vremena događaja, ritam
  ni redoslijed unutar razmaka između dvije objave. Dvije objave u razmaku od
  ≥ 1 s koje se zbroje u jednu razliku ne smiju se dati razlikovati. Ako se
  to ne može jamčiti, razlika se ne uvodi (§5, pitanje Q1).
- Procjena (iz modela, k = 12/min): kraći D ≈ 3 KB, veći ≈ 45 KB. Razlika za
  uobičajeni unos ≈ 0,2–2 KB neovisno o D, dakle uz dugi rad
  540 KB/min → ≈ 24 KB/min po aktivnom piscu s gledateljem (procjena, mjeri
  NAC-F1-SRV).

### 2.3 Kanal obavijesti umjesto upita svake 1 s

- Čitatelj umjesto 60 GET/min drži **jedan kanal obavijesti** po prikazu
  (predloženo Server-Sent Events preko postojeće sesije i
  `/api/v1`; WebSocket se ne uvodi bez odluke). Kanal nosi samo
  `{documentId, resultHash, baseHash}`; samo tijelo razlike čitatelj dohvaća
  postojećom vrstom zahtjeva ili je kanal nosi ako je ≤ 8 KB (otvoreno, Q3).
- Kanal je **dopuna, ne zamjena**: dok kanal nije dostupan (nema podrške,
  prekid, proxy koji ga reže), čitatelj se vraća na današnje upitivanje,
  ali **sporije** (predloženo 5 s uz isti backoff 2 s → 30 s, `jitter` ±20 %
  kako ne bi nastao „stampedo” nakon prekida).
- Skrivena kartica: kanal se zatvara (0 zahtjeva), kao danas.
- Čitatelj uvijek provjerava `resultHash` (§2.2); obavijest sama ništa ne
  prikazuje.
- Prekid kanala ne smije stvoriti val: ponovno spajanje s eksponencijalnim
  odgodom i jitterom; poslužitelj ograničava broj kanala po korisniku
  (predloženo 6; ostali dobivaju upitivanje).

### 2.4 Evidencija ostaje odvojena

- `evidence.commit.post`, `evidence.open.post`, dnevnik, drain i potpisane
  potvrde se **ne mijenjaju**. SYNCED i dalje znači samo potpisanu potvrdu
  evidencije.
- Stanje uživo ne ulazi u evidenciju, ne služi kao dokaz autorstva, ne ulazi u
  ocjenu ni izvoz; zakup gledatelja se **ne zapisuje** kao trajni podatak
  (živi samo u memoriji poslužitelja do isteka).
- Dnevnik pristupa: ako postojeća pravila bilježe čitanje uživo, ostaju kakva
  jesu; razlike i zakupi ne dodaju nove zapise osim ako vlasnik odluči
  drukčije (Q4).

## 3. Što se dobiva (procjena iz koda, nije mjerenje)

Pretpostavke kao u `model-klijenta.md` §3 (12 spremanja/min, D 3–45 KB).
Pretpostavka o gledanosti: u jednom trenutku gleda 10 % aktivnih pisaca.

| Mjera | Danas | S prijedlogom |
| --- | --- | --- |
| PUT/min, 15.000 aktivnih pisaca | do 180.000 | do 18.000 (samo uz gledatelja) |
| Bajtova PUT/min po piscu, veći D | ≈ 540 KB | ≈ 24 KB (razlike) |
| GET/min po kartici nastavnika | ≤ 60 | ≈ 0 dok kanal radi; ≤ 12 u povratnom načinu |
| Zahtjevi mirnog studenta | 0 | 0 |

Brojevi su gornje procjene za planiranje; stvarne vrijednosti daje mjerenje
(NAC-F1-SRV). Ako mjerenje pokaže da P1–P3 nisu uski grlo, prijedlog se ne
gradi.

## 4. Posljedice za ugovor (zato treba Danielovo „da”)

Ovo **nije** aditivna promjena postojeće rute (`live.document.get/put`,
`contracts:breaking` bi odbio promjenu odgovora i prava). Potrebno je:

1. Novi zakup gledatelja (npr. `live.viewer-lease.put`), nova ruta, nova
   verzija ugovora.
2. Nova ruta razlika (`live.delta.put/get`) uz zadržan cijeli `live.document.*`
   kao povratni način.
3. Kanal obavijesti (nova ruta, SSE).
4. Nova stanja na poslužitelju (zakup, zadnji hash, lanac razlika); ako je
   trajno (ne samo memorija), nova tablica = RLS + pgTAP retci i migracija
   (Daniel odlučuje, Q2).

Pravo pristupa se **ne širi**: iste granice kao danas (nastavnik zadatka,
mentor rada, student u istom prikazu); tuđi rad = 404.

## 5. Otvorena pitanja za Daniela

- **Q1 (PRODUCT §5, pravilo 4):** je li razlika između dva kanonska stanja
  dopuštena kad ne nosi korake, ključeve ni vremena? Ako se vlasnik ne slaže,
  ostaje samo §2.1 i §2.3 (cijeli dokument, ali samo uz gledatelja i bez
  upitivanja).
- **Q2:** zakup samo u memoriji poslužitelja (zadano preporuka) ili u bazi?
- **Q3:** nosi li kanal tijelo razlike ili samo hash?
- **Q4:** bilježi li se zakup gledatelja u dnevnik pristupa?
- **Q5:** SSE preko postojeće domene i sesije dovoljan ili traži infrastrukturnu
  odluku (proxy/vremenski rokovi)?

Preporuka: uvesti u koracima, svaki zaseban PR i zasebna odluka: (1) zakup
gledatelja i objava samo uz gledatelja, (2) kanal obavijesti, (3) razlike.
Prvi korak sam daje najveći dobitak za P1 uz najmanju promjenu ugovora.

## 6. Izvan opsega

- Evidencija i drain (ne dira se).
- Stvarno mjerenje, staging, test opterećenja (Faza 1 i Danielovo odobrenje).
- Slides/spreadsheet spremači u `packages/app/src/host/` (model vrijedi za
  tekstni rad).
- Kod, ugovor, migracije, `locales/`.

## 7. Prihvaćanje ovog dokumenta

- [ ] Daniel odgovara na Q1–Q5 i odobrava (ili odbija) korake iz §5.
- [ ] Nakon odluke orkestrator otvara zasebne SRV i WEB zadatke po koracima.
