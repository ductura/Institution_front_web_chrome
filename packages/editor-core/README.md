# @ductura/editor-core

Paket uređivača i kanonskog modela dokumenta, prenesen iz repoa Ductus
(DAN-888, pristup B). Prenosi se u dijelovima 888-1, 888-2 …; zadnji dio zatvara
DAN-946 (web uvozi paket s jednog mjesta).

## Što je u dijelu 888-1

- kanonska shema dokumenta, provjera ispravnosti, zabranjeni znakovi, snimka i
  revizija nula (`src/domain/document`), uz `src/domain/json.ts` i
  `src/domain/forensics/{jcs,crypto,integrity,ledger}.ts` koje oni trebaju;
- ulaz `src/index.ts` izvozi shemu, provjeru, zabranjene znakove, snimku i
  reviziju nula. `json` i `jcs` ostaju unutarnji.

## Pravilo prijenosa

Datoteke su kopirane bajt po bajt s Ductusa na commitu
`ce908f7a652bfc810a8c266346cd574b8d395da6`. Jedina izmjena sadržaja je uvoz u
`snapshot.ts`. Tablica „Ductus put → web put, SHA-256 izvora, je li izmijenjen”
je u [PROVENANCE.md](PROVENANCE.md), a `src/provenance.test.ts` je provjerava.
Promjena prenesene datoteke ide prvo u Ductus, pa novim prijenosom ovamo.

## Provjere

`pnpm --filter @ductura/editor-core run typecheck` i `… run test`; CI posao `ui`
pokreće oboje kroz `pnpm -r run …`.
