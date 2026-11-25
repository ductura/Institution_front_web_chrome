// WEB-V21-DRU-ZAHTJEVI-PODRUCJA: manual checklist per area for the "Zahtjevi rada" card.
// Every entry is a tick the student sets alone: no automatic check, no conclusion about the work,
// nothing is sent to the server (ticks stay in the browser, like the other manual items).
import type { AreaKey } from "./profiles";

export type AreaCheck = { key: string; text: string };

/** Only areas listed here get a list; the rest get none. */
export const AREA_CHECKS: Readonly<Partial<Record<AreaKey, readonly AreaCheck[]>>> = {
  dru: [
    { key: "method", text: "Navedena je metoda istraživanja." },
    { key: "sample", text: "Opisan je uzorak i način odabira." },
    { key: "limits", text: "Navedena su ograničenja istraživanja." },
    { key: "ethics", text: "Etička napomena, ako se istraživanje provodi na ljudima." },
  ],
};

const norm = (s: string) => s.toLowerCase().replace(/[.\s]+$/g, "").trim();

/**
 * Manual checks for the area, minus any the profile already lists itself (same text, case and
 * trailing full stop ignored), so a tick never appears twice.
 */
export function areaChecksOf(area: AreaKey, existing: readonly string[] = []): readonly AreaCheck[] {
  const have = new Set(existing.map(norm));
  return (AREA_CHECKS[area] ?? []).filter((c) => !have.has(norm(c.text)));
}
