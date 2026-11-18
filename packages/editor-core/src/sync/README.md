# `src/sync/`: stanja i sinkronizacija

Preneseno iz Ductusa na commitu `0cdb0f1f4371d334baa6793dd1dd529df9c80584` (opcija C, Ductus#2028, slot w1119b), sa svim izvornim testovima.

| Ductus | Ovdje |
|---|---|
| `src/domain/sync/**` | `src/sync/` |
| `src/domain/serverSync/**` | `src/sync/server/` |
| `tests/unit/server-sync-messages.test.ts` | `src/sync/server/messages.test.ts` |

Ostatak (`src/lib/sync/**`, `src/lib/journal/**`) dolazi u sljedećim PR-ovima.

## Pravila koja se ne mijenjaju

- Osam stanja sinkronizacije (`states.ts`) ostaje kao u Ductusu.
- SYNCED se pokazuje tek uz potpisanu potvrdu servera (B-8, F-3, F-8).
- Paket nema mreže ni pohrane na serveru. Front sve šalje kroz `src/client/api.ts` prema Institution_serveru (`/api/v1/*`).

## Prilagodbe

Sve ostale datoteke prenesene su bajt po bajt.

| Datoteka | Prilagodba |
|---|---|
| `labels.ts`, `labels.test.ts` | uvoz `@/lib/i18n/locale` → `./interface-locale` |
| `conflict.ts` | uvozi `../document` → `../document/document`; u komentaru „successful fetch” → „successful read of the server version”, jer skener `src/client/no-direct-api.test.ts` čita i komentare |
| `recovery.ts` | uvozi `../document` → `../document/document` |
| `conflict.test.ts`, `recovery*.test.ts` | uvoz `@/domain/document` ili `../document` → `../document/document` |
| `server/bootstrap.ts`, `server/contract.ts`, `server/*.test.ts` | uvozi `../document` → `../../document/document`, `../json` → `../../document/json` |
| `server/checkpoints.ts` | uvoz `@/lib/i18n/hr` → `../date-time-hr`, `../json` → `../../document/json` |
| `server/messages.test.ts` | uvozi iz `src/domain/serverSync` → `./`. Ductusov `extractUiText` (skener u `scripts/forbidden-terms`) ovdje ne postoji, jer skener fronta čita samo `locales/`. Zamjenjuje ga mala funkcija u testu: svaki string modula preko TypeScript AST-a, bez putanja uvoza i stringova u tipovima. Popis `PROTOCOL_STRINGS` i oba testa su nepromijenjeni. |

## Tanki adapteri

- `interface-locale.ts` drži samo popis jezika sučelja (`hr`, `en`) i zadani jezik. U Ductusu ih `labels.ts` uvozi iz `src/lib/i18n/locale.ts`, a ovdje je taj modul u `src/components/i18n/locale.ts`, koji paket ne smije uvoziti. Test adaptera čita registar kataloga aplikacije i pada čim aplikacija doda jezik kojeg ovdje nema.
- `date-time-hr.ts` drži `formatDateTimeHr` („19. rujna 2026. u 14:05”, zagrebačko vrijeme), koji `server/checkpoints.ts` u Ductusu uvozi iz `src/lib/i18n/hr.ts`. U frontu taj formatter nije prenesen, a zagrebački sat je u `src/components/i18n/zagreb.ts`, koji paket ne smije uvoziti. Tijelo je Ductusovo (`hr.ts` i `zagreb.ts` na `0cdb0f1`). Property test ga uspoređuje sa satom aplikacije za svaki trenutak, svaku zagrebačku minutu i svaki tekst.

## Tekst sučelja

Skener zabranjenih izraza fronta (`scripts/forbidden-terms`) čita samo `locales/`. Zato `ui-text.test.ts` provjerava svaki string iz `src/sync/**` (oznake stanja, poruke sinkronizacije) rječnikom tog skenera (Ductus `docs/PRODUCT.md` §5).
