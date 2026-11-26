// Pure rules of the student's version history (WEB-1504; plan M7.6). The student picks two versions
// and sees the difference. Nothing here shows duration, pace or size of a change (PRODUCT §5), and
// restoring an old version is not part of this task. No network call is made here; the page that
// mounts this passes a port built on src/client/time-machine.ts.
import type { DiffPart } from "@ductura/ui";

import { timeMachineMessages as text } from "./messages.hr";

export type VersionKind = "checkpoint" | "submission";
export type Version = { readonly kind: VersionKind; readonly revision: number; readonly savedMinute: string };

export type CompareBlock = {
  readonly op: "same" | "added" | "removed" | "changed";
  readonly words: readonly { readonly op: "same" | "added" | "removed"; readonly text: string }[];
};

export type VersionsRead =
  /** `more`: the server holds versions older than the ones listed (the list is one page, newest first). */
  | { readonly kind: "ready"; readonly versions: readonly Version[]; readonly more?: boolean }
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

export type TextBlock = { readonly kind: "heading" | "paragraph"; readonly text: string; readonly level?: 1 | 2 | 3 };
export type VersionText = { readonly kind: "ready"; readonly blocks: readonly TextBlock[] } | { readonly kind: "unreadable" };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const childrenOf = (node: Record<string, unknown>): unknown[] =>
  Array.isArray(node.children) ? node.children : Array.isArray(node.content) ? node.content : [];
const str = (value: unknown): string => (typeof value === "string" ? value : "");
/** A field of the node, or of its `attrs` (the editor's own JSON keeps node fields there). */
const field = (node: Record<string, unknown>, key: string): unknown => node[key] ?? (isObject(node.attrs) ? node.attrs[key] : undefined);

/** How a source is named in a citation: authors and year, or only what the document says; never dropped. */
function citationText(node: Record<string, unknown>, sources: readonly unknown[]): string {
  const source = sources.find((s) => isObject(s) && s.id === field(node, "sourceId"));
  const authors = isObject(source) && Array.isArray(source.authors)
    ? source.authors.map((a) => (isObject(a) ? str(a.family) || str(a.name) : "")).filter(Boolean).join(", ")
    : "";
  const year = isObject(source) && typeof source.year === "number" ? String(source.year) : "";
  const locator = str(field(node, "locator"));
  return text.citation([authors, year].filter(Boolean).join(" ") || text.citationUnknown, locator);
}

/** Inline text: marks are ignored, a footnote and a citation keep their words. */
function inlineText(node: unknown, sources: readonly unknown[]): string {
  if (!isObject(node)) return "";
  if (node.type === "text") return str(node.text);
  if (node.type === "footnote") return text.footnote(str(field(node, "text")));
  if (node.type === "citation") return citationText(node, sources);
  return childrenOf(node).map((child) => inlineText(child, sources)).join("");
}

const BLOCKS = new Set(["paragraph", "heading", "bulletItem", "quote", "orderedItem", "codeBlock", "box", "table", "tableRow", "tableCell", "tableHeader"]);

/** One block becomes one or more text blocks: the paragraphs of a box and the cells of a table stay apart. */
function collect(node: Record<string, unknown>, sources: readonly unknown[], out: TextBlock[]): void {
  const push = (value: string, heading?: 1 | 2 | 3) => {
    const trimmed = value.replace(/\s+/gu, " ").trim();
    if (trimmed !== "") out.push(heading === undefined ? { kind: "paragraph", text: trimmed } : { kind: "heading", text: trimmed, level: heading });
  };
  if (node.type === "table" || node.type === "tableRow") {
    const rows = node.type === "table" && Array.isArray(node.rows) ? node.rows : null;
    if (rows !== null) { for (const row of rows) for (const cell of Array.isArray(row) ? row : []) push(str(cell)); return; }
  }
  const kids = childrenOf(node);
  if (kids.some((child) => isObject(child) && BLOCKS.has(str(child.type)))) {
    for (const child of kids) if (isObject(child)) collect(child, sources, out);
    return;
  }
  if (node.type === "heading") {
    const level = Number(field(node, "level"));
    return push(inlineText(node, sources), level === 2 || level === 3 ? level : 1);
  }
  push(inlineText(node, sources));
}

/**
 * The text of a saved version, block by block, as plain text: headings keep their level, every other
 * block is a paragraph. A footnote and a citation keep their words, and the paragraphs of a box and
 * the cells of a table are separate blocks. Nothing is counted or measured; a document that is not
 * JSON with a list of nodes is unreadable rather than shown in part.
 */
export function versionText(document: string): VersionText {
  let parsed: unknown;
  try { parsed = JSON.parse(document); } catch { return { kind: "unreadable" }; }
  if (!isObject(parsed)) return { kind: "unreadable" };
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : isObject(parsed.doc) ? childrenOf(parsed.doc) : null;
  if (nodes === null) return { kind: "unreadable" };
  const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
  const blocks: TextBlock[] = [];
  for (const node of nodes) {
    if (!isObject(node)) return { kind: "unreadable" };
    collect(node, sources, blocks);
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
