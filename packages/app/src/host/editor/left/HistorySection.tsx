"use client";

// PIL-D7-POVIJEST: the "Povijest dokumenta" entry of the editor's left panel. The student's saved
// versions and the text of the chosen one (read only), then the comparison of two versions; both
// through the real port on src/client/time-machine.ts. PIL-D7-OBNOVA: "Vrati raniju verziju" below
// them saves the chosen text through the editor's own save path; the list is read again after it.
import { useMemo, useState } from "react";

import { clientTimeMachinePort } from "../../student/time-machine/client-port";
import RestoreHost from "../../student/document-history/restore/RestoreHost";
import TimeMachine from "../../student/time-machine/TimeMachine";
import VersionHistory from "../../student/time-machine/VersionHistory";
import type { TimeMachinePort } from "../../student/time-machine/model";
import styles from "./Left.module.css";

export function HistorySection({ documentId, port }: { documentId: string; port?: TimeMachinePort }) {
  const real = useMemo(() => port ?? clientTimeMachinePort(), [port]);
  const [round, setRound] = useState(0);
  return (
    <div className={styles.stack}>
      <VersionHistory key={round} documentId={documentId} port={real} />
      <RestoreHost key={documentId} documentId={documentId} history={real} onRestored={() => setRound((n) => n + 1)} />
      <TimeMachine documentId={documentId} port={real} />
    </div>
  );
}
