// Interface copy of PG-2 "Tekst rada s oznakama podrijetla" (WEB-NF5-KARTA; NF-5; prototype pgPodrijetlo, INVENTAR
// NF5-PG2). The mark says where the text came from in words, next to the line; never who typed it, never a verdict.
// The assistant is only ever "Asistent" (Q-10). No rhythm and no measure of it here.
import type { OriginKind } from "./origin";

const KIND: Record<OriginKind, string> = {
  typed: "napisano u Ducturi",
  assistant_inserted: "umetnuto iz Asistenta",
  assistant_match: "podudara se s odgovorom Asistenta",
  imported_file: "uvezeno iz datoteke",
  pasted_known: "zalijepljeno · izvor poznat",
  pasted_unknown: "zalijepljeno · izvor nije opažen",
};

export const markedTextMessages = {
  heading: "Tekst rada s oznakama podrijetla",
  revision: (revision: number) => `Oznake vrijede za verziju ${revision}.`,
  next: "Sljedeće lijepljenje ili prijenos",
  wordsNote: "Oznake su riječima uz crtu, ne samo bojom.",
  whoTyped: "Ductura ne zna tko je tipkao.",
  notProof: "Nije dokaz autorstva.",
  kind: (kind: OriginKind) => KIND[kind],
  markLabel: (kind: OriginKind, mark: number) => `${KIND[kind]} · oznaka ${mark}`,
  markStatus: (mark: number, count: number, kind: OriginKind) => `Oznaka ${mark} od ${count}: ${KIND[kind]}.`,
  noMarksInText: "U tekstu ove verzije nema lijepljenja, uvoza ni prijenosa iz Asistenta.",
  tableCaption: "Odsječci teksta (isti podaci kao oznake, bez boje i crte)",
  colText: "Odsječak",
  colKind: "Kako je ušao",
  colPlace: "Gdje u tekstu",
  place: (block: number) => `${block}. odlomak`,
  tableEmpty: "Nema odsječaka koji su ušli lijepljenjem, uvozom ili prijenosom.",
  skipped: (count: number) => `Zabilježenih mjesta koja ne odgovaraju tekstu ove verzije: ${count}. Ona nisu prikazana.`,
  loading: "Učitavanje teksta rada…",
  unavailable: "Tekst rada s oznakama trenutačno nije moguće učitati. Pokušajte ponovno; zapis time nije zahvaćen.",
  retry: "Pokušaj ponovno",
} as const;
