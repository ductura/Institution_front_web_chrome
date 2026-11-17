# src/components/outline

Lijevi panel editora, raspored Popis (DAN-977). U 977-1 je čisti model: stablo poglavlja nastaje iz ravnog popisa naslova. U 977-2 je komponenta panela, a u 977-3 sklapanje grana i aktivno poglavlje. U 978-1 dodano je traženje naslova.

| Datoteka | Što radi |
| --- | --- |
| `outline-tree.ts` | `OutlineEntry` je zrcalo istoimenog tipa iz Ductusa `src/editor/outline.ts`. `outlineTree` od redaka razine 1 do 3 gradi stablo: svaki naslov ide pod najbliži prethodni naslov niže razine. |
| `outline-tree.test.ts` | Negativni ulazi (prazan popis, razina izvan 1–3, preskočena razina, id-ovi `__proto__`, `toString`, null i duplikati, prazni brojevi i naslovi, zamrznuti ulaz) te tri razine s numeracijom iz ulaza. |
| `OutlinePanel.tsx` | `<nav>` s ugniježđenim `<ol data-depth>`, bez oznaka preglednika (`list-style: none`). Broj iz ulaza je zaseban element, a dugi naslov se lomi (`overflow-wrap: anywhere`). Prazan popis prikazuje tekst `workspace.structureEmpty`. Tekstovi su iz `locales/hr.ts`. |
| `OutlinePanel.test.ts` | Statički render: negativni ulazi te tri razine s brojevima iz ulaza, svaki broj jednom. Semantiku u katalogu na pet širina provjerava `catalog/e2e/states.spec.ts`, a axe na 1440, 400 i 360 px `catalog/e2e/catalog.spec.ts`. |
| `outline-view.ts` | `collapsedSet` od zadanih indeksa zadržava samo prikazane retke s djecom. `activeRow` za indeks iz `currentHeading` vraća redak koji nosi oznaku aktivnog poglavlja: sam redak, najbliži prethodni prikazani (za razinu izvan 1–3) ili najviši sklopljeni predak. |
| `outline-view.test.ts` | Negativni indeksi, nevaljani `collapsed` i ulaz koji se ne mijenja; oznaka kroz sklapanje jednu i dvije razine; tekst iz `src/components/i18n/hr.ts` kroz skener zabranjenih izraza. |
| `outline-view.ts` (978-1) | `foldHr` uklanja razliku velikih i malih slova i dijakritike: Č, Ć → c, Đ → d, Ǉ → lj. `searchQuery` obrezuje upit i reže ga na 200 kodnih točaka. `filterTree` ostavlja pogotke i njihove pretke, uz izvorne `index`, `number` i `depth`. |
| `outline-search.test.ts`, `outline-search.property.test.ts` | Negativni upiti (prazni, predugi, znakovi regexa, `__proto__`, brojevi), dijakritike, oznaka aktivnog poglavlja bez pogotka u grani. Svojstva: potpunost, točnost, redoslijed i nepromijenjen ulaz. |
| `outline-tree.property.test.ts` | Svojstva (fast-check): svaki valjani redak javlja se jednom i istim redom, sa svojim brojem; ulaz se ne mijenja; dubina je najviše 3, a dijete je više razine od roditelja. |

## Odluke

- **Numeracija je ulaz.** Brojeve („2.1.3”) računa editor-core, a panel ih prikazuje točno kako su dani, i kad su prazni.
- **Preskočena razina.** Naslov razine 3 iza naslova razine 1 ide ispod njega na dubinu 2 i zadržava svoj broj. Potpoglavlje bez nadređenog naslova postaje korijen.
- **Razina izvan 1–3.** Redak se izostavlja (0, 4, decimalni broj, NaN, beskonačno), a ostali ostaju.
- **Id nije ključ.** Stablo se gradi bez mape po id-u, pa duplikati i imena poput `__proto__` ništa ne mijenjaju.
- **Sklapanje (977-3).** Gumb ima `aria-expanded` i `aria-controls`, a skriveni popis ostaje u DOM-u s `hidden`. Oznaka gumba je „Potpoglavlja: {broj} {naslov}”. Tekst je u `src/components/i18n/hr.ts`, jer se `locales/` mijenja samo uz isti tekst na serveru.
- **Aktivno poglavlje.** `aria-current="location"` je uvijek na točno jednoj vidljivoj stavci.
- **Otvoreno za DAN-979.** `collapsed` po indeksu retka samo je početno stanje za katalog i testove. Indeks se pomiče kad se iznad doda naslov, pa ključ za spremanje odlučuje DAN-979. Kandidat je `entry.id`, ali može biti null ili ponovljen.
- **Traženje (978-1).** Dok upit vrijedi, gumba za sklapanje nema i sve je otvoreno. Sklopljenost se ne mijenja i vraća se kad se upit isprazni. Oznaka aktivnog poglavlja ide na najdublji prikazani čvor na putu do njega, inače nigdje. `role="status"` je uvijek u DOM-u, da čitač zaslona čuje tekst „nema pogodaka”.
