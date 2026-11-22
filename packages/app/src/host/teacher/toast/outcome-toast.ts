import { MAX_TOASTS, type ToastItem, type ToastTone } from "@ductura/ui";

/** How long a teacher toast stays (prototype, B-6 decision of 22. 11. 2026.). */
export const TEACHER_TOAST_MS = 3200;

/** What the server said about an action: only `ok` may produce a success toast. */
export type ServerOutcome = { readonly ok: boolean };

/**
 * The toast list for the teacher's outcomes, apart from React. Unlike the shared one,
 * a neutral toast leaves after 3200 ms and an error stays until it is closed.
 */
export function pushToast(list: readonly ToastItem[], id: number, text: string, tone: ToastTone): ToastItem[] {
  return [...list.filter((t) => t.id !== id), { id, text, tone }].slice(-MAX_TOASTS);
}

export function dropToast(list: readonly ToastItem[], id: number): ToastItem[] {
  return list.filter((t) => t.id !== id);
}

export function teacherToastTimeout(tone: ToastTone): number | null {
  return tone === "error" ? null : TEACHER_TOAST_MS;
}

/**
 * Runs the server action and shows the success text only if the server confirmed
 * (never optimistically, B-6). A failure or a thrown error shows nothing here: the
 * screen keeps its own inline `role="alert"` message. Returns the action's outcome.
 */
export async function toastWhenConfirmed<T extends ServerOutcome>(
  run: () => Promise<T>,
  show: (text: string) => void,
  text: string,
): Promise<T> {
  const outcome = await run();
  if (outcome.ok) show(text);
  return outcome;
}
