"use client";

// PIL-D7-POVIJEST: the "Povijest dokumenta" entry of the editor's left panel. The student's saved
// versions and the text of the chosen one (read only), then the comparison of two versions; both
// through the real port on src/client/time-machine.ts.
import { useMemo } from "react";

import { clientTimeMachinePort } from "../../student/time-machine/client-port";
import TimeMachine from "../../student/time-machine/TimeMachine";
import VersionHistory from "../../student/time-machine/VersionHistory";
import type { TimeMachinePort } from "../../student/time-machine/model";
import styles from "./Left.module.css";

export function HistorySection({ documentId, port }: { documentId: string; port?: TimeMachinePort }) {
  const real = useMemo(() => port ?? clientTimeMachinePort(), [port]);
  return (
    <div className={styles.stack}>
      <VersionHistory documentId={documentId} port={real} />
      <TimeMachine documentId={documentId} port={real} />
    </div>
  );
}
