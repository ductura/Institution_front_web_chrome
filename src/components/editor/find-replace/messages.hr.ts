/** Croatian text of find and replace (WEB-1605 part 2). */
export const findReplaceHr = {
  search: "Traži…",
  next: "Sljedeća pojava",
  previous: "Prethodna pojava",
  close: "Zatvori traženje",
  none: "Nema pojava.",
  count: (position: number, total: number) => `${position} od ${total}`,
  replacement: "Zamijeni s…",
  matchCase: "Poštuj velika slova",
  replace: "Zamijeni",
  replaceAll: "Zamijeni sve",
  replaced: (count: number) => `Zamijenjeno: ${count}.`,
  quotesKept: "Pojave u citatima izvora ostaju kakve jesu.",
  refusal: {
    in_quote: "Ova je pojava u citatu izvora i ne mijenja se.",
    no_match: "Nema pojava koje se mogu zamijeniti.",
    unchanged: "Zamjena je ista kao pronađeni tekst.",
    invalid_replacement: "Zamjena ima znakove koji se ne mogu spremiti.",
    too_many: "Previše pojava za jednu zamjenu; suzite traženje.",
    stale: "Tekst se promijenio; traženje je osvježeno.",
  },
} as const;
