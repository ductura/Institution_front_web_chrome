# src/components/support

Model obrasca „Prijavi problem” (DAN-873, web 2.c4) za rutu `support.problem-report.post`. Prenesen je iz Ductusa DAN-431 (`src/components/support/problem-report-client.ts` i `src/domain/support/problem-report.ts` na `393b8e0`). Mrežni dio nije prenesen: poziv ide kroz `src/client` u sljedećem rezu (873-2).

| Datoteka | Što radi |
| --- | --- |
| `problem-report.ts` | `checkDescription` provjerava opis: prazan, predug (više od 1000 kodnih točaka) i nedopušteni znakovi.<br>`buildProblemReportBody` gradi tijelo s ključevima abecednim redom (oblik JCS).<br>`problemReportRoute` zamjenjuje adresu stranice njezinim predloškom iz zatvorenog popisa od 27 predložaka, pa identifikatori, upit i sidro ne napuštaju stranicu. Adresa izvan popisa daje `null`.<br>`browserFromUserAgent` iz User-Agenta šalje samo obitelj preglednika i glavnu verziju.<br>`outcomeFromResponse` iz odgovora rute izvodi potvrdu ili ključ teksta iz `locales/`.<br>`retryAtFrom` čita `retry-after` za 429. |
| `fixtures/support.problem-report.post.json` | Doslovna kopija vektora rute iz ductura/server `ea171eff` (Ductus#1836 c.6926566704), git blob `6bfb2d3265e581ebad1ada98d35bac960f0c6193`, isti kao u `test-fakes-v1.0.0`. Test provjerava blob nakon pretvorbe CRLF u LF. |
| `problem-report.test.ts` | Vektori rute: uspjeh, svaka greška i 429. Pokriva i negativne razrede opisa, zaglavlja `retry-after` i ključa `messageKey`. Tekstovi koje model može vratiti provjeravaju se skenerom zabranjenih izraza. |

## Odluke

- **Tekstovi grešaka.** Za 401, 413, 422, 429 i 503 tekst je iz `support.failure.*`, kao u Ductusu. Za ostale statuse to je `messageKey` iz tijela greške, ali samo ako počinje s `errors.` i ako je vlastiti tekst u `messagesHr` i `messagesEn`. Inače se prikazuje `support.failure.unknown`.
- **Ključ `errors.tooManyReports`.** Web katalog ga još nema, a `locales/` se mijenja samo zajedno sa serverom.
- **Zaglavlje `retry-after`.** Prima se samo `delay-seconds` (RFC 9110, `1*DIGIT`), od 0 do 86400 sekundi. Ugovor rute ne navodi to zaglavlje, pa se HTTP-datum i sve ostalo čita kao `null`. Vrijeme ulazi kao argument `now`, pa model ne čita sat.
- **Lažni server.** Testovi ne uvoze `@ductura/test-fakes`. Paket je ovisnost samo paketa `src/client`, a ne posla `ui` u CI-ju. Umjesto paketa testovi čitaju kopiju vektora.
- **Izvorni testovi koji ovdje nisu.** U Ductusu `problem-report-client.test.ts` na `393b8e0` sadrži i slanje (`fetch`, točni bajtovi i kolačić), rok i prekid zahtjeva, jedan zahtjev po slanju te slanje nakon završene sesije. Te provjere idu u 873-2, zajedno s pozivom kroz `src/client`, jer `no-direct-api` ovdje ne dopušta `fetch`. Provjera „server parsira tijelo” zamijenjena je jednakošću bajtova s vektorima uspjeha. Blok testova „source parity” redak po redak prenosi svaku izvornu tvrdnju o onome što web gradi i čita. Obuhvaća opis, kategoriju, odgovore servera i svojstva predloška i preglednika. Redci samog serverskog parsera provjeravaju serverski parser, a ne web: višak ili manjak ključeva, vrijednost koja nije običan objekt, verzija aplikacije i stanje sinkronizacije. Model te dvije vrijednosti prosljeđuje onakve kakve jesu, a vrijednost izvan sheme odbija `src/client` prije mreže (873-2). Na webu ih zamjenjuje test da se gradi točno šest ključeva.
