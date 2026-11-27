// WEB-V13-NASTAVNIK-PREGLED (val 13): the words of the teacher's reading of a slides work.
// Interface text is Croatian; no word of the PRODUCT §5 vocabulary appears here (no ranking, no marks).
export const slidesReviewText = {
  region: "Pregled slajdova",
  title: "Slajdovi rada",
  loading: "Učitavanje slajdova…",
  readOnly: "Slajdovi se samo čitaju.",
  signedOut: "Prijava je istekla. Prijavite se ponovno.",
  unavailable: "Slajdovi se trenutačno ne mogu pročitati.",
  invalid: "Zapis ove revizije nije u očekivanom obliku, pa se ne prikazuje.",
  retry: "Pokušaj ponovno",
  revisionLabel: "Revizija",
  revisionSelect: "Odaberi reviziju",
  revisionOption: "Revizija {n} ({kind}, {time})",
  revisionOptionNoTime: "Revizija {n} ({kind})",
  kindCheckpoint: "spremljeno",
  kindSubmission: "predano",
  olderExist: "Postoje i starije revizije koje ovdje nisu prikazane.",
  previous: "Prethodna revizija",
  next: "Sljedeća revizija",
  replayHint: "Prolaskom kroz revizije vidi se kako su slajdovi nastajali; pokazuju se samo spremljena stanja.",
  slideListLabel: "Popis slajdova",
  slideN: "Slajd {n}",
  slideOf: "Slajd {n} od {total}",
  selectSlide: "Prikaži slajd {n}: {title}",
  untitled: "bez naslova",
  layout: "Raspored",
  notesTitle: "Bilješke govornika",
  noNotes: "Nema bilješki.",
  emptySlide: "Slajd je prazan.",
  imageBlock: "Slika: {alt}",
  noSlides: "Rad nema slajdova.",
  compareTitle: "Usporedba dviju revizija",
  compareFrom: "Starija revizija",
  compareTo: "Novija revizija",
  compareNeedTwo: "Za usporedbu su potrebne barem dvije revizije.",
  compareSame: "Odaberite dvije različite revizije.",
  compareNone: "Među ovim dvjema revizijama nema razlike u slajdovima.",
  compareSummary: "Dodano: {added}, uklonjeno: {removed}, promijenjeno: {changed}.",
  added: "Dodano",
  removed: "Uklonjeno",
  changed: "Promijenjeno",
  changeLayout: "raspored",
  changeBlocks: "sadržaj",
  changeNotes: "bilješke",
  changePosition: "redoslijed",
  changedParts: "Promijenjeno: {parts}.",
  compareLoading: "Učitavanje usporedbe…",
} as const;

export const layoutNames = {
  title: "Naslovni slajd",
  titleContent: "Naslov i sadržaj",
  twoColumns: "Dva stupca",
  imageOnly: "Samo slika",
} as const;

export const slotNames = {
  title: "Naslov",
  subtitle: "Podnaslov",
  body: "Sadržaj",
  left: "Lijevi stupac",
  right: "Desni stupac",
  image: "Slika",
} as const;

export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
