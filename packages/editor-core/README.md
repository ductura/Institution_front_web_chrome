# @ductura/editor-core

Jezgra uređivača prenesena iz Ductusa (opcija C, Ductus#2028): Tiptap shema, kanonski model dokumenta, koraci uređivanja, citati, diff, sidra suradnje, stanja sinkronizacije i lokalni dnevnik. Paket ne zove server sam; front sve što šalje šalje kroz `src/client/api.ts` prema Institution_serveru (`/api/v1/*`). Lokalni dnevnik (`src/journal`, Dexie) i prijenos dokaza (`src/sync/runner/evidence-transport.ts`) jedini su dijelovi s pohranom ili mrežom; prijenos se spaja na `src/client`.

## Raspored

Kopija iz Ductusa `main` 0cdb0f1f (550 datoteka, `cp -rn`) premještena je po KARTA (`ductura/.github` `docs/plan/KARTA.md`, redak `@ductura/editor-core` i §5 točka 4) i po rasporedu PR-ova #58–#61.

| Ductus | Ovdje |
|---|---|
| `src/domain/{document,citation,collaboration,diff,text}/**` | `src/document/<isto>/` |
| `src/domain/json.ts`, `src/domain/forensics/**` (dolaze s PR-om #59) | `src/document/json.ts`, `src/document/forensics/` |
| `src/editor/**` | `src/editor/` |
| `src/domain/sync/**` | `src/sync/` |
| `src/domain/serverSync/**` | `src/serverSync/` |
| `src/lib/sync/**` | `src/sync/runner/` |
| `src/lib/journal/**` | `src/journal/` |

Datoteke su prenesene doslovno. Promijenjeni su samo uvozi koje je premještanje slomilo: relativni putovi i `@/…` prema datoteci koja je sada u paketu postali su relativni. Uvozi prema onome čega u paketu nema (`@/adapters/…`, `@/client/…`, `@/server/…`, `@/lib/i18n/…`, `@/components/…`) ostali su kakvi jesu i rješavaju ih sljedeći zadaci.

## Naredbe

- `pnpm --filter @ductura/editor-core run typecheck`
- `pnpm --filter @ductura/editor-core run test`

Iz korijena repoa `pnpm -r run typecheck` i `pnpm -r run test` uključuju i ovaj paket.
