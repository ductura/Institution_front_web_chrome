# Model klijenta: što pravi klijent šalje po minuti (NAC-F1-WEB)

Ulaz za NAC-F1-SRV (mjerenje sata pisanja). Izmjereno čitanjem koda na bazi
`migracija/kopija-ductus-front` (464809469a6d). Proizvodni kod nije mijenjan.
Bez staginga, bez promjene ugovora. Brojevi su **izvedeni iz koda**, nisu
izmjereni na žici; što je procjena, označeno je „procjena”.

## 1. Što klijent radi (činjenice iz koda)

### 1.1 Objava uživo (student, `src/client/live-publisher.ts`)

- Jedan zahtjev u letu; promjene u međuvremenu se objedinjuju u zadnje stanje
  (`pending` se prepisuje, `live-publisher.ts:260`). Šalje se cijeli kanonski
  dokument (JCS bajtovi), nikad korak (`:4-8`, `:253-260`).
- Najmanji razmak: 1 s od početka prethodnog zahtjeva (`LIVE_PUBLISH_GAP_MS`,
  `:34`, `:141`). Gornja granica je dakle ≤ 60 PUT/min.
- Preskakanje nepromijenjenog: stanje jednako `accepted` (ili već odbijenom)
  ne šalje se (`settle()`, `:248-250`); vrijedi samo dok ništa nije u letu i
  zadnji odgovor je bio određen (`:263`).
- Što se nudi i kad: `offer()` zove samo `flushRef` u `LocalDocument.tsx:373-390`
  (red 388), tj. nakon stanke u pisanju od 400 ms (`DEBOUNCE_MS`, `:88`; timer
  se resetira na svaku izmjenu, `:413-420`), na `pagehide` i kad stranica
  postane skrivena (`:443-452`). Uz neprekinuto tipkanje bez stanke > 400 ms
  nema ponude.
- **Objavljuje se i bez gledatelja.** Izdavač ne zna ima li čitatelja; uvjet je
  samo `livePublishAllowed` (prijavljen, obavijest potvrđena, nije predano;
  `:47-53`, `LocalDocument.tsx:637-638`) i da nije zadržan (`held`, prikaz
  „Kako vidi nastavnik”, `:151`). Zadržano ne šalje ništa, a zadnje stanje čeka.
- Bez mreže: ne šalje; na `online` šalje zadnje stanje (`:158`, `:269-271`).
- Ponovni pokušaji nakon prekida: bez odgovora/5xx 2 s, udvostručuje do 30 s,
  bez jittera (`LIVE_PUBLISH_RETRY_*`, `:35-36`, `:233-239`). 409: uzme token i
  pošalje isto stanje još jednom (`:205-219`). 413/422: ista bajtovna sadržina
  se više ne šalje (`:225-232`). 401/404: stalni prekid do ponovnog učitavanja
  (`:220-224`).
- Zaglavlja: prvi put `If-None-Match: *`, zatim `If-Match: "<token>"`
  (`:171-176`).

### 1.2 Čitanje uživo (nastavnik i student u istom prikazu, `src/client/live-reader.ts`)

- Jedan zahtjev u letu; sljedeći 1 s nakon zadnjeg odgovora dok je stranica
  vidljiva (`LIVE_READ_INTERVAL_MS`, `:53`, `:246`) → ≤ 60 GET/min po kartici.
- Poslani `If-None-Match: "<hash>"` (`:70`): nepromijenjeno = 304 bez tijela;
  promjena = 200 s cijelim dokumentom (`:97-105`).
- Kad stranica nije vidljiva: `tick()` objavi „paused” i **ne zakazuje
  sljedeći** (`:199-202`); nastavlja tek na `visibilitychange` (`:249-252`).
  Skrivena kartica dakle šalje 0 zahtjeva/min.
- Kvar: 2 s, udvostručuje do 30 s (`LIVE_RETRY_*`, `:54-55`, `:241-244`);
  401/404 zaustavljaju čitač trajno (`:236-239`).
- Montirano: `LiveText.tsx:108` (`startLiveReader`), po jedan čitač po
  otvorenom prikazu rada. **Više kartica = više neovisnih čitača** (nema
  dijeljenja među karticama); n kartica nastavnika ⇒ n × 60 GET/min.

### 1.3 Spremanje evidencije (student, `evidence-session.ts`, `evidence-ingest.ts`)

- Okidač isti kao za objavu: `flushRef` → `saver.propose(doc)`
  (`LocalDocument.tsx:386`) nakon stanke od 400 ms / `pagehide` / skrivena
  stranica. Dok je spremanje u letu, novi prijedlog se prepisuje (`this.next`,
  `evidence-session.ts:357`, `:426-437`), dakle najviše jedan kandidat čeka.
- Jedno spremanje = jedan **segment** (svi događaji zabilježeni od zadnjeg
  segmenta: `recorder.takeSegment`, `:459-497`) zapisan u lokalni dnevnik, pa
  `kick()` → drain. Drain šalje **najnoviji** red i smatra starije
  nadomještenima (`planDrain`, `drain.ts:105-111`, `drain-runner.ts:103-122`).
- Jedan zahtjev `evidence.commit.post` nosi **segment i cijeli dokument**
  nakon njega, oboje base64 (`evidence-ingest.ts:375-381`): tijelo ≈
  4/3·(S + D) + ~0,3 KB ovojnice (UUID-ovi, revizija). Granice: segment ≤ 2 MiB,
  dokument ≤ 2 MiB (`:372`).
- Potvrda: **nema zasebnog provjeravanja potvrda.** Potpisana potvrda dolazi u
  odgovoru na commit (`evidence-ingest.ts:331-356`, provjera pod ključevima iz
  `evidence.open.post`, `:414-437`). Samo kad poslužitelj odgovori 202
  `pending_signature` (protokol „2”) redak ostaje, a **isti ključ se šalje
  ponovno** s odgodom 1, 2, 4, 8, 16 s pa 30 s zauvijek, ±20 % jitter
  (`drain.ts:488-516`, `isRetryable` `:790-799`, `drain-runner.ts:107`).
  Prestaje kad stigne potpisana potvrda (SYNCED) ili konačna odbijenica.
- Ritam: drain petlja šalje redak za retkom dok ih ima (`continue`,
  `evidence-session.ts:565-585`), pa je gornja granica dana trajanjem
  zahtjeva, ne vremenom; u praksi ≈ broj spremanja po minuti.
- `evidence.open.post`: pri učitavanju rada, ponovno samo ako je rad
  nepoznat (`retryOpen`, `:611-640`: na `online` i nakon spremljenog segmenta)
  i pri provjeri „predano?” nakon 409 `not_accepting` (≤ 1 zahtjev, rok 5 s;
  `evidence-session-deps.ts:86`, `:106-113`).
- Prekid: `transport_error` (5xx, 408, izgubljen odgovor) ⇒ isti ključ, backoff
  kao gore; bez mreže drain stoji do `online` (`:565`, `deps.network`).
  409 `stale_base`/`chain_conflict` i `txid_reused` ne ponavljaju se same
  (zadržan redak / dijalog sukoba).
- Probni zahtjev protokola: kartica prvi commit šalje pod „2”; ako dobije 426,
  isti zahtjev odmah još jednom pod „1” (jednom po kartici,
  `evidence-ingest.ts:139-187`, `:397-400`).

### 1.4 Više kartica istog rada

Dnevnik drži Web Lock `ductus-journal:<scope>:<documentId>` s `ifAvailable`
(`LocalDocument.tsx:709`): druga kartica dobije stanje „blocked” i **ne piše,
ne objavljuje i ne šalje evidenciju** dok prva ne pusti bravu (`:712-716`).
Student s n kartica istog rada šalje kao jedna; nastavnik s n kartica čita
n puta (1.2).

## 2. Model: događaji po minuti

Oznake: **D** = JCS bajtovi dokumenta, **S** = bajtovi jednog segmenta,
**k** = broj spremanja (flush nakon stanke ≥ 400 ms) u minuti.

| Događaj | Okidač | Zahtjeva/min | Bajtova po zahtjevu (gore) | Bajtova po zahtjevu (dolje) |
| --- | --- | --- | --- | --- |
| `evidence.commit.post` | spremanje segmenta | ≈ k (drain šalje najnoviji; za sporih odgovora manje) | ≈ 4/3·(S + D) + 0,3 KB | potpisana potvrda, procjena ~1–2 KB |
| `evidence.commit.post` ponavljanje (202) | `pending_signature` | 1 po isteku odgode (1, 2, 4, 8, 16, 30 s) dok ne stigne potvrda | isto kao gore (isti ključ) | procjena ~0,3 KB |
| `live.document.put` | ponuda nakon spremanja, ≥ 1 s razmaka | ≤ min(k, 60); preskače se nepromijenjeno | ≈ D (JCS tekst, pa JSON; uz zaglavlje If-Match) | procjena ~0,2 KB (token) |
| `live.document.get` (nastavnik, vidljiva kartica) | 1 s nakon odgovora | ≤ 60 po kartici | ~0,3 KB zaglavlja | 304: ≈ 0 tijela; 200: ≈ D (najviše uz svaku promjenu) |
| `evidence.open.post` | učitavanje; `online`; nakon segmenta ako rad nepoznat | ≈ 0 u mirnom radu | ~0,1 KB | ~1–3 KB (dokument D u base64 + ključevi) |

## 3. Bajtovi po minuti za kraći i veći dokument

Pretpostavke (procjena; mjeri NAC-F1-SRV): kraći D ≈ 3 KB (≈ 2 000 znakova),
veći D ≈ 45 KB (≈ 30 000 znakova). Aktivno pisanje ≈ 200 znakova/min s
pauzom ≥ 400 ms otprilike svakih 5 s ⇒ **k = 12**; događaj u segmentu ≈ 0,3 KB
(dva SHA-256 hexa = 128 B + koraci), pa S ≈ (200 / 12) · 0,3 KB + 0,6 KB
zaglavlja ≈ 5,6 KB po segmentu. Ovo je najgori razuman slučaj za **jednog**
studenta koji piše cijelu minutu.

| Scenarij (1 student, 1 minuta) | Zahtjeva/min | Gore (KB/min) kraći | Gore (KB/min) veći |
| --- | --- | --- | --- |
| Pisanje, bez gledatelja: commit | 12 | 12 × 11,8 ≈ **142** | 12 × 67,8 ≈ **814** |
| Pisanje, bez gledatelja: live PUT | 12 | 12 × 3 = **36** | 12 × 45 = **540** |
| **Ukupno student, pisanje** | **24** | **≈ 178** | **≈ 1 354** |
| Student miruje (otvoren rad, bez izmjena) | 0 | 0 | 0 |
| Nastavnik gleda (po kartici): GET | ≤ 60 | ≈ 18 (zaglavlja); uz promjene do +12 × 3 dolje | ≈ 18; uz promjene do +12 × 45 = 540 dolje |
| Nastavnik, skrivena kartica | 0 | 0 | 0 |

Napomene za SRV: (1) bajtovi za commit rastu s **D** (cijeli dokument ide uz
svaki segment), pa je trošak po spremanju gotovo linearan u duljini rada;
(2) objava uživo duplira slanje dokumenta (D) uz commit, neovisno o
gledateljima; (3) čitanje je jeftino dok nema promjena (304), skupo samo uz
promjene; (4) mirni student ne stvara ni jedan zahtjev, dok nastavnik s
otvorenim prikazom stvara 60 GET/min i bez ikakve promjene.

## 4. Što nije izmjereno (otvoreno)

- Stvarni S (veličina segmenta po minuti) i veličine odgovora: potrebno
  mjerenje na pravom klijentu ili uzorku povijesti; ovdje su procjene.
- Stvarni k: ovisi o ritmu pauza pri pisanju; model uzima 12/min.
- Zahtjevi koje pokreće drugi kod izvan opsega (komentari, obavijesti,
  asistent, izvori) nisu u ovom modelu.
- Slides/spreadsheet radovi (ostali formati koraka) imaju vlastite spremače u
  `packages/app/src/host/`; model vrijedi za tekstni rad (`LocalDocument.tsx`).
