/**
 * Points of the work's history (E§3.3 `history`) from work.versions.get.
 * A point carries its kind, its time and the revision it names; never text
 * and never the size of a change (PRODUCT §5 rule 7). Restoring an old point
 * is not part of this task.
 *
 * TODO(ugovor): work.versions.get is not in the generated contract of this
 * base, so the shape below is local and closed; any other shape is `error`.
 */

export type HistoryReason = "stage_submitted" | "revision_sent" | "work_submitted" | "manual";
export type HistoryPoint = { readonly id: string; readonly revision: number; readonly savedAt: string; readonly reason: HistoryReason };
export type HistoryRead =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "empty" }
  | { readonly kind: "points"; readonly points: readonly HistoryPoint[] };

const REASONS: ReadonlySet<string> = new Set(["stage_submitted", "revision_sent", "work_submitted", "manual"]);
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The body of a 200 as a read; newest point first. Anything outside the closed shape is an error. */
export function historyReadFrom(body: unknown): HistoryRead {
  if (!isObject(body) || !Array.isArray(body.versions) || Object.keys(body).length !== 1) return { kind: "error" };
  const points: HistoryPoint[] = [];
  for (const item of body.versions) {
    if (!isObject(item) || Object.keys(item).sort().join() !== "id,reason,revision,savedAt") return { kind: "error" };
    const { id, reason, revision, savedAt } = item;
    if (typeof id !== "string" || id === "" || typeof reason !== "string" || !REASONS.has(reason)) return { kind: "error" };
    if (!Number.isSafeInteger(revision) || (revision as number) < 1) return { kind: "error" };
    if (typeof savedAt !== "string" || !TIME.test(savedAt) || Number.isNaN(Date.parse(savedAt))) return { kind: "error" };
    points.push({ id, revision: revision as number, savedAt, reason: reason as HistoryReason });
  }
  if (points.length === 0) return { kind: "empty" };
  return { kind: "points", points: points.sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.revision - a.revision) };
}

/** Croatian plural of "spremljena točka" for a count. */
export function pointCountKey(n: number): "one" | "few" | "many" {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "few" : "many";
}
