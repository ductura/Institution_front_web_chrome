"use client";

import { Button } from "@ductura/ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  SuggestionCard, decideSuggestion, editorSuggestionsHr, listSuggestions,
  type Decision, type Suggestion, type Transport,
} from "@/components/editor/suggestions";
import styles from "@/components/teacher/LiveWorkView.module.css";

import { TeacherToastRegion, teacherToastHr, useTeacherToasts } from "../toast";
import { teacherProposalsMessages as t } from "./messages.hr";
import { isAccepted, orderedProposals, proposalsStatus, withdrawToast, type ProposalsRead } from "./model";

export default function ProposalsPanel({ documentId, send, current }: {
  documentId: string; send: Transport; current: () => boolean;
}) {
  const [read, setRead] = useState<ProposalsRead>({ kind: "loading" });
  const { toasts, show, dismiss } = useTeacherToasts();
  const live = useRef(true);
  const titleId = useId();

  const load = useCallback(async () => {
    const out = await listSuggestions(send, documentId);
    if (live.current && current()) setRead(out);
  }, [send, documentId, current]);
  useEffect(() => { live.current = true; void load(); return () => { live.current = false; }; }, [load]);

  const list = read.kind === "ok" ? orderedProposals(read.suggestions) : [];
  const status = proposalsStatus(read, list.length);
  const decide = async (s: Suggestion, decision: Decision) => {
    const outcome = await decideSuggestion(send, s, decision);
    const text = withdrawToast(decision, outcome, teacherToastHr.suggestionWithdrawn);
    if (text !== null && current()) { show(text); void load(); }
    if (outcome === "conflict") void load();
    return outcome;
  };

  return (
    <section className={styles.comments} aria-labelledby={titleId}>
      <h2 id={titleId}>{t.title}</h2>
      <p className={styles.muted}>{editorSuggestionsHr.note}</p>
      {status !== null && <p className={styles.muted} role="status">{status}</p>}
      {list.map((s) => (
        <div key={s.id}>
          <SuggestionCard suggestion={s} viewer="teacher" onDecide={(d) => decide(s, d)} />
          {isAccepted(s) && <p className={styles.muted}>{t.acceptedLabel}</p>}
        </div>
      ))}
      <div className={styles.actions}><Button tone="quiet" onClick={() => void load()}>{t.refresh}</Button></div>
      <TeacherToastRegion toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}
