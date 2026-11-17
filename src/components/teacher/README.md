# src/components/teacher

Nastavnički popisi prenose se iz Ductusa `src/components/teacher` na `9c45857` (DAN-871). Dio 871-1 donosi popis kolegija `TeacherCourses` sa svim njegovim testovima. `MentoredWorks` dolazi u 871-2, a ekran nad `teacher.courses.get` i `teacher.mentorships.get` kroz `src/client` u 871-3.

| Datoteka | Što radi |
| --- | --- |
| `TeacherCourses.tsx` | Kolegiji i njihovi zadaci redom kojim stižu. Za svaki zadatak prikazuje rok u Europe/Zagreb, broj studenata (samo za pregled, ne za poredak) i poveznice na brz put, novu verziju i radove. Prazan popis nudi novi kolegij. Prenesen je doslovno. Razlikuju se samo uvozi, a `next/link` je obični `a` bez `prefetch`, kao u `AppShell`. |
| `TeacherCourses.module.css` | Iz Ductusa, s jednom izmjenom. Dijelovi retka rada („· Nije predano”, „· Jezik rada”) ostaju cijeli, ali se redak lomi između njih (`inline-block`, `white-space: pre`). U Ductusu red s oznakom prilagodbe na 360–400 px izlazi do 60 px preko kartice. Na to sada pazi `catalog/e2e/states.spec.ts`. Poveznice ostaju inline u tekstu, pa ih axe `target-size` ne prijavljuje. Tokeni su iz `packages/ui`. |
| `teacher-courses-read.ts` | Samo tipovi `TeacherCourse`, `TeacherAssignment` i `AssignmentSubmission`, oblikom iz Ductusa. Čitanje dolazi kroz `src/client` u 871-3. |
| `links.ts` | `newAssignmentHref` i `workLanguageExceptionHref`, doslovno iz Ductusa. Uz njih je privatna kopija `isDocumentId` iz domene Ductusa. Funkcije spremanja iz Ductus `work-language.ts` ne prenose se jer zovu mrežu. |
| `TeacherCourses.test.ts` | Sva 24 testa iz Ductusa, tvrdnje nepromijenjene: poredak, rok i godina, prazan popis, poveznice na radove, stanje predaje (A1–A8), oznaka prilagodbe (M1–M5), jezik rada (L1–L4, i id dokumenta koji stranica ne prima), poveznica na novi zadatak i zabranjeni izrazi. |

Brojevne oblike (`countHr`, `pluralHr`) daje `../i18n/hr.ts`, a njihove testove iz Ductusa nosi `../i18n/plural.test.ts`. Tekstovi su iz `locales/hr.ts`. Stavka `TeacherCourses` u katalogu prikazuje svih pet stanja, a svako stanje ima vlastite id-jeve kolegija. Semantiku i jedinstvenost id-jeva provjerava `catalog/e2e/states.spec.ts`.
