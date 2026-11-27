"use client";

import { Button } from "@ductura/ui";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { watchSessionEnd } from "@/client/session-end";
import type { SessionMark } from "@/client/session-marks";
import { readTeacherWorkAccess } from "@/client/teacher-work";
import { ReadOnlyMentor } from "@/components/editor/mentor/work-state/ReadOnlyMentor";
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
import { TextElementsView } from "../text-elements/TextElements";
import { textElementsMessages } from "../text-elements/messages.hr";
import { useTextElements } from "../text-elements/useTextElements";
import ProvenanceMap from "../provenance/ProvenanceMap";
import { proposalsPort } from "../proposals/port";
import type { TextAnchor } from "@/domain/collaboration";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import { hostText } from "../../../text";
import { useHost } from "../../context";
import { TeacherBibliographyHost } from "../../editor/bibliography/teacher/TeacherBibliographyHost";
import MobileReview from "../mobile-review/MobileReview";
import { N12Consultations } from "../n12/N12Consultations";
import { n12Messages as consultationMessages } from "../n12/messages.hr";
import WorkFrame from "../n06/WorkFrame";
import ReplayPage from "../n09/ReplayPage";
import { useTeacherRead } from "../../pages";
import N11Compare from "../n11/Compare";
import N11Entry from "../n11/Entry";
import { n11Messages } from "../n11/messages.hr";
import { n11Port } from "../n11/port";
import N07ReceiptPage from "../n07/ReceiptPage";
import SummaryPage from "../n10/SummaryPage";
import { n10Messages } from "../n10/messages.hr";
import { n10Port } from "../n10/port";
import InterviewPage from "../interview/InterviewPage";
import { interviewMessages } from "../interview/messages.hr";
import { interviewPort } from "../interview/port";
import ChangesSinceReview from "../changes-since-review/ChangesSinceReview";
import { changesPort } from "../changes-since-review/port";
import CommentBank from "../comment-bank/CommentBank";
import { commentBankPort, draftCommentsPort } from "../comment-bank/port";
import { teacherWorkMessages as workText } from "./messages.hr";
import { useShownRevision } from "./shown-revision";
import ReviewPage from "./review/ReviewPage";
import { reviewMessages } from "./review/messages.hr";
import linkStyles from "./links.module.css";

const VIEWS = {
  live: { suffix: "", title: t.liveView.context },
  replay: { suffix: "/reprodukcija", title: t.replay.titleTeacher },
  receipt: { suffix: "/predaja", title: t.receipt.title },
  consultations: { suffix: "/konzultacije", title: consultationMessages.title },
  comparison: { suffix: "/usporedba", title: n11Messages.title },
  summary: { suffix: "/sazetak", title: n10Messages.title },
  interview: { suffix: "/priprema-razgovora", title: interviewMessages.title },
  // WEB-NUZ-PG (NF-5 PG-1): one review of the work, the views as tabs.
  review: { suffix: "/pregled", title: reviewMessages.title },
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
    return <N11Compare key={documentId} port={n11Port} documentId={documentId} signInHref={workHref} workHref={workHref}
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
  if (view === "review") {
    return <ReviewPage key={documentId} documentId={documentId} current={current} />;
  }
  if (view === "receipt") {
    // N-07 "Što je student predao" (WEB-2155).
    return <N07ReceiptPage key={documentId} documentId={documentId} workHref={workHref} current={current} />;
  }
  if (view === "replay") {
    return <ReplayPage documentId={documentId} session={session} workHref={workHref} />;
  }
  return <LiveWork documentId={documentId} workHref={workHref} session={session} />;
}

function LiveWork({ documentId, workHref, session }: { documentId: string; workHref: string; session: SessionMark }) {
  const { view, current } = useLiveView(documentId, session);
  const stopped = liveStopped(view);
  const summary = useProcessSummary(documentId, current, !stopped);
  const comments = useComments(documentId, current, !stopped);
  const textRef = useRef<HTMLDivElement>(null);
  // WEB-2153: the shared reader shows only document v1; a v2/v3 text is read here, with citations and footnotes.
  const elementsState = useTextElements(documentId, !stopped && view.document === null && view.connection === "retrying", current);
  const [draft, setDraft] = useState<TextAnchor | null>(null);
  // INT-15: a new comment names the revision of the text on screen.
  const revision = useShownRevision(documentId, view.hash, view.submitted, current, !stopped && view.document !== null);
  const placed = stopped || comments.outcome?.kind !== "ok" ? [] : placeThreads(view.document, comments.outcome.threads);
  const gaps = !stopped && summary.outcome?.kind === "ok" ? summary.outcome.summary.gaps.items : [];
  const receiptHref = `${workHref}${VIEWS.receipt.suffix}`;
  const select = () => {
    const root = textRef.current;
    const range = root && selectedRange(root, window.getSelection());
    if (view.document && range) setDraft(anchorForSelection(view.document, range.nodeId, range.start, range.end));
  };

  return (
    <MobileReview>
      <WorkFrame documentId={documentId} current={current} gaps={gaps}
        shownSubmitted={!stopped && view.submitted ? view.document : null}
        text={<>
          {elementsState.elements !== null
            ? <div ref={textRef}><TextElementsView elements={elementsState.elements} /></div>
            : <>
              {view.connection === "retrying" && view.document === null && <p role="alert">{workText.liveUnavailable}</p>}
              {elementsState.unavailable && <p role="status">{textElementsMessages.unavailable}</p>}
              <LiveText view={view} marks={openMarks(placed)} textRef={textRef} onSelect={select} />
            </>}
          {!stopped && <ul className={linkStyles.links}>
            <li><a href={`${workHref}${VIEWS.review.suffix}`}>{reviewMessages.entry}</a></li>
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
              draft={placeAnchor(view.document, draft) ? draft : null} revision={revision}
              onDraftDone={() => setDraft(null)}
              onReload={() => void comments.load()} onShow={({ nodeId, start, end }) => {
                if (textRef.current) selectInBlock(textRef.current, nodeId, start, end);
              }} />
            {/* WEB-1704 (M6.7): deferred comments and the bank; a draft is anchored to the text selected in the work. */}
            <CommentBank key={`bank-${documentId}`} assignmentId={documentId} drafts={draftCommentsPort} bank={commentBankPort}
              anchor={placeAnchor(view.document, draft) ? draft : null} />
            <ProposalsPanel documentId={documentId} send={proposalsPort} current={current} />
            {/* WEB-1704 (M6.7): changes since the last review, read from the server; marking only with a route. */}
            <ChangesSinceReview key={`changes-${documentId}`} documentId={documentId} port={changesPort} />
            <TeacherBibliographyHost documentId={documentId} submitted={view.submitted} />
            <SummaryCardBody outcome={summary.outcome} onReload={() => void summary.load()} />
            <ProvenanceMap documentId={documentId} />
          </>}
          <RecordLimits />
        </>} />
    </MobileReview>
  );
}
