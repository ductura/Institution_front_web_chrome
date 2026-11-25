// ED-17 (NF2-P15): what "Da, vrati" will change, shown in the "Vratiti ovu verziju?" step. The server
// compares the older revision with the newest one (`work.compare.get` {from, to}); restoring goes the
// other way, so what the comparison added is what the restore takes out, and the other way round.
// No network call is made here; the comparison comes through the history's port.
import type { CompareBlock, CompareRead } from "../../time-machine/model";

const FLIP = { same: "same", added: "removed", removed: "added", changed: "changed" } as const;

/** The comparison read from the restore's side: added and removed swap, in blocks and in words. */
export function restoreBlocks(blocks: readonly CompareBlock[]): readonly CompareBlock[] {
  return blocks.map((block) => ({ op: FLIP[block.op], words: block.words.map((word) => ({ ...word, op: FLIP[word.op] })) }));
}

export type RestoreDiff = {
  readonly added: number;
  readonly removed: number;
  /** The first three blocks the restore changes, for the preview. */
  readonly first: readonly CompareBlock[];
};

/** Paragraphs added and removed by the restore; a changed block counts once on each side. */
export function restoreDiff(blocks: readonly CompareBlock[]): RestoreDiff {
  const turned = restoreBlocks(blocks);
  const touched = turned.filter((block) => block.op !== "same");
  return {
    added: touched.filter((block) => block.op === "added" || block.op === "changed").length,
    removed: touched.filter((block) => block.op === "removed" || block.op === "changed").length,
    first: touched.slice(0, 3),
  };
}

export type DiffRead =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly diff: RestoreDiff }
  | { readonly kind: "unavailable" };

/** The preview of one restore; a comparison that fails or throws is "unavailable", never a guess. */
export async function readRestoreDiff(
  compare: (from: number, to: number) => Promise<CompareRead>, fromRevision: number, headRevision: number,
): Promise<DiffRead> {
  if (fromRevision >= headRevision) return { kind: "unavailable" };
  try {
    const read = await compare(fromRevision, headRevision);
    return read.kind === "ready" ? { kind: "ready", diff: restoreDiff(read.blocks) } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Croatian plural of "odlomak": 1 odlomak, 2–4 odlomka, otherwise odlomaka (11–14 too). */
export function paragraphs(n: number): string {
  const ten = n % 10, hundred = n % 100;
  if (ten === 1 && hundred !== 11) return `${n} odlomak`;
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return `${n} odlomka`;
  return `${n} odlomaka`;
}
