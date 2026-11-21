/**
 * "Riješi redom" (WEB-1103): the open findings of the Pregled card taken one
 * after the other, in document order. Pure: the position in the walk is the
 * id of the finding last shown, so a change of the text moves the walk to the
 * next finding that is still there instead of to a stale index.
 */

import type { Finding } from "../review";
import type { TextFix } from "./fixes";

export type Step = { readonly finding: Finding; readonly index: number; readonly total: number };

/** The finding after `afterId` (the first when null or gone); null past the last one. */
export function stepAfter(findings: readonly Finding[], afterId: string | null, order: readonly string[] = findings.map((f) => f.id)): Step | null {
  if (findings.length === 0) return null;
  let at = afterId === null ? -1 : findings.findIndex((f) => f.id === afterId);
  if (afterId !== null && at < 0) {
    // The finding was solved or marked: continue with the first one that came after it in the order seen before.
    const was = order.indexOf(afterId);
    at = was < 0 ? -1 : findings.filter((f) => order.indexOf(f.id) >= 0 && order.indexOf(f.id) < was).length - 1;
  }
  const next = findings[at + 1];
  return next ? { finding: next, index: at + 1, total: findings.length } : null;
}

/** The fix that belongs to a finding of kind "fix": the first one in its block. */
export function fixFor(finding: Finding, fixes: readonly TextFix[]): TextFix | null {
  if (finding.kind !== "fix" || finding.blockId === null) return null;
  return fixes.find((fix) => fix.blockId === finding.blockId) ?? null;
}
