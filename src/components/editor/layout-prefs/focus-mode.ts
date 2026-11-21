/**
 * Focus mode of the editor (WEB-1605 part 3, WEB-6B): the work alone, with
 * the rails, the panels and the command row hidden (SidePanels.module.css,
 * `data-focus`). Ctrl+. (Cmd+. on a Mac) turns it on and off, Esc turns it
 * off, and the palette's "Način fokusa" turns it on. Panels closed before
 * stay closed after, because focus mode only hides them and keeps their state.
 */

/** The event the palette sends, since it lives outside the panel layout. */
export const FOCUS_MODE_EVENT = "ductura:focus-mode";

type Key = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "defaultPrevented" | "isComposing" | "repeat">;

/**
 * Whether a key turns focus mode on or off. A key someone else took, an IME
 * composition, a held key and any key while a modal dialog is open stay with
 * their owner, so Esc closes the dialog first and focus mode only after.
 */
export function togglesFocus(event: Key, focus: boolean, modalOpen: boolean): boolean {
  if (event.defaultPrevented || event.isComposing || event.repeat || modalOpen) return false;
  const shortcut = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key === ".";
  return shortcut || (focus && event.key === "Escape");
}

/** Asks the panel layout of this page to turn focus mode on. */
export function requestFocusMode(target: EventTarget = document): void {
  target.dispatchEvent(new Event(FOCUS_MODE_EVENT));
}
