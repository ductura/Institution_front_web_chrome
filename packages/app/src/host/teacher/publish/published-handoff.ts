// F4-NAS-R13 (NAS-19): the confirmed publish travels to /nastavnik, which shows the toast there.
// Only a marker is kept, never text: the courses page shows its own fixed sentence, once.

const KEY = "ductura.nastavnik.objava-zadatka";

export type HandoffStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStore(): HandoffStore | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Marks a publish the server confirmed; false when the browser keeps no session storage. */
export function handOverPublished(store: HandoffStore | null = sessionStore()): boolean {
  if (store === null) return false;
  try {
    store.setItem(KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** True once after `handOverPublished`: the mark is removed as it is read. */
export function takePublished(store: HandoffStore | null = sessionStore()): boolean {
  if (store === null) return false;
  try {
    const marked = store.getItem(KEY) === "1";
    if (marked) store.removeItem(KEY);
    return marked;
  } catch {
    return false;
  }
}
