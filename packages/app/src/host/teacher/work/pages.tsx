"use client";

import { Button } from "@ductura/ui";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { goToSignIn } from "@/client/api";
import { watchSessionEnd } from "@/client/session-end";
import type { SessionMark } from "@/client/session-marks";
import { readTeacherWorkAccess, readTeacherWorkReceipt } from "@/client/teacher-work";
import { ReadOnlyMentor } from "@/components/editor/mentor/work-state/ReadOnlyMentor";
import { ReceiptPanel, studentReceiptRead, type ReceiptRead } from "@/components/predaja/ReceiptPanel";
import { appHref } from "@/components/shell/nav";
import { anchorForSelection, placeAnchor, placeThreads } from "@/components/teacher/comment-place";
import LiveText, { liveStopped, openMarks, useLiveView } from "@/components/teacher/LiveText";
import { liveWorkHref } from "@/components/teacher/LiveWorkFrame";
import RecordLimits from "@/components/teacher/RecordLimits";
import { selectedRange, selectInBlock } from "@/components/teacher/selection";
import { SummaryCardBody, useProcessSummary } from "@/components/teacher/SummaryCard";
import { useComments } from "@/components/teacher/TeacherComments";
import TeacherComments from "../comments/TeacherCommentsPanel";
import ProposalsPanel from "../proposals/ProposalsPanel";
import ProvenanceMap from "../provenance/ProvenanceMap";
import { proposalsPort } from "../proposals/port";
import type { TextAnchor } from "@/domain/collaboration";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import { hostText } from "../../../text";
import { useHost } from "../../context";
import { TeacherBibliographyHost } from "../../editor/bibliography/teacher/TeacherBibliographyHost";
import AiDeclarationSection from "../ai-declaration/AiDeclarationSection";
import MobileReview from "../mobile-review/MobileReview";
import { N12Consultations } from "../n12/N12Consultations";
import { n12Messages as consultationMessages } from "../n12/messages.hr";
import WorkFrame from "../n06/WorkFrame";
import ReplayPage from "../n09/ReplayPage";
import { FallbackPanel, PreSubmitPanel } from "../pre-submit/PreSubmitPanel";
import { showFallback } from "../pre-submit/model";
import { useTeacherRead } from "../../pages";
import N11Compare from "../n11/Compare";
import N11Entry from "../n11/Entry";
import { n11Messages } from "../n11/messages.hr";
import { n11Port } from "../n11/port";
import SummaryPage from "../n10/SummaryPage";
import { n10Messages } from "../n10/messages.hr";
import { n10Port } from "../n10/port";
import InterviewPage from "../interview/InterviewPage";
import { interviewMessages } from "../interview/messages.hr";
import { interviewPort } from "../interview/port";
import { teacherWorkMessages as workText } from "./messages.hr";

const VIEWS = {
  live: { suffix: "", title: t.liveView.context },
  replay: { suffix: "/reprodukcija", title: t.replay.titleTeacher },
  receipt: { suffix: "/predaja", title: t.receipt.title },
  consultations: { suffix: "/konzultacije", title: consultationMessages.title },
  comparison: { suffix: "/usporedba", title: n11Messages.title },
  summary: { suffix: "/sazetak", title: n10Messages.title },
  interview: { suffix: "/priprema-razgovora", title: interviewMessages.title },
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
  const summaryPort = useMemo(() => n10Port(current), [current]);

  const title = VIEWS[view].title;
  const workHref = appHref(base, path);
  if (ended) return <WorkStatus title={title}><p role="status">{t.liveView.connection.signedOut}</p></WorkStatus>;
  if (view === "consultations") {
    // N-12 (WEB-2161). The router adds the basePath itself, so it gets the path without "/app".
    return <N12Consultations key={documentId} documentId={documentId} workHref={workHref}
      appPath={`${workHref.slice("/app".length)}/konzultacije`} />;
  }
  if (view === "comparison") {
    return <N11Compare key={documentId} port={n11Port} documentId={documentId} signInHref={workHref}
      replayHref={`${workHref}${VIEWS.replay.suffix}`} />;
  }
  if (view === "summary") {
    // N-10 (WEB-2157): the summary as its own page; the origin map (N-10 br. 18) is another task.
    return <SummaryPage key={documentId} port={summaryPort} documentId={documentId} workHref={workHref}
      signInHref={`${workHref}${VIEWS.summary.suffix}`} />;
  }
  if (view === "interview") {
    // N-14 (WEB-1530): the teacher's preparation for a talk about the work.
    return <InterviewPage key={documentId} port={interviewPort} documentId={documentId} workHref={workHref}
      summaryHref={`${workHref}${VIEWS.summary.suffix}`} />;
  }
  if (view === "receipt") {
    return <Receipt documentId={documentId} workHref={workHref} current={current} />;
  }
  if (view === "replay") {
    return (
      <WorkStatus title={title}>
        <p><a href={workHref}>{consultationMessages.backToWork}</a></p>
        <ReplayPage documentId={documentId} session={session} />
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
            <N11Entry port={n11Port} documentId={documentId} href={`${workHref}${VIEWS.comparison.suffix}`} />
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
            <ProposalsPanel documentId={documentId} send={proposalsPort} current={current} />
            <TeacherBibliographyHost documentId={documentId} submitted={view.submitted} />
            <SummaryCardBody outcome={summary.outcome} onReload={() => void summary.load()} />
            <ProvenanceMap documentId={documentId} />
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
  const submitted = result?.kind === "ready" && result.state !== "nije_predano";
  const summary = useProcessSummary(documentId, current, submitted);
  const read: ReceiptRead = result === null || result.kind === "signedOut" ? { kind: "loading" }
    : result.kind === "ready" ? studentReceiptRead(result.submission, result.state === "nije_predano" ? "open" : "submitted")
      : { kind: "error" };
  return (
    <WorkStatus title={VIEWS.receipt.title}>
      <p><a href={workHref}>{consultationMessages.backToWork}</a></p>
      {result?.kind === "ready" && result.studentName && <p>{result.studentName}</p>}
      {result?.kind === "notFound" ? <p role="alert">{t.liveView.connection.notFound}</p> : (
        <div onClick={retry}>
          {submitted && <PreSubmitPanel outcome={summary.outcome} summaryHref={`${workHref}${VIEWS.summary.suffix}`}
            onReload={() => void summary.load()} />}
          <ReceiptPanel read={read} retryHref={here} summaryHref={`${workHref}${VIEWS.summary.suffix}`} />
          {submitted && showFallback(read.kind) && <FallbackPanel fallback={{ kind: "unavailable" }} />}
        </div>
      )}
      {result?.kind === "ready" && <AiDeclarationSection submissionId={documentId} />}
    </WorkStatus>
  );
}
