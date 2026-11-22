"use client";

import { Checkbox } from "@ductura/ui";
import { useEffect, useState } from "react";

import { whatIsRecordedHr as t } from "../../../../lib/i18n/messages.hr";
import styles from "./WhatIsRecorded.module.css";
import { readRhythm, rhythmKey, writeRhythm } from "./rhythm";

type Props = { rhythm?: boolean; onRhythmChange?: (value: boolean) => void };

export function useRhythmSetting() {
  const [value, setValue] = useState(true);
  useEffect(() => setValue(readRhythm(() => localStorage.getItem(rhythmKey))), []);
  return [value, (next: boolean) => {
    setValue(next);
    writeRhythm(next, (v) => localStorage.setItem(rhythmKey, v));
  }] as const;
}

export function WhatIsRecorded({ rhythm, onRhythmChange }: Props) {
  const [own, setOwn] = useRhythmSetting();
  const checked = rhythm ?? own;
  const change = onRhythmChange ?? setOwn;
  return (
    <div className={styles.root} data-testid="what-is-recorded">
      <dl className={styles.list}>
        <div><dt>{t.what.heading}</dt><dd>{t.what.text}</dd></div>
        <div><dt>{t.when.heading}</dt><dd>{t.when.text}</dd></div>
        <div>
          <dt>{t.rhythm.heading}</dt>
          <dd>{t.rhythm.text}</dd>
          <dd><Checkbox label={t.rhythm.toggle} checked={checked} onChange={() => change(!checked)} /></dd>
        </div>
        <div><dt>{t.not.heading}</dt><dd>{t.not.text}</dd></div>
        <div><dt>{t.who.heading}</dt><dd>{t.who.text}</dd></div>
      </dl>
      <p className={styles.note}>{t.note}</p>
    </div>
  );
}
