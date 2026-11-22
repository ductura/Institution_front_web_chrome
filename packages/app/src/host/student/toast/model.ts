// WEB-2112 (PD-7): the toast list of the student's screens, apart from React.
// The prototype's #toast goes by itself after 3.2 s (PD-7); the package's own
// timeout is 6 s, so the host keeps this one. Errors stay until they are closed.
export type StudentToastTone = "neutral" | "error";
export type StudentToast = { readonly id: number; readonly text: string; readonly tone: StudentToastTone };

export const STUDENT_TOAST_MS = 3200;
export const STUDENT_MAX_TOASTS = 3;

/** How long a toast stays by itself; null: until it is closed. */
export function toastLifetime(tone: StudentToastTone): number | null {
  return tone === "error" ? null : STUDENT_TOAST_MS;
}

/** The list with `item` added; the oldest leave first when it is full. */
export function withToast(list: readonly StudentToast[], item: StudentToast): StudentToast[] {
  return [...list.filter((t) => t.id !== item.id), item].slice(-STUDENT_MAX_TOASTS);
}

export function withoutToast(list: readonly StudentToast[], id: number): StudentToast[] {
  return list.filter((t) => t.id !== id);
}
