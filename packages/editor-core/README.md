# @ductura/editor-core

Jezgra uređivača prenesena iz Ductusa (opcija C, Ductus#2028): Tiptap shema, kanonski model dokumenta, koraci uređivanja, citati, diff i sidra suradnje. Paket nema mreže ni pohrane; front sve što šalje šalje kroz `src/client/api.ts` prema Institution_serveru (`/api/v1/*`).

## Raspored

| Ductus | Ovdje |
|---|---|
| `src/domain/document/**`, `diff/**`, `collaboration/**` i njihove ovisnosti (`json.ts`, `forensics/jcs.ts`, `citation/bibliography.ts`) | `src/document/` (ista podstruktura kao `src/domain/`) |
| `src/editor/**` | `src/editor/` |

Datoteke se prenose gotovo doslovno, sa svojim testovima. Mijenjaju se samo uvozi `@/…` (postaju relativni) i ono što front ne smije; svaka takva izmjena navodi se u opisu PR-a.

## Naredbe

- `pnpm --filter @ductura/editor-core run typecheck`
- `pnpm --filter @ductura/editor-core run test`

Iz korijena repoa `pnpm -r run typecheck` i `pnpm -r run test` uključuju i ovaj paket.
