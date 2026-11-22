"use client";

import { useEffect, useState } from "react";
import { Button, DataTable, type DataTableColumn } from "@ductura/ui";

import type { HistoryCall, HistoryEvent, HistoryRead } from "./contract";
import { readSubmissionHistory } from "./contract";
import { historyText as t } from "./messages.hr";
import { eventText, eventTime, failureMessage, newestFirst } from "./model";

/**
 * The teacher's history of one student's work on an assignment: each submission and each
 * withdrawal with its attempt, revision and record time (WEB-1903; P-D3; LOK-WEB-21). Read only.
 */
export default function SubmissionHistory(
  { call, assignmentId, studentId }: { call: HistoryCall; assignmentId: string; studentId: string },
) {
  const key = `${assignmentId}/${studentId}`;
  const [state, setState] = useState<{ key: string; read: HistoryRead } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const read = state?.key === key ? state.read : null;

  useEffect(() => {
    let live = true;
    void readSubmissionHistory(call, assignmentId, studentId)
      .then((next) => { if (live) setState({ key, read: next }); })
      .catch(() => { if (live) setState({ key, read: { kind: "nepoznato" } }); });
    return () => { live = false; };
  }, [call, assignmentId, studentId, key, attempt]);

  const columns: readonly DataTableColumn<HistoryEvent>[] = [
    { id: "event", header: t.event, rowHeader: true, cell: eventText },
    { id: "attempt", header: t.attempt, numeric: true, cell: (e) => e.attempt, sortValue: (e) => e.attempt },
    { id: "revision", header: t.revision, numeric: true, cell: (e) => e.revision, sortValue: (e) => e.revision },
    { id: "time", header: t.time, cell: eventTime, sortValue: (e) => e.at },
  ];

  if (read !== null && read.kind !== "ready") {
    return (
      <div>
        <p role="alert">{failureMessage(read)}</p>
        <Button tone="quiet" onClick={() => { setState(null); setAttempt((n) => n + 1); }}>{t.retry}</Button>
      </div>
    );
  }
  return (
    <section aria-labelledby="submission-history-h">
      <h2 id="submission-history-h">{t.title}</h2>
      <DataTable caption={t.caption} columns={columns} rows={read === null ? [] : newestFirst(read.events)} rowKey={(e) => e.id}
        empty={t.empty} loading={read === null} loadingLabel={t.loading} />
    </section>
  );
}
