"use client";

// WEB-V16-TEMA-MENTOR: the "Tema rada" section of the shared "Završni rad" panel. The mentor reads the proposal,
// decides (approve; return with a required comment) and sees the versions; the student reads it in topic-student. After a write, and after a 409, the view shows what the server now says.
import { useState } from "react";

import { ActionRow, Button, Notice, Tag, TextArea, formatDate } from "@ductura/ui";

import { createApi } from "../../../../../../src/client/api";
import type { SectionViewProps, ThesisSectionDef } from "../model";
import { allowedDecisions, COMMENT_MAX, decide, type Decision, type Outcome } from "./actions";
import { topicMentorHr as t } from "./messages.hr";
import { readTopic, type Call, type TopicValue } from "./read";

const when = (iso: string) => formatDate(iso, "hr");
export const say = (o: Outcome) => t[o];

export function TopicMentorView({ documentId, role, value: first, reload, call = createApi() }: SectionViewProps<TopicValue> & { call?: Call }) {
  const [value, setValue] = useState(first);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Outcome | null>(null);
  const [attempted, setAttempted] = useState(false);
  const options = allowedDecisions(role, value.state);

  const run = async (decision: Decision) => {
    setAttempted(true);
    setBusy(true);
    const o = await decide(call, documentId, role, value, decision, comment);
    setMessage(o);
    // A 404 means the work is gone for this reader: the frame must read again and hide the section.
    if (o === "notFound") reload();
    if (o === "saved" || o === "conflict") {
      if (o === "saved") { setComment(""); setAttempted(false); }
      const r = await readTopic(call, documentId).catch(() => null);
      if (r !== null && r.kind === "ready") setValue(r.value); else reload();
    }
    setBusy(false);
  };

  const needsComment = attempted && comment.trim() === "";
  return (
    <div>
      <p><Tag tone={value.state === "approved" ? "accent" : "neutral"}>{t.states[value.state]}</Tag></p>
      {value.current === null ? <p>{t.noneYet}</p> : (
        <div data-testid="topic-current">
          <h4>{value.current.title}</h4>
          <p><small>{t.versionLabel} {value.current.version}, {t.proposedOn} {when(value.current.proposedAt)}</small></p>
          <p>{value.current.summary === "" ? t.noSummary : value.current.summary}</p>
        </div>
      )}
      {value.decision !== null && (
        <div data-testid="topic-decision">
          <h5>{t.decisionHeading}</h5>
          <p>{value.decision.decision === "approved" ? t.decisionApproved : t.decisionReturned} ({t.versionLabel} {value.decision.version}) {t.decisionOn} {when(value.decision.decidedAt)}</p>
          {value.decision.comment !== null && <p>{value.decision.comment}</p>}
        </div>
      )}
      {role === "student" && value.current !== null && <p><small>{t.studentReadOnly}</small></p>}
      {role === "mentor" && options.length > 0 && (
        <div data-testid="topic-controls">
          <TextArea label={t.commentLabel} hint={options.includes("approved") ? `${t.commentHintReturn} ${t.commentHintApprove}` : t.commentHintReturn}
            value={comment} maxLength={COMMENT_MAX + 1}
            error={comment.trim().length > COMMENT_MAX ? t.commentTooLong : needsComment ? t.commentRequired : undefined}
            onChange={(e) => setComment(e.target.value)} />
          <ActionRow>
            {options.includes("approved") && <Button disabled={busy} onClick={() => void run("approved")}>{t.approve}</Button>}
            <Button tone="secondary" disabled={busy} onClick={() => void run("returned")}>
              {value.state === "approved" ? t.returnApproved : t.returnForRework}
            </Button>
          </ActionRow>
        </div>
      )}
      <h5>{t.historyHeading}</h5>
      {value.history.length === 0 ? <p>{t.noHistory}</p> : (
        <ul>{value.history.map((h) => <li key={h.version}>{t.versionLabel} {h.version}, {when(h.proposedAt)}: {h.title}</li>)}</ul>
      )}
      {message !== null && <Notice tone={message === "saved" ? "info" : "warn"}>{say(message)}</Notice>}
    </div>
  );
}

export const section: ThesisSectionDef<TopicValue> = {
  id: "topic-mentor",
  order: 10,
  title: t.title,
  // The student has their own section (topic-student) with the proposal form; this one shows nothing to them
  // and sends no request, so the panel never shows the topic twice.
  read: async (documentId, role) => (role === "student" ? { kind: "notFound" } : readTopic(createApi(), documentId)),
  View: (props) => <TopicMentorView {...props} />,
};
