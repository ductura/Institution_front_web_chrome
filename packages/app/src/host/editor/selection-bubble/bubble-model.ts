// ED-75: the bubble beside the selected text (prototype toolbar2.js `showBub`, #selBub). What it offers and
// where it stands; the host reads the editor and runs the actions through the paths the rest of the editor
// already uses (comments card, source list at the caret, quote, footnote, the left column's stash).

/** The prototype shows nothing for less than three characters of selected text. */
export const MIN_CHARS = 3;
/** The prototype waits this long after the selection last moved. */
export const DELAY_MS = 350;

export const BUBBLE_ACTIONS = ["comment", "cite", "toQuote", "toFootnote", "stash"] as const;
export type BubbleAction = (typeof BUBBLE_ACTIONS)[number];

export type BubbleInput = {
  /** The work can be written in and the editor holds the focus. */
  readonly editable: boolean;
  readonly text: string;
  /** The selection already stands in a quote: "U blok-citat" would do nothing. */
  readonly inQuote: boolean;
  /** A footnote can stand where the selection is (schema 3, within one paragraph, not a heading). */
  readonly footnote: boolean;
};

/** The buttons, in the prototype's order, or null when the bubble stays hidden. */
export function bubbleActions(input: BubbleInput): BubbleAction[] | null {
  if (!input.editable || input.text.trim().length < MIN_CHARS) return null;
  return BUBBLE_ACTIONS.filter((a) => (a === "toQuote" ? !input.inQuote : a === "toFootnote" ? input.footnote : true));
}

export type Box = { readonly left: number; readonly top: number; readonly width: number; readonly bottom: number };
export type Viewport = { readonly width: number; readonly height: number };

/** Above the selection, centred on it; below it on a narrow screen or near the top, never off the screen. */
export function bubblePlace(selection: Box, width: number, view: Viewport): { left: number; top: number } {
  const below = view.width <= 700 || selection.top < 110;
  const left = Math.max(8, Math.min(view.width - width - 8, selection.left + selection.width / 2 - width / 2));
  const top = below ? Math.min(view.height - 100, selection.bottom + 10) : selection.top - 44;
  return { left, top };
}
