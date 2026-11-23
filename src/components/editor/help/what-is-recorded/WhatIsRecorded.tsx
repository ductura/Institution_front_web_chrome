"use client";

import { useMemo } from "react";

import { createRhythmPort, type RhythmPort } from "../../../../client/input-rhythm";
import { RhythmSetting } from "../../rhythm/RhythmSetting";
import { inputRhythmHr, whatIsRecordedHr as t } from "../../../../lib/i18n/messages.hr";
import styles from "./WhatIsRecorded.module.css";

type Props = {
  /** The work whose rhythm setting is shown; without it the setting is not available. */
  documentId?: string;
  /** Where the setting is read and the rhythm deleted; the server (createRhythmPort) by default, the fake in tests. */
  port?: RhythmPort;
};

export function WhatIsRecorded({ documentId, port }: Props) {
  const server = useMemo(() => port ?? createRhythmPort(), [port]);
  return (
    <div className={styles.root} data-testid="what-is-recorded">
      <dl className={styles.list}>
        <div><dt>{t.what.heading}</dt><dd>{t.what.text}</dd></div>
        <div><dt>{t.when.heading}</dt><dd>{t.when.text}</dd></div>
        <div>
          <dt>{t.rhythm.heading}</dt>
          <dd>{t.rhythm.text}</dd>
          <dd>{documentId === undefined
            ? <p data-testid="rhythm-setting-unknown">{inputRhythmHr.unknown}</p>
            : <RhythmSetting port={server} documentId={documentId} />}</dd>
        </div>
        <div><dt>{t.not.heading}</dt><dd>{t.not.text}</dd></div>
        <div><dt>{t.who.heading}</dt><dd>{t.who.text}</dd></div>
      </dl>
      <p className={styles.note}>{t.note}</p>
    </div>
  );
}
