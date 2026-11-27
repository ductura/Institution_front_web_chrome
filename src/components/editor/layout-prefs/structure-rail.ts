/**
 * ED-112: "Struktura rada" by keyboard and from the palette, as the prototype's
 * `ACT.railToggle` (features.js): Ctrl+\ (Cmd+\ on a Mac) shows or hides the
 * structure rail, and on a narrow screen opens or closes its drawer. The
 * palette lives outside the panel layout, so it asks with an event, as focus
 * mode does (focus-mode.ts).
 */

/** The event the palette sends to the panel layout of this page. */
export const STRUCTURE_RAIL_EVENT = "ductura:structure-rail";

type Key = Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "defaultPrevented" | "isComposing" | "repeat">;

/**
 * Whether a key shows or hides the structure. A key someone else took, an IME
 * composition, a held key and any key while a modal dialog is open stay with
 * their owner. On a Croatian keyboard "\" is AltGr+Q, which the browser reports
 * with Alt held, so a typed "\" counts with Alt too; the key where an English
 * keyboard has "\" ("Ž" on a Croatian one) counts without Alt.
 */
export function togglesRail(event: Key, modalOpen: boolean): boolean {
  if (event.defaultPrevented || event.isComposing || event.repeat || modalOpen) return false;
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey) return false;
  return event.key === "\\" || (!event.altKey && event.code === "Backslash");
}

/** Asks the panel layout of this page to show or hide the structure. */
export function requestStructureRail(target: EventTarget = document): void {
  target.dispatchEvent(new Event(STRUCTURE_RAIL_EVENT));
}
