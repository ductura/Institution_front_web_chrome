"use client";

import { StudentDataExportList, StudentDataExportRequest, formatDateTime, type StudentDataExportListState } from "@ductura/ui";
import { useCallback, useEffect, useState } from "react";

import {
  approveStudentDataExport, listStudentDataExports, requestStudentDataExport, studentDataExportCall,
  type ApproveOutcome, type RequestInput, type RequestOutcome,
} from "@/client/student-data-export";
import type { StudentDataExportCall } from "@/client/api";

import { useHost } from "../../context";
import { studentDataExportMessages as t } from "./messages.hr";

type Refused = Exclude<RequestOutcome["kind"] | ApproveOutcome["kind"], "ok">;

/** The catalogue text for an answer: the page never shows a raw server code. */
export const say = (kind: Refused): string => ({
  signedOut: t.errors.unauthorized, denied: t.errors.forbidden, unavailable: t.errors.unavailable, invalid: t.errors.invalid,
  notFound: t.errors.notFound, exists: t.errors.exists, stale: t.errors.stale,
})[kind];

function AdminList({ call }: { call: StudentDataExportCall }) {
  const [state, setState] = useState<StudentDataExportListState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const [note, setNote] = useState("");

  const read = useCallback(async () => {
    const out = await listStudentDataExports(call);
    setState(out.kind === "ok"
      ? {
        kind: "ready",
        exports: out.exports.map((e) => ({
          exportId: e.exportId, state: e.state,
          requestedAt: formatDateTime(e.requestedAt, "hr"),
          expiresAt: e.expiresAt === null ? null : formatDateTime(e.expiresAt, "hr"),
        })),
      }
      : { kind: "error", message: say(out.kind) });
  }, [call]);
  const load = useCallback(() => {
    setState({ kind: "loading" });
    void read();
  }, [read]);
  useEffect(load, [load]);

  const approve = async (exportId: string, reference: string) => {
    setBusy(true);
    setActionError(undefined);
    setNote("");
    const out = await approveStudentDataExport(exportId, reference, call);
    if (out.kind === "ok") setNote(t.approved);
    else setActionError(say(out.kind));
    // An ok answer changed the list and a stale one means it is out of date: read it again either way.
    if (out.kind === "ok" || out.kind === "stale") await read();
    setBusy(false);
  };

  return (
    <>
      <StudentDataExportList
        labels={t.labels} state={state} busy={busy} actionError={actionError}
        onApprove={(id, reference) => { void approve(id, reference); }} onRetry={load}
      />
      <p role="status">{note}</p>
    </>
  );
}

function RequestForm({ call }: { call: StudentDataExportCall }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const [note, setNote] = useState("");

  const request = async (input: RequestInput) => {
    setBusy(true);
    setActionError(undefined);
    setNote("");
    const out = await requestStudentDataExport(input, call);
    if (out.kind === "ok") setNote(t.requested);
    else setActionError(say(out.kind));
    setBusy(false);
  };

  return (
    <>
      <StudentDataExportRequest
        labels={t.labels} busy={busy} actionError={actionError}
        onRequest={(input) => { void request(input); }}
      />
      <p role="status">{note}</p>
    </>
  );
}

/**
 * /ustanova/izvoz-podataka (WEB-1302; SRV-1308): the institution administrator sees the requests
 * and starts an export with a reference; everyone else signed in sees the registry office's
 * request form. The server decides who may do what (403 is shown as the catalogue text). Reads
 * and writes go only through src/client.
 */
export default function StudentDataExportPage({ call = studentDataExportCall() }: { call?: StudentDataExportCall }) {
  const { page, role } = useHost();
  return (
    <section className="page" data-role={role ?? undefined}>
      <h1>{page.label}</h1>
      {role === "admin" ? <AdminList call={call} /> : <RequestForm call={call} />}
    </section>
  );
}
