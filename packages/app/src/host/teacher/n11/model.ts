// Pure rules of N-11 "Usporedba verzija" (WEB-2160; INVENTAR-nastavnik 3.11, PARITET N-11). One select
// "Usporedi s …": only submitted versions are offered, the newest is the current one and the default
// is the previous one. The counts are words, described without colour or threshold. No network call here.
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import { n11Messages as text } from "./messages.hr";

export type N11Version = { readonly kind: "checkpoint" | "submission"; readonly revision: number; readonly savedMinute: string };
export type N11Block = { readonly kind: "paragraph" | "bulletItem" | "quote" | "heading"; readonly level?: number; readonly change: "unchanged" | "removed" | "added"; readonly text: string };

export type N11Versions = { readonly kind: "ready"; readonly versions: readonly N11Version[] } | { readonly kind: "signedOut" | "unavailable" };
export type N11Compare = { readonly kind: "ready"; readonly blocks: readonly N11Block[] } | { readonly kind: "signedOut" | "notFound" | "unavailable" };

export interface N11Port {
  versions(documentId: string): Promise<N11Versions>;
  compare(documentId: string, from: number, to: number): Promise<N11Compare>;
}

export const unavailablePort: N11Port = {
  versions: async () => ({ kind: "unavailable" }),
  compare: async () => ({ kind: "unavailable" }),
};

export async function loadVersions(port: N11Port, documentId: string): Promise<N11Versions> {
  try {
    return await port.versions(documentId);
  } catch {
    return { kind: "unavailable" };
  }
}

export async function loadComparison(port: N11Port, documentId: string, from: number, to: number): Promise<N11Compare> {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to <= from) return { kind: "unavailable" };
  try {
    return await port.compare(documentId, from, to);
  } catch {
    return { kind: "unavailable" };
  }
}

/** Submitted versions only, one per revision, newest first. */
export function submittedVersions(versions: readonly N11Version[]): readonly N11Version[] {
  const byRevision = new Map<number, N11Version>();
  for (const v of versions) if (v.kind === "submission") byRevision.set(v.revision, v);
  return [...byRevision.values()].sort((a, b) => b.revision - a.revision);
}

/** The "Usporedi s …" choices: every submitted version older than the current one. */
export function olderChoices(submitted: readonly N11Version[]): readonly N11Version[] {
  return submitted.slice(1);
}

/** Default: the previous submitted version. `null` while there is nothing to compare with. */
export function defaultFrom(submitted: readonly N11Version[]): number | null {
  return submitted[1]?.revision ?? null;
}

export const currentLine = (v: N11Version): string => text.current(formatDateTimeHr(v.savedMinute), v.revision);
export const optionLabel = (v: N11Version): string => text.option(formatDateTimeHr(v.savedMinute), v.revision);

export type N11Part = { readonly kind: "same" | "added" | "removed"; readonly text: string };
/** One displayed block: whole-block change, or `changed` = a removed and an added paragraph compared word by word. */
export type N11Row =
  | { readonly change: "unchanged" | "removed" | "added"; readonly text: string }
  | { readonly change: "changed"; readonly parts: readonly N11Part[] };

const TOKEN = /\p{L}[\p{L}\p{N}'’-]*|\p{N}+|\s+|[^\s]/gu;
const isWord = (token: string): boolean => /^[\p{L}\p{N}]/u.test(token);
/** Above this many LCS cells the paragraph is shown as one removed and one added block (bounded memory and time). */
const MAX_CELLS = 4_000_000;

const wordCount = (s: string): number => (s.match(TOKEN) ?? []).filter(isWord).length;

/** Word-by-word difference of two texts (longest common subsequence of words, spaces and punctuation); `null` over the size bound. */
export function wordDiff(before: string, after: string): readonly N11Part[] | null {
  const a = before.match(TOKEN) ?? [];
  const b = after.match(TOKEN) ?? [];
  if ((a.length + 1) * (b.length + 1) > MAX_CELLS) return null;
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * width + j] = a[i] === b[j] ? table[(i + 1) * width + j + 1]! + 1 : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
    }
  }
  const parts: { kind: N11Part["kind"]; text: string }[] = [];
  const push = (kind: N11Part["kind"], text: string): void => {
    const last = parts[parts.length - 1];
    if (last?.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { push("same", a[i]!); i++; j++; }
    else if (i < a.length && (j === b.length || table[(i + 1) * width + j]! >= table[i * width + j + 1]!)) { push("removed", a[i]!); i++; }
    else { push("added", b[j]!); j++; }
  }
  return parts;
}

/** A removed block directly followed by an added block of the same kind and level is one edited paragraph. */
export function diffRows(blocks: readonly N11Block[]): readonly N11Row[] {
  const rows: N11Row[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const next = blocks[i + 1];
    if (block.change === "removed" && next?.change === "added" && next.kind === block.kind && next.level === block.level) {
      const parts = wordDiff(block.text, next.text);
      if (parts !== null) { rows.push({ change: "changed", parts }); i++; continue; }
    }
    rows.push({ change: block.change, text: block.text });
  }
  return rows;
}

export function countWords(blocks: readonly N11Block[]): { readonly added: number; readonly removed: number } {
  let added = 0, removed = 0;
  for (const row of diffRows(blocks)) {
    if (row.change === "changed") {
      for (const { kind, text: t } of row.parts) {
        if (kind === "added") added += wordCount(t);
        if (kind === "removed") removed += wordCount(t);
      }
    } else if (row.change === "added") added += wordCount(row.text);
    else if (row.change === "removed") removed += wordCount(row.text);
  }
  return { added, removed };
}

export const hasChanges = (blocks: readonly N11Block[]): boolean => blocks.some((b) => b.change !== "unchanged");

/** The live-work link is offered only when at least one version was submitted. */
export const hasSubmission = (versions: readonly N11Version[]): boolean => submittedVersions(versions).length > 0;
