# Inventar prototipa administracije Ducture (NF-7)

Datum: 23. 11. 2026. Izvor zadatka: Daniel, 23. 11. 2026. (odluke 1 do 8 za NF-7, doslovno u nalogu orkestratora na Ductus#2055). Nalaz: `docs/nalazi/nove-funkcije-7-operater-administracija.md` (OA-1 do OA-12, §0 postojeće operacije).

Prototip: `docs/prototip/Ductura_administracija.html` (uzor: `Ductura_nastavnik.html`; isti tokeni „papir i grafit”, isti usmjerivač po `#imenu`, ista traka prototipa sa stanjima). Kartice: `Ductura_administracija_kartice.html`. Uloge u prototipu (padajući izbornik „uloga”): operater (`network_engineer`) i administrator fakulteta (`institution_admin`). Svi podaci su izmišljeni (Fakultet A, Operater A, Administrator A, Student A). Svaki ekran ima oznaku „NF-7” i atribut `data-nf7="OA-n"`; stanja: puno, prazno, učitavanje, greška (OA-12).

Traka prototipa, bilješke ekrana i izbornik uloge nisu dio proizvoda.

## Stavke

| ID | OA | Ekran (`App.register`) | Uloga | Stanja u prototipu | Serverska ovisnost |
|---|---|---|---|---|---|
| NF7-OA1 | OA-1 | `mjerila`: Mjerila pilota | operater, administrator | puno, prazno, učitavanje, greška | postoji: `ops.pilot-metrics.get`. Ruta i uloga u ljusci: zajednička datoteka `routes.ts`, samo uz zadatak orkestratora |
| NF7-OA2 | OA-2 | `postavke`: Postavke fakulteta (pravila, pragovi, čuvanje podataka, obrasci fakulteta; samo čitanje) | administrator | puno, prazno, učitavanje, greška | postoji: `institution.config.get`, `institution.faculty-rules.get`, `institution.origin-thresholds.get`, `institution.retention.get`. Obrasci fakulteta: provjeriti (OD-11) |
| NF7-OA3 | OA-3 | `dnevnik`: Dnevnik radnji (samo čitanje, bez osobnih podataka studenata) | operater, administrator | puno, prazno, učitavanje, greška | nedostaje, SRV-ADMIN-3 |
| NF7-OA5 | OA-5 | `prava`: Moja prava (studentska pomoć, statični tekst, „čeka pravni pregled”) | pomoć, vidljiva i iz administracije | puno, prazno, učitavanje, greška | nema (statični tekst) |
| NF7-OA6 | OA-6 | `izvoz`: Zahtjevi izvoza podataka, upozorenje na dupli zahtjev | administrator | puno, dupli zahtjev, prazno, učitavanje, greška | postoji: `institution.student-data-exports.get|post`, `institution.student-data-exports-approve.post`. Potpuni skup stanja: provjeriti |
| NF7-OA7 | OA-7 | `prijave`: Prijave problema (kategorija, usmjerenje, stanje zaprimljeno/riješeno) | operater, administrator | puno, prazno, učitavanje, greška | nedostaje, SRV-ADMIN-7 (postoji samo `support.problem-report.post`) |
| NF7-OA9 | OA-9 | `asistent`: Asistent na fakultetu (samo čitanje, bez pružatelja, modela, kvote i kvačica) | administrator | puno, prazno, učitavanje, greška | pravila po vrsti rada postoje: `institution.faculty-rules.get`; polje „asistent uključen na fakultetu” nedostaje, SRV-ADMIN-9 |
| NF7-OA10 | OA-10 | `uvoz`: Uvoz popisa studenata iz Merlina ili ISVU-a (odabir datoteke, pregled prije potvrde, potvrda dijalogom; upis kodom ostaje) | administrator | puno (pregled), prazno, pregled prije potvrde, uvezeno, učitavanje, greška | nedostaje, SRV-ADMIN-10; format datoteke nije određen |
| NF7-OA12 | OA-12 | zajednički obrazac svih ekrana: naslov, rečenica svrhe, tablica ili obrazac, stanja, potvrda dijalogom, „Pokušaj ponovno” | oba | sva četiri stanja | nema |

Čuvanje podataka (dio NF7-OA2): rokovi koji nisu određeni prikazani su kao „Rok još nije određen (čeka odluku)”. Rokovi se ne izmišljaju; tko ih određuje još nije odlučeno (Daniel 23. 11., t. 5).

## Ne gradi se

Kvota 50/100/200 i kvačice pružatelja, nadzor po osobi, rangiranje, imenovanje pružatelja ili modela (Q-10), automatski zaključak o autorstvu. Nakon pilota: OA-4 (zahtjev za brisanje ili ispravak), OA-8 (obavijest o prekidu upisuje operater; u pilotu ručna uz javnu stranicu stanja), OA-11 (nova akademska godina).

## Nije izvedeno

Prototip je statičan; nijedan poslužitelj nije pozvan. Pregled u pravom pregledniku i čitač zaslona nisu provjereni (samo axe i tipkovnica u Chromiumu).
