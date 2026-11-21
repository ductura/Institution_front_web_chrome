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

export interface TimeMachinePort {
  versions(documentId: string): Promise<VersionsRead>;
  compare(documentId: string, from: number, to: number): Promise<CompareRead>;
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
