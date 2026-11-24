"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { flushSync } from "react-dom";
import { Button, CheckActionList, Dialog } from "@ductura/ui";
import { useEditorState, type Editor } from "@tiptap/react";

import { listComments, type CommentThread } from "@/client/comments";
import { watchSessionEnd } from "@/client/session-end";
import type { SessionMark } from "@/client/session-marks";
import { createAnchorPlacer } from "@/editor";
import { countTextWords } from "@/lib/i18n/length-line";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { jumpTo } from "../review/ReviewPanel";
import { reviewMessagesHr as review } from "../review/messages.hr";
import { rowsOf } from "../review/view";
import { submissionPackageMessages as packageText } from "../submission-package/messages.hr";
import { packageRows, type PackageInput } from "../submission-package/package-rows";
import styles from "./SubmissionRehearsal.module.css";
import { beforeSubmission, declarationText, useDeclarationGate, type GateRead } from "./declaration-gate";
import { rehearsalMessagesHr as t } from "./messages.hr";
import { loadRequirements, rangeDetail, readRehearsal, wordsLabel, type Requirements } from "./rehearsal-model";

type Supplement = { detail: string; open?: () => void };

// A dialog's bubbling cancel event must stop before it reaches the containing drawer.
const stopDialogEvent = (event: SyntheticEvent) => event.stopPropagation();
const dialogBoundaryEvents = { onKeyDown: stopDialogEvent, onCancel: stopDialogEvent };

export type SubmissionRehearsalProps = {
  editor: Editor | null;
  assignmentId: string;
  documentId?: string;
  sessionTag: string | null;
  session?: SessionMark;
  enabledChecks?: readonly string[] | null;
  comments?: readonly CommentThread[];
  approval?: PackageInput["approval"];
  supplements?: Partial<Record<"facultyRequirements" | "uncited" | "proofs" | "forms", Supplement>>;
  onComments?: () => void;
  onPrintPreview?: () => void;
  onJumpToDocument?: () => void;
  /** The declaration's read; the server's by default (student.declaration.get), a recorded one in tests. */
  declarationGate?: GateRead;
};

function Row({ title, children, open }: { title: string; children: ReactNode; open?: () => void }) {
  return <div className={styles.row}>
    <dt>{title}</dt>
    <dd>
      {children}
      {open && <Button tone="quiet" aria-label={`${t.open} · ${title}`} onClick={open}>{t.open}</Button>}
    </dd>
  </div>;
}

export function SubmissionRehearsal(props: SubmissionRehearsalProps) {
  return <Rehearsal key={JSON.stringify([props.assignmentId, props.sessionTag])} {...props} />;
}

function Rehearsal(props: SubmissionRehearsalProps) {
  const [open, setOpen] = useState(false);
  const editor = props.editor;
  const close = useCallback(() => setOpen(false), []);
  if (!editor || editor.isDestroyed) return null;
  return <>
    <Button tone="quiet" aria-haspopup="dialog" onClick={() => setOpen(true)}>{t.title}</Button>
    {open && <div {...dialogBoundaryEvents}>
      <RehearsalDialog {...props} editor={editor} close={close} />
    </div>}
  </>;
}

function RehearsalDialog({
  editor, assignmentId, documentId, session, enabledChecks = null, comments, approval,
  supplements, onComments, onPrintPreview, onJumpToDocument, close, declarationGate,
}: Omit<SubmissionRehearsalProps, "editor"> & { editor: Editor; close: () => void }) {
  const intro = useRef<HTMLParagraphElement>(null);
  const packageIntro = useRef<HTMLParagraphElement>(null);
  const packageButton = useRef<HTMLButtonElement>(null);
  const [showPackage, setShowPackage] = useState(false);
  const [requirements, setRequirements] = useState<Requirements>(null);
  const [loadedComments, setLoadedComments] = useState<readonly CommentThread[]>();
  const doc = useEditorState({ editor, selector: ({ editor }) => editor.state.doc, equalityFn: (a, b) => a === b });
  const model = useMemo(() => readRehearsal(doc, enabledChecks), [doc, enabledChecks]);
  // WEB-NUZ-PREDAJA-1 (PR-2): the declaration as the server holds it, the same read the steps of the
  // submission make; this browser's own mark no longer says "confirmed" while the server refuses.
  const { gate } = useDeclarationGate(assignmentId, declarationGate);
  useEffect(() => {
    let active = true;
    const watch = watchSessionEnd(session ?? null, close);
    const current = () => active && !watch.ended();
    if (current()) {
      void loadRequirements(assignmentId).then((result) => { if (current()) setRequirements(result); });
      if (documentId) void listComments(documentId, current).then((result) => {
        if (current() && result.kind === "ok") setLoadedComments(result.threads);
      });
    }
    return () => { active = false; watch.close(); };
  }, [assignmentId, documentId, session, close]);

  function leaveFor(action: () => void) {
    // The shared dialog must release focus before the editor or the next preview takes it.
    flushSync(close);
    action();
  }

  function select(from: number, to = from) {
    if (editor.isDestroyed || editor.state.doc !== doc) return;
    jumpInDocument(() => {
      editor.chain().setTextSelection({ from, to }).scrollIntoView().run();
      editor.view.focus();
    });
  }

  function jumpInDocument(action: () => void) {
    flushSync(() => { close(); onJumpToDocument?.(); });
    action();
  }

  const places = model.places.map((place) => ({
    id: String(place.from), severity: "required" as const, title: review.kind.hole, detail: place.context,
    actions: [{ id: "go", label: review.goTo }],
  }));
  const advice = rowsOf(model.advice.slice(0, 8)).map((item) => ({ ...item, actions: [{ id: "go", label: review.goTo }] }));
  const advisoryLabels = { list: t.advisory, empty: t.noAdvice, required: review.required, advisory: review.advisory };
  const openComments = (comments ?? loadedComments)?.filter((thread) => thread.state !== "resolved"
    && thread.comments.some((comment) => comment.role === "teacher" && comment.body !== null));
  const commentRange = openComments && createAnchorPlacer((thread: CommentThread) => thread.anchor)(doc, openComments).find(Boolean);
  const { abstract, summary, keywords } = model;
  const rows = packageRows({
    approval: approval ?? "none", openPlaces: places.length, summaryWritten: Boolean(abstract?.text && summary?.text),
    declaration: gate.kind === "confirmed" || gate.kind === "not_required" ? "filled" : "missing",
  });
  const approvalDetail = approval === undefined ? t.approvalUnavailable : rows.find((row) => row.id === "approval")?.detail;
  const form = messagesHr.beforeSubmit;
  const firstPlace = model.places[0];
  const missing = beforeSubmission(gate, places.length);
  const missingLine = gate.kind === "loading" ? t.declarationChecking
    : missing.count === 0 ? t.missingNothing : missing.items.map((item) => item.text).join(" ");

  function switchView(next: boolean) {
    flushSync(() => setShowPackage(next));
    (next ? packageIntro : packageButton).current?.focus();
  }

  return <Dialog open title={showPackage ? packageText.title : t.title} initialFocus={intro} onClose={close} actions={<>
    {showPackage ? <Button tone="quiet" onClick={() => switchView(false)}>{t.backToRehearsal}</Button> : <>
      {onPrintPreview && <Button tone="quiet" onClick={() => leaveFor(onPrintPreview)}>{t.print}</Button>}
      <Button ref={packageButton} tone="quiet" onClick={() => switchView(true)}>{packageText.title}</Button>
    </>}
    <Button onClick={close}>{t.close}</Button>
  </>}>
    {showPackage ? <>
      <p ref={packageIntro} tabIndex={-1}>{packageText.lead}</p>
      <dl className={styles.rows}>{rows.map((row) =>
        <Row key={row.id} title={packageText.rows[row.id]}>
          {row.id === "approval" ? approvalDetail : row.detail || packageText.ok}
        </Row>)}</dl>
      <p>{packageText.codeNever}</p>
    </> : <>
    <p ref={intro} tabIndex={-1}>{t.intro}</p>
    <h3>{t.missingTitle}</h3>
    <p role="status">{missingLine}</p>
    <h3>{t.blockers} ({places.length})</h3>
    <CheckActionList findings={places} labels={{ ...advisoryLabels, list: t.blockers, empty: t.noBlockers }}
      onAction={({ findingId }) => {
        const place = model.places.find(({ from }) => String(from) === findingId);
        if (place) select(place.from, place.to);
      }} />

    <h3>{t.parts}</h3>
    <dl className={styles.rows}>
      <Row title={t.scope}>
        <span role="status">{wordsLabel(model.words)} · {rangeDetail(model.words, requirements)}</span>
      </Row>
      <Row title={t.abstract} open={abstract && (() => select(abstract.pos))}>
        {abstract?.text ? `${wordsLabel(countTextWords(abstract.text))}. ${t.abstractHint}` : t.unwritten}
      </Row>
      <Row title={t.summary} open={summary && (() => select(summary.pos))}>
        {summary?.text ? wordsLabel(countTextWords(summary.text)) : t.unwritten}
      </Row>
      <Row title={t.keywords} open={keywords && (() => select(keywords.pos))}>
        {keywords?.text || t.unwritten}
      </Row>
      <Row title={t.declaration}>{declarationText(gate)}</Row>
      <Row title={t.comments} open={commentRange ? () => select(commentRange.from, commentRange.to)
        : onComments && (() => leaveFor(onComments))}>
        {openComments === undefined ? t.approvalUnavailable : t.unresolved.replace("{count}", String(openComments.length))}
      </Row>
      <Row title={t.places} open={firstPlace && (() => select(firstPlace.from, firstPlace.to))}>
        {places.length ? t.placesCount.replace("{count}", String(places.length)) : t.noPlaces}
      </Row>
      <Row title={t.approval}>{approvalDetail}</Row>
      {(["facultyRequirements", "uncited", "proofs", "forms"] as const).map((key) => {
        const supplement = supplements?.[key];
        const go = supplement?.open;
        return supplement && <Row key={key} title={t[key]} open={go && (() => leaveFor(go))}>
          {supplement.detail}
        </Row>;
      })}
      <Row title={form.form}>{form.formNotRun}</Row>
    </dl>

    <h3>{t.advisory} ({model.advice.length})</h3>
    <CheckActionList findings={advice} labels={advisoryLabels} onAction={({ findingId }) => {
      const finding = model.advice.find(({ id }) => id === findingId);
      if (finding && !editor.isDestroyed && editor.state.doc === doc) jumpInDocument(() => { jumpTo(editor, finding); });
    }} />
    </>}
  </Dialog>;
}
