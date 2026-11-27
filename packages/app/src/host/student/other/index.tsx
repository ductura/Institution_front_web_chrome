"use client";

// HOST-S5 (graditelj, 21. 11. 2026.): the student's other pages in the host:
// the access log (/rad/<id>/dnevnik-pristupa) and the replay (/rad/<id>/reprodukcija), read only through src/client.
//
// The access log and the replay want the work (documentId); the contract has
// no read-only route from the assignment to it, and evidence.open.post opens
// the document, so it is never used for this (#87 c.7010793472). A submitted
// work names its document in the signed receipt (student submission read), so
// for it both pages read for real; a work in progress reads as unavailable,
// a work not started as not started. Never an empty log or player in place of
// a state.
import { notFound, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { appHref } from "../../../../../../src/components/index.ts";
import { assignmentIdOf, editorWorkRead } from "../../../../../../src/components/editor/EditorPage.read.ts";
import { withMentoredAssignments } from "../../../../../../src/components/student/mentored-assignments.ts";
import { readSubmittedWork } from "../../../../../../src/components/editor/mentor/work-state/submitted-work-read.ts";
import ReplayView from "../../../../../../src/components/replay/ReplayView.tsx";
import { pageHref, readAccessLogPage, type AccessLogCursor, type AccessLogRead } from "../access-log/read.ts";
import { AccessLogDays, AccessLogUnavailable } from "../access-log/AccessLogView.tsx";
import { browserTransport, createApi, goToSignIn } from "../../../../../../src/client/api.ts";
import type { SessionMark } from "../../../../../../src/client/session-marks.ts";
import { studentHostHr as t } from "../i18n/messages.hr.ts";
import { messagesHr as shared } from "../../../../../../src/lib/i18n/messages.hr.ts";
import { DeniedState } from "../../states/States";

import { nextPath } from "../../../bases";
import { hostText } from "../../../text";
import { useHost } from "../../context";

const NONE = { params: undefined, query: undefined, body: undefined } as const;
const UNREACHED = { ok: false, status: 0 } as const;

const workPath = (assignmentId: string) => `/rad/${encodeURIComponent(assignmentId)}`;

/** What the assignment and its work allow the two pages to read. */
export type WorkDocument =
  | { readonly kind: "invalid" }
  | { readonly kind: "notFound" }
  /** 403 from either read: not a read error (design alignment 27. 11. 2026., A3). */
  | { readonly kind: "denied" }
  | { readonly kind: "notStarted" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "document"; readonly assignmentId: string; readonly documentId: string };

/**
 * The work's document, as far as the contract gives it read-only. Signed out
 * goes to AAI@EduHr back to `suffix`; a notice not yet acknowledged comes first.
 */
export function useWorkDocument(raw: string, suffix: string): WorkDocument | null {
  const { base } = useHost();
  const router = useRouter();
  const [shown, setShown] = useState<WorkDocument | null>(null);
  useEffect(() => {
    let live = true;
    const assignmentId = assignmentIdOf(raw);
    if (assignmentId === null) {
      setShown({ kind: "invalid" });
      return;
    }
    const here = appHref(base, `${workPath(assignmentId)}/${suffix}`);
    void (async () => {
      const client = withMentoredAssignments(createApi());
      const [assignments, work] = await Promise.all([
        client("student.assignments.get", NONE).catch(() => UNREACHED),
        client("student.assignment-work.get", NONE).catch(() => UNREACHED),
      ]);
      if (!live) return;
      const read = editorWorkRead(assignmentId, assignments as never, work as never);
      if (read.kind === "signedOut") return goToSignIn(here);
      if (read.kind === "noticeFirst") return router.replace(nextPath(base, `/zadatak/${assignmentId}`));
      if (read.kind !== "ready") return setShown({ kind: read.kind });
      if (read.workState === "not_started") return setShown({ kind: "notStarted" });
      if (read.workState !== "submitted") return setShown({ kind: "unavailable" });
      const submission = await readSubmittedWork(assignmentId, { baseUrl: window.location.origin, fetchImpl: browserTransport })
        .catch(() => ({ kind: "nepoznato" as const }));
      if (!live) return;
      if (submission.kind === "session-expired") return goToSignIn(here);
      if (submission.kind !== "potvrdeno") return setShown({ kind: "unavailable" });
      setShown({ kind: "document", assignmentId, documentId: submission.receipt.payload.documentId });
    })();
    return () => {
      live = false;
    };
  }, [raw, base, suffix]);
  return shown;
}

/** A3, 403: the heading and the way back to one's own space, no further text. */
function Denied({ base }: { base: string }) {
  return <div className="page"><DeniedState title={shared.access.deniedTitle} backLabel={shared.access.backToOwn} backHref={appHref(base, "/")} /></div>;
}

function Page({ title, back, children }: { title: string; back: ReactNode; children: ReactNode }) {
  return (
    <div className="page access-log">
      <h1>{title}</h1>
      {back}
      {children}
    </div>
  );
}

/** S-42: who opened the student's work (PRODUCT §5 rule 17), a page at a time (`?prije=&zapis=`). */
export function AccessLogPage({ assignmentId: raw, cursor }: { assignmentId: string; cursor: AccessLogCursor | null }) {
  const { base } = useHost();
  const work = useWorkDocument(raw, "dnevnik-pristupa");
  const [log, setLog] = useState<AccessLogRead | null>(null);
  const documentId = work?.kind === "document" ? work.documentId : null;
  useEffect(() => {
    if (documentId === null) return;
    let live = true;
    void readAccessLogPage(createApi(), documentId, cursor)
      .catch((): AccessLogRead => ({ kind: "unavailable" }))
      .then((result) => {
        if (live) setLog(result);
      });
    return () => {
      live = false;
    };
  }, [documentId, cursor?.beforeAt, cursor?.beforeId]);

  if (work?.kind === "notFound") notFound();
  if (work?.kind === "denied") return <Denied base={base} />;
  const id = assignmentIdOf(raw);
  const here = id === null ? "" : appHref(base, `${workPath(id)}/dnevnik-pristupa`);
  if (log?.kind === "signedOut") goToSignIn(here);
  if (log?.kind === "notFound") notFound();
  const back = id === null ? null : <p><a href={appHref(base, workPath(id))}>{t.accessLog.backToWork}</a></p>;

  let body: ReactNode;
  if (work === null || (work.kind === "document" && (log === null || log.kind === "signedOut"))) {
    body = <p role="status">{t.accessLog.loading}</p>;
  } else if (work.kind === "invalid") {
    body = <p role="status">{t.accessLog.invalid}</p>;
  } else if (work.kind === "notStarted") {
    body = <p className="access-log__note" role="status">{t.accessLog.notStarted}</p>;
  } else if (work.kind !== "document" || log?.kind !== "ok") {
    body = <AccessLogUnavailable retryHref={pageHref(here, cursor)} />;
  } else {
    body = (
      <>
        <p className="access-log__note">{t.accessLog.note}</p>
        <AccessLogDays days={log.days} olderHref={log.next === null ? null : pageHref(here, log.next)}
          newestHref={cursor === null ? null : here} />
      </>
    );
  }
  return <Page title={t.accessLog.title} back={back}>{body}</Page>;
}

/** The session the replay is read under: profile.me.get's tag, at this render. */
function useSessionMark(): SessionMark | null | undefined {
  const [mark, setMark] = useState<SessionMark | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const at = Date.now();
    void createApi()("profile.me.get", NONE)
      .then((me) => (me.ok ? { tag: me.body.sessionTag, at } : null))
      .catch(() => null)
      .then((value) => {
        if (live) setMark(value);
      });
    return () => {
      live = false;
    };
  }, []);
  return mark;
}

/** S-34: the student's replay of their own work, the teacher's player (PRODUCT §5 rule 5). */
export function ReplayPage({ assignmentId: raw }: { assignmentId: string }) {
  const { base } = useHost();
  const work = useWorkDocument(raw, "reprodukcija");
  const session = useSessionMark();
  if (work?.kind === "notFound") notFound();
  if (work?.kind === "denied") return <Denied base={base} />;
  const id = assignmentIdOf(raw);
  const back = id === null ? null : <p><a href={appHref(base, workPath(id))}>{t.replay.backToWork}</a></p>;

  let body: ReactNode;
  if (work === null || (work.kind === "document" && session === undefined)) {
    body = <p role="status">{hostText.loading}</p>;
  } else if (work.kind === "invalid") {
    body = <p role="status">{t.replay.invalid}</p>;
  } else if (work.kind === "notStarted") {
    body = <p role="status">{t.replay.notStarted}</p>;
  } else if (work.kind !== "document") {
    body = <><p role="alert">{t.replay.unavailable}</p><p>{t.replay.unavailableStudent}</p></>;
  } else {
    body = <ReplayView documentId={work.documentId} session={session ?? null} student />;
  }
  return <div className="page"><h1>{t.replay.titleStudent}</h1>{back}{body}</div>;
}
