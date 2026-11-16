/**
 * The part of the page the on-screen keyboard leaves visible, from
 * `visualViewport`, and the scroll that keeps the caret inside it. Ported in
 * behaviour from the `web-mobile` skeleton (`public/app.js`, `isKeyboardOpen`
 * in `public/lib/doc.js`): WebKit does not always fire `visualViewport`
 * `resize`, so `window` `resize` is read as well; the full height is
 * remembered per width, and turning the device starts the measurement over.
 */

/** One reading of the window; `visual` is absent where there is no `visualViewport`. */
export interface ViewportReading {
  innerWidth: number;
  innerHeight: number;
  visual?: { height: number; offsetTop: number } | null;
}

export interface VisibleArea {
  width: number;
  /** Height of the visible part, in CSS px, always in [0, innerHeight]. */
  visibleHeight: number;
  /** Top of the visible part in layout viewport coordinates. */
  offsetTop: number;
  /** Layout height hidden under the keyboard, for `bottom` of fixed bars. */
  keyboardInset: number;
  keyboardOpen: boolean;
  /** Largest height seen at this width without the keyboard. */
  fullHeight: number;
}

/** Below this share of the full height the keyboard counts as open (skeleton value). */
export const KEYBOARD_OPEN_RATIO = 0.75;

function finite(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The visible area for a reading. `previous` is the last result, so the full
 * height survives the keyboard; pass nothing on the first reading. NaN,
 * negative, infinite or oversized values never leave [0, innerHeight].
 */
export function visibleArea(reading: ViewportReading, previous?: VisibleArea): VisibleArea {
  const width = Math.max(finite(reading.innerWidth, 0), 0);
  const innerHeight = Math.max(finite(reading.innerHeight, 0), 0);
  const visual = reading.visual ?? null;
  const visibleHeight = clamp(finite(visual?.height, innerHeight), 0, innerHeight);
  const offsetTop = clamp(finite(visual?.offsetTop, 0), 0, innerHeight - visibleHeight);
  const remembered = previous && previous.width === width ? previous.fullHeight : 0;
  const fullHeight = Math.max(remembered, innerHeight);
  return {
    width,
    visibleHeight,
    offsetTop,
    keyboardInset: Math.max(innerHeight - visibleHeight - offsetTop, 0),
    keyboardOpen: fullHeight > 0 && visibleHeight / fullHeight < KEYBOARD_OPEN_RATIO,
    fullHeight,
  };
}

/**
 * How far to scroll (positive: content moves up) so the caret, given in layout
 * viewport coordinates, ends inside the visible area with `margin` px of air.
 * Zero when it is already there. A caret taller than the visible part is
 * aligned to its top. Non-finite input gives zero rather than a wild scroll.
 */
export function caretScrollDelta(
  caret: { top: number; bottom: number },
  area: Pick<VisibleArea, "visibleHeight" | "offsetTop">,
  margin = 8,
): number {
  const { top: rawTop, bottom: rawBottom } = caret;
  if (![rawTop, rawBottom, area.visibleHeight, area.offsetTop].every(Number.isFinite)) return 0;
  const top = Math.min(rawTop, rawBottom);
  const bottom = Math.max(rawTop, rawBottom);
  const height = bottom - top;
  const visible = Math.max(area.visibleHeight, 0);
  if (height >= visible) return top - area.offsetTop;
  const air = clamp(finite(margin, 0), 0, (visible - height) / 2);
  const low = area.offsetTop + air;
  const high = area.offsetTop + visible - air;
  if (top < low) return top - low;
  if (bottom > high) return bottom - high;
  return 0;
}

type Listener = () => void;
interface Listens {
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
}

/** The parts of `window` the tracker reads. */
export interface ViewportWindow extends Listens {
  innerWidth: number;
  innerHeight: number;
  visualViewport?: (Listens & { height: number; offsetTop: number }) | null;
}

/**
 * Calls `onChange` now and after every viewport change; returns the function
 * that stops listening.
 */
export function trackVisibleArea(win: ViewportWindow, onChange: (area: VisibleArea) => void): () => void {
  let last: VisibleArea | undefined;
  const update = () => {
    const vv = win.visualViewport;
    last = visibleArea(
      { innerWidth: win.innerWidth, innerHeight: win.innerHeight, visual: vv ? { height: vv.height, offsetTop: vv.offsetTop } : null },
      last,
    );
    onChange(last);
  };
  const vv = win.visualViewport ?? null;
  vv?.addEventListener("resize", update);
  vv?.addEventListener("scroll", update);
  win.addEventListener("resize", update);
  update();
  return () => {
    vv?.removeEventListener("resize", update);
    vv?.removeEventListener("scroll", update);
    win.removeEventListener("resize", update);
  };
}
