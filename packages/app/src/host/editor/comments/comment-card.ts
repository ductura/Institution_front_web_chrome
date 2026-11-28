// ED-98 (prototype text2.js `#t2card`): a tap on a comment in the text, up to 1050 px, asks for the
// comment card instead of a popover. The marks host knows what was tapped; the card host answers.
import type { Comment } from "./model";

/** The comment at `pos`: an open one first, the shortest place when several cover it. */
export function commentAt(comments: readonly Comment[], pos: number): Comment | null {
  const hit = comments.filter((c) => !c.place.lost && c.place.from <= pos && pos <= c.place.to);
  hit.sort((a, b) => Number(a.resolved) - Number(b.resolved) || (a.place.to - a.place.from) - (b.place.to - b.place.from));
  return hit[0] ?? null;
}

export const COMMENT_CARD_EVENT = "ductura:comment-card";
export const CARD_MAX_WIDTH = 1050;

/** Asks the card for the comment at `pos` in the text. */
export function requestCommentCard(pos: number, target: EventTarget = document): void {
  target.dispatchEvent(new CustomEvent(COMMENT_CARD_EVENT, { detail: { pos } }));
}

/** The position asked for, or null for another event. */
export function cardPosition(event: Event): number | null {
  const pos = (event as CustomEvent<{ pos?: unknown }>).detail?.pos;
  return typeof pos === "number" && Number.isInteger(pos) && pos >= 0 ? pos : null;
}

/** The card is only for narrow screens; wider, the comment is in the panel. */
export const cardFits = (width: number) => width > 0 && width <= CARD_MAX_WIDTH;

// ED-119 (prototype app.js `.cmt` click): wider than the card, a click on a comment in the text opens
// Komentari with that comment in focus. The panel may still be closed when it is asked, so the place
// waits here a few seconds for the panel that mounts next.
export const COMMENT_FOCUS_EVENT = "ductura:comment-focus";
const FOCUS_WAIT_MS = 5000;
let pendingFocus: { pos: number; at: number } | null = null;

/** Asks the Comments card in the panel to bring the comment at `pos` into focus. */
export function requestCommentFocus(pos: number, target: EventTarget = document, now = Date.now()): void {
  pendingFocus = { pos, at: now };
  target.dispatchEvent(new CustomEvent(COMMENT_FOCUS_EVENT, { detail: { pos } }));
}

/** The place asked for and not yet taken, once; an old request is dropped. */
export function takeCommentFocus(now = Date.now()): number | null {
  const asked = pendingFocus;
  pendingFocus = null;
  return asked !== null && now - asked.at <= FOCUS_WAIT_MS ? asked.pos : null;
}
