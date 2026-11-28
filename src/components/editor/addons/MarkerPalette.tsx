"use client";

import { Button } from "@ductura/ui";

import { addonsMessages as t } from "./messages.hr";
import { CUSTOM_MARKER_START, MARKER_PALETTE, safeMarker, type MarkerColor } from "./marker-palette";

type Props = {
  current?: string | null;
  onPick: (value: string) => void;
  onRemove: () => void;
  palette?: readonly MarkerColor[];
};

/**
 * The colour grid of the Marker menu: 51 colours, "Druga boja…" (any colour, ED-107, prototype pages.js `pgPick`),
 * "Ukloni marker" and the note that the marker is the student's own. The caller applies the mark.
 */
export function MarkerPalette({ current = null, onPick, onRemove, palette = MARKER_PALETTE }: Props) {
  const custom = current && !palette.some((color) => color.value === current) ? safeMarker(current) : null;
  return (
    <div role="group" aria-label={t.markerTitle}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(28px, 1fr))", gap: 4 }}>
        {palette.map((color) => (
          <button key={color.id} type="button" title={color.name} aria-label={t.markerColor(color.name)}
            aria-pressed={current === color.value} onClick={() => onPick(color.value)}
            style={{ background: color.value, width: 28, height: 28, border: "1px solid currentColor", borderRadius: 4 }} />
        ))}
      </div>
      <label>
        {t.markerOther} <small>{t.markerOtherHint}</small>
        <input type="color" value={custom ?? CUSTOM_MARKER_START}
          onChange={(event) => { const value = safeMarker(event.currentTarget.value); if (value) onPick(value); }} />
      </label>
      <Button tone="quiet" onClick={onRemove}>{t.markerRemove}</Button>
      <p>{t.markerNote}</p>
    </div>
  );
}
