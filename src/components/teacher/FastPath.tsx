"use client";

import { Button, PanelTabs } from "@ductura/ui";
import Link from "next/link";
import { createElement as h, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { browserTransport, signInHref as loginHref } from "@/client/api";
import { listRevisionRequests, type RevisionListOutcome } from "@/client/revision-requests";
import { watchSessionEnd, type SessionWatch } from "@/client/session-end";
import type { SessionMark } from "@/client/session-marks";
import RevisionLog from "@/components/editor/revision/RevisionLog";
import { revisionLog } from "@/components/editor/revision/revision-log";
import { ProcessSummaryView } from "@/components/summary/ProcessSummaryView";
import { messagesHr } from "@/lib/i18n/messages.hr";

import styles from "./FastPath.module.css";
import { liveWorkHref, SUMMARY_ANCHOR } from "./LiveWorkFrame";
import { readSessionMark } from "./LiveWorkView";
import {
  bySurname,
  fastPathLines,
  fullName,
  textRuns,
  whenText,
  type FastPathLoad,
  type FastPathRecord,
  type FastPathStudent,
  type WorkState,
} from "./fast-path";
import controls from "./fast-path/controls.module.css";
import { fastPathControlsHr } from "./fast-path/messages.hr";
import { startFastPathReader } from "./fast-path/read";

const t = { ...messagesHr.fastPath, ...fastPathControlsHr };

/**
 * Screen 11, the teacher's fast path (F-11, D-80 point 2; design demo-tok-v2
 * step 5). Students by surname on the left; for the chosen one the lines,
 * the state of the record, and either the text or the process summary.
 *
 * It reads the work and separate revision request records. The summary is
 * the student's own component (PRODUCT §5 rule 5).
 *
 * Written with `createElement`, not JSX, so the unit tests can render it.
 */
type RevisionAccess = { current: () => boolean; onSignedOut: () => void };
export type FastPathProps = {
  readonly load: FastPathLoad;
  readonly signInHref?: string;
  readonly revisions?: RevisionAccess;
};

export function FastPath({ load, signInHref = loginHref(), revisions }: FastPathProps) {
  if (load.state === "loading") return h("p", { className: styles.state, role: "status" }, t.loading);
  if (load.state === "unavailable") return h("p", { className: styles.state, role: "alert" }, t.unavailable);
  if (load.state === "signedOut") {
    // An OIDC login: a real navigation, not a prefetchable Link.
    return h("p", { className: styles.state, role: "status" }, messagesHr.teacher.signedOut, " ", h("a", { href: signInHref }, messagesHr.teacher.signIn));
  }
  if (load.state === "pickAssignment") {
    return h("p", { className: styles.state }, t.pickAssignment, " ", h(Link, { href: "/nastavnik" }, messagesHr.home.openTeacher));
  }
  return h(
    "div",
    null,
    load.stale
      ? h("p", { className: styles.note, role: "status" }, t.stale)
      : h("p", { className: styles.note }, t.refresh),
    // A foreign, a missing and an empty assignment look the same (#757 invariant 4).
    load.students.length === 0
      ? h("p", { className: styles.state }, t.empty)
      : h(Roster, { students: bySurname(load.students), revisions }),
  );
}

/**
 * The fast path of one assignment, read from the route at most once per
 * P-03. Once the session of the page ends in this browser, nothing more is
 * sent and the names and texts leave the screen (F-093, D-118).
 */
export function FastPathLive({ assignmentId }: { readonly assignmentId: string | null }) {
  return assignmentId === null ? h(FastPath, { load: { state: "pickAssignment" } })
    : h(FastPathSession, { key: assignmentId, assignmentId });
}

function FastPathSession({ assignmentId }: { readonly assignmentId: string }) {
  const [session, setSession] = useState<SessionMark | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void readSessionMark().then((mark) => { if (active) setSession(mark); });
    return () => { active = false; };
  }, [attempt]);
  if (session === undefined) return h(FastPath, { load: { state: "loading" } });
  if (session === null) {
    const retry = () => { setSession(undefined); setAttempt((n) => n + 1); };
    return h("div", null, h(FastPath, { load: { state: "unavailable" } }), h(Button, { onClick: retry }, t.retry));
  }
  return h(AssignmentFastPath, { assignmentId, session });
}

function AssignmentFastPath({ assignmentId, session }: {
  readonly assignmentId: string; readonly session: SessionMark;
}) {
  const [load, setLoad] = useState<FastPathLoad>({ state: "loading" });
  const [ended, setEnded] = useState(false);
  const watchRef = useRef<SessionWatch | null>(null);
  const { tag, at } = session;
  const end = useCallback(() => setEnded(true), []);
  useLayoutEffect(() => {
    const watch = watchSessionEnd({ tag, at }, end);
    watchRef.current = watch;
    return () => {
      watch.close();
      if (watchRef.current === watch) watchRef.current = null;
    };
  }, [tag, at, end]);
  const current = useCallback(() => !ended && watchRef.current?.ended() === false, [ended]);
  useEffect(() => {
    if (ended) return;
    return startFastPathReader({ assignmentId, onChange: (next) => {
      if (next.state === "signedOut") end();
      else setLoad(next);
    }, current });
  }, [assignmentId, current, end, ended]);
  return h(FastPath, {
    load: ended ? { state: "signedOut" } : load,
    signInHref: loginHref(`/nastavnik/brz-put?zadatak=${encodeURIComponent(assignmentId)}`),
    revisions: { current, onSignedOut: end },
  });
}

function Roster({ students, revisions }: { readonly students: readonly FastPathStudent[]; revisions?: RevisionAccess }) {
  const [selectedId, setSelectedId] = useState(students[0]!.id);
  // The chosen student stays chosen through a refresh while still on the list.
  const index = Math.max(0, students.findIndex((s) => s.id === selectedId));
  const current = students[index]!;
  const href = liveWorkHref(current.documentId);
  const step = (student: FastPathStudent | undefined, label: string) => h(Button, {
    tone: "quiet", disabled: student === undefined,
    onClick: () => { if (student) setSelectedId(student.id); },
  }, label);

  return h(
    "div",
    { className: styles.layout },
    h(
      "nav",
      { className: styles.students, "aria-label": t.studentsLabel },
      h("h2", { className: styles.navTitle }, t.studentsTitle),
      h(
        "ul",
        { className: styles.list },
        students.map((s) =>
          h(
            "li",
            { key: s.id },
            h(
              Button,
              {
                tone: "quiet",
                className: styles.student,
                "aria-current": s.id === current.id ? "true" : undefined,
                onClick: () => setSelectedId(s.id),
              },
              h("span", { className: styles.name }, fullName(s)),
              workState(s.work),
              h("span", { className: styles.meta }, whenText(s.lastChangeAt)),
            ),
          ),
        ),
      ),
      h("p", { className: styles.orderNote }, t.orderNote),
    ),
    h(
      "section",
      { className: styles.work, "aria-labelledby": "brz-put-student" },
      h(
        "div",
        { className: styles.head },
        h("h2", { id: "brz-put-student", className: styles.studentName }, fullName(current)),
        workState(current.work),
      ),
      current.record
        ? h(Record, { student: current, record: current.record, href })
        : h("p", { className: styles.state }, t.noRecordYet),
      h("div", { className: controls.actions },
        step(students[index - 1], t.previous),
        step(students[index + 1], t.next),
        href && h(Link, { href, prefetch: false }, t.openWork),
      ),
      revisions && href && current.documentId && current.record && h(RevisionPreview, {
        key: current.documentId, documentId: current.documentId, record: current.record,
        current: revisions.current, onSignedOut: revisions.onSignedOut,
      }),
    ),
  );
}

/**
 * #732 item 17: the state of a work, with a dot in its token colour before the
 * word. The word carries the meaning; the dot only helps the eye find it. It is
 * drawn by CSS (`::before`, empty content), so it adds no element and no text for
 * assistive technology. The list stays in surname order (D-80).
 */
function workState(work: WorkState) {
  return h("span", { className: `${styles.meta} ${styles.dot}`, "data-work": work }, t.work[work]);
}

type RecordProps = {
  readonly student: FastPathStudent;
  readonly record: FastPathRecord;
  readonly href: string | null;
};

function Record({ student, record, href }: RecordProps) {
  const lines = fastPathLines(student, record);
  const text = h(
    "article",
    { className: styles.text, "aria-label": t.textLabel },
    textRuns(record.blocks).map((run, i): ReactNode => {
      if (run.kind === "heading") return h("h3", { key: i, className: styles.blockHeading }, run.texts[0]);
      const paragraphs = run.texts.map((text, j) => h(run.kind === "bulletItem" ? "li" : "p", { key: j }, text));
      const body = run.kind === "bulletItem" ? h("ul", null, paragraphs) : run.kind === "quote" ? h("blockquote", null, paragraphs) : paragraphs;
      return h("div", { key: i, className: styles.block }, body);
    }),
  );
  return h(
    "div",
    { className: styles.record },
    h(
      "dl",
      { className: styles.lines },
      lines.flatMap((line) => [
        h("dt", { key: `${line.key}-k` }, line.label),
        h("dd", { key: `${line.key}-v`, "data-line": line.key }, line.value),
      ]),
    ),
    h(PanelTabs, { label: t.viewLabel, tabs: [
      { id: "text", label: t.views.text, content: text },
      { id: "summary", label: t.views.summary, content: h("div", null,
        h(ProcessSummaryView, { summary: record.summary }),
        href && h(Link, { href: `${href}#${SUMMARY_ANCHOR}`, prefetch: false }, t.openSummary),
      ) },
    ] }),
  );
}

function RevisionPreview({ documentId, record, current, onSignedOut }: RevisionAccess & {
  documentId: string; record: FastPathRecord;
}) {
  const [outcome, setOutcome] = useState<RevisionListOutcome | null>(null);
  useEffect(() => {
    let active = true;
    const reading = () => active && current();
    void listRevisionRequests(documentId, reading, { fetchImpl: browserTransport }).then((result) => {
      if (!reading()) return;
      if (result.kind === "signedOut") onSignedOut();
      else setOutcome(result);
    });
    return () => { active = false; };
  }, [documentId, record, current, onSignedOut]);

  if (outcome === null) return h("p", { role: "status" }, t.revisionsLoading);
  if (outcome.kind !== "ok") return h("p", { role: "status" }, t.revisionsUnavailable);
  const awaiting = outcome.requests.some((request) => request.state === "responded"
    && request.versions.at(-1)?.response?.kind === "done");
  return h("div", null,
    awaiting && h("p", { className: controls.round, role: "status" }, t.revisionReady),
    h(RevisionLog, { entries: revisionLog(outcome.requests) }),
  );
}
