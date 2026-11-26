// ED-48 (P2-24): "Pitaj mentora" from the left panel. A part of the editor outside the Comments card
// (the chapter sheet) asks it to open a new comment with a first line already written; the card opens
// it on the selection the part made, so the question stands on the chapter's title, as in the
// prototype (features.js `hAsk`). Nothing is sent until the person writes and publishes it.
//
// The card may not be mounted yet when it is asked (a layout that mounts it only once its group
// opens), so the request also waits here, briefly, for the card that mounts next.

export const ASK_COMMENT_EVENT = "ductura:comment-new";
const MAX = 2000;
/** How long a request waits for a card that mounts later; past it, an old click opens nothing. */
export const ASK_WAIT_MS = 5000;

let waiting: { text: string; at: number } | null = null;

export function askComment(text: string, target: EventTarget = document, now: number = Date.now()): void {
  waiting = { text, at: now };
  target.dispatchEvent(new CustomEvent(ASK_COMMENT_EVENT, { detail: text }));
}

/** The first line the event asks for, or null when it carries none the card should take. */
export function askedComment(event: Event): string | null {
  const detail = (event as CustomEvent<unknown>).detail;
  return typeof detail === "string" && detail.length <= MAX ? detail : null;
}

/** The request still waiting for a card, taken once: a card takes it on mount or from the event. */
export function takeAskedComment(now: number = Date.now()): string | null {
  const request = waiting;
  waiting = null;
  return request !== null && now - request.at <= ASK_WAIT_MS && request.text.length <= MAX ? request.text : null;
}
