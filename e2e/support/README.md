# e2e/support

Pomoćnici za e2e testove, preneseni iz Ductusa `e2e/` (DAN-755, `docs/PLAN.md` §4 i §6).

| Datoteka | Što | Izvor u Ductusu (b36c82b9) |
|---|---|---|
| `axe.js` | `axeViolations(page)` vraća kršenja WCAG 2.0/2.1 A i AA; `axe(page)` očekuje da ih nema | `e2e/local-editor.spec.ts:189`, `e2e/offline-editor.spec.ts:65` |

Ostali harnessi (`caret`, `evidence-`, `identity-`, `source-`, `teacher-roles-harness`) dolaze s testovima koji ih koriste.
