/**
 * What the Pregled card shows: findings as the rows of `CheckActionList` and
 * the summary as plain text. Pure, so the wording is tested without a DOM.
 * Text is plain text, never HTML.
 */

import type { CheckFinding } from "@ductura/ui";

import type { Finding } from "./checks";
import type { Digest } from "./digest";
import { reviewMessagesHr as t } from "./messages.hr";

export const ACTION_GO = "go";
export const ACTION_IGNORE = "ignore";

const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), text);

/** What exactly was found, in words; empty text is never returned. */
export function detailOf(finding: Finding): string {
  const note = finding.note;
  switch (finding.kind) {
    case "fix": return t.detail[(["spaces", "before", "after", "quotes", "double"] as const).find((k) => k === note) ?? "double"];
    case "ref":
      if (note === "last") return t.detail.refLast;
      if (note === "first") return t.detail.refFirst;
      return fill(t.detail.refMissing, { n: note.replace("missing:", "") });
    case "str":
      return note === "empty" ? t.detail.strEmpty : note === "single" ? t.detail.strSingle : note === "long" ? t.detail.strLong : t.detail.strPunct;
    default: return fill(t.detail[finding.kind], { note });
  }
}

/** The rows for the list: a required one only for a mark left for later. */
export function rowsOf(findings: readonly Finding[]): CheckFinding[] {
  return findings.map((finding) => ({
    id: finding.id,
    severity: finding.severity,
    title: t.kind[finding.kind],
    detail: `${finding.excerpt} — ${detailOf(finding)}`,
    actions: [{ id: ACTION_GO, label: t.goTo }, { id: ACTION_IGNORE, label: t.notAnError }],
  }));
}

export type DigestExtras = { readonly question?: string | null; readonly wordRange?: { readonly min: number | null; readonly max: number | null } | null };

export function scopeLine(words: number, range: DigestExtras["wordRange"]): string {
  const min = range?.min ?? null;
  const max = range?.max ?? null;
  if (min !== null && max !== null) return fill(t.digest.scopeRange, { words, min, max });
  if (min !== null) return fill(t.digest.scopeMin, { words, min });
  if (max !== null) return fill(t.digest.scopeMax, { words, max });
  return fill(t.digest.scopeWords, { words });
}

/** The summary as text for "Kopiraj": one line per part. */
export function digestText(digest: Digest, extras: DigestExtras = {}): string {
  const d = t.digest;
  const lines = [
    digest.title ?? d.untitled,
    `${d.question}: ${extras.question?.trim() || d.questionNone}`,
    `${d.scope}: ${scopeLine(digest.words, extras.wordRange)}`,
    `${d.structure}:`,
    ...(digest.rows.length === 0 ? [`  ${d.structureNone}`]
      : digest.rows.map((row) => `  ${row.number} ${row.title} · ${row.words} ${d.words.toLowerCase()} · ${row.citations} ${d.citations.toLowerCase()}`)),
    `${d.hypotheses}: ${digest.hypotheses.length === 0 ? d.hypothesesNone : digest.hypotheses.join(", ")}`,
    `${d.conclusion}: ${digest.conclusion ?? d.conclusionNone}`,
    `${d.findings}: ${digest.open === 0 ? d.findingsNone : fill(d.findingsLine, { n: digest.open, required: digest.openRequired })}`,
  ];
  return lines.join("\n");
}

/** The count line above the list. */
export function summaryLine(n: number, inChapter: boolean): string {
  return n === 0 ? t.summaryNone : fill(t.summaryCount, { n, scope: inChapter ? t.summaryScope : "" });
}
