"use client";

import { Button, Dialog } from "@ductura/ui";
import { useState, type SyntheticEvent } from "react";

import { editorPanelLayoutsHr as t } from "@/lib/i18n/messages.hr";

import { DEFAULT_PREFERENCES, LAYOUTS, type LayoutPreferences, type Side } from "./preferences";
import styles from "../SidePanels.module.css";

export function PanelSettings({ side, value, onChange }: {
  side: Side;
  value: LayoutPreferences[Side];
  onChange: (value: LayoutPreferences[Side]) => void;
}) {
  const [open, setOpen] = useState(false);
  const title = t.customize[side];
  const labels = t.variants[side];

  return <>
    <Button tone="quiet" aria-haspopup="dialog" aria-label={title} onClick={() => setOpen(true)}>
      {side === "left" ? title : <span aria-hidden="true">⚙</span>}
    </Button>
    {open && <div {...{ onCancel: (event: SyntheticEvent) => event.stopPropagation() }}
      onKeyDown={(event) => { if (event.defaultPrevented) event.stopPropagation(); }}>
      <Dialog open title={title} onClose={() => setOpen(false)} actions={<>
        <Button tone="quiet" onClick={() => onChange(DEFAULT_PREFERENCES[side])}>{t.reset}</Button>
        <Button onClick={() => setOpen(false)}>{t.done}</Button>
      </>}>
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
      </Dialog>
    </div>}
  </>;
}
