"use client";

import { Button, Dialog } from "@ductura/ui";
import { useState, type SyntheticEvent } from "react";

import { editorPanelLayoutsHr as t } from "@/lib/i18n/messages.hr";

import { DEFAULT_SETTINGS, type PanelSize } from "../layout/layout-settings";
import { DEFAULT_PREFERENCES, LAYOUTS, type LayoutPreferences, type Side } from "./preferences";
import styles from "../SidePanels.module.css";

const WIDTHS = ["narrow", "medium", "wide"] as const satisfies readonly PanelSize[];
type Width = (typeof WIDTHS)[number];

export function PanelSettings({ side, value, onChange, width, onWidth }: {
  side: Side;
  value: LayoutPreferences[Side];
  onChange: (value: LayoutPreferences[Side]) => void;
  /** ED-39: the side's width on a computer (the same choice as the shell's "Raspored" menu). */
  width?: Width;
  onWidth?: (width: Width) => void;
}) {
  const [open, setOpen] = useState(false);
  const title = t.customize[side];
  const labels = t.variants[side];

  return <>
    <Button tone="quiet" aria-haspopup="dialog" aria-label={title} onClick={() => setOpen(true)}>
      {side === "left" ? title : <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" />
      </svg>}
    </Button>
    {open && <div {...{ onCancel: (event: SyntheticEvent) => event.stopPropagation() }}
      onKeyDown={(event) => { if (event.defaultPrevented) event.stopPropagation(); }}>
      <Dialog open title={title} onClose={() => setOpen(false)} actions={<>
        <Button tone="quiet" onClick={() => {
          onChange(DEFAULT_PREFERENCES[side]);
          onWidth?.(DEFAULT_SETTINGS[side === "left" ? "rail" : "panel"]);
        }}>{t.reset}</Button>
        <Button onClick={() => setOpen(false)}>{t.done}</Button>
      </>}>
        <p className={styles.settingsNote}>{t.settingsNote}</p>
        <fieldset className={styles.layoutChoices}>
          <legend>{t.layout}</legend>
          {LAYOUTS.map((layout) => <Button key={layout} tone="quiet" aria-pressed={layout === value.layout}
            onClick={() => onChange({ ...value, layout })}>
            <strong>{labels[layout]}</strong><span>{t.descriptions[side][layout]}</span>
          </Button>)}
        </fieldset>
        <fieldset className={styles.mobileChoices}>
          <legend>{t.mobile}</legend>
          {(["same", ...LAYOUTS] as const).map((mobile) => <Button key={mobile} tone="quiet"
            aria-pressed={mobile === value.mobile} onClick={() => onChange({ ...value, mobile })}>
            {mobile === "same" ? t.same : labels[mobile]}
          </Button>)}
        </fieldset>
        <fieldset className={styles.mobileChoices}>
          <legend>{t.density}</legend>
          {([false, true] as const).map((dense) => <Button key={String(dense)} tone="quiet"
            aria-pressed={dense === (value.dense === true)}
            onClick={() => onChange(dense ? { ...value, dense: true } : { layout: value.layout, mobile: value.mobile })}>
            {dense ? t.densities.dense : t.densities.airy}
          </Button>)}
        </fieldset>
        {width && onWidth && <fieldset className={styles.mobileChoices}>
          <legend>{t.width}</legend>
          {WIDTHS.map((size) => <Button key={size} tone="quiet" aria-pressed={size === width} onClick={() => onWidth(size)}>
            {t.widths[size]}
          </Button>)}
        </fieldset>}
      </Dialog>
    </div>}
  </>;
}
