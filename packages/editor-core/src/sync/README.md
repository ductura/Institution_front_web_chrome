# `src/sync/`: stanja i sinkronizacija

Preneseno iz Ductusa na commitu `0cdb0f1f4371d334baa6793dd1dd529df9c80584` (opcija C, Ductus#2028, slot w1119b), sa svim izvornim testovima.

| Ductus | Ovdje |
|---|---|
| `src/domain/sync/**` | `src/sync/` |

Ostatak (`src/domain/serverSync/**`, `src/lib/sync/**`, `src/lib/journal/**`) dolazi u sljedećim PR-ovima.

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

## Tanki adapter

`interface-locale.ts` drži samo popis jezika sučelja (`hr`, `en`) i zadani jezik. U Ductusu ih `labels.ts` uvozi iz `src/lib/i18n/locale.ts`, a ovdje je taj modul u `src/components/i18n/locale.ts`, koji paket ne smije uvoziti. Test adaptera čita registar kataloga aplikacije i pada čim aplikacija doda jezik kojeg ovdje nema.
