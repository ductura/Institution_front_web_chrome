// WEB-V20-POSTAVKE-DIJALOG: the read-aloud speed chosen in the dialog. Browser only (localStorage), like the other
// reading preferences; blocked or throwing storage never breaks the screen, and an unknown stored value is ignored.
import { READ_ALOUD_DEFAULT_RATE, type ReadAloudRate } from "../read-aloud/controller";

export const READ_ALOUD_RATE_KEY = "ductura.reading.rate.v1";

/** The speeds the dialog offers (a closed set inside the controller's 0.75 to 1.5). */
export const READ_ALOUD_RATE_STEPS = [0.75, 1, 1.25, 1.5] as const satisfies readonly ReadAloudRate[];

export const isRateStep = (value: unknown): value is (typeof READ_ALOUD_RATE_STEPS)[number] =>
  typeof value === "number" && (READ_ALOUD_RATE_STEPS as readonly number[]).includes(value);

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadReadAloudRate(storage: Pick<Storage, "getItem"> | null = defaultStorage()): ReadAloudRate {
  try {
    const raw = storage?.getItem(READ_ALOUD_RATE_KEY);
    if (typeof raw !== "string") return READ_ALOUD_DEFAULT_RATE;
    const value: unknown = JSON.parse(raw);
    return isRateStep(value) ? value : READ_ALOUD_DEFAULT_RATE;
  } catch {
    return READ_ALOUD_DEFAULT_RATE;
  }
}

/** Returns false when the choice could not be kept (it then holds for this visit only). A value outside the steps is refused. */
export function saveReadAloudRate(rate: number, storage: Pick<Storage, "setItem"> | null = defaultStorage()): boolean {
  if (!isRateStep(rate)) return false;
  try {
    storage?.setItem(READ_ALOUD_RATE_KEY, JSON.stringify(rate));
    return storage != null;
  } catch {
    return false;
  }
}

export function resetReadAloudRate(storage: Pick<Storage, "setItem" | "removeItem"> | null = defaultStorage()): void {
  try {
    storage?.removeItem(READ_ALOUD_RATE_KEY);
  } catch {
    /* blocked storage: nothing to clear */
  }
}

type Listener = (rate: ReadAloudRate) => void;
const listeners = new Set<Listener>();
let current: ReadAloudRate | null = null;

/** The rate now; read from storage once, then held here so the dialog and a reader see the same value. */
export const readAloudRate = (): ReadAloudRate => (current ??= loadReadAloudRate());

export function setReadAloudRate(rate: number): ReadAloudRate {
  if (!isRateStep(rate)) return readAloudRate();
  current = rate;
  saveReadAloudRate(rate);
  for (const listener of [...listeners]) listener(rate);
  return rate;
}

export function resetReadAloudRateNow(): ReadAloudRate {
  current = READ_ALOUD_DEFAULT_RATE;
  resetReadAloudRate();
  for (const listener of [...listeners]) listener(current);
  return current;
}

export function subscribeReadAloudRate(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
