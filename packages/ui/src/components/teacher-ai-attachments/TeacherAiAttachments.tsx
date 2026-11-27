"use client";

import { useEffect, useId, useRef, useState } from "react";

import { InertButton } from "../assistant-states/InertButton";
import type { DeclarationUse } from "../declaration-ai/DeclarationAi";
import type { DeclarationTurn } from "../declaration-ai/declaration-logic";
import styles from "./TeacherAiAttachments.module.css";

export type TeacherAiAttachmentsLabels = {
  title: string;
  /** Prefix of the confirmation time: „Izjava potvrđena”. */
  confirmed: string;
  /** The student declared no AI use; no recorded use, nothing attached. */
  noUse: string;
  /** The assignment did not allow the built-in assistant. */
  aiDisabled: string;
  /** Submitted, but the declaration could not be put together yet (S31-AI state 5). */
  pendingTag: string;
  pending: string;
  loading: string;
  error: string;
  errorNote: string;
  retry: string;
  usesCaption: string;
  colPurpose: string;
  colProvider: string;
  colPhase: string;
  /** Heading of the transfer list; the count is appended. */
  transfersHeading: string;
  transfersNote: string;
  /** Heading of the attached list; the count is appended. */
  attachedHeading: string;
  transferTag: string;
  studentAddedTag: string;
  /** Explains both tags and that conversations the student did not attach are not shown (D-41). */
  attachedNote: string;
  /** Heading of the declared external conversations; the count is appended. */
  externalHeading: string;
  externalTag: string;
  externalNote: string;
  open: string;
  /** Under an opened conversation: the exact version the student confirmed, read only. */
  versionNote: string;
  student: string;
  back: string;
  /** „Student u svojoj predaji vidi ovaj isti prikaz.” */
  sameView: string;
};

export type TeacherTransfer = {
  readonly id: string;
  /** „Odlomak 2 · Lektura · 2. 11. 14:05” */
  readonly heading: string;
  /** Provider, model, the transfer label and the conversation. */
  readonly source: string;
  readonly text: string;
};

/** An attached conversation; the teacher only ever receives attached ones. */
export type TeacherAttachedConversation = {
  readonly conversationId: string;
  readonly title: string;
  readonly reason: "transfer" | "student_added";
  readonly assistantName: string;
  readonly throughSeq: number;
  readonly turns: readonly DeclarationTurn[];
  /** Where text from it went in the work, shown under the opened conversation. */
  readonly transferredNote?: string;
};

export type TeacherExternalConversation = { readonly id: string; readonly title: string };

export type TeacherAiAttachmentsState =
  | { readonly kind: "loading" }
  | { readonly kind: "error" }
  | { readonly kind: "pending" }
  | { readonly kind: "no_use"; readonly confirmedAt: string }
  | {
      readonly kind: "ready";
      readonly confirmedAt: string;
      /** false: the built-in assistant was not allowed, only external tools can be declared. */
      readonly assistantAllowed: boolean;
      readonly uses: readonly DeclarationUse[];
      readonly transfers: readonly TeacherTransfer[];
      readonly conversations: readonly TeacherAttachedConversation[];
      readonly external: readonly TeacherExternalConversation[];
    };

export type TeacherAiAttachmentsProps = {
  labels: TeacherAiAttachmentsLabels;
  state: TeacherAiAttachmentsState;
  onRetry?: () => void;
};

/**
 * The teacher's read-only view of the AI part of a submission (N-AI-ATT, no match marker).
 * Shows the declaration, the transfers and the attached conversations up to the confirmed
 * through_seq. Conversations the student did not attach are never shown, not even as a count.
 */
export function TeacherAiAttachments({ labels, state, onRetry }: TeacherAiAttachmentsProps) {
  const titleId = useId();
  const body = (() => {
    switch (state.kind) {
      case "loading":
        return (
          <div aria-busy="true">
            <div className={styles.skel} aria-hidden="true" />
            <div className={styles.skel} aria-hidden="true" />
            <p className={styles.note} role="status">{labels.loading}</p>
          </div>
        );
      case "error":
        return (
          <>
            <p className={styles.alert} role="alert">{labels.error}</p>
            <p className={styles.note}>{labels.errorNote}</p>
            {onRetry && <button type="button" className={styles.retryLink} onClick={onRetry}>{labels.retry}</button>}
          </>
        );
      case "pending":
        return (
          <>
            <p><span className={styles.tag} data-tone="warn">{labels.pendingTag}</span></p>
            <p className={styles.text}>{labels.pending}</p>
          </>
        );
      case "no_use":
        return (
          <>
            <p className={styles.meta}>{`${labels.confirmed} ${state.confirmedAt}`}</p>
            <p className={styles.text}>{labels.noUse}</p>
            <p className={styles.note}>{labels.sameView}</p>
          </>
        );
      case "ready":
        return <Ready labels={labels} state={state} />;
    }
  })();
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>{labels.title}</h2>
      {body}
    </section>
  );
}

type ReadyState = Extract<TeacherAiAttachmentsState, { kind: "ready" }>;

function Ready({ labels, state }: { labels: TeacherAiAttachmentsLabels; state: ReadyState }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const lastOpened = useRef<string | null>(null);
  const openHeading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const opened = state.conversations.find((c) => c.conversationId === openId);

  useEffect(() => {
    if (opened) openHeading.current?.focus();
    else if (lastOpened.current) {
      const rows = list.current?.querySelectorAll<HTMLElement>("[data-conversation]") ?? [];
      [...rows].find((row) => row.dataset.conversation === lastOpened.current)?.querySelector("button")?.focus();
    }
  }, [opened]);

  if (opened) {
    const tag = opened.reason === "transfer" ? labels.transferTag : labels.studentAddedTag;
    return (
      <div className={styles.group}>
        <h3 ref={openHeading} tabIndex={-1} className={styles.subtitle}>
          {opened.title} <span className={styles.tag} data-tone={opened.reason === "transfer" ? undefined : "accent"}>{tag}</span>
        </h3>
        <p className={styles.note}>{`${opened.assistantName}. ${labels.versionNote}`}</p>
        <ol className={styles.turns}>
          {opened.turns.filter((t) => t.seq <= opened.throughSeq).map((turn) => (
            <li key={turn.seq} className={styles.turn} data-author={turn.author}>
              <span className={styles.who}>{turn.author === "student" ? labels.student : opened.assistantName}</span>
              <span className={styles.message}>{turn.text}</span>
            </li>
          ))}
        </ol>
        {opened.transferredNote && <p className={styles.note}>{opened.transferredNote}</p>}
        <div className={styles.acts}><InertButton onClick={() => setOpenId(null)}>{labels.back}</InertButton></div>
      </div>
    );
  }

  const open = (id: string) => {
    lastOpened.current = id;
    setOpenId(id);
  };

  return (
    <>
      <p className={styles.meta}>{`${labels.confirmed} ${state.confirmedAt}`}</p>
      {!state.assistantAllowed && <p className={styles.text}>{labels.aiDisabled}</p>}
      {state.uses.length > 0 && (
        <table className={styles.uses}>
          <caption className={styles.caption}>{labels.usesCaption}</caption>
          <thead>
            <tr><th scope="col">{labels.colPurpose}</th><th scope="col">{labels.colProvider}</th><th scope="col">{labels.colPhase}</th></tr>
          </thead>
          <tbody>
            {state.uses.map((use, i) => (
              <tr key={i}><td>{use.purpose}</td><td>{use.provider}</td><td>{use.phase}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {state.transfers.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.subtitle}>{`${labels.transfersHeading} (${state.transfers.length})`}</h3>
          <ul className={styles.items}>
            {state.transfers.map((t) => (
              <li key={t.id} className={styles.item}>
                <span className={styles.itemTitle}>{t.heading}</span>
                <span className={styles.meta}>{t.source}</span>
                <span className={styles.text}>{t.text}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>{labels.transfersNote}</p>
        </div>
      )}
      {state.conversations.length > 0 && (
        <div className={styles.group} ref={list}>
          <h3 className={styles.subtitle}>{`${labels.attachedHeading} (${state.conversations.length})`}</h3>
          <ul className={styles.items}>
            {state.conversations.map((c) => (
              <li key={c.conversationId} className={styles.row} data-conversation={c.conversationId}>
                <span className={styles.itemTitle}>{c.title}</span>
                <span className={styles.tag} data-tone={c.reason === "transfer" ? undefined : "accent"}>{c.reason === "transfer" ? labels.transferTag : labels.studentAddedTag}</span>
                <InertButton tone="quiet" onClick={() => open(c.conversationId)}>
                  {labels.open}
                  <span className={styles.sr}>{` ${c.title}`}</span>
                </InertButton>
              </li>
            ))}
          </ul>
          <p className={styles.note}>{labels.attachedNote}</p>
        </div>
      )}
      {state.external.length > 0 && (
        <div className={styles.group}>
          <h3 className={styles.subtitle}>{`${labels.externalHeading} (${state.external.length})`}</h3>
          <ul className={styles.items}>
            {state.external.map((e) => (
              <li key={e.id} className={styles.row}>
                <span className={styles.itemTitle}>{e.title}</span>
                <span className={styles.tag}>{labels.externalTag}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>{labels.externalNote}</p>
        </div>
      )}
      <p className={styles.note}>{labels.sameView}</p>
    </>
  );
}
