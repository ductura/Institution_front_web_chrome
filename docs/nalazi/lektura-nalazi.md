# Lektura korisničkih tekstova (`lektura-nalazi`)

Datum: 26. 11. 2026. Pisac: JEZIK-POJMOVNIK (`wjezikpojmovnik`, frontend). Zadatak: plan `ductura/.github#104` (`docs/plan/PRIJEDLOZI-2611.md`), odobren 26. 11. (Ductus#2055 c.7182294468). Baza: `migracija/kopija-ductus-front` na `d0defe91`.

**Samo dokument.** Nijedan tekst sučelja nije promijenjen. Ispravci su poseban kasniji zadatak; ovaj popis je njegov ulaz. Uz njega ide `docs/nalazi/pojmovnik.md` (jedan pojmovnik pojmova sučelja); redni brojevi pojmova (P-n) pozivaju se ondje.

Svi primjeri su stvarni retci iz repoa, ali bez osobnih podataka.

## 0. Što je pročitano, a što nije

Pročitano (skriptom, doslovno, s brojem retka): svaki string u `locales/hr.ts`, `src/lib/i18n/messages.hr.ts`, svim modulnim katalozima `*messages*.hr.ts` i `notices.hr.ts` u `src/components/**`, `packages/app/src/host/**`, `packages/editor-core/**`, `packages/ui/**` te ostalim `.ts/.tsx` datotekama kojima string izgleda kao hrvatski tekst (diakritici ili česte hrvatske riječi). To je oko 6 700 stringova u 313 datoteka. Pojedine skupine pregledane su i očima (obraćanje, nazivi uloga, poruke grešaka, stanja spremanja).

Izvan pregleda, namjerno:
- `locales/en.ts` i engleski katalozi (jezik je hrvatski; engleski prolaz je zaseban zadatak, D-70);
- testovi (`*.test.*`), `e2e/`, `catalog/`, `*.stories.*`, `test-fakes/`, `src/_cekanje/`, generirane datoteke;
- tekstovi koje poslužitelj vraća kao podatak (nazivi kolegija, komentari studenata); `config/faculties/**` i `public/` nisu čitani.

Ograničenja pregleda (iskreno): pregled je djelomično strojni (obrasci), pa ne ulovi sve pravopisne ili stilske propuste; nema ručnog čitanja svih ~6 700 rečenica. Hard-kodirani tekst u JSX-u izvan kataloga postoji na samo tri mjesta (§L-20). Pokretanje skenera zabranjenih izraza i testova nije bilo moguće (u repou nije instaliran `node_modules`); odjeljak L-09 je zato heuristički i treba ga potvrditi skenerom.

Nije pročitano ni pokrenuto: aplikacija, baza, Docker, `pnpm` testovi.

## 1. Kako čitati tablice

Stupci: `#` (oznaka nalaza), `datoteka:redak` (do tri mjesta, ostala u zagradi), `sada` (doslovni tekst), `prijedlog`, `razlog`.

- Jedan redak kataloga postoji na dva mjesta: `locales/hr.ts` i `src/lib/i18n/messages.hr.ts` (769 od 808 tekstova iz `locales/hr.ts` je doslovno u oba, vidi L-21). Ispravak se mora napraviti u oba, a ne zasebno.
- Retci označeni „[PITANJE]” ne smiju se primijeniti bez odluke vlasnika; ostali su izravni prijedlozi.
- Varijable u vitičastim zagradama (`{n}`, `${n}`) ostaju netaknute.
- Prijedlozi su prijedlozi lekture, ne tekst koji je odobrio vlasnik; kod ugovorno propisanih naziva (obrasci fakulteta) vrijedi pojmovnik P-n.

## 2. Sažetak

| Nalaz | Što | Redaka |
|---|---|---|
| L-01 | Obraćanje: „vaš” malim početnim slovom, „Vaš” velikim | 34 |
| L-02 | Obraćanje: „ti” u rečenicama, „Vi” drugdje | 26 |
| L-03 | „Sesija” u značenju prijave | 15 |
| L-04 | „Odjava zatvara sesiju” | 5 |
| L-05 | „ponovo” umjesto „ponovno” | 1 |
| L-06 | Crtica: „—” umjesto „–” | 1 |
| L-07 | „ekran” i „zaslon” | 9 |
| L-08 | „asistent” malim slovom | 5 |
| L-09 | Rječnik zabranjenih izraza (PRODUCT §5): mjesta za provjeru | 11 |
| L-10 | „sačuvati/pohraniti” uz „spremiti” | 14 |
| L-11 | Rodni oblici: kosa crta i „ili” | 3 |
| L-12 | Interne oznake (P-01, P-02) u tekstu za studenta i nastavnika | 8 |
| L-13 | Glas poruka o učitavanju: „Učitavam …” i „Učitavanje …” | 69 |
| L-14 | Isti glas: ostale poruke u prvom licu | 17 |
| L-15 | „zahtjev” u tehničkom značenju vidljiv korisniku | 2 |
| L-16 | „prijava” = prijava u aplikaciju i prijava problema | 15 |
| L-17 | „korištenje” i „uporaba” | 12 |
| L-18 | „kartica” u tri značenja | 6 |
| L-19 | Brojevi uz imenice bez množinskog oblika | 12 |
| L-22 | Ostalo (ručno uočeno) | 6 |
| L-20 | Tekst izvan kataloga (JSX) | 3 |
| L-21 | Dva kataloga s istim tekstom | 0 |

**Ukupno 274 redaka nalaza** (jedan redak = jedan različit tekst; isti tekst na više mjesta je jedan redak).

## 4. Tablice

## L-01 Obraćanje: „vaš” malim početnim slovom, „Vaš” velikim

Većina kataloga piše oslovljavanje velikim slovom (134 mjesta „Vaš…”, 23 „Vi”), a 34 mjesta pišu malim. Prijedlog: svugdje veliko (pravopisno dopušteno i već prevladava). Jedno mjesto u listi (`operator/problem-reports`) je samo naziv stupca bez obraćanja: ne mijenjati.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-01-001 | src/components/editor/suggestions/messages.hr.ts:12 | Prijedlog ne mijenja vaš rad dok ga ne prihvatite. | Prijedlog ne mijenja Vaš rad dok ga ne prihvatite. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-002 | src/lib/i18n/messages.hr.ts:631<br>locales/hr.ts:613 | Brojke vrijede samo za vašu ustanovu i računaju se pri otvaranju stranice. Pojedine osobe i kolegiji ovdje se ne prikazuju. | Brojke vrijede samo za Vašu ustanovu i računaju se pri otvaranju stranice. Pojedine osobe i kolegiji ovdje se ne prikazuju. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-003 | src/lib/i18n/messages.hr.ts:659<br>locales/hr.ts:641 | Nastavnici vaše ustanove i osobe koje čekaju potvrdu uloge. Ulogu nastavnika potvrđujete i opozivate vi; prijava preko AAI@EduHr daje samo pravo da vas osoba čeka na popisu. | Nastavnici Vaše ustanove i osobe koje čekaju potvrdu uloge. Ulogu nastavnika potvrđujete i opozivate Vi; prijava preko AAI@EduHr daje samo pravo da Vas osoba čeka na popisu. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-004 | src/lib/i18n/messages.hr.ts:690<br>locales/hr.ts:673 | Potvrda se upisuje u revizijski trag, s vama kao izvršiteljem. | Potvrda se upisuje u revizijski trag, s Vama kao izvršiteljem. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-005 | src/lib/i18n/messages.hr.ts:699<br>locales/hr.ts:682 | Ako mu kasnija prijava da pravo nastavnika, ponovno će čekati vašu potvrdu. | Ako mu kasnija prijava da pravo nastavnika, ponovno će čekati Vašu potvrdu. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-006 | src/lib/i18n/messages.hr.ts:700<br>locales/hr.ts:683 | Opoziv se upisuje u revizijski trag, s vama kao izvršiteljem. | Opoziv se upisuje u revizijski trag, s Vama kao izvršiteljem. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-007 | src/lib/i18n/messages.hr.ts:707<br>locales/hr.ts:691 | Potvrda nije moguća. Ova osoba više ne čeka potvrdu na vašoj ustanovi. Popis je osvježen. | Potvrda nije moguća. Ova osoba više ne čeka potvrdu na Vašoj ustanovi. Popis je osvježen. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-008 | src/lib/i18n/messages.hr.ts:708<br>locales/hr.ts:693 | Opoziv nije potreban. Ova osoba više nema potvrđenu ulogu na vašoj ustanovi. Popis je osvježen. | Opoziv nije potreban. Ova osoba više nema potvrđenu ulogu na Vašoj ustanovi. Popis je osvježen. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-009 | src/lib/i18n/messages.hr.ts:1509<br>locales/hr.ts:1310 | Ovdje će se prikazati vaši kolegiji i njihovi zadaci. | Ovdje će se prikazati Vaši kolegiji i njihovi zadaci. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-010 | src/lib/i18n/messages.hr.ts:1513<br>locales/hr.ts:1316 | U svakom kolegiju nastavnik vam dodjeljuje zadatke. | U svakom kolegiju nastavnik Vam dodjeljuje zadatke. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-011 | src/lib/i18n/messages.hr.ts:1765<br>locales/hr.ts:1569 | Nakon prijave otvara se vaš prostor prema dodijeljenoj ulozi. Ulogu nastavnika potvrđuje administrator fakulteta. | Nakon prijave otvara se Vaš prostor prema dodijeljenoj ulozi. Ulogu nastavnika potvrđuje administrator fakulteta. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-012 | src/lib/i18n/messages.hr.ts:1902<br>locales/hr.ts:1616 | Kolegiji vaše ustanove po akademskoj godini, s nastavnim timom i seminarskim grupama. Radovi studenata i njihov sadržaj ovdje se ne prikazuju. | Kolegiji Vaše ustanove po akademskoj godini, s nastavnim timom i seminarskim grupama. Radovi studenata i njihov sadržaj ovdje se ne prikazuju. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-013 | src/lib/i18n/messages.hr.ts:1944 | Poslužitelj nije prihvatio podatke. Provjerite ima li nositelj potvrđenu nastavničku ulogu u vašoj ustanovi i ostavite grupe praznima. | Poslužitelj nije prihvatio podatke. Provjerite ima li nositelj potvrđenu nastavničku ulogu u Vašoj ustanovi i ostavite grupe praznima. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-014 | packages/app/src/host/admin/faculty-settings/messages.hr.ts:5 | Jedno mjesto za pravila, pragove i čuvanje podataka vašeg fakulteta. Ovdje se samo čita; promjene se rade na stranicama kartica. | Jedno mjesto za pravila, pragove i čuvanje podataka Vašeg fakulteta. Ovdje se samo čita; promjene se rade na stranicama kartica. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-015 | packages/app/src/host/admin/faculty-settings/messages.hr.ts:41 | Student vidi isto kao i vi: pravilo vrste rada i napomenu da asistent nije uključen. | Student vidi isto kao i Vi: pravilo vrste rada i napomenu da asistent nije uključen. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-016 | packages/app/src/host/editor/code-run/messages.hr.ts:5<br>packages/app/src/host/teacher/code-tests/messages.hr.ts:48 | Pokrenuto u vašem pregledniku; to nije provjera nastavnika i ne ulazi u ocjenu. | Pokrenuto u Vašem pregledniku; to nije provjera nastavnika i ne ulazi u ocjenu. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-017 | packages/app/src/host/editor/draft-panel/messages.hr.ts:11 | Samo vi vidite ovu bilješku. | Samo Vi vidite ovu bilješku. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-018 | packages/app/src/host/editor/draft-panel/messages.hr.ts:12<br>packages/app/src/host/editor/left/messages.hr.ts:24 | Bilješka je samo za vas: ne ulazi u tekst, izvoz ni predaju. | Bilješka je samo za Vas: ne ulazi u tekst, izvoz ni predaju. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-019 | packages/app/src/host/editor/sealed-self-note/messages.ts:6 | Kratka bilješka za vas: što sljedeće napraviti i gdje ste stali. Zaštićena je na vašem uređaju prije slanja, pa je osim vas nitko ne može pročitati. | Kratka bilješka za Vas: što sljedeće napraviti i gdje ste stali. Zaštićena je na Vašem uređaju prije slanja, pa je osim Vas nitko ne može pročitati. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-020 | packages/app/src/host/editor/sealed-self-note/messages.ts:14 | Prije prve poruke aplikacija će napraviti frazu i kod za oporavak. Trebat će vam na drugom računalu i nakon odjave. | Prije prve poruke aplikacija će napraviti frazu i kod za oporavak. Trebat će Vam na drugom računalu i nakon odjave. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-021 | packages/app/src/host/editor/sealed-self-note/messages.ts:20 | Nitko ih ne može vratiti: ni fakultet, ni nastavnik, ni Ductura. Ako izgubite i frazu i kod za oporavak, vaše poruke sebi više se ne mogu pročitati. | Nitko ih ne može vratiti: ni fakultet, ni nastavnik, ni Ductura. Ako izgubite i frazu i kod za oporavak, Vaše poruke sebi više se ne mogu pročitati. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-022 | packages/app/src/host/operator/problem-reports/messages.hr.ts:19 | Nijedna prijava nije stigla vama. Kad je student pošalje iz pomoći, pojavit će se ovdje. | Nijedna prijava nije stigla Vama. Kad je student pošalje iz pomoći, pojavit će se ovdje. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-023 | packages/app/src/host/public/my-rights/messages.hr.ts:5 | Što možete tražiti u vezi s podacima koje Ductura čuva o vama i kome se javiti. | Što možete tražiti u vezi s podacima koje Ductura čuva o Vama i kome se javiti. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-024 | packages/app/src/host/public/my-rights/messages.hr.ts:11 | Možete zatražiti uvid u podatke koje Ductura čuva o vama. Zahtjev podnosite referadi svog fakulteta. | Možete zatražiti uvid u podatke koje Ductura čuva o Vama. Zahtjev podnosite referadi svog fakulteta. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-025 | packages/app/src/host/public/my-rights/messages.hr.ts:16 | Možete zatražiti izvoz svojih podataka. Izvoz pokreće administrator fakulteta nakon vašeg zahtjeva referadi, a vi dobivate poveznicu za jednokratno preuzimanje. | Možete zatražiti izvoz svojih podataka. Izvoz pokreće administrator fakulteta nakon Vašeg zahtjeva referadi, a Vi dobivate poveznicu za jednokratno preuzimanje. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-026 | packages/app/src/host/public/my-rights/messages.hr.ts:26 | Na zahtjev odgovara fakultet. Rok za odgovor određuje fakultet, a ako ga još nije odredio, to će vam reći referada. | Na zahtjev odgovara fakultet. Rok za odgovor određuje fakultet, a ako ga još nije odredio, to će Vam reći referada. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-027 | packages/app/src/host/student/direct-edit-setting/messages.hr.ts:4 | Možete dopustiti nastavniku da izravno uređuje vaš rad. Njegov je tekst u radu označen, a dopuštenje možete opozvati kad god želite. | Možete dopustiti nastavniku da izravno uređuje Vaš rad. Njegov je tekst u radu označen, a dopuštenje možete opozvati kad god želite. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-028 | packages/app/src/host/student/document-history/restore/messages.hr.ts:10 | Tekst iz odabrane verzije postat će nova verzija vašeg rada. Sve dosadašnje verzije ostaju u povijesti. | Tekst iz odabrane verzije postat će nova verzija Vašeg rada. Sve dosadašnje verzije ostaju u povijesti. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-029 | packages/app/src/host/student/time-machine/messages.hr.ts:24 | Verzije vašeg rada na poslužitelju, od najnovije. Odaberite verziju da pročitate njezin tekst. | Verzije Vašeg rada na poslužitelju, od najnovije. Odaberite verziju da pročitate njezin tekst. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-030 | packages/app/src/host/teacher/comment-bank/messages.hr.ts:41 | Unos više ne postoji u vašoj banci. Popis je osvježen. | Unos više ne postoji u Vašoj banci. Popis je osvježen. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-031 | packages/app/src/host/teacher/direct-edit/messages.hr.ts:4 | Student je opozvao dopuštenje. Uređivanje je zaključano, a vaša zadnja izmjena nije zabilježena. | Student je opozvao dopuštenje. Uređivanje je zaključano, a Vaša zadnja izmjena nije zabilježena. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-032 | packages/app/src/host/teacher/work/review/pg-messages.hr.ts:25 | Ductura ne zna tko je tipkao i ne otkriva alate izvan sebe. Zaključak ostaje vama, nakon razgovora sa studentom. | Ductura ne zna tko je tipkao i ne otkriva alate izvan sebe. Zaključak ostaje Vama, nakon razgovora sa studentom. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-033 | packages/app/src/host/teacher/work/review/pg-messages.hr.ts:104 | Je li student vidio vaše komentare, trenutačno nije moguće dohvatiti. To ne znači da nije. | Je li student vidio Vaše komentare, trenutačno nije moguće dohvatiti. To ne znači da nije. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |
| L-01-034 | packages/app/src/host/teacher/work/review/pg-messages.hr.ts:105 | „Student je vidio” prikazuje se samo uz vaše vlastite objavljene komentare. | „Student je vidio” prikazuje se samo uz Vaše vlastite objavljene komentare. | Nedosljedno pisanje oslovljavanja; prevladava „Vi/Vaš” velikim slovom. |

## L-02 Obraćanje: „ti” u rečenicama, „Vi” drugdje

Gumbi i naredbe su u imperativu jednine („Spremi”, „Prijavi se”, „Izvezi tekst”), a poruke u imperativu množine („Prijavite se ponovno”, 121 prema 23 mjesta). Ovdje su samo poruke (rečenice) u kojima se obraća s „ti”; samostalni gumbi („Pokušaj ponovno”, „Učitaj ponovno”) ostaju kako jesu dok vlasnik ne odluči drukčije (vidi pojmovnik, §Obraćanje).

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-02-035 | src/components/editor/student-milestones/messages.hr.ts:17 | Nije potvrđeno je li etapa poslana. Osvježi prikaz prije novog pokušaja. | Nije potvrđeno je li etapa poslana. Osvježite prikaz prije novog pokušaja. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-036 | src/components/editor/student-milestones/messages.hr.ts:18 | Sesija je završila. Prijavi se ponovno. | Sesija je završila. Prijavite se ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-037 | src/lib/i18n/messages.hr.ts:966<br>locales/hr.ts:847 | Dodaj izvor; navod i unos u popisu literature upisuju se u stilu FPZG-a. | Dodajte izvor; navod i unos u popisu literature upisuju se u stilu FPZG-a. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-038 | src/lib/i18n/messages.hr.ts:967<br>locales/hr.ts:848 | Upiši: {field}. | Upišite: {field}. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-039 | src/lib/i18n/messages.hr.ts:1717<br>locales/hr.ts:1520 | Izmjene nisu obrisane i ostaju na ovom uređaju. Pokušaj ponovno. | Izmjene nisu obrisane i ostaju na ovom uređaju. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-040 | src/lib/i18n/messages.hr.ts:2588 | Sesija je istekla. Prijavi se ponovno pa opet otvori ovaj prozor. | Sesija je istekla. Prijavite se ponovno pa opet otvorite ovaj prozor. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-041 | src/lib/i18n/messages.hr.ts:2606 | Poslužitelj nije potvrdio brisanje. Pokušaj ponovno. | Poslužitelj nije potvrdio brisanje. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-042 | src/lib/i18n/messages.hr.ts:2607 | Sesija je istekla. Prijavi se ponovno pa pokušaj opet. | Sesija je istekla. Prijavite se ponovno pa pokušajte opet. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-043 | packages/app/src/host/editor/assistant-match-notice/messages.hr.ts:16 | Objašnjenje nije stiglo na poslužitelj. Pokušaj ponovno. | Objašnjenje nije stiglo na poslužitelj. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-044 | packages/app/src/host/editor/assistant-match-notice/messages.hr.ts:19<br>packages/app/src/host/student/event-dispute/messages.hr.ts:20<br>packages/app/src/host/teacher/submissions/messages.hr.ts:18 | Sesija je istekla. Prijavi se ponovno. | Sesija je istekla. Prijavite se ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-045 | packages/app/src/host/student/event-dispute/messages.hr.ts:18 | Tekst nije prihvaćen. Upiši tekst do dopuštene duljine. | Tekst nije prihvaćen. Upišite tekst do dopuštene duljine. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-046 | packages/app/src/host/student/event-dispute/messages.hr.ts:21 | Tekst trenutačno nije moguće poslati. Pokušaj ponovno. | Tekst trenutačno nije moguće poslati. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-047 | packages/app/src/host/student/interview/messages.hr.ts:26 | Bilješku nije bilo moguće spremiti. Pokušaj ponovno. | Bilješku nije bilo moguće spremiti. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-048 | packages/app/src/host/student/interview/messages.hr.ts:32 | Poziv nije bilo moguće učitati. Pokušaj ponovno. | Poziv nije bilo moguće učitati. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-049 | packages/app/src/host/student/interview/messages.hr.ts:37 | Objašnjenje nije bilo moguće poslati. Pokušaj ponovno. | Objašnjenje nije bilo moguće poslati. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-050 | packages/app/src/host/student/statement/messages.hr.ts:23 | Izjavu nije bilo moguće učitati. Pokušaj ponovno. | Izjavu nije bilo moguće učitati. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-051 | packages/app/src/host/student/statement/messages.hr.ts:25 | Izjavu nije bilo moguće spremiti. Pokušaj ponovno. | Izjavu nije bilo moguće spremiti. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-052 | packages/app/src/host/teacher/interview/messages.hr.ts:13 | Pripremu za razgovor trenutačno nije moguće učitati. Pokušaj ponovno. | Pripremu za razgovor trenutačno nije moguće učitati. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-053 | packages/app/src/host/teacher/interview/messages.hr.ts:15 | Prijava je istekla. Prijavi se ponovno. | Prijava je istekla. Prijavite se ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-054 | packages/app/src/host/teacher/interview/messages.hr.ts:17 | Radnja nije uspjela. Pokušaj ponovno. | Radnja nije uspjela. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-055 | packages/app/src/host/teacher/interview/messages.hr.ts:56 | Upiši mjesto i vrijeme. | Upišite mjesto i vrijeme. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-056 | packages/app/src/host/teacher/submissions/bulk/messages.hr.ts:18 | Zahtjev nije prošao provjeru. Osvježi stranicu i pokušaj ponovno. | Zahtjev nije prošao provjeru. Osvježite stranicu i pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-057 | packages/app/src/host/teacher/submissions/bulk/messages.hr.ts:19 | Poveznicu trenutačno nije moguće dobiti. Pokušaj ponovno. | Poveznicu trenutačno nije moguće dobiti. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-058 | packages/app/src/host/teacher/submissions/messages.hr.ts:17 | Predaje nije bilo moguće učitati. Pokušaj ponovno. | Predaje nije bilo moguće učitati. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-059 | packages/editor-core/src/serverSync/messages.ts:13 | Ne mogu učitati dokument. Osvježi stranicu. | Ne mogu učitati dokument. Osvježite stranicu. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |
| L-02-060 | packages/editor-core/src/serverSync/messages.ts:29 | Kontrolnu točku nije bilo moguće stvoriti. Pokušaj ponovno. | Kontrolnu točku nije bilo moguće stvoriti. Pokušajte ponovno. | Miješanje „ti” i „Vi” u istoj poruci/istom zaslonu. |

## L-03 „Sesija” u značenju prijave

„Sesija” znači dvoje: prijavu u aplikaciju („Sesija je istekla”) i razdoblje pisanja bez stanke („nova sesija počinje nakon stanke”, prag P-01). Katalog već piše „Prijava je istekla” (npr. `comments.signedOut`), pa je prijedlog da se za prijavu svugdje rabi „prijava”, a „sesija” ostane samo za razdoblje pisanja.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-03-061 | src/components/editor/mentor/milestones/messages.hr.ts:19<br>src/components/editor/mentor/milestones/stages-messages.hr.ts:8 | Sesija je završila. Prijavite se ponovno. | Prijava je završila. Prijavite se ponovno. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-062 | src/components/editor/sources/proofs/messages.hr.ts:11 | Sesija je istekla. Prijavite se ponovno da biste vidjeli potvrde. | Prijava je istekla. Prijavite se ponovno da biste vidjeli potvrde. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-063 | src/components/editor/sources/proofs/messages.hr.ts:49 | Sesija je istekla. Nacrt je sačuvan; prijavite se ponovno pa pošaljite. | Prijava je istekla. Nacrt je sačuvan; prijavite se ponovno pa pošaljite. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-064 | src/components/editor/student-milestones/messages.hr.ts:18 | Sesija je završila. Prijavi se ponovno. | Prijava je završila. Prijavi se ponovno. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-065 | src/lib/i18n/messages.hr.ts:1780<br>locales/hr.ts:1586 | Sesija je istekla | Prijava je istekla | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-066 | src/lib/i18n/messages.hr.ts:1946 | Sesija je završila. Prijavite se ponovno pa izradite kolegij. | Prijava je završila. Prijavite se ponovno pa izradite kolegij. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-067 | src/lib/i18n/messages.hr.ts:2082<br>locales/hr.ts:1772 | Sesija je završila. Za reprodukciju se ponovno prijavite. | Prijava je završila. Za reprodukciju se ponovno prijavite. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-068 | src/lib/i18n/messages.hr.ts:2198<br>locales/hr.ts:1904 | Sesija je završila. Zapišite opis izvan Ducture, prijavite se ponovno pa ga pošaljite. | Prijava je završila. Zapišite opis izvan Ducture, prijavite se ponovno pa ga pošaljite. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-069 | src/lib/i18n/messages.hr.ts:2399 | Sesija je istekla. Prijavite se ponovno preko AAI@EduHr. | Prijava je istekla. Prijavite se ponovno preko AAI@EduHr. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-070 | src/lib/i18n/messages.hr.ts:2588 | Sesija je istekla. Prijavi se ponovno pa opet otvori ovaj prozor. | Prijava je istekla. Prijavi se ponovno pa opet otvori ovaj prozor. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-071 | src/lib/i18n/messages.hr.ts:2607 | Sesija je istekla. Prijavi se ponovno pa pokušaj opet. | Prijava je istekla. Prijavi se ponovno pa pokušaj opet. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-072 | packages/app/src/host/editor/assistant-match-notice/messages.hr.ts:19<br>packages/app/src/host/student/event-dispute/messages.hr.ts:20<br>packages/app/src/host/teacher/submissions/messages.hr.ts:18 | Sesija je istekla. Prijavi se ponovno. | Prijava je istekla. Prijavi se ponovno. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-073 | packages/app/src/host/editor/bibliography/teacher/messages.hr.ts:7<br>packages/app/src/host/editor/import/messages.hr.ts:28<br>packages/app/src/host/editor/work-history/messages.hr.ts:9<br>… (+17) | Sesija je istekla. Prijavite se ponovno. | Prijava je istekla. Prijavite se ponovno. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-074 | packages/app/src/host/student/document-history/restore/messages.hr.ts:26 | Sesija je istekla. Prijavite se ponovno. Tekst ostaje spremljen na uređaju. | Prijava je istekla. Prijavite se ponovno. Tekst ostaje spremljen na uređaju. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |
| L-03-075 | packages/app/src/host/student/start-work/messages.hr.ts:12 | Sesija je istekla. Prijavite se ponovno da vidite predložak. | Prijava je istekla. Prijavite se ponovno da vidite predložak. | Dvoznačnost i anglicizam; isti događaj drugdje glasi „Prijava je istekla”. |

## L-04 „Odjava zatvara sesiju”

Ista dvoznačnost kao L-03, u poruci o odjavi s neposlanim izmjenama. Prijedlog je kratak; konačnu rečenicu usklađuje vlasnik uz poruke odjave.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-04-076 | src/lib/i18n/messages.hr.ts:1687<br>locales/hr.ts:1488 | Odjava zatvara sesiju na ovom uređaju. | Odjavom se zatvara prijava na ovom uređaju. | „Sesija” je ovdje prijava, ne razdoblje pisanja (L-03). |
| L-04-077 | src/lib/i18n/messages.hr.ts:1689<br>src/lib/i18n/messages.hr.ts:1691<br>locales/hr.ts:1490<br>… (+1) | {n} izmjena postoji samo na ovom uređaju. Odjava zatvara sesiju. | {n} izmjena postoji samo na ovom uređaju. Odjavom se zatvara prijava na ovom uređaju. | „Sesija” je ovdje prijava, ne razdoblje pisanja (L-03). |
| L-04-078 | src/lib/i18n/messages.hr.ts:1690<br>locales/hr.ts:1491 | {n} izmjene postoje samo na ovom uređaju. Odjava zatvara sesiju. | {n} izmjene postoje samo na ovom uređaju. Odjavom se zatvara prijava na ovom uređaju. | „Sesija” je ovdje prijava, ne razdoblje pisanja (L-03). |
| L-04-079 | src/lib/i18n/messages.hr.ts:1695<br>src/lib/i18n/messages.hr.ts:1697<br>locales/hr.ts:1496<br>… (+1) | {n} izmjena nakon predaje postoji samo na ovom uređaju i ne šalje se. Odjava zatvara sesiju. | {n} izmjena nakon predaje postoji samo na ovom uređaju i ne šalje se. Odjavom se zatvara prijava na ovom uređaju. | „Sesija” je ovdje prijava, ne razdoblje pisanja (L-03). |
| L-04-080 | src/lib/i18n/messages.hr.ts:1696<br>locales/hr.ts:1497 | {n} izmjene nakon predaje postoje samo na ovom uređaju i ne šalju se. Odjava zatvara sesiju. | {n} izmjene nakon predaje postoje samo na ovom uređaju i ne šalju se. Odjavom se zatvara prijava na ovom uređaju. | „Sesija” je ovdje prijava, ne razdoblje pisanja (L-03). |

## L-05 „ponovo” umjesto „ponovno”

Svugdje drugdje (661 mjesto) piše se „ponovno”; jedno mjesto piše „ponovo”.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-05-081 | packages/app/src/host/editor/left/messages.hr.ts:109 | Prijavite se ponovo da vidite etape i konzultacije. | Prijavite se ponovno da vidite etape i konzultacije. | Jedan oblik u cijelom sučelju. |

## L-06 Crtica: „—” umjesto „–”

Sučelje svugdje rabi kratku crticu s razmacima („ – ”); jedno mjesto rabi dugu.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-06-082 | src/components/editor/rich/blocks/messages.hr.ts:34 | Ukloni okvir — tekst ostaje | Ukloni okvir – tekst ostaje | Jedna vrsta crtice. |

## L-07 „ekran” i „zaslon”

Oba se rabe za isti pojam (zaslon 21, ekran 12 mjesta). Prijedlog: „zaslon” (prevladava, ide uz „čitač zaslona”). Napomena: PRODUCT §5 pravilo 6 piše „prvi ekran”; to je dokument, ne sučelje, pa se ne mijenja ovdje.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-07-083 | src/lib/i18n/messages.hr.ts:325<br>locales/hr.ts:289 | Obavijest o praćenju kao prvi ekran zadatka, prije prve rečenice. | Obavijest o praćenju kao prvi zaslon zadatka, prije prve rečenice. | Jedan naziv za isti pojam. |
| L-07-084 | src/lib/i18n/messages.hr.ts:370<br>locales/hr.ts:331 | Prvi ekran svakog zadatka kaže što nastavnik vidi i od kada. Student to pročita prije prve rečenice. | Prvi zaslon svakog zadatka kaže što nastavnik vidi i od kada. Student to pročita prije prve rečenice. | Jedan naziv za isti pojam. |
| L-07-085 | src/lib/i18n/messages.hr.ts:852<br>packages/app/src/host/teacher/merlin/messages.hr.ts:41 | Otisci pojedinih datoteka nalaze se u CSV popisu i u zasebnoj datoteci u paketu. Na ovom ekranu prikazuje se otisak paketa kad je paket spreman. | Otisci pojedinih datoteka nalaze se u CSV popisu i u zasebnoj datoteci u paketu. Na ovom zaslonu prikazuje se otisak paketa kad je paket spreman. | Jedan naziv za isti pojam. |
| L-07-086 | packages/app/app/[base]/pristupacnost/statement.ts:37 | Ova mrežna aplikacija djelomično je usklađena sa Zakonom i normom ${STANDARD}, koja upućuje na Smjernice za pristupačnost web-sadržaja (WCAG) 2.1, razinu AA. Cilj za sve ekrane je razina AA Smjernica WCAG 2.2. Neusklađenosti su… | Ova mrežna aplikacija djelomično je usklađena sa Zakonom i normom ${STANDARD}, koja upućuje na Smjernice za pristupačnost web-sadržaja (WCAG) 2.1, razinu AA. Cilj za sve zaslone je razina AA Smjernica WCAG 2.2. Neusklađenosti su navedene u nastavku. | Jedan naziv za isti pojam. |
| L-07-087 | packages/app/app/[base]/pristupacnost/statement.ts:44 | Svi glavni ekrani provjereni su automatskim alatom axe prema kriterijima razina A i AA, u tamnoj i svijetloj temi te na širini računala i mobitela. | Svi glavni zasloni provjereni su automatskim alatom axe prema kriterijima razina A i AA, u tamnoj i svijetloj temi te na širini računala i mobitela. | Jedan naziv za isti pojam. |
| L-07-088 | packages/app/app/[base]/pristupacnost/statement.ts:54 | Provjera čitačem zaslona (NVDA u pregledniku Chrome i VoiceOver) još nije zapisana za sve ekrane. Automatska provjera ne otkriva sve prepreke, pa dijelovi aplikacije mogu biti teže upotrebljivi čitačem zaslona (WCAG 1.3.1, 4.1.2). | Provjera čitačem zaslona (NVDA u pregledniku Chrome i VoiceOver) još nije zapisana za sve zaslone. Automatska provjera ne otkriva sve prepreke, pa dijelovi aplikacije mogu biti teže upotrebljivi čitačem zaslona (WCAG 1.3.1, 4.1.2). | Jedan naziv za isti pojam. |
| L-07-089 | packages/app/app/[base]/pristupacnost/statement.ts:71 | Metoda: samoprocjena, uz automatsku provjeru svih glavnih ekrana i ručnu provjeru tipkovnicom. Izjava se preispituje najmanje jednom godišnje i nakon svake veće promjene sučelja. | Metoda: samoprocjena, uz automatsku provjeru svih glavnih zaslona i ručnu provjeru tipkovnicom. Izjava se preispituje najmanje jednom godišnje i nakon svake veće promjene sučelja. | Jedan naziv za isti pojam. |
| L-07-090 | packages/app/app/[base]/pristupacnost/statement.ts:76 | Ako uočite sadržaj koji nije pristupačan ili Vam treba informacija u pristupačnom obliku, javite se administratoru svog fakulteta. U poruci navedite ekran i što ste pokušali napraviti. Odgovor ćete dobiti najkasnije u roku od 1… | Ako uočite sadržaj koji nije pristupačan ili Vam treba informacija u pristupačnom obliku, javite se administratoru svog fakulteta. U poruci navedite zaslon i što ste pokušali napraviti. Odgovor ćete dobiti najkasnije u roku od 15 dana od primitka upita. | Jedan naziv za isti pojam. |
| L-07-091 | packages/app/src/host/admin/faculty-settings/messages.hr.ts:40 | U ovoj fazi pilota asistent nije uključen ni za jedan rad. Prekidač se ne mijenja s ovog ekrana. | U ovoj fazi pilota asistent nije uključen ni za jedan rad. Prekidač se ne mijenja s ovog zaslona. | Jedan naziv za isti pojam. |

## L-08 „asistent” malim slovom

Alat u Ducturi piše se „Asistent” velikim slovom (naziv značajke); `admin/faculty-settings` piše „asistent” malim.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-08-092 | packages/app/src/host/admin/faculty-settings/messages.hr.ts:37 | Samo za čitanje: je li asistent uključen na fakultetu i što pravila fakulteta dopuštaju po vrsti rada. Student vidi isto. | Samo za čitanje: je li Asistent uključen na fakultetu i što pravila fakulteta dopuštaju po vrsti rada. Student vidi isto. | Nedosljedno pisanje naziva značajke. |
| L-08-093 | packages/app/src/host/admin/faculty-settings/messages.hr.ts:40 | U ovoj fazi pilota asistent nije uključen ni za jedan rad. Prekidač se ne mijenja s ovog ekrana. | U ovoj fazi pilota Asistent nije uključen ni za jedan rad. Prekidač se ne mijenja s ovog ekrana. | Nedosljedno pisanje naziva značajke. |
| L-08-094 | packages/app/src/host/admin/faculty-settings/messages.hr.ts:41 | Student vidi isto kao i vi: pravilo vrste rada i napomenu da asistent nije uključen. | Student vidi isto kao i vi: pravilo vrste rada i napomenu da Asistent nije uključen. | Nedosljedno pisanje naziva značajke. |
| L-08-095 | packages/app/src/host/admin/faculty-settings/messages.hr.ts:44 | Pravilo vrijedi tek kad se asistent uključi. | Pravilo vrijedi tek kad se Asistent uključi. | Nedosljedno pisanje naziva značajke. |
| L-08-096 | packages/app/src/host/admin/faculty-settings/messages.hr.ts:46 | Pomoć asistenta | Pomoć Asistenta | Nedosljedno pisanje naziva značajke. |

## L-09 Rječnik zabranjenih izraza (PRODUCT §5): mjesta za provjeru

Heuristički pregled; autoritet je skener (`scripts/forbidden-terms`). Gdje skener propušta (tekst izvan `locales/`), ispravak je zaseban zadatak. „Kopirano/kopiran” u općim porukama o međuspremniku provjeriti u skeneru: Rječnik dopušta samo točne fraze „Kopirano u međuspremnik”, „Kopiraj navod”.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-09-097 | src/components/editor/rich/blocks/messages.hr.ts:29<br>packages/app/src/host/teacher/assignment-card/messages.hr.ts:31 | Kod je kopiran. | Kopirano u međuspremnik. | Skener (`terms.ts`) pušta samo „Kopiraj navod”, „kopiranje navoda”, „Kopirano u međuspremnik”; svaki drugi oblik korijena „kopir” je zabranjen (PRODUCT §5). |
| L-09-098 | src/components/editor/stopped-report/messages.hr.ts:16 | Opis ne može ovako u prijavu. Skratite ga ili uklonite neobične znakove. | Opis ne može ovako u prijavu. Skratite ga ili uklonite znakove koji se ne mogu prikazati. | Rječnik: „neobično” nije dopušteno. |
| L-09-099 | packages/app/src/host/editor/assist/messages.hr.ts:95 | Pitanje rada je spremljeno uz rad. | Pitanje rada je zapisano uz rad. | Rječnik: „spremljeno” bez pojašnjenja gdje; prijedlog „zapisano” ili navesti „na poslužitelju”. |
| L-09-100 | packages/app/src/host/editor/bibliography/student/messages.hr.ts:74 | ISBN je kopiran. | Kopirano u međuspremnik. | Skener (`terms.ts`) pušta samo „Kopiraj navod”, „kopiranje navoda”, „Kopirano u međuspremnik”; svaki drugi oblik korijena „kopir” je zabranjen (PRODUCT §5). |
| L-09-101 | packages/app/src/host/editor/mentor/messages.hr.ts:56 | Priprema je kopirana. | Kopirano u međuspremnik. | Skener (`terms.ts`) pušta samo „Kopiraj navod”, „kopiranje navoda”, „Kopirano u međuspremnik”; svaki drugi oblik korijena „kopir” je zabranjen (PRODUCT §5). |
| L-09-102 | packages/app/src/host/editor/stem/messages.hr.ts:8 | Doslovni navod mora biti prepisan točno. Usporedba je slovo po slovo i ne razumije smisao. | Doslovni navod mora biti navedeno točno kao u izvoru. Usporedba je slovo po slovo i ne razumije smisao. | Rječnik: „prepisano” nije dopušteno. |
| L-09-103 | packages/app/src/host/editor/toc/messages.hr.ts:10 | Sadržaj rada je kopiran. | Kopirano u međuspremnik. | Skener (`terms.ts`) pušta samo „Kopiraj navod”, „kopiranje navoda”, „Kopirano u međuspremnik”; svaki drugi oblik korijena „kopir” je zabranjen (PRODUCT §5). |
| L-09-104 | packages/app/src/host/student/submission/receipt/messages.hr.ts:19 | Otisak je kopiran. | Kopirano u međuspremnik. | Skener (`terms.ts`) pušta samo „Kopiraj navod”, „kopiranje navoda”, „Kopirano u međuspremnik”; svaki drugi oblik korijena „kopir” je zabranjen (PRODUCT §5). |
| L-09-105 | packages/app/src/host/teacher/assignment-card/messages.hr.ts:32 | Kod nije kopiran. Označite ga i kopirajte ručno. | Kod nije stavljen u međuspremnik. Označite ga i stavite u međuspremnik ručno. | Skener (`terms.ts`) pušta samo „Kopiraj navod”, „kopiranje navoda”, „Kopirano u međuspremnik”; svaki drugi oblik korijena „kopir” je zabranjen (PRODUCT §5). |
| L-09-106 | packages/app/src/host/teacher/assignment-form/messages.hr.ts:50 | Pravilo o povlačenju nije spremljeno. Zadatak je objavljen; pravilo postavite na stranici zadatka. | Pravilo o povlačenju nije zapisano. Zadatak je objavljen; pravilo postavite na stranici zadatka. | Rječnik: „spremljeno” bez pojašnjenja gdje; prijedlog „zapisano” ili navesti „na poslužitelju”. |
| L-09-107 | packages/app/src/host/teacher/assignment-form/messages.hr.ts:51 | Pravilo o izjavi nije spremljeno. Zadatak je objavljen; pravilo postavite na stranici zadatka. | Pravilo o izjavi nije zapisano. Zadatak je objavljen; pravilo postavite na stranici zadatka. | Rječnik: „spremljeno” bez pojašnjenja gdje; prijedlog „zapisano” ili navesti „na poslužitelju”. |

## L-10 „sačuvati/pohraniti” uz „spremiti”

Sučelje ima uređen rječnik stanja („Spremljeno na uređaju”, „Spremljeno na poslužitelju”), a poruke uz njega rabe i „sačuvano”, „pohraniti”. „Sačuvano” ne kaže gdje (kao „spremljeno” bez pojašnjenja u Rječniku). Prijedlog je navesti što se zbilo ili gdje tekst ostaje; prije primjene potvrditi značenje s autorom poruke. `Sačuvaj potvrdu` (`student/submission/receipt`) je preuzimanje datoteke, pa „Preuzmi potvrdu” (kao uz „Preuzmi potvrdu povlačenja”).

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-10-108 | src/components/editor/mentor/consultation-slots/messages.hr.ts:33<br>packages/app/src/host/editor/work/consult/messages.hr.ts:66 | Nije poznato je li promjena zabilježena. Provjerite prikaz prije novog pokušaja. Ono što ste upisali je sačuvano. | Nije poznato je li promjena zabilježena. Provjerite prikaz prije novog pokušaja. Ono što ste upisali ostaje u obrascu. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-109 | src/components/editor/sources/proofs/messages.hr.ts:47 | Isječak nije poslan. Nacrt je sačuvan: pokušajte ponovno. | Isječak nije poslan. Nacrt je ostao u obrascu: pokušajte ponovno. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-110 | src/components/editor/sources/proofs/messages.hr.ts:48 | Poslužitelj nije primio isječak. Nacrt je sačuvan. | Poslužitelj nije primio isječak. Nacrt je ostao u obrascu. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-111 | src/components/editor/sources/proofs/messages.hr.ts:49 | Sesija je istekla. Nacrt je sačuvan; prijavite se ponovno pa pošaljite. | Sesija je istekla. Nacrt je ostao u obrascu; prijavite se ponovno pa pošaljite. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-112 | src/lib/i18n/messages.hr.ts:1296 | Ovo obrazloženje nije poslano jer se na zahtjev više ne odgovara. Sačuvajte ga negdje drugdje ako ga želite zadržati. | Ovo obrazloženje nije poslano jer se na zahtjev više ne odgovara. Zapišite ga negdje drugdje ako ga želite zadržati. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-113 | src/lib/i18n/messages.hr.ts:1298 | Ovo obrazloženje nije poslano, a zahtjevi se trenutačno ne mogu učitati. Sačuvajte ga negdje drugdje ako ga želite zadržati. | Ovo obrazloženje nije poslano, a zahtjevi se trenutačno ne mogu učitati. Zapišite ga negdje drugdje ako ga želite zadržati. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-114 | src/lib/i18n/messages.hr.ts:1679<br>locales/hr.ts:1480 | Ovaj uređaj nije mogao pohraniti dio teksta, pa bi se odjavom izgubio. Izvezite tekst prije odjave. | Ovaj uređaj nije mogao spremiti dio teksta na uređaju, pa bi se odjavom izgubio. Izvezite tekst prije odjave. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-115 | packages/app/src/host/editor/import/ipynb/messages.hr.ts:16 | Bilježnicu nije bilo moguće umetnuti u rad. Pregled je sačuvan, pokušajte ponovno. | Bilježnicu nije bilo moguće umetnuti u rad. Pregled je ostao na ovom uređaju, pokušajte ponovno. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-116 | packages/app/src/host/editor/right/messages.hr.ts:45 | Pohrana u pregledniku nije dostupna; pojmovi se neće sačuvati. | Pohrana u pregledniku nije dostupna; pojmovi se neće zadržati. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-117 | packages/app/src/host/editor/work/consult/messages.hr.ts:89 | Nije poznato je li zapis spremljen. Ono što ste upisali je sačuvano. | Nije poznato je li zapis spremljen. Ono što ste upisali ostaje u obrascu. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-118 | packages/app/src/host/student/submission/receipt/messages.hr.ts:61 | Sačuvaj potvrdu | Preuzmi potvrdu | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-119 | packages/app/src/host/teacher/mentorships/messages.hr.ts:98 | Nije poznato je li promjena zabilježena. Osvježite prikaz prije novog pokušaja. Ono što ste upisali je sačuvano. | Nije poznato je li promjena zabilježena. Osvježite prikaz prije novog pokušaja. Ono što ste upisali ostaje u obrascu. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-120 | locales/hr.ts:1099 | Ovo obrazloženje nije poslano jer se na zahtjev više ne odgovara. Stavite ga u međuspremnik ako ga želite sačuvati. | Ovo obrazloženje nije poslano jer se na zahtjev više ne odgovara. Stavite ga u međuspremnik ako ga želite zadržati. | Jedan glagol za spremanje; stanje uvijek s mjestom. |
| L-10-121 | locales/hr.ts:1102 | Ovo obrazloženje nije poslano, a zahtjevi se trenutačno ne mogu učitati. Stavite ga u međuspremnik ako ga želite sačuvati. | Ovo obrazloženje nije poslano, a zahtjevi se trenutačno ne mogu učitati. Stavite ga u međuspremnik ako ga želite zadržati. | Jedan glagol za spremanje; stanje uvijek s mjestom. |

## L-11 Rodni oblici: kosa crta i „ili”

Tri različita zapisa za isto: „izjavio/izjavila”, „koristio sam ili koristila”. Prijedlog: bezrodna rečenica koja ne traži oblik glagola.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-11-122 | packages/app/src/host/student/submission/declaration/messages.hr.ts:31 | Koristio sam ili koristila generativnu umjetnu inteligenciju uz izjavu | Generativna umjetna inteligencija je korištena, uz izjavu | Kose crte i dvostruki oblici teško se čitaju čitačem zaslona; bezrodna rečenica ih izbjegava. Zadržava značenje opcije `used` (uporaba potvrđena, bez tvrdnje o prilogu); rečenicu uz obrazac fakulteta potvrđuje vlasnik. |
| L-11-123 | packages/app/src/host/teacher/work/ai-attachments/messages.hr.ts:7 | Student je izjavio/izjavila da nije koristio/koristila AI alate. U radu nije zabilježena uporaba Asistenta i nema priloženih razgovora. | U izjavi stoji da AI alati nisu korišteni. U radu nije zabilježena uporaba Asistenta i nema priloženih razgovora. | Kose crte i dvostruki oblici teško se čitaju čitačem zaslona; bezrodna rečenica ih izbjegava. Zadržava značenje opcije `used` (uporaba potvrđena, bez tvrdnje o prilogu); rečenicu uz obrazac fakulteta potvrđuje vlasnik. |
| L-11-124 | packages/app/src/host/teacher/work/ai-attachments/messages.hr.ts:8 | Zadatak ne dopušta ugrađenog Asistenta. Student je izjavio/izjavila uporabu vanjskog alata. | Zadatak ne dopušta ugrađenog Asistenta. U izjavi je navedena uporaba vanjskog alata. | Kose crte i dvostruki oblici teško se čitaju čitačem zaslona; bezrodna rečenica ih izbjegava. Zadržava značenje opcije `used` (uporaba potvrđena, bez tvrdnje o prilogu); rečenicu uz obrazac fakulteta potvrđuje vlasnik. |

## L-12 Interne oznake (P-01, P-02) u tekstu za studenta i nastavnika

Sučelje navodi interne oznake pragova („prag P-01”). Korisnik ne može znati što je „P-01”; vrijednost praga je već u rečenici.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-12-125 | src/components/teacher/TeacherSetup/messages.hr.ts:18 | Sesije se sastoje od niza promjena bez prekida duljeg od 30 minuta. Prag P-01 postavlja fakultet. | Sesije se sastoje od niza promjena bez prekida duljeg od 30 minuta. Prag postavlja fakultet. | Interna oznaka nije pojam korisnika. |
| L-12-126 | src/components/teacher/TeacherSetup/messages.hr.ts:19 | Lijepljenja dulja od 200 znakova (P-02). Izvor se prikazuje kad je opažen. | Lijepljenja dulja od 200 znakova. Izvor se prikazuje kad je opažen. | Interna oznaka nije pojam korisnika. |
| L-12-127 | src/lib/i18n/messages.hr.ts:1590<br>packages/app/src/host/student/i18n/messages.hr.ts:87<br>locales/hr.ts:1385 | Koja je tipka pritisnuta i koliko je držana. Iz vremena promjena ne računaju se brzina, ritam ni bilo kakva mjera, osim sesija: sesije se određuju prekidom dužim od praga P-01. Reprodukcija neće preskakati ni isticati stanke. | Koja je tipka pritisnuta i koliko je držana. Iz vremena promjena ne računaju se brzina, ritam ni bilo kakva mjera, osim sesija: sesije se određuju prekidom dužim od praga P-01. Reprodukcija neće preskakati ni isticati stanke. | Interna oznaka nije pojam korisnika. |
| L-12-128 | packages/app/src/host/student/submission/summary/messages.hr.ts:27 | Sesija je niz promjena bez prekida duljeg od {n} minuta (prag P-01, postavka fakulteta). | Sesija je niz promjena bez prekida duljeg od {n} minuta (prag je postavka fakulteta). | Interna oznaka nije pojam korisnika. |
| L-12-129 | packages/app/src/host/student/submission/summary/messages.hr.ts:50 | Popisano je svako lijepljenje dulje od {n} znakova (prag P-02, postavka fakulteta). Vrijeme je zaokruženo na odsječak zapisa. Bez zbroja i bez udjela u radu. | Popisano je svako lijepljenje dulje od {n} znakova (prag je postavka fakulteta). Vrijeme je zaokruženo na odsječak zapisa. Bez zbroja i bez udjela u radu. | Interna oznaka nije pojam korisnika. |
| L-12-130 | packages/app/src/host/teacher/assignment-form/messages.hr.ts:87 | lijepljenja dulja od 200 znakova (prag P-02), bez izvora ako izvor nije opažen | lijepljenja dulja od 200 znakova, bez izvora ako izvor nije opažen | Interna oznaka nije pojam korisnika. |
| L-12-131 | packages/app/src/host/teacher/n10/messages.hr.ts:49 | Sesija je niz promjena bez prekida duljeg od ${minutes} (prag P-01, postavka fakulteta).${gaps ? " Raspon praznine nije uračunat." : ""} | Sesija je niz promjena bez prekida duljeg od ${minutes} (prag je postavka fakulteta).${gaps ? " Raspon praznine nije uračunat." : ""} | Interna oznaka nije pojam korisnika. |
| L-12-132 | packages/app/src/host/teacher/n10/messages.hr.ts:52 | Popisano je svako lijepljenje dulje od ${characters} (prag P-02, postavka fakulteta). Vrijeme je zaokruženo na odsječak zapisa. Bez zbroja. | Popisano je svako lijepljenje dulje od ${characters} (prag je postavka fakulteta). Vrijeme je zaokruženo na odsječak zapisa. Bez zbroja. | Interna oznaka nije pojam korisnika. |

## L-13 Glas poruka o učitavanju: „Učitavam …” i „Učitavanje …”

Dvije vrste uz isti događaj: prvo lice („Učitavam povijest rada…”, 70 različitih poruka) i imenica („Učitavanje verzija…”, ~20). Isto vrijedi za „Šaljem …”, „Čitam …”, „Provjeravam …”, „Tražim …”, „Otvaram …”. Ostatak sučelja govori u trećem licu („Ductura bilježi …”). Prijedlog: imenica s trotočkom, bez prvog lica.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-13-133 | src/components/editor/history/messages.hr.ts:5 | Učitavam povijest rada… | Učitavanje povijesti rada… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-134 | src/components/editor/mentor/messages/messages.hr.ts:5 | Učitavam poruke… | Učitavanje poruka… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-135 | src/components/editor/mentor/milestones/messages.hr.ts:4<br>src/components/editor/mentor/milestones/stages-messages.hr.ts:4<br>src/components/editor/student-milestones/messages.hr.ts:6 | Učitavam etape… | Učitavanje etapa… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-136 | src/components/editor/mentor/work-state/messages.hr.ts:6<br>packages/app/src/host/editor/mentor/messages.hr.ts:5 | Učitavam stanje rada… | Učitavanje stanja rada… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-137 | src/components/editor/mentor/work-state/messages.hr.ts:15<br>packages/app/src/host/teacher/key-dates/messages.hr.ts:21 | Učitavam vremensku crtu… | Učitavanje vremenske crte… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-138 | src/components/editor/review/messages.hr.ts:20<br>packages/app/src/host/editor/work/review/messages.hr.ts:4 | Učitavam postavke provjera… | Učitavanje postavki provjera… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-139 | src/components/editor/sources/proofs/messages.hr.ts:8 | Učitavam potvrde… | Učitavanje potvrda… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-140 | src/components/editor/spelling/messages.hr.ts:20 | Učitavam hrvatski rječnik… | Učitavanje hrvatskog rječnika… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-141 | src/components/editor/submission-rehearsal/messages.hr.ts:10 | Učitavam traženi opseg… | Učitavanje traženog opsega… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-142 | src/components/teacher/consultation-records/messages.hr.ts:5<br>packages/app/src/host/teacher/n12/messages.hr.ts:6 | Učitavam zapise konzultacija… | Učitavanje zapisa konzultacija… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-143 | src/components/teacher/consultation-records/messages.hr.ts:22<br>packages/app/src/host/teacher/n12/messages.hr.ts:24 | Učitavam verzije rada… | Učitavanje verzija rada… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-144 | src/components/teacher/mentored-students/messages.hr.ts:5 | Učitavam studente… | Učitavanje studenata… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-145 | src/lib/i18n/messages.hr.ts:281<br>locales/hr.ts:245 | Učitavam probni prostor… | Učitavanje probnog prostora… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-146 | src/lib/i18n/messages.hr.ts:1007<br>locales/hr.ts:877 | Učitavam pravila za ovu vrstu rada. | Učitavanje pravila za ovu vrstu rada… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-147 | src/lib/i18n/messages.hr.ts:2035<br>packages/app/src/host/student/i18n/messages.hr.ts:169<br>locales/hr.ts:1725 | Učitavam dnevnik pristupa. | Učitavanje dnevnika pristupa… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-148 | src/lib/i18n/messages.hr.ts:2076<br>locales/hr.ts:1766 | Učitavam promjene rada. | Učitavanje promjena rada… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-149 | src/lib/i18n/messages.hr.ts:2317<br>locales/hr.ts:1987 | Učitavam rezultate provjera. | Učitavanje rezultata provjera… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-150 | src/lib/i18n/messages.hr.ts:2353 | Učitavam zabilježene stavke. | Učitavanje zabilježenih stavki… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-151 | src/lib/i18n/messages.hr.ts:2401<br>packages/app/src/host/student/submission/summary/messages.hr.ts:11<br>packages/app/src/host/student/submission/summary/messages.hr.ts:121 | Učitavam sažetak procesa. | Učitavanje sažetka procesa… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-152 | src/lib/i18n/messages.hr.ts:2420 | Učitavam tekst s poslužitelja. | Učitavanje teksta s poslužitelja… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-153 | src/lib/i18n/messages.hr.ts:2461 | Učitavam potvrdu predaje. | Učitavanje potvrde predaje… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-154 | src/lib/i18n/messages.hr.ts:2561 | Učitavam zapis o načinu unosa. | Učitavanje zapisa o načinu unosa… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-155 | packages/app/src/host/editor/assistant-chat/messages.hr.ts:35<br>packages/app/src/host/editor/assistant-rules/messages.hr.ts:6 | Učitavam pravila zadatka… | Učitavanje pravila zadatka… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-156 | packages/app/src/host/editor/assistant-chat/messages.hr.ts:43 | Učitavam razgovor… | Učitavanje razgovora… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-157 | packages/app/src/host/editor/bibliography/teacher/messages.hr.ts:4 | Učitavam literaturu rada… | Učitavanje literature rada… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-158 | packages/app/src/host/editor/citation-styles/messages.hr.ts:5 | Učitavam stil navođenja ustanove. | Učitavanje stila navođenja ustanove… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-159 | packages/app/src/host/editor/format-check/messages.hr.ts:5 | Učitavam pravila oblika. | Učitavanje pravila oblika… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-160 | packages/app/src/host/editor/left/messages.hr.ts:104 | Učitavam etape i konzultacije. | Učitavanje etapa i konzultacija… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-161 | packages/app/src/host/editor/mentor/messages.hr.ts:81<br>packages/app/src/host/teacher/work/review/pg-messages.hr.ts:100 | Učitavam povratnu informaciju… | Učitavanje povratne informacije… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-162 | packages/app/src/host/editor/proof-requests/messages.hr.ts:5 | Učitavam zahtjeve nastavnika… | Učitavanje zahtjeva nastavnika… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-163 | packages/app/src/host/editor/rules/messages.hr.ts:7 | Učitavam pravila… | Učitavanje pravila… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-164 | packages/app/src/host/editor/sheet/messages.hr.ts:4 | Učitavam tablicu… | Učitavanje tablice… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-165 | packages/app/src/host/editor/work-history/messages.hr.ts:7 | Učitavam verzije… | Učitavanje verzija… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-166 | packages/app/src/host/editor/work-history/messages.hr.ts:19 | Učitavam tekst verzije… | Učitavanje teksta verzije… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-167 | packages/app/src/host/shared/document-history/messages.hr.ts:17 | Učitavam povijest dokumenta… | Učitavanje povijesti dokumenta… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-168 | packages/app/src/host/student/document-history/restore/messages.hr.ts:15 | Učitavam razliku… | Učitavanje razlike… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-169 | packages/app/src/host/student/interview/messages.hr.ts:31 | Učitavam poziv. | Učitavanje poziva… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-170 | packages/app/src/host/student/portfolio/messages.hr.ts:4 | Učitavam predane radove… | Učitavanje predanih radova… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-171 | packages/app/src/host/student/statement/messages.hr.ts:22 | Učitavam izjavu. | Učitavanje izjave… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-172 | packages/app/src/host/student/submission/declaration/messages.hr.ts:55<br>packages/app/src/host/student/submission/steps/messages.hr.ts:7 | Učitavam zabilježene stavke i priloge. | Učitavanje zabilježenih stavki i priloga… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-173 | packages/app/src/host/student/submission/declaration/messages.hr.ts:61 | Učitavam izjavu s poslužitelja. | Učitavanje izjave s poslužitelja… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-174 | packages/app/src/host/student/submission/history/messages.hr.ts:14 | Učitavam popis predaja. | Učitavanje popisa predaja… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-175 | packages/app/src/host/student/submission/receipt/messages.hr.ts:38<br>packages/app/src/host/teacher/n07/messages.hr.ts:7 | Učitavam potvrdu s poslužitelja. | Učitavanje potvrde s poslužitelja… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-176 | packages/app/src/host/student/submission/steps/messages.hr.ts:6<br>packages/app/src/host/student/submission/submit/messages.hr.ts:18 | Učitavam stanje rada s poslužitelja. | Učitavanje stanja rada s poslužitelja… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-177 | packages/app/src/host/student/submission/summary/messages.hr.ts:120 | Učitavam tekst rada s poslužitelja. | Učitavanje teksta rada s poslužitelja… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-178 | packages/app/src/host/student/submission/withdraw/messages.hr.ts:18 | Učitavam stanje predaje. | Učitavanje stanja predaje… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-179 | packages/app/src/host/teacher/assignment-form/messages.hr.ts:131 | Učitavam kostur predloška. | Učitavanje kostura predloška… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-180 | packages/app/src/host/teacher/course-aggregate/messages.hr.ts:18 | Učitavam zbirni pregled… | Učitavanje zbirnog pregleda… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-181 | packages/app/src/host/teacher/input-rhythm/messages.hr.ts:17 | Učitavam postavku ritma… | Učitavanje postavke ritma… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-182 | packages/app/src/host/teacher/interview/messages.hr.ts:12 | Učitavam pripremu za razgovor… | Učitavanje pripreme za razgovor… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-183 | packages/app/src/host/teacher/mentorships/messages.hr.ts:22 | Učitavam stanje radova… | Učitavanje stanja radova… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-184 | packages/app/src/host/teacher/mentorships/messages.hr.ts:48 | Učitavam pregled runde… | Učitavanje pregleda runde… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-185 | packages/app/src/host/teacher/mentorships/messages.hr.ts:102 | Učitavam zapisnik… | Učitavanje zapisnika… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-186 | packages/app/src/host/teacher/n06/messages.hr.ts:8 | Učitavam rad s poslužitelja… | Učitavanje rada s poslužitelja… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-187 | packages/app/src/host/teacher/n09/messages.hr.ts:7 | Učitavam promjene rada… | Učitavanje promjena rada… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-188 | packages/app/src/host/teacher/n10/messages.hr.ts:8 | Učitavam sažetak procesa… | Učitavanje sažetka procesa… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-189 | packages/app/src/host/teacher/n11/messages.hr.ts:7 | Učitavam poslane verzije… | Učitavanje poslanih verzija… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-190 | packages/app/src/host/teacher/n11/messages.hr.ts:8 | Učitavam usporedbu… | Učitavanje usporedbe… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-191 | packages/app/src/host/teacher/pre-submit/messages.hr.ts:6 | Učitavam sažetak procesa s poslužitelja… | Učitavanje sažetka procesa s poslužitelja… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-192 | packages/app/src/host/teacher/revision/messages.hr.ts:24 | Učitavam zahtjev za doradu… | Učitavanje zahtjeva za doradu… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-193 | packages/app/src/host/teacher/submissions/history/messages.hr.ts:12 | Učitavam povijest. | Učitavanje povijesti… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-194 | packages/app/src/host/teacher/submissions/messages.hr.ts:16 | Učitavam predaje. | Učitavanje predaja… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-195 | packages/app/src/host/teacher/submissions/messages.hr.ts:24 | Učitavam predanu verziju. | Učitavanje predane verzije… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-196 | packages/app/src/host/teacher/work/ai-attachments/messages.hr.ts:12 | Učitavam izjavu i priložene razgovore. | Učitavanje izjave i priloženih razgovora… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-197 | packages/app/src/host/teacher/work/review/messages.hr.ts:6 | Učitavam pregled rada… | Učitavanje pregleda rada… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-198 | packages/app/src/host/teacher/work/review/pg-messages.hr.ts:17 | Učitavam sastav teksta… | Učitavanje sastava teksta… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-199 | packages/app/src/host/teacher/work/review/pg-messages.hr.ts:52 | Učitavam važna mjesta… | Učitavanje važnih mjesta… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-200 | packages/app/src/host/teacher/work/review/pg-messages.hr.ts:78 | Učitavam objašnjenja… | Učitavanje objašnjenja… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |
| L-13-201 | packages/app/src/i18n/messages.hr.ts:45 | Učitavam postavke obavijesti… | Učitavanje postavki obavijesti… | Jedan glas sučelja; prvo lice uz stroj nije u ostatku sučelja. |

## L-14 Isti glas: ostale poruke u prvom licu

Vidi L-13.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-14-202 | src/components/editor/mentor/messages/messages.hr.ts:10<br>src/components/editor/student-milestones/messages.hr.ts:14<br>packages/app/src/host/editor/mentor/messages.hr.ts:70 | Šaljem… | Slanje… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-203 | src/components/editor/sources/proofs/messages.hr.ts:40 | Šaljem isječak… | Slanje isječka… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-204 | src/components/editor/sources/proofs/messages.hr.ts:53 | Tražim u PDF-u… | Traženje u PDF-u… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-205 | src/components/editor/stopped-report/messages.hr.ts:14 | Šaljem prijavu… | Slanje prijave… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-206 | src/components/editor/submission-rehearsal/messages.hr.ts:23<br>packages/app/src/host/editor/status/messages.hr.ts:19<br>packages/app/src/host/student/submission/summary/messages.hr.ts:107 | Provjeravam izjavu na poslužitelju… | Provjera izjave na poslužitelju… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-207 | src/lib/i18n/messages.hr.ts:1059<br>locales/hr.ts:934 | Otvaram rad… | Otvaranje rada… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-208 | src/lib/i18n/messages.hr.ts:2179<br>locales/hr.ts:1878 | Šaljem prijavu. | Slanje prijave… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-209 | packages/app/src/host/editor/bibliography/student/messages.hr.ts:68 | Čitam crtični kod… | Čitanje crtičnog koda… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-210 | packages/app/src/host/editor/import/messages.hr.ts:9 | Čitam datoteku… | Čitanje datoteke… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-211 | packages/app/src/host/editor/status/messages.hr.ts:13 | Provjeravam zatražene potvrde… | Provjera zatraženih potvrda… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-212 | packages/app/src/host/institution/student-data-export/messages.hr.ts:26 | Šaljem zahtjev… | Slanje zahtjeva… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-213 | packages/app/src/host/student/interview/messages.hr.ts:22 | Šaljem bilješku. | Slanje bilješke. | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-214 | packages/app/src/host/student/interview/messages.hr.ts:28 | Šaljem objašnjenje. | Slanje objašnjenja. | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-215 | packages/app/src/host/student/submission/declaration/messages.hr.ts:34 | Spremam potvrdu izjave na poslužitelj… | Spremanje potvrde izjave na poslužitelj… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-216 | packages/app/src/host/student/submission/submit/messages.hr.ts:69 | Provjeravam je li tekst na uređaju stigao na poslužitelj… | Provjera je li tekst na uređaju stigao na poslužitelj… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-217 | packages/app/src/host/student/submission/submit/messages.hr.ts:82 | Čitam stanje predaje s poslužitelja. Pokušaj {n} od {limit}. | Čitanje stanja predaje s poslužitelja. Pokušaj {n} od {limit}. | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |
| L-14-218 | packages/app/src/host/student/submission/submit/messages.hr.ts:102 | Šaljem zadnju verziju na poslužitelj… | Slanje zadnje verzije na poslužitelj… | Jedan glas sučelja (L-13). Genitiv/oblik provjeriti pri ispravku. |

## L-15 „zahtjev” u tehničkom značenju vidljiv korisniku

„Zahtjev” znači tri stvari: zahtjev za doradu (nastavnik studentu), zahtjev za predaju i mrežni zahtjev. Mrežni oblik korisniku ne treba.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-15-219 | locales/hr.ts:2011 | Slanje zahtjeva prekinuto je prije kraja. Pokušajte ponovno. | Slanje je prekinuto prije kraja. Pokušajte ponovno. | Tehnički pojam bez koristi za korisnika; „zahtjev” rezerviran za doradu/predaju. |
| L-15-220 | locales/hr.ts:2012 | Slanje zahtjeva trajalo je predugo. Pokušajte ponovno. | Slanje je trajalo predugo. Pokušajte ponovno. | Tehnički pojam bez koristi za korisnika; „zahtjev” rezerviran za doradu/predaju. |

## L-16 „prijava” = prijava u aplikaciju i prijava problema

Isti zaslon kaže „Ovaj preglednik više nije prijavljen” (prijava u aplikaciju) i „Prijava je otišla prije toga” (prijava problema). Prijedlog: za prijavu problema uvijek „prijava problema”; „prijava” sama ostaje za AAI@EduHr prijavu.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-16-221 | src/components/editor/stopped-report/messages.hr.ts:13<br>src/lib/i18n/messages.hr.ts:2178<br>locales/hr.ts:1877 | Pošalji prijavu | Pošalji prijavu problema | Homonim u istoj rečenici. |
| L-16-222 | src/components/editor/stopped-report/messages.hr.ts:14 | Šaljem prijavu… | Slanje prijave problema… | Homonim u istoj rečenici. |
| L-16-223 | src/components/editor/stopped-report/messages.hr.ts:15 | Prijava je poslana. U nju je ušla samo oznaka stanja, ne tekst rada. | Prijava problema je poslana. U nju je ušla samo oznaka stanja, ne tekst rada. | Homonim u istoj rečenici. |
| L-16-224 | src/components/editor/stopped-report/messages.hr.ts:16 | Opis ne može ovako u prijavu. Skratite ga ili uklonite neobične znakove. | Opis ne može ovako u prijavu problema. Skratite ga ili uklonite neobične znakove. | Homonim u istoj rečenici. |
| L-16-225 | src/lib/i18n/messages.hr.ts:2179<br>locales/hr.ts:1878 | Šaljem prijavu. | Slanje prijave problema. | Homonim u istoj rečenici. |
| L-16-226 | src/lib/i18n/messages.hr.ts:2181<br>locales/hr.ts:1880 | Prijava je poslana | Prijava problema je poslana | Homonim u istoj rečenici. |
| L-16-227 | src/lib/i18n/messages.hr.ts:2183<br>locales/hr.ts:1882 | Broj prijave navedite ako se javite istim povodom. | Broj prijave navedite ako se javite istim povodom. | Homonim u istoj rečenici. |
| L-16-228 | src/lib/i18n/messages.hr.ts:2184<br>locales/hr.ts:1883 | Prijava nije poslana. Opis je ostao u obrascu. | Prijava problema nije poslana. Opis je ostao u obrascu. | Homonim u istoj rečenici. |
| L-16-229 | src/lib/i18n/messages.hr.ts:2187<br>locales/hr.ts:1888 | Ovaj preglednik više nije prijavljen pod Vašim računom: odjavili ste se ili se prijavio netko drugi. Prijava je otišla prije toga i možda je primljena, pa je ne šaljite ponovno. Opis je uklonjen iz obrasca. | Ovaj preglednik više nije prijavljen pod Vašim računom: odjavili ste se ili se prijavio netko drugi. Prijava problema je otišla prije toga i možda je primljena, pa je ne šaljite ponovno. Opis je uklonjen iz obrasca. | Homonim u istoj rečenici. |
| L-16-230 | src/lib/i18n/messages.hr.ts:2188<br>locales/hr.ts:1890 | Prijava je primljena pod brojem {reference} prije nego što je ovaj preglednik odjavljen s Vašeg računa. Opis je uklonjen iz obrasca. | Prijava problema je primljena pod brojem {reference} prije nego što je ovaj preglednik odjavljen s Vašeg računa. Opis je uklonjen iz obrasca. | Homonim u istoj rečenici. |
| L-16-231 | src/lib/i18n/messages.hr.ts:2196<br>locales/hr.ts:1900 | Veza s Ducturom prekinuta je prije odgovora. Prijava je možda ipak primljena. Provjerite internetsku vezu pa pokušajte ponovno; ako je već stigla, bit će zabilježena dvaput. | Veza s Ducturom prekinuta je prije odgovora. Prijava problema je možda ipak primljena. Provjerite internetsku vezu pa pokušajte ponovno; ako je već stigla, bit će zabilježena dvaput. | Homonim u istoj rečenici. |
| L-16-232 | src/lib/i18n/messages.hr.ts:2197<br>locales/hr.ts:1902 | Ductura nije odgovorila na vrijeme. Prijava je možda ipak primljena. Pokušajte ponovno za nekoliko minuta; ako je već stigla, bit će zabilježena dvaput. | Ductura nije odgovorila na vrijeme. Prijava problema je možda ipak primljena. Pokušajte ponovno za nekoliko minuta; ako je već stigla, bit će zabilježena dvaput. | Homonim u istoj rečenici. |
| L-16-233 | src/lib/i18n/messages.hr.ts:2202<br>locales/hr.ts:1910 | Ductura nije potvrdila zapis prijave. Prijava je možda ipak primljena. Pokušajte ponovno za nekoliko minuta; ako je već stigla, bit će zabilježena dvaput. | Ductura nije potvrdila zapis prijave. Prijava problema je možda ipak primljena. Pokušajte ponovno za nekoliko minuta; ako je već stigla, bit će zabilježena dvaput. | Homonim u istoj rečenici. |
| L-16-234 | src/lib/i18n/messages.hr.ts:2203<br>locales/hr.ts:1911 | Ductura nije potvrdila primitak prijave. Pokušajte ponovno za nekoliko minuta. | Ductura nije potvrdila primitak prijave. Pokušajte ponovno za nekoliko minuta. | Homonim u istoj rečenici. |
| L-16-235 | packages/app/src/i18n/messages.hr.ts:7 | Postavke vrijede samo za Vaš račun. Promjena jezika ne traži ponovnu prijavu. | Postavke vrijede samo za Vaš račun. Promjena jezika ne traži ponovnu prijavu. | Homonim u istoj rečenici. |

## L-17 „korištenje” i „uporaba”

Isti pojam piše se „Izjava o korištenju AI-ja” (naziv obrasca) i „Pravila uporabe AI-ja”, „uporaba Asistenta”. [PITANJE] Naziv „Izjava o korištenju …” može biti propisan obrascem fakulteta (D-129); dok vlasnik ne potvrdi, ne mijenjati naziv obrasca, nego uskladiti ostale tekstove s jednim izborom.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-17-236 | src/components/editor/assistant/coming-soon/messages.hr.ts:7 | Svrha korištenja | Svrha uporabe | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |
| L-17-237 | src/components/editor/submission-package/messages.hr.ts:9<br>src/components/editor/submission-rehearsal/messages.hr.ts:21<br>src/lib/i18n/messages.hr.ts:1047<br>… (+1) | Izjava o korištenju AI-ja | Izjava o uporabi AI-ja | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |
| L-17-238 | src/lib/i18n/messages.hr.ts:154<br>locales/hr.ts:100 | Student piše, a nastavnik prati kako rad nastaje i komentira uz odlomke. ${APP_NAME} ne procjenjuje autorstvo ni korištenje AI-ja, a prije početka vidite što nastavnik vidi i od kada. | Student piše, a nastavnik prati kako rad nastaje i komentira uz odlomke. ${APP_NAME} ne procjenjuje autorstvo ni uporabu AI-ja, a prije početka vidite što nastavnik vidi i od kada. | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |
| L-17-239 | packages/app/src/host/editor/assistant-rules/messages.hr.ts:25 | Izjava o korištenju alata | Izjava o uporabi alata | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |
| L-17-240 | packages/app/src/host/student/i18n/messages.hr.ts:98 | Ductura ne procjenjuje autorstvo ni korištenje AI-ja. | Ductura ne procjenjuje autorstvo ni uporabu AI-ja. | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |
| L-17-241 | packages/app/src/host/student/interview/messages.hr.ts:7 | Razgovor nije optužba. Ductura ne procjenjuje autorstvo ni korištenje AI-ja. | Razgovor nije optužba. Ductura ne procjenjuje autorstvo ni uporabu AI-ja. | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |
| L-17-242 | packages/app/src/host/student/notice/messages.hr.ts:10 | Dopušteno: nijedna uporaba Asistenta s popisa. | Dopušteno: nijedna uporaba Asistenta s popisa. | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |
| L-17-243 | packages/app/src/host/student/statement/messages.hr.ts:31 | Navedite alate koje ste koristili izvan Ducture. Razgovori s Asistentom bilježe se sami. | Navedite alate koje ste koristili izvan Ducture. Razgovori s Asistentom bilježe se sami. | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |
| L-17-244 | packages/app/src/host/student/submission/declaration/messages.hr.ts:4<br>packages/app/src/host/student/submission/summary/messages.hr.ts:64<br>packages/app/src/host/teacher/ai-declaration/messages.hr.ts:2 | Izjava o korištenju generativne umjetne inteligencije | Izjava o uporabi generativne umjetne inteligencije | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |
| L-17-245 | packages/app/src/host/teacher/ai-declaration/messages.hr.ts:10 | Izjava o korištenju AI-ja trenutačno nije dostupna. | Izjava o uporabi AI-ja trenutačno nije dostupna. | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |
| L-17-246 | packages/app/src/host/teacher/work/ai-attachments/messages.hr.ts:7 | Student je izjavio/izjavila da nije koristio/koristila AI alate. U radu nije zabilježena uporaba Asistenta i nema priloženih razgovora. | Student je izjavio/izjavila da nije koristio/koristila AI alate. U radu nije zabilježena uporaba Asistenta i nema priloženih razgovora. | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |
| L-17-247 | packages/app/src/host/teacher/work/ai-attachments/messages.hr.ts:8 | Zadatak ne dopušta ugrađenog Asistenta. Student je izjavio/izjavila uporabu vanjskog alata. | Zadatak ne dopušta ugrađenog Asistenta. Student je izjavio/izjavila uporabu vanjskog alata. | Jedan naziv za isti pojam (izbor vlasnika; prijedlog „uporaba”, kao u „Pravila uporabe”). |

## L-18 „kartica” u tri značenja

„Kartica” je: kartica preglednika („ova kartica više ne sprema”), kartica u rubnom panelu editora („u kartici Komentari”, „u kartici Rad”) i kartica zadatka/rada („na kartici zadatka”). Prijedlog: za preglednik uvijek „kartica preglednika”; panel „kartica Komentari” ostaje; vidi pojmovnik.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-18-248 | src/lib/i18n/messages.hr.ts:1151<br>locales/hr.ts:995 | Dokument je u međuvremenu promijenjen na drugom mjestu, pa ova kartica više ne sprema. Izvezite tekst, zatim ponovno učitajte stranicu. | Dokument je u međuvremenu promijenjen na drugom mjestu, pa ova kartica preglednika više ne sprema. Izvezite tekst, zatim ponovno učitajte stranicu. | Dvoznačnost; uz „preglednika” je jasno da nije panel. |
| L-18-249 | src/lib/i18n/messages.hr.ts:1154<br>locales/hr.ts:999 | Lokalni zapis nije moguće pouzdano pročitati. Ostaje netaknut, a ova kartica ništa ne sprema. | Lokalni zapis nije moguće pouzdano pročitati. Ostaje netaknut, a ova kartica preglednika ništa ne sprema. | Dvoznačnost; uz „preglednika” je jasno da nije panel. |
| L-18-250 | src/lib/i18n/messages.hr.ts:1332<br>locales/hr.ts:1133 | Prikaz miruje dok je kartica u pozadini. | Prikaz miruje dok je kartica preglednika u pozadini. | Dvoznačnost; uz „preglednika” je jasno da nije panel. |
| L-18-251 | src/lib/i18n/messages.hr.ts:1734<br>locales/hr.ts:1536 | Prijava više ne vrijedi, pa ova kartica više ne prikazuje rad. Rad nastavljate kad se ponovno prijavite. | Prijava više ne vrijedi, pa ova kartica preglednika više ne prikazuje rad. Rad nastavljate kad se ponovno prijavite. | Dvoznačnost; uz „preglednika” je jasno da nije panel. |
| L-18-252 | src/lib/i18n/messages.hr.ts:2224<br>locales/hr.ts:1933 | Ništa izvan editora: zaslon, kamera i druge kartice preglednika nisu dio rada. | Ništa izvan editora: zaslon, kamera i druge kartice preglednika nisu dio rada. | Dvoznačnost; uz „preglednika” je jasno da nije panel. |
| L-18-253 | packages/editor-core/src/sync/labels.ts:92<br>packages/ui/src/components/save-state.ts:23 | Dokument je otvoren u drugoj kartici. | Dokument je otvoren u drugoj kartici preglednika. | Dvoznačnost; uz „preglednika” je jasno da nije panel. |

## L-19 Brojevi uz imenice bez množinskog oblika

Neka poruke ispisuju broj uz fiksni oblik („za {n} dana”, „{n} riječi”, „{n} puta”), pa za 1, 21, 31 … ispadaju „1 dana”, „21 riječi”. Drugdje se rabi `pluralHr`/ternar (`status`, `assist` redak 212). Provjeriti može li {n} biti 1, 21, 31 …; ako može, rabiti `pluralHr`.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-19-254 | packages/app/src/host/editor/assist/messages.hr.ts:124<br>packages/app/src/host/editor/assist/messages.hr.ts:156 | Rad je ${n} riječi iznad granice. | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |
| L-19-255 | packages/app/src/host/editor/assist/messages.hr.ts:127<br>packages/app/src/host/editor/assist/messages.hr.ts:157 | Do donje granice nedostaje ${n} riječi. | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |
| L-19-256 | packages/app/src/host/editor/assist/messages.hr.ts:165 | Ciljevi su raspodijeljeni na oko ${n} riječi. | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |
| L-19-257 | packages/app/src/host/editor/comments/messages.hr.ts:57 | Ista primjedba ponavlja se ${n} puta | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |
| L-19-258 | packages/app/src/host/editor/format-check/messages.hr.ts:26<br>packages/app/src/host/editor/rules/messages.hr.ts:50 | {n} riječi. | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |
| L-19-259 | packages/app/src/host/editor/format-check/messages.hr.ts:27 | {n} riječi, najmanje {min}. | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |
| L-19-260 | packages/app/src/host/editor/format-check/messages.hr.ts:28 | {n} riječi, najviše {max}. | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |
| L-19-261 | packages/app/src/host/editor/left/messages.hr.ts:74 | Ova sesija: ${n >= 0 ? "+" : ""}${n} riječi | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |
| L-19-262 | packages/app/src/host/editor/mentor/messages.hr.ts:35 | za {n} dana | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |
| L-19-263 | packages/app/src/host/editor/mentor/messages.hr.ts:45 | {n} riječi | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |
| L-19-264 | packages/app/src/host/editor/rules/messages.hr.ts:35 | Sada {n} riječi. | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |
| L-19-265 | packages/app/src/host/student/home/messages.hr.ts:20 | Rok za {n} dana | (isti tekst; oblik brojiti kroz `pluralHr`: jedan / dva do četiri / ostalo) | Pogrešan oblik za brojeve koji završavaju na 1 (osim 11). |

## L-22 Ostalo (ručno uočeno)

Pojedinačni nalazi izvan obrazaca iznad.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-22-266 | src/lib/i18n/messages.hr.ts:971<br>locales/hr.ts:852 | {field} sadrži znak koji list ne prima; upiši polje ponovno. | {field} sadrži znak koji list ne prima; upišite polje ponovno. | Obraćanje s „ti” (L-02); rečenica je izvan pravila L-02 jer nema točku na kraju. |
| L-22-267 | src/lib/i18n/messages.hr.ts:972<br>locales/hr.ts:853 | Stranica navoda sadrži znak koji list ne prima; upiši je ponovno. | Stranica navoda sadrži znak koji list ne prima; upišite je ponovno. | Obraćanje s „ti” (L-02). |
| L-22-268 | packages/app/src/host/editor/right/messages.hr.ts:43 | Pojmovnik je pun. Ukloni neki pojam da dodaš novi. | Pojmovnik je pun. Uklonite neki pojam da dodate novi. | Drugo lice jednine („dodaš”) u poruci; ostatak sučelja govori s „Vi” (L-02). |
| L-22-269 | packages/app/src/host/institution/student-data-export/messages.hr.ts:12 | Referada predaje zahtjev nakon što je provjerila identitet studenta. Izvoz pokreće administrator ustanove. | Referada podnosi zahtjev nakon što je provjerila identitet studenta. Izvoz pokreće administrator ustanove. | „Predati” je u sučelju rezervirano za predaju rada (pojmovnik P-3); zahtjev se podnosi. |
| L-22-270 | packages/app/src/host/institution/student-data-export/messages.hr.ts:49 | Zahtjeve za izvoz podataka predaje referada, a pokreće ih administrator ustanove. | Zahtjeve za izvoz podataka podnosi referada, a pokreće ih administrator ustanove. | Isto (P-3). |
| L-22-271 | packages/app/src/host/teacher/comment-bank/messages.hr.ts:19 | Nacrti su se u međuvremenu promijenili, osvježi popis | Nacrti su se u međuvremenu promijenili. Osvježite popis. | Obraćanje s „ti” i spojena rečenica bez točke (L-02). |
## L-20 Tekst izvan kataloga (JSX)

Tri teksta stoje izravno u komponentama, ne u katalogu. Komentar u `src/lib/i18n/messages.hr.ts` kaže da se čišćenje izvan kataloga odgađa do engleskog (D-70); popis služi tome.

| # | datoteka:redak | sada | prijedlog | razlog |
|---|---|---|---|---|
| L-20-001 | packages/ui/src/components/Card.tsx:35 | Učitavanje… | tekst iz kataloga (npr. `common.loading`), isti kao u `locales/hr.ts` „Učitavanje…” | Izravan tekst u zajedničkoj komponenti ne može se prevesti ni skenirati. |
| L-20-002 | packages/ui/src/components/command-palette/CommandPalette.tsx:62 | ↑ ↓ odabir · Enter potvrda · Esc zatvori | iz kataloga; nazive tipki ostaviti, riječi „odabir”, „potvrda”, „zatvori” prevesti kroz katalog | Isto. Uz to „potvrda” (imenica) uz „zatvori” (glagol): „odabir · potvrda · zatvaranje” ili „odaberi · potvrdi · zatvori”. |
| L-20-003 | packages/ui/src/components/shortcut-list/ShortcutList.tsx:24 | Nema prečaca za ovaj prikaz. | iz kataloga | Isto. |

## L-21 Dva kataloga s istim tekstom

`locales/hr.ts` (808 tekstova prema ovom pregledu) i `src/lib/i18n/messages.hr.ts` (1 094) sadrže 769 istih tekstova; razlika je u starim ključevima koje rabi editor. Svaki ispravak iz ovog popisa treba napraviti u oba (vidi stupac `datoteka:redak`), inače se tekst u sučelju razilazi ovisno o ekranu. Ovo nije lektorski nalaz, ali ga je potrebno znati prije ispravka; spajanje kataloga je zaseban zadatak.

## 3. Otvoreno i pretpostavke

**Otvoreno (odluke vlasnika):**
- L-17: „korištenje” ili „uporaba” u nazivima obrazaca (D-129 / obrazac fakulteta).
- L-10: znači li „sačuvano” isto što i „spremljeno na uređaju”; prije primjene provjeriti s autorom poruke.
- L-08 i pojmovnik P-9: Rječnik (PRODUCT §5) traži „iz AI pomoćnika”, a sučelje u novijim modulima piše „Asistent”.
- L-02: ostavlja li se „ti” u gumbima (pojmovnik P-1).
- L-07: PRODUCT §5 pravilo 6 piše „ekran”, sučelje većinom „zaslon”.

**Pretpostavke:** dosljednost se mjeri prema većini u kodu (npr. „Vaš” 134 : 34, „ponovno” 661 : 1); gdje većina nije jasna ili tekst može biti propisan, redak je označen kao pitanje. Nijedan prijedlog ne dira Rječnik zabranjenih izraza ni `terms.ts`.

**Za sljedeći zadatak (ispravci):** raditi po nalazima L-01 do L-19, svaki ispravak s testom koji bi pao bez izmjene (skener `scripts/forbidden-terms` i testovi kataloga); L-09 prvo potvrditi skenerom.
