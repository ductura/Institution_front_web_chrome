# scripts/forbidden-terms

Skener zabranjenih izraza sučelja (Ductus [docs/PRODUCT.md](https://github.com/danielrisavi77-create/Ductus/blob/main/docs/PRODUCT.md) §5) za katalog [`locales/`](../../locales/README.md). Kopija je iz `ductura/Institution_server` `scripts/forbidden-terms` na `2e9a9b35ed4d5bdaf3b698a56dd4b2746b65637a` (DAN-753, 2.c4-a0). Opis rječnika, savijanja teksta i provjere znakova je u [izvornom README-u](https://github.com/ductura/Institution_server/blob/2e9a9b35ed4d5bdaf3b698a56dd4b2746b65637a/scripts/forbidden-terms/README.md).

- `terms.ts`, `characters.ts`, `index.ts` i testovi `terms.test.ts`, `characters.test.ts` su doslovne kopije, osim unosa „izvornost” u `terms.ts` i njegovih testova u `terms.test.ts`: izraz „Izjava o izvornosti rada” je dopušten (T10, vlasnička odluka, DAN-1034). Razlika u `diff` naredbama niže za te dvije datoteke je očekivana dok `ductura/Institution_server` ne preuzme istu promjenu.
- `scan.ts` se razlikuje samo u popisima: web nema `hr.json` (poruke gatea i potpisa servera), pa ga nema u `CATALOGUES`, a `EXCEPTIONS` je prazan.
- `scan.test.ts` nema slučajeve koji ovise o `hr.json` i njegovim iznimkama za „Risk:” (devet slučajeva). Popis je u opisu PR-a.
- **Dodano za prenesenu Ductus kopiju fronta (zadatak 7, Ductus#2028), nije dio kopije servera:**
  - `ui-text.ts` (+ `ui-text.test.ts`): `UI_TEXT_MODULES`, `isUiTextModule`, `extractUiText` (samo način `catalogue`) i `scanUiTextModules`, prema Ductus `scripts/forbidden-terms/scan.ts` na `0cdb0f1`. Čita tekst sučelja izvan `locales/`: Ductusov katalog `src/lib/i18n/**` i module `labels.ts`, `messages.ts`, `copy.ts` te `packages/editor-core/src/editor/schema.ts`. Čitanje JSX-a (komponente, metapodaci) nije preneseno. Test „finds no forbidden term in the UI text of this repository” čita cijeli repo.
  - `scan.ts` ponovno izvozi te nazive iz `ui-text.ts` (jedan blok uvoza na vrhu), jer ih preneseni testovi uvoze iz `scan`.
  - `terms.ts` na kraju dobiva `findForbiddenTermsInMarkup`, `windowsCutShort`, `closedUpPastQuotes` i `MAX_WINDOW_PARTS` iz Ductusa na `0cdb0f1`. Jedina razlika: svako čitanje ide kroz `readingFor`, pa se unos s `allows` (Ductus ga nema) čita kao u `findForbiddenTerms`.
  - Zato se `diff` naredbe niže za `scan.ts` i `terms.ts` razlikuju i u tim blokovima.
- Pokreće se u `pnpm -r run test` (CI „UI”).

Provjera prema izvoru (iz korijena weba, uz `ductura/Institution_server` u `../server` na tom SHA-u):

```bash
for f in terms characters index scan terms.test characters.test scan.test; do diff ../server/scripts/forbidden-terms/$f.ts scripts/forbidden-terms/$f.ts; done
diff ../server/locales/hr.ts locales/hr.ts && diff ../server/locales/en.ts locales/en.ts
```

Kad server objavi skener u paketu, kopija se zamjenjuje uvozom.
