# src/components/teacher

Nastavnički popisi prenose se iz Ductusa `src/components/teacher` na `9c45857` (DAN-871). Dio 871-1 donosi popis kolegija `TeacherCourses` sa svim njegovim testovima, a dio 871-2 popis radova uz mentora `MentoredWorks`. Ekran nad `teacher.courses.get` i `teacher.mentorships.get` kroz `src/client` dolazi u 871-3.

| Datoteka | Što radi |
| --- | --- |
| `TeacherCourses.tsx` | Kolegiji i njihovi zadaci redom kojim stižu. Za svaki zadatak prikazuje rok u Europe/Zagreb, broj studenata (samo za pregled, ne za poredak) i poveznice na brz put, novu verziju i radove. Prazan popis nudi novi kolegij. Prenesen je doslovno. Razlikuju se samo uvozi, a `next/link` je obični `a` bez `prefetch`, kao u `AppShell`. |
| `TeacherCourses.module.css` | Iz Ductusa, s jednom izmjenom. Dijelovi retka rada („· Nije predano”, „· Jezik rada”) ostaju cijeli, ali se redak lomi između njih (`inline-block`, `white-space: pre`). U Ductusu red s oznakom prilagodbe na 360–400 px izlazi do 60 px preko kartice. Na to sada pazi `catalog/e2e/states.spec.ts`. Poveznice ostaju inline u tekstu, pa ih axe `target-size` ne prijavljuje. Tokeni su iz `packages/ui`. |
| `teacher-courses-read.ts` | Samo tipovi `TeacherCourse`, `TeacherAssignment` i `AssignmentSubmission`, oblikom iz Ductusa. Čitanje dolazi kroz `src/client` u 871-3. |
| `links.ts` | `newAssignmentHref` i `workLanguageExceptionHref`, doslovno iz Ductusa. Uz njih je privatna kopija `isDocumentId` iz domene Ductusa. Funkcije spremanja iz Ductus `work-language.ts` ne prenose se jer zovu mrežu. |
| `TeacherCourses.test.ts` | Sva 24 testa iz Ductusa, tvrdnje nepromijenjene: poredak, rok i godina, prazan popis, poveznice na radove, stanje predaje (A1–A8), oznaka prilagodbe (M1–M5), jezik rada (L1–L4, i id dokumenta koji stranica ne prima), poveznica na novi zadatak i zabranjeni izrazi. |
| `MentoredWorks.tsx` | Jedan redak za svako otvoreno mentorstvo: student, naslov, vrsta i stanje rada riječima. Započeti rad vodi na prikaz uživo, a rad koji nije započet nema poveznicu. Prazan popis to i kaže. Prenesen je doslovno. Razlikuju se samo uvozi, a `next/link` je obični `a` bez `prefetch`, kao u `AppShell`. |
| `MentoredWorks.module.css` | Doslovno iz Ductusa. Tokeni su iz `packages/ui`. |
| `mentored-works-view.ts` | `byFamilyName` slaže po prezimenu pa imenu, hrvatskim poretkom (`compareHr` iz `src/domain/text`). Student bez imena ide zadnji, a izjednačenje se rješava po id-ju mentorstva. Uz to su tekst imena i stanja i poveznica na prikaz uživo. Doslovno iz Ductusa. |
| `mentored-works-read.ts` | Samo tipovi `MentoredWork`, oblikom iz Ductusa. Isti oblik daje `teacher.mentorships.get`, a čitanje dolazi u 871-3. |
| `MentoredWorks.test.ts` | Svih 10 testova iz Ductusa, s nepromijenjenim tvrdnjama: poredak, izjednačenje, nepromijenjen ulaz, stanje riječima, poveznice, prazan popis, bez vremena i ocjene te zabranjeni izrazi. |

Brojevne oblike (`countHr`, `pluralHr`) daje `../i18n/hr.ts`, a njihove testove iz Ductusa nosi `../i18n/plural.test.ts`. Tekstovi su iz `locales/hr.ts`. Stavka `TeacherCourses` u katalogu prikazuje svih pet stanja, a svako stanje ima vlastite id-jeve kolegija. Semantiku i jedinstvenost id-jeva provjerava `catalog/e2e/states.spec.ts`.

`compareHr` se uvozi relativnim putem do `src/domain/text/compare-hr.ts`. Ulaz paketa `@ductura/Institution_front_web_chrome-domain` povlači i `diff.ts`, a on ne prolazi `noUncheckedIndexedAccess` iz `packages/ui/tsconfig.json`. Tekstovi su iz `locales/hr.ts`. Stavka `MentoredWorks` u katalogu prikazuje svih pet stanja. Fiksni id-jevi naslova ponavljaju se između stanja kataloga, isto kao `zadaci-nedostupno`: axe ih stavlja u `incomplete`, ne u `violations`.
