import { fold } from "../command-palette/palette-logic";

export type SearchableListItem = {
  id: string;
  label: string;
  description?: string;
  keywords?: string;
};

export function filterItems<T extends SearchableListItem>(items: readonly T[], query: string): readonly T[] {
  const terms = fold(query).trim().split(/\s+/u).filter(Boolean);
  if (!terms.length) return items;
  return items.filter(({ label, description, keywords }) => {
    const text = fold([label, description, keywords].join(" "));
    return terms.every((term) => text.includes(term));
  });
}
