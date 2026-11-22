// WEB-2131: the text size on the screen (S.tz in the prototype): five steps, the sheet's type is multiplied by --tz.
// Export and print stay as the faculty's rules say; this only changes what is drawn.
import { toolbarBehaviourHr as t } from "./messages.hr";

export const TEXT_ZOOMS = [0.9, 1, 1.15, 1.3, 1.5] as const;
export const DEFAULT_ZOOM = 1;
export const ZOOM_KEY = "ductura.toolbar.zoom.v1";

/** Any value is moved to the nearest step; anything that is not a number is the default. */
export function snapZoom(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return DEFAULT_ZOOM;
  return TEXT_ZOOMS.reduce((best, z) => (Math.abs(z - n) < Math.abs(best - n) ? z : best), DEFAULT_ZOOM as number);
}

/** One step smaller (-1) or larger (1); at the ends the size stays. */
export function stepZoom(current: number, direction: -1 | 1): number {
  const at = TEXT_ZOOMS.indexOf(snapZoom(current) as (typeof TEXT_ZOOMS)[number]);
  return TEXT_ZOOMS[Math.min(TEXT_ZOOMS.length - 1, Math.max(0, at + direction))] ?? DEFAULT_ZOOM;
}

export const zoomPercent = (zoom: number): number => Math.round(snapZoom(zoom) * 100);
export const canStep = (current: number, direction: -1 | 1): boolean => stepZoom(current, direction) !== snapZoom(current);
export const zoomToast = (zoom: number): string => t.textSizeToast(zoomPercent(zoom));

export function loadZoom(storage: Pick<Storage, "getItem"> | null = zoomStorage()): number {
  try {
    return snapZoom(storage?.getItem(ZOOM_KEY));
  } catch {
    return DEFAULT_ZOOM;
  }
}

export function saveZoom(zoom: number, storage: Pick<Storage, "setItem"> | null = zoomStorage()): void {
  try {
    storage?.setItem(ZOOM_KEY, String(snapZoom(zoom)));
  } catch {
    // Blocked storage: the size holds for this visit only.
  }
}

function zoomStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
