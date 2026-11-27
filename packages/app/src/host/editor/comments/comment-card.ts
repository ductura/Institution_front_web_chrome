// ED-98 (prototype text2.js `#t2card`): a tap on a comment in the text, up to 1050 px, asks for the
// comment card instead of a popover. The marks host knows what was tapped; the card host answers.
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
