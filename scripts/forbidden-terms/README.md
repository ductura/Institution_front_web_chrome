# scripts/forbidden-terms

Skener zabranjenih izraza sučelja (Ductus [docs/PRODUCT.md](https://github.com/danielrisavi77-create/Ductus/blob/main/docs/PRODUCT.md) §5) za katalog [`locales/`](../../locales/README.md). Kopija je iz `ductura/server` `scripts/forbidden-terms` na `2e9a9b35ed4d5bdaf3b698a56dd4b2746b65637a` (DAN-753, 2.c4-a0). Opis rječnika, savijanja teksta i provjere znakova je u [izvornom README-u](https://github.com/ductura/server/blob/2e9a9b35ed4d5bdaf3b698a56dd4b2746b65637a/scripts/forbidden-terms/README.md).

- `terms.ts`, `characters.ts`, `index.ts` i testovi `terms.test.ts`, `characters.test.ts` su doslovne kopije.
- `scan.ts` se razlikuje samo u popisima: web nema `hr.json` (poruke gatea i potpisa servera), pa ga nema u `CATALOGUES`, a `EXCEPTIONS` je prazan.
- `scan.test.ts` nema slučajeve koji ovise o `hr.json` i njegovim iznimkama za „Risk:” (devet slučajeva). Popis je u opisu PR-a.
- Pokreće se u `pnpm -r run test` (CI „UI”).

Provjera prema izvoru (iz korijena weba, uz `ductura/server` u `../server` na tom SHA-u):

```bash
for f in terms characters index scan terms.test characters.test scan.test; do diff ../server/scripts/forbidden-terms/$f.ts scripts/forbidden-terms/$f.ts; done
diff ../server/locales/hr.ts locales/hr.ts && diff ../server/locales/en.ts locales/en.ts
```

Kad server objavi skener u paketu, kopija se zamjenjuje uvozom.
