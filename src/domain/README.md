# src/domain

Klijentski dio domene preuzet iz Ductusa sa svojim testovima (`docs/PLAN.md` §4, korak 2.c4). Čiste funkcije: bez I/O-a, bez vremena, bez teksta sučelja.

- `text/find-literal.ts`: doslovna pretraga unutar jednog niza teksta (bez regularnih izraza), pomaci u UTF-16, pogodak nikad ne presijeca surogatni par; `isSearchableText` odbija upit koji se ne može upisati ni spremiti.
- `text/compare-hr.ts`: usporedba riječi po hrvatskoj abecedi (dž, lj i nj su jedno slovo), neovisno o ICU podacima preglednika.
- `diff/diff.ts`: deterministički diff po riječima i savjetodavne oznake (promjena broja, negacije, modalnih riječi) bez prosudbe značenja.

Izvor je Ductus `main` @ `9c45857` (DAN-990). Datoteke su prenesene doslovno; `diff/index.ts` izvozi samo `diff` jer `protected-content` još nije prenesen. `tsconfig.json` isključuje `noUncheckedIndexedAccess` samo za ovaj paket jer ga Ductus nema, a doslovni `diff.ts` pod njim ne prolazi provjeru tipova.
