# src/components/outline

Lijevi panel editora, raspored Popis (DAN-977). U 977-1 je čisti model: stablo poglavlja nastaje iz ravnog popisa naslova. U 977-2 je komponenta panela. Sklapanje grana i aktivno poglavlje dolaze u 977-3.

| Datoteka | Što radi |
| --- | --- |
| `outline-tree.ts` | `OutlineEntry` je zrcalo istoimenog tipa iz Ductusa `src/editor/outline.ts`. `outlineTree` od redaka razine 1 do 3 gradi stablo: svaki naslov ide pod najbliži prethodni naslov niže razine. |
| `outline-tree.test.ts` | Negativni ulazi (prazan popis, razina izvan 1–3, preskočena razina, id-ovi `__proto__`, `toString`, null i duplikati, prazni brojevi i naslovi, zamrznuti ulaz) te tri razine s numeracijom iz ulaza. |
| `OutlinePanel.tsx` | `<nav>` s ugniježđenim `<ol data-depth>`, bez oznaka preglednika (`list-style: none`). Broj iz ulaza je zaseban element, a dugi naslov se lomi (`overflow-wrap: anywhere`). Prazan popis prikazuje tekst `workspace.structureEmpty`. Tekstovi su iz `locales/hr.ts`. |
| `OutlinePanel.test.ts` | Statički render: negativni ulazi te tri razine s brojevima iz ulaza, svaki broj jednom. Semantiku u katalogu na pet širina provjerava `catalog/e2e/states.spec.ts`, a axe na 1440, 400 i 360 px `catalog/e2e/catalog.spec.ts`. |
| `outline-tree.property.test.ts` | Svojstva (fast-check): svaki valjani redak javlja se jednom i istim redom, sa svojim brojem; ulaz se ne mijenja; dubina je najviše 3, a dijete je više razine od roditelja. |

## Odluke

- **Numeracija je ulaz.** Brojeve („2.1.3”) računa editor-core, a panel ih prikazuje točno kako su dani, i kad su prazni.
- **Preskočena razina.** Naslov razine 3 iza naslova razine 1 ide ispod njega na dubinu 2 i zadržava svoj broj. Potpoglavlje bez nadređenog naslova postaje korijen.
- **Razina izvan 1–3.** Redak se izostavlja (0, 4, decimalni broj, NaN, beskonačno), a ostali ostaju.
- **Id nije ključ.** Stablo se gradi bez mape po id-u, pa duplikati i imena poput `__proto__` ništa ne mijenjaju.
