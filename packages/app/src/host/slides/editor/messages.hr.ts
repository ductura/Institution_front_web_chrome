// WEB-V13-UREDNIK (val 13): the words of the slides editor. Interface text is
// Croatian; no word of the PRODUCT §5 vocabulary appears here.
import type { SlideLayout, SlideSlot } from "../../../../../editor-core/src/slides/index.ts";
import type { Refusal } from "./editor-model.ts";

export const slidesEditorText = {
  region: "Uređivač slajdova",
  loading: "Učitavanje slajdova…",
  errorTitle: "Slajdovi se ne mogu otvoriti",
  errorBody: "Rad nije promijenjen. Pokušajte ponovno.",
  retry: "Pokušaj ponovno",
  submittedNote: "Rad je predan. Slajdovi se samo čitaju.",
  notSavedNote: "Izmjene se za sada drže samo u ovom prozoru; spremanje na uređaj i poslužitelj još nije uključeno.",
  listTitle: "Slajdovi",
  listLabel: "Popis slajdova",
  slideN: "Slajd {n}",
  slideOf: "Slajd {n} od {total}",
  selectSlide: "Odaberi slajd {n}: {title}",
  add: "Dodaj slajd",
  remove: "Ukloni slajd",
  moveUp: "Pomakni gore",
  moveDown: "Pomakni dolje",
  undo: "Poništi",
  redo: "Ponovi",
  layout: "Raspored",
  layoutHint: "Prikazani su rasporedi koji ne bi izostavili postojeći sadržaj slajda.",
  canvasTitle: "Slajd",
  notesLabel: "Bilješke govornika",
  notesHint: "Vide se samo u uređivaču i ne prikazuju se na slajdu.",
  listItemLabel: "{slot}, stavka {n}",
  imageBlock: "Slika: {alt}",
  tooLong: "Tekst je predug za ovo polje.",
} as const;

export const layoutLabels: Readonly<Record<SlideLayout, string>> = {
  title: "Naslovni slajd",
  titleContent: "Naslov i sadržaj",
  twoColumns: "Dva stupca",
  imageOnly: "Samo slika",
};

export const slotLabels: Readonly<Record<SlideSlot, string>> = {
  title: "Naslov",
  subtitle: "Podnaslov",
  body: "Sadržaj",
  left: "Lijevi stupac",
  right: "Desni stupac",
  image: "Slika",
};

/** What a refused change says; the document is unchanged, so the text says so. */
export const refusalText: Readonly<Record<Refusal, string>> = {
  last_slide: "Zadnji slajd se ne može ukloniti. Izmjena nije napravljena.",
  unknown_slide: "Slajd više ne postoji. Izmjena nije napravljena.",
  document_invalid: "Slajdovi nisu u ispravnom obliku. Izmjena nije napravljena.",
  slide_not_found: "Slajd više ne postoji. Izmjena nije napravljena.",
  slide_exists: "Slajd već postoji. Izmjena nije napravljena.",
  block_not_found: "Sadržaj više ne postoji. Izmjena nije napravljena.",
  index_out_of_range: "Mjesto izmjene više ne postoji. Izmjena nije napravljena.",
  range_invalid: "Mjesto izmjene u tekstu više ne postoji. Izmjena nije napravljena.",
  hash_mismatch: "Sadržaj se u međuvremenu promijenio. Izmjena nije napravljena.",
  target_invalid: "Ovdje se ta izmjena ne može napraviti. Izmjena nije napravljena.",
  no_change: "Nema promjene.",
  result_invalid: "Tekst nije dopušten u ovom polju (predug je ili sadrži znak koji nije dopušten). Izmjena nije napravljena.",
  too_large: "Slajdovi su dosegnuli najveću dopuštenu veličinu. Izmjena nije napravljena.",
};

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/gu, (_, key: string) => String(values[key] ?? ""));
}
