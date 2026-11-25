// WEB-V17-FORMAT-CHECK: the lines of the panel as words; pure, so the wording is tested without a browser.
import type { FormatItem, FormatResult } from "./format-check";
import { formatCheckText as t } from "./messages.hr";

const fill = (text: string, values: Readonly<Record<string, string | number>>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

export type Line = { readonly id: FormatItem["id"]; readonly label: string; readonly state: string; readonly detail: string };

function detailOf(item: FormatItem): string {
  const d = t.detail;
  const v = item.values;
  switch (item.id) {
    case "words": return fill(item.status === "deviation" ? ("min" in v ? d.wordsBelow : d.wordsAbove) : d.wordsOk, v);
    case "sources": return fill(item.status === "deviation" ? d.sourcesBelow : d.sourcesOk, v);
    case "sections": return item.status === "deviation" ? fill(d.sectionsMissing, v) : d.sectionsOk;
    case "citations": return item.status === "deviation" ? fill(d.citationsBad, v) : d.citationsOk;
    default: return item.status === "rule" ? fill(d.lekta, v) : d.lektaMissing;
  }
}

const stateOf = (item: FormatItem) => item.status === "deviation" ? t.deviation : item.status === "ok" ? t.ok : item.status === "rule" ? t.rule : t.unavailableItem;

/** Items whose rule is not set at all (`none`) are left out: there is nothing to say about them. */
export function linesOf(result: FormatResult): readonly Line[] {
  return result.items.filter((item) => item.status !== "none")
    .map((item) => ({ id: item.id, label: t.items[item.id], state: stateOf(item), detail: detailOf(item) }));
}

export const summaryOf = (result: FormatResult): string => result.deviations === 0 ? t.allOk : fill(t.deviations, { n: result.deviations });
