// Pure rules of the student's version history (WEB-1504; plan M7.6). The student picks two versions
// and sees the difference. Nothing here shows duration, pace or size of a change (PRODUCT §5), and
// restoring an old version is not part of this task. No network call is made here; the page that
// mounts this passes a port built on src/client/time-machine.ts.
import type { DiffPart } from "@ductura/ui";

export type VersionKind = "checkpoint" | "submission";
export type Version = { readonly kind: VersionKind; readonly revision: number; readonly savedMinute: string };

export type CompareBlock = {
  readonly op: "same" | "added" | "removed" | "changed";
  readonly words: readonly { readonly op: "same" | "added" | "removed"; readonly text: string }[];
};

export type VersionsRead =
  | { readonly kind: "ready"; readonly versions: readonly Version[] }
  | { readonly kind: "signedOut" | "unavailable" };
export type CompareRead =
  | { readonly kind: "ready"; readonly blocks: readonly CompareBlock[] }
  | { readonly kind: "signedOut" | "notFound" | "unavailable" };

export type VersionRead =
  | { readonly kind: "ready"; readonly revision: number; readonly document: string }
  | { readonly kind: "signedOut" | "notFound" | "unavailable" };

export interface TimeMachinePort {
  versions(documentId: string): Promise<VersionsRead>;
  compare(documentId: string, from: number, to: number): Promise<CompareRead>;
  /** One saved version's canonical document, only for reading (PIL-D7-POVIJEST). */
  version(documentId: string, revision: number): Promise<VersionRead>;
}

export type TextBlock = { readonly kind: "heading" | "paragraph"; readonly text: string };
export type VersionText = { readonly kind: "ready"; readonly blocks: readonly TextBlock[] } | { readonly kind: "unreadable" };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const childrenOf = (node: Record<string, unknown>): unknown[] =>
  Array.isArray(node.children) ? node.children : Array.isArray(node.content) ? node.content : [];
const textOf = (node: unknown): string =>
  !isObject(node) ? "" : node.type === "text" && typeof node.text === "string" ? node.text : childrenOf(node).map(textOf).join("");

/**
 * The text of a saved version, block by block, as plain text: headings stay headings, every other
 * block is a paragraph. Nothing is counted or measured; a document that is not JSON with a list of
 * nodes is unreadable rather than shown in part.
 */
export function versionText(document: string): VersionText {
  let parsed: unknown;
  try { parsed = JSON.parse(document); } catch { return { kind: "unreadable" }; }
  if (!isObject(parsed)) return { kind: "unreadable" };
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : isObject(parsed.doc) ? childrenOf(parsed.doc) : null;
  if (nodes === null) return { kind: "unreadable" };
  const blocks: TextBlock[] = [];
  for (const node of nodes) {
    if (!isObject(node)) return { kind: "unreadable" };
    const text = textOf(node).trim();
    if (text !== "") blocks.push({ kind: node.type === "heading" ? "heading" : "paragraph", text });
  }
  return { kind: "ready", blocks };
}

/** Newest first, one entry per revision. */
export function orderVersions(versions: readonly Version[]): readonly Version[] {
  const byRevision = new Map(versions.map((v) => [v.revision, v]));
  return [...byRevision.values()].sort((a, b) => b.revision - a.revision);
}

/** The older of the two chosen revisions goes first; the same revision twice is no pair. */
export function orderedPair(a: number, b: number): { from: number; to: number } | null {
  if (a === b) return null;
  return a < b ? { from: a, to: b } : { from: b, to: a };
}

/** Diff parts for the shared DiffView: words in order, a space between neighbours, a line break between blocks. */
export function diffParts(blocks: readonly CompareBlock[]): DiffPart[] {
  const parts: DiffPart[] = [];
  blocks.forEach((block, index) => {
    if (index > 0) parts.push({ kind: "same", text: "\n" });
    block.words.forEach((word, i) => {
      if (i > 0) parts.push({ kind: "same", text: " " });
      parts.push({ kind: word.op, text: word.text });
    });
  });
  return parts;
}
