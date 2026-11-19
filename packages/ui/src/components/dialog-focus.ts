/**
 * Focus rules of the Dialog (WEB-04), apart from React so they can be tested
 * without a browser. Tab and Shift+Tab move through the dialog's own
 * focusable elements and wrap at either end, so focus never leaves it.
 */

/** What can take focus inside a dialog; disabled controls and tabindex="-1" are out. */
export const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled]):not([type=hidden])", "select:not([disabled])",
  "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])", "[contenteditable='true']",
].join(",");

/**
 * The index Tab moves to among `count` focusable elements, from `current`
 * (-1 when the focus is on none of them, e.g. on the dialog itself).
 */
export function trappedIndex(current: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return backwards ? count - 1 : 0;
  return backwards ? (current - 1 + count) % count : (current + 1) % count;
}

/** Where the focus goes back after the dialog closes: what had it before, while that is still on the page. */
export function returnTarget(previousFocus: Element | null, isConnected: (el: Element) => boolean): HTMLElement | null {
  if (previousFocus === null || !isConnected(previousFocus)) return null;
  return typeof (previousFocus as HTMLElement).focus === "function" ? (previousFocus as HTMLElement) : null;
}
