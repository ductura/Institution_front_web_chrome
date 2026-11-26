"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dialog } from "@ductura/ui";

import { explainAssistantMatch, MAX_EXPLANATION_LENGTH, readAssistantMatch, type AssistantMatch, type MatchCall, type MatchRead } from "./contract";
import { noticeText as t } from "./messages.hr";
import styles from "./AssistantMatchNotice.module.css";
import { reportAlert } from "../../../../../../src/components/editor/layout-prefs/context-alerts.ts";

const ALERT_KEY = "assistant-match";

type Status = "idle" | "empty" | "sending" | "failed" | "rejected" | "conflict" | "signedOut";

/**
 * The student's notice at the moment the server attaches the conversation automatically (WEB-1230), as the
 * prototype's banner (NF2-P13), with "Objasni, ako želiš…" opening the explanation dialog. Behind the faculty
 * flag: while the flag is off the component renders nothing. The notice never blocks writing or submitting,
 * the explanation is optional and not part of the grade. `explainable` is false where nothing may be written
 * (a submitted work, a replay). A new `version` reads the matches again (the host raises it when a checked
 * segment matched).
 */
export default function AssistantMatchNotice({ call, documentId, explainable = true, version = 0 }: { call: MatchCall; documentId: string; explainable?: boolean; version?: number }) {
  const [read, setRead] = useState<MatchRead | null>(null);
  const [matches, setMatches] = useState<readonly AssistantMatch[]>([]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [savedNow, setSavedNow] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readAssistantMatch(call, documentId).then((answer) => {
      if (!active) return;
      setRead(answer);
      setMatches(answer.kind === "ready" ? answer.state.matches : []);
    });
    return () => { active = false; };
  }, [call, documentId, version]);

  // ED-38: every match is also a line in the "Uz tekst" alert row; it opens the assistant group. Hiding
  // the banner does not take the line away: the row points to the place, the banner explains it.
  useEffect(() => {
    reportAlert(ALERT_KEY, matches.length > 0 ? { group: "assistant", text: t.row(matches.length) } : null);
  }, [matches.length]);
  useEffect(() => () => reportAlert(ALERT_KEY, null), []);

  if (read === null || read.kind !== "ready") return null;
  const open = matches.filter((m) => !dismissed.has(m.segmentId));
  if (open.length === 0) return null;
  return (
    <div data-assistant-match-notice className={styles.list}>
      {open.map((m) => (
        <Item
          key={m.segmentId}
          match={m}
          call={call}
          documentId={documentId}
          explainable={explainable}
          savedNow={savedNow === m.segmentId}
          onSaved={(next) => {
            setMatches((all) => all.map((x) => (x.segmentId === next.segmentId ? next : x)));
            setSavedNow(next.segmentId);
          }}
          onDismiss={() => setDismissed((s) => new Set(s).add(m.segmentId))}
        />
      ))}
    </div>
  );
}

function Item({ match, call, documentId, explainable, savedNow, onSaved, onDismiss }: {
  match: AssistantMatch; call: MatchCall; documentId: string; explainable: boolean; savedNow: boolean;
  onSaved: (m: AssistantMatch) => void; onDismiss: () => void;
}) {
  const [dialog, setDialog] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const field = useRef<HTMLTextAreaElement>(null);
  const canExplain = explainable && match.explanation === undefined && match.messageId !== undefined;

  const close = () => {
    if (status === "sending") return;
    setDialog(false);
    setStatus("idle");
  };
  const send = async () => {
    if (text.trim().length === 0) {
      setStatus("empty");
      field.current?.focus();
      return;
    }
    setStatus("sending");
    const result = await explainAssistantMatch(call, documentId, match, text);
    if (result.kind === "saved") {
      setDialog(false);
      setStatus("idle");
      setText("");
      onSaved(result.match);
    } else setStatus(result.kind);
  };
  const error = status === "empty" ? t.empty
    : status === "failed" ? t.failed
    : status === "rejected" ? t.rejected
    : status === "conflict" ? t.conflict
    : status === "signedOut" ? t.signedOut
    : undefined;

  return (
    <>
    <div role="status" className={styles.banner} data-match={match.segmentId}>
      <span><b>{t.title}.</b> {t.neutral}{match.explanation !== undefined && <> {savedNow ? t.saved : t.explained}</>}</span>
      <span className={styles.grow} />
      {canExplain && <button type="button" className={styles.lnk} onClick={() => setDialog(true)}>{t.explainOpen}</button>}
      <button type="button" className={styles.lnk} onClick={onDismiss}>{t.dismiss}</button>
    </div>
      <Dialog open={dialog} title={t.dialogTitle} onClose={close} dismissible={status !== "sending"} initialFocus={field} error={error}
        actions={<>
          <Button onClick={close} disabled={status === "sending"}>{t.close}</Button>
          <Button tone="primary" onClick={() => void send()} disabled={status === "sending"}>{status === "sending" ? t.sending : t.send}</Button>
        </>}>
        <p className={styles.muted}>{t.dialogBody}</p>
        <textarea ref={field} className={styles.ta} rows={4} maxLength={MAX_EXPLANATION_LENGTH} aria-label={t.field}
          aria-invalid={status === "empty" || status === "rejected" ? true : undefined}
          value={text} onChange={(e) => { setText(e.target.value); if (status === "empty") setStatus("idle"); }} />
      </Dialog>
    </>
  );
}
