"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Button, CheckActionList, Dialog } from "@ductura/ui";
import { useEditorState, type Editor } from "@tiptap/react";

import { listComments, type CommentThread } from "@/client/comments";
import { watchSessionEnd } from "@/client/session-end";
import type { SessionMark } from "@/client/session-marks";
import { createAnchorPlacer } from "@/editor";
import { countTextWords } from "@/lib/i18n/length-line";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { readConfirmed } from "../../predaja/Declaration";
import { confirmationKey } from "../../predaja/flow";
import { jumpTo } from "../review/ReviewPanel";
import { reviewMessagesHr as review } from "../review/messages.hr";
import { rowsOf } from "../review/view";
import { packageRows, type PackageInput } from "../submission-package/package-rows";
import styles from "./SubmissionRehearsal.module.css";
import { rehearsalMessagesHr as t } from "./messages.hr";
import { loadRequirements, rangeDetail, readRehearsal, wordsLabel, type Requirements } from "./rehearsal-model";

type Supplement = { detail: string; open?: () => void };

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
  onPackagePreview?: () => void;
  onJumpToDocument?: () => void;
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
    {open && <div onKeyDown={(event) => event.stopPropagation()} onCancel={(event) => event.stopPropagation()}>
      <RehearsalDialog {...props} editor={editor} close={close} />
    </div>}
  </>;
}

function RehearsalDialog({
  editor, assignmentId, documentId, sessionTag, session, enabledChecks = null, comments, approval,
  supplements, onComments, onPrintPreview, onPackagePreview, onJumpToDocument, close,
}: Omit<SubmissionRehearsalProps, "editor"> & { editor: Editor; close: () => void }) {
  const intro = useRef<HTMLParagraphElement>(null);
  const [requirements, setRequirements] = useState<Requirements>(null);
  const [loadedComments, setLoadedComments] = useState<readonly CommentThread[]>();
  const doc = useEditorState({ editor, selector: ({ editor }) => editor.state.doc, equalityFn: (a, b) => a === b });
  const model = useMemo(() => readRehearsal(doc, enabledChecks), [doc, enabledChecks]);
  const declared = readConfirmed(sessionTag === null ? null : confirmationKey(sessionTag, assignmentId));
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
  const approvalRow = approval === undefined ? undefined : packageRows({
    approval, openPlaces: places.length, summaryWritten: Boolean(model.abstract?.text),
    declaration: declared ? "filled" : "missing",
  }).find((row) => row.id === "approval");
  const form = messagesHr.beforeSubmit;
  const { abstract, summary, keywords } = model;
  const firstPlace = model.places[0];

  return <Dialog open title={t.title} initialFocus={intro} onClose={close} actions={<>
    {onPrintPreview && <Button tone="quiet" onClick={() => leaveFor(onPrintPreview)}>{t.print}</Button>}
    {onPackagePreview && <Button tone="quiet" onClick={() => leaveFor(onPackagePreview)}>{t.package}</Button>}
    <Button onClick={close}>{t.close}</Button>
  </>}>
    <p ref={intro} tabIndex={-1}>{t.intro}</p>
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
      <Row title={t.declaration}>{declared ? t.confirmed : t.unconfirmed}</Row>
      <Row title={t.comments} open={commentRange ? () => select(commentRange.from, commentRange.to)
        : onComments && (() => leaveFor(onComments))}>
        {openComments === undefined ? t.approvalUnavailable : t.unresolved.replace("{count}", String(openComments.length))}
      </Row>
      <Row title={t.places} open={firstPlace && (() => select(firstPlace.from, firstPlace.to))}>
        {places.length ? t.placesCount.replace("{count}", String(places.length)) : t.noPlaces}
      </Row>
      <Row title={t.approval}>{approvalRow?.detail ?? t.approvalUnavailable}</Row>
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
  </Dialog>;
}
