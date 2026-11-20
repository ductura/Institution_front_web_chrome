/**
 * The list of sources of the "Literatura" tab (WEB-7C, E§3.4): search, the
 * split into cited and not yet cited, and the summary of the literature.
 * Pure functions; the tag says where a source came from (course reading list
 * or mentor's recommendation) once the server gives that data.
 */

export type SourceTag = "mandatory" | "recommended";

export type ListedSource = {
  /** The entry as written into the bibliography; one source, one entry. */
  readonly entry: string;
  readonly cited: boolean;
  readonly tag?: SourceTag;
};

export type LiteratureSummary = {
  total: number;
  cited: number;
  uncited: number;
  mandatory: number;
  recommended: number;
};

const norm = (text: string) => text.normalize("NFC").toLocaleLowerCase("hr").replace(/\s+/g, " ").trim();

/** Keeps the sources whose entry contains every word of the query; an empty query keeps all. */
export function filterSources<T extends ListedSource>(items: readonly T[], query: string): T[] {
  const words = norm(query).split(" ").filter(Boolean);
  if (words.length === 0) return [...items];
  return items.filter((item) => {
    const entry = norm(item.entry);
    return words.every((word) => entry.includes(word));
  });
}

export function splitByCitation<T extends ListedSource>(items: readonly T[]): { cited: T[]; uncited: T[] } {
  return { cited: items.filter((item) => item.cited), uncited: items.filter((item) => !item.cited) };
}

export function summarize(items: readonly ListedSource[]): LiteratureSummary {
  const cited = items.filter((item) => item.cited).length;
  return {
    total: items.length,
    cited,
    uncited: items.length - cited,
    mandatory: items.filter((item) => item.tag === "mandatory").length,
    recommended: items.filter((item) => item.tag === "recommended").length,
  };
}
