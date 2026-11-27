/**
 * ED-99: the switch "Tipografija dok tipkam" (prototype acad.js `S.typo`,
 * `acTypo`). While it is on, which is the default, CroatianQuotes and
 * DashEllipsis change a typed `"`, ` - ` and `...`. While it is off, every
 * character stays as typed. The text already written is never changed by the
 * switch.
 *
 * The choice is kept in this browser. With blocked storage it still holds
 * for this page.
 */

export const TYPING_TYPOGRAPHY_KEY = "ductura.editor.typingTypography";

type SwitchStorage = Pick<Storage, "getItem" | "setItem">;

let current: boolean | null = null;
const listeners = new Set<() => void>();

function browserStorage(): SwitchStorage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

/** Whether typed quotes, dashes and dots are changed; on until it is switched off. */
export function typingTypographyOn(storage: () => SwitchStorage | undefined = browserStorage): boolean {
  if (current !== null) return current;
  try {
    current = storage()?.getItem(TYPING_TYPOGRAPHY_KEY) !== "off";
  } catch {
    current = true;
  }
  return current;
}

/** Switches it and keeps the choice; the listeners hear of it. */
export function setTypingTypography(on: boolean, storage: () => SwitchStorage | undefined = browserStorage): boolean {
  current = on;
  try {
    storage()?.setItem(TYPING_TYPOGRAPHY_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the switch still holds on this page.
  }
  listeners.forEach((listener) => listener());
  return on;
}

export function subscribeTypingTypography(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function resetTypingTypographyForTest(): void {
  current = null;
  listeners.clear();
}
