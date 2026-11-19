/**
 * The toast list (WEB-04), apart from React. A short message about something
 * that just happened; a neutral one leaves by itself, an error stays until it
 * is closed, so nobody misses it. At most MAX_TOASTS show at once.
 */
export type ToastTone = "neutral" | "error";
export type ToastItem = { readonly id: number; readonly text: string; readonly tone: ToastTone };

export const MAX_TOASTS = 3;
export const TOAST_TIMEOUT_MS = 6000;

/** The list with `item` added; the oldest leave first when it is full. */
export function addToast(list: readonly ToastItem[], item: ToastItem): ToastItem[] {
  return [...list.filter((t) => t.id !== item.id), item].slice(-MAX_TOASTS);
}

export function removeToast(list: readonly ToastItem[], id: number): ToastItem[] {
  return list.filter((t) => t.id !== id);
}

/** How long a toast stays by itself; null: until it is closed. */
export function toastTimeout(tone: ToastTone): number | null {
  return tone === "error" ? null : TOAST_TIMEOUT_MS;
}
