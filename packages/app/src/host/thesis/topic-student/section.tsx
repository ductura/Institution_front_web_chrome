"use client";

// WEB-V16-TEMA-STUDENT: the student's "Tema rada" section of the "Završni rad" panel: the form (title, summary,
// counters), the state (proposed, approved, returned with the mentor's comment), a new proposal after a return and
// the history of versions. After approval the form is locked. The mentor's side is another task.
import { useRef, useState } from "react";

import { Button, Notice, TextArea, TextField, formatDate } from "@ductura/ui";

import { createApi } from "../../../../../../src/client/api";
import type { SectionViewProps, ThesisSectionDef } from "../model";
import { canPropose, draftProblem, length, proposeTopic, SUMMARY_MAX, TITLE_MAX, type Outcome } from "./actions";
import { topicStudentHr as t } from "./messages.hr";
import { readTopic, type Call, type Topic } from "./read";

const when = (iso: string) => formatDate(iso, "hr");
export const say = (o: Outcome) => (o === "saved" ? t.saved : t[o]);

export function TopicStudentView({ documentId, role, value: first, reload, call = createApi() }: SectionViewProps<Topic> & { call?: Call }) {
  const [value, setValue] = useState(first);
  const [title, setTitle] = useState(first.current?.title ?? "");
  const [summary, setSummary] = useState(first.current?.summary ?? "");
  const [message, setMessage] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  // A ref, not the state: two clicks in the same tick must send one request.
  const sending = useRef(false);
  const problem = draftProblem(title, summary);
  const open = canPropose(value.state);

  const submit = async () => {
    setTouched(true);
    if (sending.current || problem !== null) return;
    sending.current = true;
    setBusy(true);
    const r = await proposeTopic(call, documentId, role, value, title, summary);
    sending.current = false;
    setBusy(false);
    setMessage(r.outcome);
    if (r.outcome === "saved" && r.topic) { setValue(r.topic); return; }
    // A conflict means the mentor decided meanwhile: the truth is the server's, read it again.
    if (r.outcome === "conflict") {
      void readTopic(call, documentId).then((n) => {
        if (n.kind === "ready") { setValue(n.value); setTitle(n.value.current?.title ?? ""); setSummary(n.value.current?.summary ?? ""); } else reload();
      }, () => reload());
    }
  };

  const decision = value.decision;
  const label = value.state === "none" ? t.submitFirst : value.state === "returned" ? t.submitAgain : t.submitNew;
  return (
    <div>
      <p data-testid="topic-state"><strong>{t.stateLabel}:</strong> {t.states[value.state]}</p>
      {value.state === "returned" && decision !== null && (
        <p data-testid="topic-comment"><strong>{t.mentorComment}:</strong> {decision.comment ?? t.noComment}</p>
      )}
      {value.state === "approved" && <p data-testid="topic-approved">{t.approvedLocked}</p>}
      {value.current !== null && (
        <div data-testid="topic-current">
          <h4>{t.currentHeading}</h4>
          <p><strong>{value.current.title}</strong> <small>{t.versionLabel} {value.current.version}, {when(value.current.proposedAt)}</small></p>
          {value.current.summary !== "" && <p>{value.current.summary}</p>}
        </div>
      )}
      {open && (
        <div>
          <TextField label={t.titleLabel} value={title} onChange={(e) => setTitle(e.target.value)}
            error={touched && problem === "titleEmpty" ? t.titleEmpty : problem === "titleTooLong" ? t.titleTooLong : undefined}
            hint={`${t.titleCount}: ${length(title.trim())}/${TITLE_MAX}`} />
          <TextArea label={t.summaryLabel} value={summary} onChange={(e) => setSummary(e.target.value)}
            error={problem === "summaryTooLong" ? t.summaryTooLong : undefined}
            hint={`${t.summaryCount}: ${length(summary.trim())}/${SUMMARY_MAX}`} />
          <Button busy={busy} onClick={() => void submit()}>{label}</Button>
        </div>
      )}
      <h4>{t.historyHeading}</h4>
      {value.history.length === 0 ? <p>{t.noHistory}</p> : (
        <ul>{value.history.map((h) => (
          <li key={h.version} data-testid={`topic-v${h.version}`}>{t.versionLabel} {h.version}: {h.title} <small>({when(h.proposedAt)})</small></li>
        ))}</ul>
      )}
      <p><small>{t.note}</small></p>
      {message !== null && <Notice tone={message === "saved" || message === "unchanged" ? "info" : "warn"}>{say(message)}</Notice>}
    </div>
  );
}

export const section: ThesisSectionDef<Topic> = {
  id: "topic-student",
  order: 10,
  title: t.title,
  // The mentor decides in his own section; this one shows nothing to him and sends no request.
  read: async (documentId, role) => (role !== "student" ? { kind: "notFound" } : readTopic(createApi(), documentId)),
  View: (props) => <TopicStudentView {...props} />,
};
