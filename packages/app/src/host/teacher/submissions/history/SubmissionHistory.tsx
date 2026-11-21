"use client";

import { useEffect, useState } from "react";
import { Button, DataTable, type DataTableColumn } from "@ductura/ui";

import type { HistoryCall, HistoryEvent, HistoryRead } from "./contract";
import { readSubmissionHistory } from "./contract";
import { historyText as t } from "./messages.hr";
import { eventText, eventTime, failureMessage, newestFirst } from "./model";

/**
 * The teacher's history of one assignment: each submission and each withdrawal with the student,
 * revision and record minute (WEB-1903; P-D3). Read only. TODO(ugovor): the contract names no
 * student, so the caller may pass names it already holds.
 */
export default function SubmissionHistory(
  { call, assignmentId, names = {} }: { call: HistoryCall; assignmentId: string; names?: Readonly<Record<string, string>> },
) {
  const [state, setState] = useState<{ assignmentId: string; read: HistoryRead } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const read = state?.assignmentId === assignmentId ? state.read : null;
  const nameOf = (event: HistoryEvent) => names[event.studentId] ?? event.studentId;

  useEffect(() => {
    let live = true;
    void readSubmissionHistory(call, assignmentId)
      .then((next) => { if (live) setState({ assignmentId, read: next }); })
      .catch(() => { if (live) setState({ assignmentId, read: { kind: "nepoznato" } }); });
    return () => { live = false; };
  }, [call, assignmentId, attempt]);

  const columns: readonly DataTableColumn<HistoryEvent>[] = [
    { id: "student", header: t.student, rowHeader: true, cell: nameOf, sortValue: nameOf },
    { id: "event", header: t.event, cell: eventText },
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
      <DataTable caption={t.caption} columns={columns} rows={read === null ? [] : newestFirst(read.events)} rowKey={(e) => e.eventId}
        empty={t.empty} loading={read === null} loadingLabel={t.loading} />
    </section>
  );
}
