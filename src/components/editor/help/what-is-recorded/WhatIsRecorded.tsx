"use client";

import { useMemo } from "react";

import { createFakeRhythmPort } from "@/client/input-rhythm-fake";
import type { RhythmPort } from "@/client/input-rhythm";
import { RhythmSetting } from "../../rhythm";
import { whatIsRecordedHr as t } from "../../../../lib/i18n/messages.hr";
import styles from "./WhatIsRecorded.module.css";

type Props = {
  /** Where the rhythm setting of the work is read from; the fake adapter until SRV-0910. */
  port?: RhythmPort;
  documentId?: string;
  /** Only a teacher changes the rhythm setting (P-1); a student sees it read-only. */
  canChange?: boolean;
  onChange?: (on: boolean) => void;
};

export function WhatIsRecorded({ port, documentId = "current", canChange = false, onChange }: Props) {
  const fallback = useMemo(() => createFakeRhythmPort(), []);
  return (
    <div className={styles.root} data-testid="what-is-recorded">
      <dl className={styles.list}>
        <div><dt>{t.what.heading}</dt><dd>{t.what.text}</dd></div>
        <div><dt>{t.when.heading}</dt><dd>{t.when.text}</dd></div>
        <div>
          <dt>{t.rhythm.heading}</dt>
          <dd>{t.rhythm.text}</dd>
          <dd><RhythmSetting port={port ?? fallback} documentId={documentId} canChange={canChange} onChange={onChange} /></dd>
        </div>
        <div><dt>{t.not.heading}</dt><dd>{t.not.text}</dd></div>
        <div><dt>{t.who.heading}</dt><dd>{t.who.text}</dd></div>
      </dl>
      <p className={styles.note}>{t.note}</p>
    </div>
  );
}
