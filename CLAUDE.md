# ductura/Institution_front_web_chrome: pravila za AI agente

Ovaj dokument je tanki adapter. Ne uvodi nova pravila: pravila rada su ista kao u repozitoriju Ductus, a razlikuju se samo putanje (tablica niže). U sukobu vrijedi izvorni dokument u Ductusu, a ovaj se ispravlja.

## Izvori pravila

| Što | Izvor |
| --- | --- |
| Tvrda pravila, izvori istine, vanjski botovi, preuzimanje posla, jezik | Ductus [CLAUDE.md](https://github.com/danielrisavi77-create/Ductus/blob/main/CLAUDE.md) |
| Gate: uloge, risk razine, review, QA, invalidacija, critical PR | Ductus [docs/ENGINEERING_SYSTEM.md](https://github.com/danielrisavi77-create/Ductus/blob/main/docs/ENGINEERING_SYSTEM.md); prvo [sažetak](https://github.com/danielrisavi77-create/Ductus/blob/main/docs/ENGINEERING_SYSTEM-SAZETAK.md), puni dokument samo u sekcijama koje zadatak traži |
| Načini rada (worker, review, qa ...) i oblik nalaza | Ductus [AGENTS.md](https://github.com/danielrisavi77-create/Ductus/blob/main/AGENTS.md) |
| Kartice uloga (pisac, reviewer, QA) | Ductus [.claude/uloge/README.md](https://github.com/danielrisavi77-create/Ductus/blob/main/.claude/uloge/README.md); pisac u oblaku i [pisac-oblak.md](https://github.com/danielrisavi77-create/Ductus/blob/main/.claude/uloge/pisac-oblak.md) |
| Rječnik zabranjenih izraza i pravila koja proizvod nikad ne krši | Ductus [docs/PRODUCT.md](https://github.com/danielrisavi77-create/Ductus/blob/main/docs/PRODUCT.md) §5; vrijedi i ovdje |
| Predaja posla i rotacija sesije | Ductus [docs/MULTI-ACCOUNT.md](https://github.com/danielrisavi77-create/Ductus/blob/main/docs/MULTI-ACCOUNT.md) |
| Vizualni smjer „papir i grafit” | Ductus [docs/design/DESIGN-SYSTEM.md](https://github.com/danielrisavi77-create/Ductus/blob/main/docs/design/DESIGN-SYSTEM.md) |

Zadatak (identitet, prioritet, nositelj, status) je u Linearu (`DAN-xxx`); posao dodjeljuje orkestrator (`claude:b:orchestrator`).

## Tvrda pravila (preslika)

Izvor: Ductus [CLAUDE.md](https://github.com/danielrisavi77-create/Ductus/blob/main/CLAUDE.md), „Tvrda pravila”, i [docs/PRODUCT.md](https://github.com/danielrisavi77-create/Ductus/blob/main/docs/PRODUCT.md) §3.

- Prijava studenata isključivo AAI@EduHr (D-09). Nikad ne dodaj drugi način prijave, ni privremeno, osim lažnog OIDC pružatelja koji radi samo lokalno i u CI-ju.
- Pravila iz Ductus `docs/PRODUCT.md` §5 nikad se ne krše. Riječi iz rječnika zabranjenih izraza ne smiju se pojaviti u sučelju.
- Ništa se ne gradi na odluci sa statusom PRIJEDLOG ako bi promjena te odluke bila skupa. U tom slučaju stani i dodaj pitanje u Owner queue.
- Jedan korak (zadatak) po PR-u. Najviše oko 400 promijenjenih redaka koda; veći PR treba obrazloženje u opisu.
- Testovi moraju biti zeleni prije svakog commita. Nikad ne briši, ne preskači i ne stavljaj u karantenu test bez jednakovrijedne zamjene.
- Front podatke dobiva samo kroz `/api/v1` (klijent `src/client/api.ts`); klijent nikad ne piše izravno u tablice evidencije, predaje ni revizijskog traga.
- Nikad ne koristi stvarne studentske radove ni osobne podatke u testovima i fixtureima.
- Tajne nikad u repou. Migracije se ne primjenjuju na produkciju iz agenta.
- `git add <putanje>`, nikad `git add -A`. Konvencionalni prefiksi: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

## Putanje: Ductus → ovdje

| U Ductusu | U ductura/Institution_front_web_chrome |
| --- | --- |
| `src/i18n/` i tekstovi sučelja | `locales/` |
| skener zabranjenih izraza | `scripts/forbidden-terms/` ([README](scripts/forbidden-terms/README.md)) |
| `infra/fake-oidc/` | nije u ovom repou; lažni OIDC dolazi s lokalnim stogom Institution_servera |
| komponente sučelja | `packages/ui` (`@ductura/ui`), prikazane u `catalog/` |
| editor | `packages/editor-core`, `src/components/editor/` |
| e2e | `e2e/` (Playwright) |
| `pnpm orch:overlap`, `pnpm orch:preflight` | ne postoje u ovom repou; u izvještaju napiši da su preskočeni |

## Jezik

Tekst sučelja na hrvatskom. Kod, identifikatori i commit poruke na engleskom. Dokumenti u `docs/` na hrvatskom.
