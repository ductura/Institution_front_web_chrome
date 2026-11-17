# src/components/outline

Lijevi panel editora, raspored Popis (DAN-977). Ovaj dio (977-1) je čisti model: stablo poglavlja nastaje iz ravnog popisa naslova. Komponenta panela dolazi u 977-2, a sklapanje grana i aktivno poglavlje u 977-3.

| Datoteka | Što radi |
| --- | --- |
| `outline-tree.ts` | `OutlineEntry` je zrcalo istoimenog tipa iz Ductusa `src/editor/outline.ts`. `outlineTree` od redaka razine 1 do 3 gradi stablo: svaki naslov ide pod najbliži prethodni naslov niže razine. |
| `outline-tree.test.ts` | Negativni ulazi (prazan popis, razina izvan 1–3, preskočena razina, id-ovi `__proto__`, `toString`, null i duplikati, prazni brojevi i naslovi, zamrznuti ulaz) te tri razine s numeracijom iz ulaza. |
| `outline-tree.property.test.ts` | Svojstva (fast-check): svaki valjani redak javlja se jednom i istim redom, sa svojim brojem; ulaz se ne mijenja; dubina je najviše 3, a dijete je više razine od roditelja. |

## Odluke

- **Numeracija je ulaz.** Brojeve („2.1.3”) računa editor-core, a panel ih prikazuje točno kako su dani, i kad su prazni.
- **Preskočena razina.** Naslov razine 3 iza naslova razine 1 ide ispod njega na dubinu 2 i zadržava svoj broj. Potpoglavlje bez nadređenog naslova postaje korijen.
- **Razina izvan 1–3.** Redak se izostavlja (0, 4, decimalni broj, NaN, beskonačno), a ostali ostaju.
- **Id nije ključ.** Stablo se gradi bez mape po id-u, pa duplikati i imena poput `__proto__` ništa ne mijenjaju.
