"use client";

import { StudentDataExportList, StudentDataExportRequest, formatDateTime, type StudentDataExportListState } from "@ductura/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  approveStudentDataExport, listStudentDataExports, requestStudentDataExport, studentDataExportCall,
  type ApproveOutcome, type RequestInput, type RequestOutcome, type StudentDataExportCall,
} from "@/client/student-data-export";

import { useHost } from "../../context";
import { openRequests, type OpenRequests } from "./duplicate";
import { studentDataExportMessages as t } from "./messages.hr";

type Refused = Exclude<RequestOutcome["kind"] | ApproveOutcome["kind"], "ok">;

/** The catalogue text for an answer: the page never shows a raw server code. */
export const say = (kind: Refused): string => ({
  signedOut: t.errors.unauthorized, denied: t.errors.forbidden, unavailable: t.errors.unavailable, invalid: t.errors.invalid,
  notFound: t.errors.notFound, exists: t.errors.exists, stale: t.errors.stale,
})[kind];

function AdminList({ call, refresh }: { call: StudentDataExportCall; refresh: number }) {
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
  // `refresh` grows when a request was recorded on this page: the list is read again.
  useEffect(load, [load, refresh]);

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
      <p>{t.statesNote}</p>
      <p role="status">{note}</p>
    </>
  );
}

type RequestFormProps = { call: StudentDataExportCall; open: OpenRequests; onRecorded?: () => void };

function RequestForm({ call, open, onRecorded }: RequestFormProps) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const [note, setNote] = useState("");

  const request = async (input: RequestInput) => {
    setBusy(true);
    setActionError(undefined);
    setNote("");
    // NF-7 OA-6: a student this page already sent a request for is refused before anything is sent.
    if (open.has(input.studentId)) {
      setActionError(say("exists"));
      setBusy(false);
      return;
    }
    const out = await requestStudentDataExport(input, call);
    if (out.kind === "ok" || out.kind === "exists") open.add(input.studentId);
    if (out.kind === "ok") setNote(onRecorded === undefined ? t.requested : t.recordedHere);
    else setActionError(say(out.kind));
    setBusy(false);
    if (out.kind === "ok") onRecorded?.();
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

/** NF-7 OA-6: the administrator sees the requests with their state and may record one too (prototype `izvoz`). */
function AdminView({ call }: { call: StudentDataExportCall }) {
  const open = useRef(openRequests()).current;
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <AdminList call={call} refresh={refresh} />
      <RequestForm call={call} open={open} onRecorded={() => { setRefresh((n) => n + 1); }} />
    </>
  );
}

function RegistryView({ call }: { call: StudentDataExportCall }) {
  const open = useRef(openRequests()).current;
  return <RequestForm call={call} open={open} />;
}

/**
 * /ustanova/izvoz-podataka (WEB-1302; SRV-1308; NF-7 OA-6): the institution administrator sees the
 * requests with their state, starts an export with a reference and may record a request; everyone
 * else signed in sees the registry office's request form. A second request for the same student is
 * refused on the page before sending, and the server's 409 says the same. The server decides who
 * may do what (403 is shown as the catalogue text). Reads and writes go only through src/client.
 */
export default function StudentDataExportPage({ call = studentDataExportCall() }: { call?: StudentDataExportCall }) {
  const { page, role } = useHost();
  return (
    <section className="page" data-role={role ?? undefined} data-nf7="OA-6">
      <h1>{page.label}</h1>
      {role === "admin" ? <AdminView call={call} /> : <RegistryView call={call} />}
    </section>
  );
}
