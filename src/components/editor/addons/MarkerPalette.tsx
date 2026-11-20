"use client";

import { Button } from "@ductura/ui";

import { addonsMessages as t } from "./messages.hr";
import { MARKER_PALETTE, type MarkerColor } from "./marker-palette";

type Props = {
  current?: string | null;
  onPick: (value: string) => void;
  onRemove: () => void;
  palette?: readonly MarkerColor[];
};

/** The colour grid of the Marker menu: 51 colours and "Ukloni marker". The caller applies the mark. */
export function MarkerPalette({ current = null, onPick, onRemove, palette = MARKER_PALETTE }: Props) {
  return (
    <div role="group" aria-label={t.markerTitle}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(28px, 1fr))", gap: 4 }}>
        {palette.map((color) => (
          <button key={color.id} type="button" title={color.name} aria-label={t.markerColor(color.name)}
            aria-pressed={current === color.value} onClick={() => onPick(color.value)}
            style={{ background: color.value, width: 28, height: 28, border: "1px solid currentColor", borderRadius: 4 }} />
        ))}
      </div>
      <Button tone="quiet" onClick={onRemove}>{t.markerRemove}</Button>
    </div>
  );
}
