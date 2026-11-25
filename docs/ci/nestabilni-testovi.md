# Poznati i nestabilni testovi

Zajednički popis testova za koje se zna da ponekad padnu bez promjene koda. Popis služi samo kao obavijest:

- ne izuzima nijedan test iz CI-ja i ne preskače nijednu provjeru;
- test s popisa koji padne i dalje obara `ci-ok` i `pnpm ci:local`;
- `pnpm ci:local` uz neuspjeli korak samo ispiše retke ovog popisa čiji se test spominje u ispisu.

Redak se dodaje kad se pad ponovi bez promjene koda, a briše kad je uzrok uklonjen. Stupac Test sadrži put datoteke, a po želji i ` > ` i naziv testa. Datum je u obliku GGGG-MM-DD.

| Test | Vlasnik | Datum | Razlog |
| --- | --- | --- | --- |
| `src/client/sealed-self-note/seal.test.ts` | Lab | 2026-11-24 | Lokalno, pod opterećenjem računala, istekne vrijeme testa. Sam za sebe prolazi 12/12, a u CI-ju nije zabilježen pad. |
| `packages/app/e2e/assistant-chat.spec.ts` | Lab | 2026-11-24 | Lokalno, uz drugi teški posao na računalu, preglednik se zatvori („session closed”) prije provjere. Ponovljeno samo prolazi. |
