# Pojmovnik pojmova sučelja (`pojmovnik`)

Datum: 26. 11. 2026. Pisac: JEZIK-POJMOVNIK (`wjezikpojmovnik`, frontend). Zadatak: plan `ductura/.github#104` (`docs/plan/PRIJEDLOZI-2611.md`), odobren 26. 11. (Ductus#2055 c.7182294468). Uz ovaj dokument ide `docs/nalazi/lektura-nalazi.md` (prolaz lekture; oznake L-n).

**Samo dokument.** Ništa u kodu nije promijenjeno. Ovo je prijedlog jednog rječnika za sučelje; ispravke tekstova su poseban kasniji zadatak.

Ne brkati: u editoru postoji studentova funkcija „Pojmovnik” (popis pojmova rada, `packages/app/src/host/editor/right`). Ovdje „pojmovnik” znači popis naziva koje sučelje smije rabiti.

## 0. Odnos prema postojećim pravilima

- **Rječnik zabranjenih izraza** (Ductus `docs/PRODUCT.md` §5, skener `scripts/forbidden-terms/terms.ts`) vrijedi bez iznimke i ima prednost. Ovaj pojmovnik ga ne mijenja ni ne proširuje; stupac „Ne rabiti” navodi samo nedosljedne ili dvoznačne inačice, a zabranjene izraze iz Rječnika označava s „(Rječnik)”.
- Ako se pojmovnik i Rječnik razilaze, vrijedi Rječnik, a pojmovnik se ispravlja (P-9).
- Sučelje je na hrvatskom, bez engleskih riječi tamo gdje postoji uobičajen hrvatski naziv. Naziv aplikacije je `APP_NAME` (Ductura), s lokativom „u Ducturi”, akuzativom „u Ducturu”.
- „Preporučeno” je određeno prema većini u kodu (broj mjesta iz pregleda u lektura-nalazi.md, §0); gdje većina nije jasna, stoji [PITANJE] i ostaje odluka vlasnika.

Stupci: **pojam** (što znači), **preporučeni izraz**, **ne rabiti** (nedosljedne ili dvoznačne inačice), **gdje se koristi** (modul ili ključ; staze su u `packages/app/src/host/…` ili `src/…`), **napomena**.

## 1. Osobe i uloge

| # | Pojam | Preporučeni izraz | Ne rabiti | Gdje se koristi | Napomena |
|---|---|---|---|---|---|
| P-1a | Student, osoba koja piše rad | **student** (opća muška imenica; nema kosih crta) | „student/ica”, „studentica ili student”, rodni parovi u glagolu („izjavio/izjavila”) | svugdje; `locales/hr.ts` `student.*` | Za rečenice koje bi tražile rod glagola: bezrodna formulacija („U izjavi stoji …”), vidi L-11. |
| P-1b | Nastavnik zadatka, osoba koja objavljuje zadatak i vidi tijek rada | **nastavnik** | „profesor”, „predavač”, „voditelj” | `teacher.*`, `shell.role.teacher`, nav „Moji kolegiji” | PRODUCT §3: „nastavnik ili profesor” je jedna uloga; u sučelju samo „nastavnik”. |
| P-1c | Nastavnik u ulozi mentora rada (završni, diplomski …) | **mentor** | „voditelj rada”, „komentor” (osim kad uloga stvarno postoji) | `mentor.*`, `mentorship.*`, nav „Radovi uz mentora” | „Mentor (nastavnik zadatka)” je jedna uloga (D-154): u tekstu pisati „mentor”, a „nastavnik” samo kad je riječ o kolegiju i zadatku. |
| P-1d | Administrator ustanove | **administrator ustanove** (u nav i naslovima „Administracija ustanove”) | „admin”, „administrator fakulteta” u istom ekranu kao „administrator ustanove” | `shell.space.admin`, `institution*` | PRODUCT §3 navodi „administrator ustanove (administrator fakulteta)”; u tekstu jedan od dva, ne oba na istom zaslonu (vidi P-4). |
| P-1e | Referada (osoblje fakulteta koje podnosi zahtjeve) | **referada** | „studentska služba”, „studomat” osim kad je to naziv sustava | `public/my-rights`, `institution/student-data-export` | Referada **podnosi** zahtjev (P-3), ne „predaje” ga. |
| P-1f | Član nastavnog tima (asistent na kolegiju, grupa) | **nastavni tim** | „asistent” bez odrednice (sukob s AI Asistentom, P-9) | `teacher/teaching-team` | U prikazima s ID-em („Asistent #id”, WEB-2006) pisati „član tima” dok nije jasno da nije AI Asistent. |

## 2. Rad, zadatak, predaja

| # | Pojam | Preporučeni izraz | Ne rabiti | Gdje se koristi | Napomena |
|---|---|---|---|---|---|
| P-2a | Studentov tekst (dokument koji nastaje) | **rad** („Moji radovi”, „Predan rad”) | „dokument” za rad u cjelini; „projekt”, „esej” | `student.works`, `editor.*`, `submission.*` | „Dokument” je dopušten samo u tehničkim porukama o editoru („Dokument je otvoren u drugoj kartici”); korisniku se predaje „rad”. |
| P-2b | Nastavnikova obveza za koju se piše rad | **zadatak** („Moji zadaci”, „Obavijest zadatka”) | „predmet”, „obveza”, „task” | `teacher.assignment.*`, `student.assignments` | „Zadatak” je uvijek nastavnikov; „rad” je uvijek studentov. |
| P-2c | Skup zadataka, studenata i nastavnika | **kolegij** („Upis u kolegij”) | „predmet”, „kurs” | `student.enrol*`, `teacher.course.*` | 72 mjesta „kolegij”; nijedno „predmet”. |
| P-3a | Konačno dostavljanje rada nastavniku (s potvrdom) | **predaja** / **predati rad** („Rad je predan”, „Potvrda predaje”) | „slanje rada”, „prijava rada”, „dostava” | `submission.*`, `student/submission/**`, `teacher/submissions` | Samo za rad. Zahtjev, obrazac ili paket se **podnosi**, ne predaje. |
| P-3b | Prijenos teksta s uređaja na poslužitelj | **slanje** („Slanje na poslužitelj”, „poslano na poslužitelj”) | „predaja” za sinkronizaciju; „upload” | `editor.send*`, `errors.body*`, `statusPage.components.writing` | Slanje ≠ predaja: poslan tekst nije predan rad. |
| P-3c | Verzija rada koju je student poslao nastavniku na pregled, a nije predana | **poslana verzija** | „predana verzija” za neposlanu, „objavljena verzija” | `student.teacherExtended`, `howItWorks.seen.rows.compare` (PRODUCT §5 pr. 7: „poslane na pregled ili predane”) | Usporedba je „poslanih verzija”; riječ „predana” samo uz stvarnu predaju. |
| P-3d | Povlačenje predaje prije roka | **povući predaju** / **povlačenje** („Potvrda povlačenja”) | „opozvati predaju”, „poništiti” | `student/submission/withdraw/**` | Za predaju i zahtjev: „povući”; za ulogu i dopuštenje: „opozvati” (P-14). |
| P-3e | Dorada, odnosno zahtjev nastavnika da student ispravi rad | **zahtjev za doradu**, **dorada** („rok dorade”, „Mentor čeka doradu”) | „ispravak”, „revizija” (osim u revizijskom tragu), „povratni zahtjev” | `revisions.*`, `teacher.revision`, `editor.mentor` | „Zahtjev” je ovdje poruka nastavnika studentu; mrežni „zahtjev” nikad ne pokazivati korisniku (P-8). |

## 3. Ustanova i pravila

| # | Pojam | Preporučeni izraz | Ne rabiti | Gdje se koristi | Napomena |
|---|---|---|---|---|---|
| P-4a | Ustanova u općem smislu (račun, uloge, postavke, podaci) | **ustanova** („Pregled ustanove”, „Postavke ustanove”, „administrator ustanove”) | „fakultet” za isti pojam u istoj poruci | `institution*`, `shell.nav.institution` | 44 mjesta „ustanova/fakultet” u katalogu. |
| P-4b | Konkretni fakultet kao izvor pravila („pravila fakulteta”, „pravilnik”) | **fakultet** („Pravila fakulteta”, „postavka fakulteta”) | „ustanova” kad je riječ o pravilniku koji je donio fakultet | `facultyRules`, `facultyRuleVersions`, `teacher.course.policy` | Rječnik: obrazac fakulteta propisuje naziv; ne mijenjati naziv obrasca. |
| P-4c | Naslov zaslona koji sada glasi „Postavke ustanove” ili „postavke fakulteta” | **jedan naziv po zaslonu** [PITANJE] | oba na istom zaslonu | `src/lib/i18n/m:2026` („Postavke ustanove”) i `admin/faculty-settings` („postavke fakulteta”) | Isti zaslon, dva naziva; odluka vlasnika. |
| P-4d | Pravila koja nastavnik postavlja na kolegiju | **pravila kolegija** | „pravila predmeta” | `teacher.tools`, `teacher.course.policies` | |

## 4. Prijava, odjava, upis, sesija

| # | Pojam | Preporučeni izraz | Ne rabiti | Gdje se koristi | Napomena |
|---|---|---|---|---|---|
| P-5a | Prijava u aplikaciju (AAI@EduHr) | **prijava** / **prijaviti se**, **odjava** | „login”, „sesija” (za prijavu), „ulogirati se” | `landing.enter`, `auth.*`, `*.signedOut` | Pisati točno **AAI@EduHr** (D-09). Isti događaj: „Prijava je istekla” (L-03). |
| P-5b | Poruka o problemu koju korisnik šalje podršci | **prijava problema** | „prijava” sama (sukob s P-5a), „bug report” | `support.*`, `stopped-report`, `operator/problem-reports` | „Broj prijave problema”, „Prijava problema je poslana” (L-16). |
| P-5c | Upis studenta u kolegij | **upis u kolegij** / **upisati se** („kod za upis”) | „prijava na kolegij” | `student.enrol*`, `teacher.teaching-team` | Uz „upisan”, „upisani studenti”; imperativ „Upiši kolegij” je gumb (P-1 obraćanje). |
| P-5d | Razdoblje pisanja bez stanke (prag P-01 koji postavlja fakultet) | **razdoblje pisanja** [PITANJE: ili „sesija pisanja”] | „sesija” uz prijavu (L-03), „P-01” u tekstu za korisnika (L-12) | `student/submission/summary`, `teacher/n10`, `TeacherSetup` | „Sesija” ostaje samo ako vlasnik odluči zadržati; tada uvijek „sesija pisanja”. |

## 5. Stanja spremanja, slanje, tekst

| # | Pojam | Preporučeni izraz | Ne rabiti | Gdje se koristi | Napomena |
|---|---|---|---|---|---|
| P-6a | Tekst zapisan na uređaju | **Spremljeno na uređaju** | „sačuvano”, „pohranjeno”, „spremljeno” bez mjesta (Rječnik) | `editor.sendStoppedSaved`, `howItWorks.saving.device` | Rječnik traži mjesto uz „spremljeno”. |
| P-6b | Tekst koji je poslužitelj potvrdio | **Spremljeno na poslužitelju** | isto | `howItWorks.saving.server`, `submission.*` | Ne tvrditi prije potvrde poslužitelja. |
| P-6c | Zapis „u obrascu” (neposlan unos) | **ostaje u obrascu** | „sačuvano” (L-10) | `sources/proofs`, `consult`, `mentorships` | Gdje poruka tvrdi „sačuvano”, navesti gdje. |
| P-6d | Što je poslužitelj, a što uređaj, preglednik | **poslužitelj**, **uređaj**, **preglednik** („kartica preglednika”) | „server”, „aplikacija na klijentu” | cijelo sučelje (poslužitelj 257 mjesta) | |
| P-6e | Spremanje u opisu radnje | **spremiti** (gumb: „Spremi jezik rada”) | „sačuvati”, „pohraniti” | `teacher.workLanguageException.save` | |

## 6. AI i Asistent

| # | Pojam | Preporučeni izraz | Ne rabiti | Gdje se koristi | Napomena |
|---|---|---|---|---|---|
| P-9a | Ugrađeni alat za razgovor (pilot) | **Asistent** (velikim slovom) | „asistent” malim, „chatbot”, „bot” | `editor.assistant*`, `student/submission/declaration`, `teacher/work/ai-attachments` | Rječnik: „iz AI pomoćnika (model, vrijeme)” je **propisana** zamjenska fraza za oznaku porijekla teksta; pojmovnik je ne mijenja. |
| P-9b | Pravilo o dopuštenoj pomoći AI-ja | **AI pomoć** („AI pomoć nije dopuštena”, „AI pomoć je djelomično dopuštena”) | „AI asistencija” | `teacher.course.policies`, `facultyRuleVersions.aiPolicy` | |
| P-9c | Sadržajni naziv u obrascu | **Izjava o korištenju/uporabi AI-ja** [PITANJE] | oba oblika u istom sučelju | `workspace.work.aiStatement`, `student/submission/declaration`, `teacher.course.policy` | L-17: „korištenju” (obrazac) i „uporaba” (pravila). Obrazac fakulteta može propisivati naziv (D-129). |
| P-9d | Stariji naziv „AI pomoćnik” | **Asistent** u novim tekstovima | „AI pomoćnik” osim u Rječnikom propisanoj frazi | `src/lib/i18n/m:1926`, `:2026`, `howItWorks.rules.body` | Vidi L-08; ispravak tek uz odluku (Rječnik vs sučelje). |

## 7. Zapisi, verzije, povijest

| # | Pojam | Preporučeni izraz | Ne rabiti | Gdje se koristi | Napomena |
|---|---|---|---|---|---|
| P-10a | Što je prošlo kroz uređivač (događaji) | **zapis** („praznina u zapisu”, „zapis je cjelovit i neizmijenjen od primitka”) | „log”, „integritet zapisa” (Rječnik), „nestali podaci” (Rječnik) | `student.recorded.*`, `howItWorks.recorded.*`, `teacher/provenance` | Uvijek bez ocjene (PRODUCT §5 pr. 3). |
| P-10b | Popis radnji (pristup, praksa, dorada) | **dnevnik** („dnevnik pristupa”, „dnevnik prakse”, „dnevnik dorade”) | „log”, „zapisnik” | `student.access-log`, `teacher/practice-journal`, `teacher/fast-path` | „Zapisnik” je u kodu jednom („Učitavam zapisnik…”); uskladiti u „dnevnik” ili „zapisnik” po zaslonu. |
| P-10c | Povijest verzija rada | **povijest rada** / **povijest verzija** | „historija”, „povijest dokumenta” (osim tehnički) | `revisions`, `shared/document-history`, `student/time-machine` | Za korisnika „rada”, ne „dokumenta” (P-2a). |
| P-10d | Verzija dokumenta (broj) | **verzija** | „revizija” u korisničkim tekstovima | `student/document-history`, `teacher/n06` | „Revizija” ostaje u „revizijski trag” (audit) i internom broju predaje („revizija {n}”). |
| P-10e | Alternativni tekst odlomka | **inačica** („Inačica odlomka”) | „verzija” za odlomak | `editor.toolbar`, `src/lib/i18n/m:1204` | Rječnik: „vlastita inačica odlomka” je tehnički pojam. |
| P-10f | Podrijetlo teksta | **podrijetlo** (kako je tekst ušao u rad) | „izvor” u tom značenju, „porijeklo” | `teacher/provenance`, `student/submission/summary` | „Izvor” je literatura (P-10g). |
| P-10g | Literatura i navod | **izvor** (literatura), **navod** (citat u tekstu) | „referenca”, „citat” | `editor/sources`, `bibliography` | „Kopiraj navod” je jedini dopušteni oblik od korijena „kopir” uz „Kopirano u međuspremnik” (Rječnik). |

## 8. Poruke, obavijesti, komentari

| # | Pojam | Preporučeni izraz | Ne rabiti | Gdje se koristi | Napomena |
|---|---|---|---|---|---|
| P-7a | Poruka nastavnika uz zadatak (što prati, od kada) | **obavijest** („Obavijest zadatka”) | „napomena”, „upozorenje” | `student.notice`, `landing.faq`, PRODUCT §5 pr. 6 | „Upozorenje o studentu” je zabranjeno (Rječnik). |
| P-7b | Sitna usputna bilješka uz unos | **napomena** („Dodaj napomenu (nije obavezna)”) | „obavijest” | `consultation-records`, `working-criteria` | |
| P-7c | Komentar nastavnika uz tekst | **komentar** („Komentari”, kartica Komentari) | „primjedba” (4 mjesta u `comments`, `marks`) | `comments.*`, `editor.marks` | „Banka komentara” za predloške; „Česte primjedbe” uskladiti. |
| P-7d | Obrazloženje, odgovor ili objašnjenje | **obrazloženje** (nastavnik/student o odluci), **objašnjenje** (studentov odgovor u razgovoru) | „opis” za obje | `revisions`, `student/interview`, `student/event-dispute` | „Opis” je samo opis problema (P-5b). |
| P-7e | Poruke u razgovoru mentora i studenta | **poruka** | „obavijest” | `editor/mentor/messages` | „Postavke obavijesti” ostaje za obavijesti aplikacije. |
| P-7f | Potvrda | **potvrda predaje**, **potvrda povlačenja**, **potvrda uloge**, **potvrda izvora** | samostalna „potvrda” bez odrednice | `student/submission/receipt`, `teacherRoles`, `editor/proof-requests` | Četiri značenja; uvijek s odrednicom. |

## 9. Sučelje i radnje

| # | Pojam | Preporučeni izraz | Ne rabiti | Gdje se koristi | Napomena |
|---|---|---|---|---|---|
| P-11a | Cijeli zaslon aplikacije | **zaslon** („na ovom zaslonu”) | „ekran” (12 mjesta; 21 „zaslon”) | `src/lib/i18n/m:1955`, `1989`, `1997`, `statement.ts` | L-07. PRODUCT §5 pr. 6 piše „prvi ekran”; to je dokument. |
| P-11b | Adresa u aplikaciji | **stranica** („Ponovno učitajte stranicu”) | „page” | `errors.*`, `editor.failure*` | |
| P-11c | Način prikaza | **prikaz** („Prikaz uživo”, „prikaz rada”) | „pogled”, „view” | `liveView`, `teacher.work` | |
| P-11d | Kartica u rubnom panelu editora | **kartica** („u kartici Komentari”) | „tab”, „jezičac” | `editor.assist`, `editor.marks`, `student/work` | |
| P-11e | Kartica preglednika | **kartica preglednika** | „kartica” sama, „tab” | `src/lib/i18n/m:1147–1154`, `editor-core/sync/labels.ts:92` | L-18. |
| P-11f | Prozor s pitanjem ili obrascem | **prozor** (korisnik), **dijalog** (samo tehnički/pristupačnost) | oba u istom tekstu | `assistant-match-notice`, `proofs` | |
| P-12a | Izvoz vlastitog teksta kao datoteke | **izvesti** („Izvezi tekst”), **izvoz** | „skinuti”, „download” | `editor.exportText`, `editor.fail*` | |
| P-12b | Preuzimanje datoteke (potvrda, paket) | **preuzeti** („Preuzmi potvrdu povlačenja”) | „skini”, „sačuvaj” za datoteku (L-10) | `student/submission/history`, `receipt` | Rječnik dopušta „Preuzmi / preuzeto” za datoteku. |
| P-12c | Trajno brisanje sadržaja | **obrisati** („Obriši poglavlje”), **brisanje** | „ukloniti” za trajno | `editor.left`, `auth.afterSubmissionDiscard` | |
| P-12d | Uklanjanje stavke s popisa ili oznake | **ukloniti** („Ukloni oznaku”, „Ukloni okvir – tekst ostaje”) | „obrisati” kad tekst ostaje | `editor.rich`, `teacher.newVersion` | L-06 (crtica). |
| P-12e | Ukidanje uloge ili dopuštenja | **opozvati** / **opoziv** („Opozovi ulogu”) | „povući” za ulogu | `teacherRoles.*`, `teacher/direct-edit` | |
| P-12f | Povlačenje predaje, zahtjeva, prijedloga | **povući** | „opozvati”, „poništiti” | `revisions`, `suggestions`, `submission.withdraw` | P-3d. |
| P-12g | Ponavljanje radnje | **ponovno** | „ponovo”, „opet” | cijelo sučelje (661 : 1 : 3) | L-05. |

## 10. Obraćanje i glas

| # | Pravilo | Preporučeno | Ne rabiti | Gdje | Napomena |
|---|---|---|---|---|---|
| P-1 | Oslovljavanje | **Vi**, **Vaš…** velikim slovom (134 : 34) | „vaš” malim slovom | cijelo sučelje | L-01. |
| P-1′ | Imperativ u rečenicama | množina: „Pokušajte ponovno”, „Prijavite se” (121 : 23) | jednina u rečenici („Pokušaj ponovno”, „Osvježi stranicu”) | poruke grešaka | L-02. |
| P-1″ | Imperativ na gumbima i naredbama | jednina („Spremi”, „Prijavi se”, „Izvezi tekst”) [PITANJE: vlasnik potvrđuje kao konvenciju] | — | gumbi, izbornici | Dosad je to stvarna konvencija; nije zapisana. |
| P-13 | Glas sučelja | treće lice ili imenica: „Ductura bilježi …”, „Učitavanje …” | prvo lice („Učitavam …”, „Šaljem …”, „Ne mogu učitati …”, „Ne diramo …”) | poruke učitavanja, greške | L-13, L-14. |

## 11. Rječnik zabranjenih izraza (sažetak za pisce)

Nije novo pravilo; preuzeto iz Ductus `docs/PRODUCT.md` §5 radi lakšeg čitanja uz pojmovnik. Izvor i puni popis: PRODUCT §5 „Rječnik sučelja” i `scripts/forbidden-terms/terms.ts` (skener stroži: svaki oblik korijena „kopir” osim „Kopiraj navod”, „kopiranje navoda”, „Kopirano u međuspremnik”).

| Ne koristiti | Koristiti umjesto toga |
|---|---|
| sumnjivo, rizik, anomalija, upozorenje o studentu | ništa; činjenice bez oznake |
| AI postotak, vjerojatnost, autentičnost, napisao AI | iz AI pomoćnika (model, vrijeme) |
| kopirano, prepisano, tuđi tekst | zalijepljeno (izvor nije opažen) |
| nestali podaci, skriveno, nedostajući podaci | praznina u zapisu |
| plagijat, izvornost, originalnost, integritet | cjelovitost zapisa; „zapis je cjelovit i neizmijenjen od primitka” |
| neobično, nepravilnost | ništa; opis činjenice |
| spremljeno (bez pojašnjenja) | spremljeno na uređaju / na poslužitelju / predano |

Dopušteno: „Kopiraj navod”, „Kopirano u međuspremnik”, „Preuzmi / preuzeto” (datoteka), „Izjava o izvornosti rada” (T10, DAN-1034).

## 12. Otvorena pitanja za vlasnika

1. **P-1″**: potvrditi „ti” u imperativu samo na gumbima, „Vi” u rečenicama (stvarno stanje u kodu).
2. **P-4c**: „Postavke ustanove” ili „postavke fakulteta” kao jedan naziv zaslona.
3. **P-5d**: „sesija”, „razdoblje pisanja” ili „sesija pisanja” za prag P-01.
4. **P-9c**: „korištenje” ili „uporaba” u nazivu izjave o AI-ju (D-129).
5. **P-9d**: sukob Rječnika („iz AI pomoćnika”) i sučelja („Asistent”).
6. **P-6c / L-10**: smije li „sačuvano” ostati ili se zamjenjuje navođenjem mjesta.

## 13. Trag

Pregled je djelomično strojni (obrasci nad ~6 700 stringova u 313 datoteka); popis pojmova nastao je iz uočenih nedosljednosti i iz PRODUCT §3 i §5. Brojevi („134 : 34”, „661 : 1”) odnose se na pojave u pregledanom kodu i mogu se razlikovati od brojeva u pojedinom katalogu jer su dva kataloga djelomično duplicirana (lektura-nalazi.md L-21).
