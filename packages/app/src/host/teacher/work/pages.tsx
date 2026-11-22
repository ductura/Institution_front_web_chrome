"use client";

import { Button } from "@ductura/ui";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { goToSignIn } from "@/client/api";
import { watchSessionEnd } from "@/client/session-end";
import type { SessionMark } from "@/client/session-marks";
import { readTeacherWorkAccess, readTeacherWorkReceipt } from "@/client/teacher-work";
import { ReadOnlyMentor } from "@/components/editor/mentor/work-state/ReadOnlyMentor";
import { ReceiptPanel, studentReceiptRead, type ReceiptRead } from "@/components/predaja/ReceiptPanel";
import ReplayView from "@/components/replay/ReplayView";
import { appHref } from "@/components/shell/nav";
import { anchorForSelection, placeAnchor, placeThreads } from "@/components/teacher/comment-place";
import { ConsultationRecords } from "@/components/teacher/consultation-records/ConsultationRecords";
import { consultationMessages } from "@/components/teacher/consultation-records/messages.hr";
import LiveText, { liveStopped, openMarks, useLiveView } from "@/components/teacher/LiveText";
import { liveWorkHref, SUMMARY_ANCHOR } from "@/components/teacher/LiveWorkFrame";
import RecordLimits from "@/components/teacher/RecordLimits";
import { selectedRange, selectInBlock } from "@/components/teacher/selection";
import { SummaryCardBody, useProcessSummary } from "@/components/teacher/SummaryCard";
import { useComments } from "@/components/teacher/TeacherComments";
import TeacherComments from "../comments/TeacherCommentsPanel";
import type { TextAnchor } from "@/domain/collaboration";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import { hostText } from "../../../text";
import { useHost } from "../../context";
import AiDeclarationSection from "../ai-declaration/AiDeclarationSection";
import MobileReview from "../mobile-review/MobileReview";
import WorkFrame from "../n06/WorkFrame";
import { useTeacherRead } from "../../pages";
import { teacherWorkMessages as workText } from "./messages.hr";

const VIEWS = {
  live: { suffix: "", title: t.liveView.context },
  replay: { suffix: "/reprodukcija", title: t.replay.titleTeacher },
  receipt: { suffix: "/predaja", title: t.receipt.title },
  consultations: { suffix: "/konzultacije", title: consultationMessages.title },
} as const;

type View = keyof typeof VIEWS;

function WorkStatus({ title, children }: { title: string; children: ReactNode }) {
  return <div className="page"><h1>{title}</h1>{children}</div>;
}

export function TeacherWorkPage({ documentId, view }: { documentId: string; view: View }) {
  const path = liveWorkHref(documentId);
  const title = VIEWS[view].title;
  if (path === null) return <WorkStatus title={title}><p role="status">{t.liveView.invalid}</p></WorkStatus>;
  return <Access key={`${view}:${path}`} documentId={documentId} path={path} view={view} />;
}

function Access({ documentId, path, view }: { documentId: string; path: string; view: View }) {
  const { base } = useHost();
  const [access, retry] = useTeacherRead<SessionMark>(base, () => readTeacherWorkAccess());
  const title = VIEWS[view].title;
  if (access?.kind === "ready") return <OpenWork documentId={documentId} path={path} view={view} session={access.value} />;
  return (
    <WorkStatus title={title}>
      {access?.kind === "unavailable" ? (
        <>
          <p role="alert">{workText.unavailable}</p>
          <Button onClick={retry}>{t.teacherLiveWork.retry}</Button>
        </>
      ) : <p role="status">{access?.kind === "signedOut" ? hostText.signingIn
        : access?.kind === "notTeacher" ? t.teacher.signedOut : workText.loading}</p>}
    </WorkStatus>
  );
}

function OpenWork({ documentId, path, view, session }: {
  documentId: string; path: string; view: View; session: SessionMark;
}) {
  const { base } = useHost();
  const [ended, setEnded] = useState(false);
  const watch = useRef<ReturnType<typeof watchSessionEnd> | null>(null);
  useLayoutEffect(() => {
    const listener = watchSessionEnd(session, () => setEnded(true));
    watch.current = listener;
    return () => { watch.current = null; listener.close(); };
  }, [session]);
  const current = useCallback(() => watch.current?.ended() === false, []);

  const title = VIEWS[view].title;
  const workHref = appHref(base, path);
  if (ended) return <WorkStatus title={title}><p role="status">{t.liveView.connection.signedOut}</p></WorkStatus>;
  if (view === "consultations") {
    // ConsultationRecords uses Next Link and router, which supply basePath themselves.
    return <ConsultationRecords key={documentId} documentId={documentId} workHref={workHref.slice("/app".length)} />;
  }
  if (view === "receipt") {
    return <Receipt documentId={documentId} workHref={workHref} current={current} />;
  }
  if (view === "replay") {
    return (
      <WorkStatus title={title}>
        <p><a href={workHref}>{consultationMessages.backToWork}</a></p>
        <ReplayView documentId={documentId} session={session} student={false} />
      </WorkStatus>
    );
  }
  return <LiveWork documentId={documentId} workHref={workHref} session={session} />;
}

function LiveWork({ documentId, workHref, session }: { documentId: string; workHref: string; session: SessionMark }) {
  const { view, current } = useLiveView(documentId, session);
  const stopped = liveStopped(view);
  const summary = useProcessSummary(documentId, current, !stopped);
  const comments = useComments(documentId, current, !stopped);
  const textRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<TextAnchor | null>(null);
  const placed = stopped || comments.outcome?.kind !== "ok" ? [] : placeThreads(view.document, comments.outcome.threads);
  const gaps = !stopped && summary.outcome?.kind === "ok" ? summary.outcome.summary.gaps.items : [];
  const receiptHref = `${workHref}${VIEWS.receipt.suffix}`;
  const select = () => {
    const root = textRef.current;
    const range = root && selectedRange(root, window.getSelection());
    if (view.document && range) setDraft(anchorForSelection(view.document, range.nodeId, range.start, range.end));
  };

  return (
    <MobileReview><div className="page">
      <WorkFrame documentId={documentId} gaps={gaps}
        text={<>
          {view.connection === "retrying" && view.document === null && <p role="alert">{workText.liveUnavailable}</p>}
          <LiveText view={view} marks={openMarks(placed)} textRef={textRef} onSelect={select} />
          {!stopped && <ul>
            <li><a href={receiptHref}>{VIEWS.receipt.title}</a></li>
            <li><a href={`${workHref}${VIEWS.replay.suffix}`}>{VIEWS.replay.title}</a></li>
            <li><a href={`${workHref}${VIEWS.consultations.suffix}`}>{VIEWS.consultations.title}</a></li>
          </ul>}
        </>}
        aside={<>
          {!stopped && <>
            <ReadOnlyMentor documentId={documentId} role="teacher" receiptHref={receiptHref} />
            <TeacherComments documentId={documentId} outcome={comments.outcome} placed={placed}
              nodeOrder={view.document?.nodes ?? []} current={current} readOnly={view.document === null}
              draft={placeAnchor(view.document, draft) ? draft : null} onDraftDone={() => setDraft(null)}
              onReload={() => void comments.load()} onShow={({ nodeId, start, end }) => {
                if (textRef.current) selectInBlock(textRef.current, nodeId, start, end);
              }} />
            <SummaryCardBody outcome={summary.outcome} onReload={() => void summary.load()} />
          </>}
          <RecordLimits />
        </>} />
    </div></MobileReview>
  );
}

function Receipt({ documentId, workHref, current }: { documentId: string; workHref: string; current: () => boolean }) {
  const here = `${workHref}${VIEWS.receipt.suffix}`;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof readTeacherWorkReceipt>> | null>(null);
  useEffect(() => {
    let active = true;
    void readTeacherWorkReceipt(documentId, () => active && current()).then((read) => {
      if (!active || !current()) return;
      if (read.kind === "signedOut") goToSignIn(here);
      setResult(read);
    });
    return () => { active = false; };
  }, [documentId, here, attempt, current]);

  const retry = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (link?.getAttribute("href") !== here) return;
    event.preventDefault();
    setResult(null);
    setAttempt((n) => n + 1);
  };
  const read: ReceiptRead = result === null || result.kind === "signedOut" ? { kind: "loading" }
    : result.kind === "ready" ? studentReceiptRead(result.submission, result.state === "nije_predano" ? "open" : "submitted")
      : { kind: "error" };
  return (
    <WorkStatus title={VIEWS.receipt.title}>
      <p><a href={workHref}>{consultationMessages.backToWork}</a></p>
      {result?.kind === "ready" && result.studentName && <p>{result.studentName}</p>}
      {result?.kind === "notFound" ? <p role="alert">{t.liveView.connection.notFound}</p> : (
        <div onClick={retry}>
          <ReceiptPanel read={read} retryHref={here} summaryHref={`${workHref}#${SUMMARY_ANCHOR}`} />
        </div>
      )}
      {result?.kind === "ready" && <AiDeclarationSection submissionId={documentId} />}
    </WorkStatus>
  );
}
