/**
 * Where a popover goes (UI-6A), apart from React so it can be tested without
 * a browser. The rule of the editor prototype's openPop: left edge on the
 * anchor's left, 6 px under it; flipped above when it does not fit below; never
 * closer than 8 px to an edge of the viewport.
 */

export type AnchorRect = { left: number; right: number; top: number; bottom: number };
export type Size = { width: number; height: number };

export const POPOVER_GAP = 6;
export const POPOVER_MARGIN = 8;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export function placePopover(anchor: AnchorRect, size: Size, viewport: Size): { left: number; top: number } {
  const left = Math.min(Math.max(POPOVER_MARGIN, anchor.left), viewport.width - size.width - POPOVER_MARGIN);
  let top = anchor.bottom + POPOVER_GAP;
  if (top + size.height > viewport.height - POPOVER_MARGIN) top = Math.max(POPOVER_MARGIN, anchor.top - size.height - POPOVER_GAP);
  top = clamp(top, POPOVER_MARGIN, Math.max(POPOVER_MARGIN, viewport.height - size.height - POPOVER_MARGIN));
  return { left: Math.max(POPOVER_MARGIN, left), top };
}

/** True when the event target is outside both the popover and its anchor (a click there closes it). */
export function isOutside(target: Node | null, popover: Node | null, anchor: Node | null): boolean {
  if (target === null) return true;
  return !(popover?.contains(target) ?? false) && !(anchor?.contains(target) ?? false);
}
