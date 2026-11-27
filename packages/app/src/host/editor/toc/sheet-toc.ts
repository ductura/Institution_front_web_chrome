// ED-71: "Sadržaj na listu" (prototype `tocToggle`, `S.toc`): the table of
// contents shown on the sheet above the text. Whether it is shown is the
// person's choice for this work, kept in this browser under the person's
// journal scope and the work's document, like the work parts (WEB-14c).
// The toolbar and the box on the sheet share it through this small store.

export type TocStorage = Pick<Storage, "getItem" | "setItem">;

const PREFIX = "ductura.editor.sheet-toc:";
const WORK_PARTS_PREFIX = "ductura.editor.work-parts:";

/** The key for one person and one work. */
export const sheetTocKey = (scope: string, documentId: string) => `${PREFIX}${JSON.stringify([scope, documentId])}`;

/** The same key from the toolbar's work-parts key (`ductura.editor.work-parts:[scope, documentId]`); null for any other. */
export function sheetTocKeyOf(workPartsKey: string): string | null {
  return workPartsKey.startsWith(WORK_PARTS_PREFIX) ? `${PREFIX}${workPartsKey.slice(WORK_PARTS_PREFIX.length)}` : null;
}

const shown = new Map<string, boolean>();
const listeners = new Set<() => void>();

const browserStorage = (): TocStorage | null => {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
};

/** Whether the box is shown for `key`; off until the person turns it on. */
export function readSheetToc(key: string | null, storage: () => TocStorage | null = browserStorage): boolean {
  if (key === null) return false;
  const known = shown.get(key);
  if (known !== undefined) return known;
  let on = false;
  try { on = storage()?.getItem(key) === "on"; } catch { on = false; }
  shown.set(key, on);
  return on;
}

/** Shows or hides the box and keeps the choice; blocked storage keeps it for this page only. */
export function setSheetToc(key: string | null, next: boolean, storage: () => TocStorage | null = browserStorage): boolean {
  if (key === null) return false;
  shown.set(key, next);
  try { storage()?.setItem(key, next ? "on" : "off"); } catch { /* the choice still holds on this page */ }
  for (const listener of listeners) listener();
  return next;
}

export function subscribeSheetToc(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Test seam: forgets what this page remembered. */
export function resetSheetTocForTest(): void {
  shown.clear();
}
