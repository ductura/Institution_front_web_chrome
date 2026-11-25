"use client";

// ED-16 (NF2-P14): mounted with the work's session controls, where the document is known. It answers
// the "Povijest i usporedba" request of every entry (header, view menu, Ctrl+K, left panel) with the
// one dialog, over the real time-machine port and the shared comparison client.
import { useEffect, useMemo, useState } from "react";

import { createApi } from "../../../../../../src/client/api.ts";
import { WORK_HISTORY_EVENT } from "../../../../../../src/components/editor/commands/work-history-event.ts";
import type { ComparisonApi } from "../../../../../../src/components/editor/diff/comparison-read.ts";
import { clientTimeMachinePort } from "../../student/time-machine/client-port";
import type { TimeMachinePort } from "../../student/time-machine/model";
import { WorkHistoryDialog } from "./WorkHistoryDialog";

export type WorkHistoryHostProps = {
  readonly documentId: string;
  readonly replayHref: string;
  readonly port?: TimeMachinePort;
  readonly client?: ComparisonApi;
};

export function WorkHistoryHost({ documentId, replayHref, port, client }: WorkHistoryHostProps) {
  const [open, setOpen] = useState(false);
  const realPort = useMemo(() => port ?? clientTimeMachinePort(), [port]);
  const realClient = useMemo(() => client ?? (createApi() as unknown as ComparisonApi), [client]);
  useEffect(() => {
    const asked = (event: Event) => {
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener(WORK_HISTORY_EVENT, asked);
    return () => document.removeEventListener(WORK_HISTORY_EVENT, asked);
  }, []);
  if (documentId === "") return null;
  return <WorkHistoryDialog open={open} onClose={() => setOpen(false)} documentId={documentId}
    port={realPort} client={realClient} replayHref={replayHref} />;
}
