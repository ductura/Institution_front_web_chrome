# src/components/outline

Lijevi panel editora, raspored Popis (DAN-977). U 977-1 je čisti model: stablo poglavlja nastaje iz ravnog popisa naslova. U 977-2 je komponenta panela, a u 977-3 sklapanje grana i aktivno poglavlje. U 978-1 dodano je traženje naslova, u 978-2 „Sklopi sve”, a u 978-3 „Samo naslovi”.

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
| `panel-settings.ts` (DAN-979, 979-1) | Postavke panela u pregledniku: raspored, razine, sklopljenost (po id-u bloka) i „samo naslovi”. `parseSettings` svako neispravno polje vraća na zadanu vrijednost. `readSettings` i `writeSettings` sve rade u try/catch i nikad ne bacaju. `clearPanelSettings` briše ključeve s prefiksom, za odjavu. |
| `panel-settings.test.ts`, `panel-settings.property.test.ts` | Bez spremišta, spremište koje baca, pokvaren ili predug zapis, ključevi prototipa, getter i Proxy koji bacaju. Svojstva: zapis i čitanje vraćaju iste postavke, svaki ulaz čita se natrag u normalnom obliku, svaki spremljeni niz daje valjane postavke. |
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
- **Sklopi sve (978-2).** Jedan običan gumb s promjenjivim natpisom, bez `aria-pressed` i `aria-expanded`. Piše „Sklopi sve” dok je vidljiva neka otvorena grana, a inače „Rasklopi sve”. „Vidljiva otvorena grana” računa se iz stabla (`openBranchShown`), ne iz popisa sklopljenih indeksa, koji smije imati nevaljane vrijednosti. Gumba nema bez grana ni za vrijeme traženja.
- **Samo naslovi (978-3).** Preklopni gumb stalnog natpisa (`aria-pressed`). Uključeno stanje vidi se i bez boje: po debljini slova i rubu. Svaki pritisak javlja se jednom kroz `onHeadingsOnlyChange`, iz obrađivača klika, a ne iz funkcije stanja (StrictMode). Popis naslova se ne mijenja. Učinak na tekst rada dolazi s editorom (E-0.3).
- **Postavke u pregledniku (979-1).** Sklopljenost se sprema po `entry.id`, a ne po indeksu, jer se indeks pomiče kad se iznad doda naslov. Ključ `ductura.outline.v1:<scope>` nosi verziju. Scope daje pozivatelj; za editor je predviđen sažetak id-a dokumenta, ne sam id. Id smije imati samo znakove `[A-Za-z0-9_-]` (id bloka u Ductusu je UUID). JSON ih ne escapea, pa najviše 200 id-ova po 64 znaka sigurno stane u 16 384 znaka zapisa. U spremište ne ide tekst rada. Spajanje `clearPanelSettings` na odjavu je zaseban korak (Risk critical).
