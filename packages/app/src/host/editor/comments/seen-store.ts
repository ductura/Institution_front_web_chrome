// ED-42 (paritet P2-13, „Novo”): when the student last looked at the comments of a work. No route
// keeps this record, so it lives in this browser only. Without a record nothing is claimed new (the
// first visit, another browser, storage switched off): a missing record never marks every comment new.

export type SeenStorage = Pick<Storage, "getItem" | "setItem">;

const KEY = "ductura.comments.seen.";

export const browserSeenStorage = (): SeenStorage | null => {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
};

/** The time of the last visit, or Infinity when none is recorded (nothing is then new). */
export function readSeen(storage: SeenStorage | null, workId: string): number {
  try {
    const raw = storage?.getItem(KEY + workId) ?? null;
    const at = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(at) && at > 0 ? at : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** Records a visit; false when the browser keeps nothing. */
export function writeSeen(storage: SeenStorage | null, workId: string, at: number): boolean {
  if (!storage || !Number.isFinite(at) || at <= 0) return false;
  try { storage.setItem(KEY + workId, String(Math.floor(at))); return true; } catch { return false; }
}
