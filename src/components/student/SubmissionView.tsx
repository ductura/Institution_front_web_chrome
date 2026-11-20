/**
 * S: E-10, step 4 of the submission (WEB-26): the text on the server as the
 * student sees it, read-only, and the button that opens PD-3. Pure: the page
 * state comes in, so each variant renders with `renderToStaticMarkup`.
 *
 * Nothing here says "predano": success is the receipt (B-6), and the page
 * then moves to step 5. Every other answer is a line with what the student
 * can do next (`nextOf`), never "nije predano" when the outcome is unknown.
 */

import { Button, Card, Steps } from "@ductura/ui";
import { useId, type ReactNode } from "react";

import type { SubmissionRead, SubmitOutcome } from "@/client/submission";
import { messagesHr } from "@/lib/i18n/messages.hr";

import type { Stage } from "../predaja/stage";
import { zagrebParts } from "../summary/zagreb-time";

const t = messagesHr.submit;

/** The element that holds the answer; the page moves the focus to it. */
export const OUTCOME_ID = "submission-outcome";

/**
 * One block of the text as the page shows it. TODO(editor-core): the
 * canonical document type of @ductura/editor-core is not in the pages' type
 * graph yet (it is checked without noUncheckedIndexedAccess); until it is,
 * the page reads only these fields of the snapshot.
 */
export type TextNode = {
  readonly type: "paragraph" | "heading" | "bulletItem" | "quote";
  readonly level?: number;
  readonly children: readonly { readonly text: string; readonly marks: readonly string[] }[];
};

/** The work as evidence.open.post gives it; `empty`: no text on the server yet. */
export type WorkRead =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "empty" }
  | { readonly kind: "ready"; readonly documentId: string; readonly revision: number; readonly nodes: readonly TextNode[] };

/** An answer of the submission, or of "Provjeri stanje predaje" (student.submission.get). */
export type Answer = SubmitOutcome | { readonly kind: "check"; readonly state: SubmissionRead };

export type Next =
  | { readonly go: "receipt" | "notice" | "signIn" }
  /** `retry`: the button may send again; `offer`: what the line offers. */
  | { readonly go: null; readonly text: string; readonly offer?: "check" | "reload"; readonly retry: boolean };

const UNKNOWN: Next = { go: null, text: t.unknown, offer: "check", retry: false };

function fromState(state: SubmissionRead): Next {
  switch (state.kind) {
    case "potvrdeno": return { go: "receipt" };
    // Recorded, the receipt not signed yet: never "predano" (P-9: checked by hand only).
    case "ceka": return { go: null, text: t.waiting, offer: "check", retry: false };
    case "none": return { go: null, text: t.notRecorded, retry: true };
    case "session-expired": return { go: "signIn" };
    case "greska": return state.code === "not_found" ? { go: null, text: t.errors.not_found, retry: false } : UNKNOWN;
    default: return UNKNOWN;
  }
}

/** What the page does with one answer (S: PO-17; P-10 texts as proposed). */
export function nextOf(answer: Answer): Next {
  switch (answer.kind) {
    case "predano": return { go: "receipt" };
    case "session-expired": return { go: "signIn" };
    case "odbijeno": return { go: null, text: t.blocked[answer.reason], retry: true };
    case "nedovrseno": return { go: null, text: t.incomplete, retry: true };
    case "stanje":
    case "check": return fromState(answer.state);
    case "greska":
      if (answer.code === "not_acknowledged") return { go: "notice" };
      if (answer.code === "stale_revision") return { go: null, text: t.errors.stale_revision, offer: "reload", retry: false };
      return { go: null, text: Object.hasOwn(t.errors, answer.code) ? t.errors[answer.code as keyof typeof t.errors] : t.errors.other, retry: true };
    default: return UNKNOWN;
  }
}

function Block(node: TextNode, key: number): ReactNode {
  const children = node.children.map((child, i) => {
    let content: ReactNode = child.text;
    if (child.marks.includes("italic")) content = <em>{content}</em>;
    if (child.marks.includes("bold")) content = <strong>{content}</strong>;
    return <span key={i}>{content}</span>;
  });
  if (node.type === "paragraph" || node.type === "quote") return <p key={key}>{children}</p>;
  if (node.type === "bulletItem") return <li key={key}>{children}</li>;
  // The page has its own h1, so the work's levels 1 to 3 are h2 to h4.
  const Tag = node.level === 1 ? "h2" : node.level === 2 ? "h3" : "h4";
  return <Tag key={key}>{children}</Tag>;
}

/** Consecutive bullet items are one list, consecutive quote paragraphs one block quote (E1). */
export function Text({ nodes }: { readonly nodes: readonly TextNode[] }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < nodes.length;) {
    const node = nodes[i] as TextNode;
    if (node.type !== "bulletItem" && node.type !== "quote") {
      out.push(Block(node, i++));
      continue;
    }
    const start = i;
    while (nodes[i]?.type === node.type) i++;
    const items = nodes.slice(start, i).map((item, k) => Block(item, start + k));
    out.push(node.type === "bulletItem" ? <ul key={start}>{items}</ul> : <blockquote key={start}>{items}</blockquote>);
  }
  return <>{out}</>;
}

function dueText(iso: string): string {
  const parts = zagrebParts(iso);
  return parts === null ? iso : `${parts.date} ${messagesHr.summary.at} ${parts.time}`;
}

export type SubmissionViewProps = {
  readonly work: WorkRead;
  readonly stage: Stage;
  readonly confirmed: boolean;
  readonly online: boolean;
  readonly sending: boolean;
  readonly checking: boolean;
  /** The line of the last answer; `go` answers never reach the view. */
  readonly next: Extract<Next, { go: null }> | null;
  readonly onOpen: () => void;
  readonly onCheck: () => void;
  readonly onReload: () => void;
  readonly onDeclaration: () => void;
  readonly onBack: () => void;
};

export function SubmissionView(props: SubmissionViewProps) {
  const { work, stage, confirmed, online, sending, checking, next } = props;
  const hint = useId();
  const ready = work.kind === "ready";
  const canSend = ready && confirmed && online && !sending && (next === null || next.retry);
  const why = !online ? t.offline : !confirmed ? t.declarationMissing : undefined;
  return (
    <div className="page submission">
      <Steps currentStep={4} />
      <h1>{t.title}</h1>
      {stage.kind === "closed" && <p role="note">{`${t.late}: ${dueText(stage.dueAt)}. ${t.lateNote}`}</p>}
      {stage.kind === "unavailable" && <p role="note">{t.stageUnavailable}</p>}
      {!online && <p role="status">{t.offline}</p>}
      {work.kind === "loading" && <p role="status">{t.loading}</p>}
      {work.kind === "unavailable" && <p role="alert">{t.unavailable}</p>}
      {work.kind === "empty" && <p role="status">{t.empty}</p>}
      {ready && (
        <Card title={`${t.textTitle} (${t.revision}: ${work.revision})`}>
          <p>{t.serverNote}</p>
          <div className="manuscript" role="document" aria-label={t.textTitle}>
            <Text nodes={work.nodes} />
          </div>
        </Card>
      )}
      {next !== null && <p id={OUTCOME_ID} tabIndex={-1} role="alert">{next.text}</p>}
      {next?.offer === "check" && <p><Button tone="quiet" busy={checking} onClick={props.onCheck}>{checking ? t.checking : t.check}</Button></p>}
      {(work.kind === "unavailable" || next?.offer === "reload") && <p><Button tone="quiet" onClick={props.onReload}>{t.reload}</Button></p>}
      <p>
        {confirmed
          ? <Button disabled={!canSend} aria-describedby={why ? hint : undefined} onClick={props.onOpen}>{t.submit}</Button>
          : <Button aria-describedby={hint} onClick={props.onDeclaration}>{t.toDeclaration}</Button>}
        <Button tone="quiet" onClick={props.onBack}>{t.back}</Button>
      </p>
      {why && <p id={hint}>{why}</p>}
    </div>
  );
}
