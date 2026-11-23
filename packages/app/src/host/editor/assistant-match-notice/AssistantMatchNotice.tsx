"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import { explainAssistantMatch, MAX_EXPLANATION_LENGTH, readAssistantMatch, type AssistantMatch, type MatchCall, type MatchRead } from "./contract";
import { noticeText as t } from "./messages.hr";

type Status = "idle" | "sending" | "saved" | "failed" | "rejected" | "signedOut";

/**
 * The student's notice at the moment the server attaches the conversation automatically (WEB-1230), with the
 * option to explain the match. Behind the faculty flag: while the flag is off the component renders nothing.
 * The notice never blocks writing or submitting and is not a verdict. `explainable` is false while the
 * server has no route that stores the explanation: then no field asks for one. A new `version` reads
 * the matches again (the host raises it when a checked segment matched).
 */
export default function AssistantMatchNotice({ call, documentId, explainable = true, version = 0 }: { call: MatchCall; documentId: string; explainable?: boolean; version?: number }) {
  const [read, setRead] = useState<MatchRead | null>(null);
  const [matches, setMatches] = useState<readonly AssistantMatch[]>([]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let active = true;
    void readAssistantMatch(call, documentId).then((answer) => {
      if (!active) return;
      setRead(answer);
      setMatches(answer.kind === "ready" ? answer.state.matches : []);
    });
    return () => { active = false; };
  }, [call, documentId, version]);

  if (read === null || read.kind !== "ready") return null;
  const open = matches.filter((m) => !dismissed.has(m.segmentId));
  if (open.length === 0) return null;
  return (
    <div data-assistant-match-notice>
      {open.map((m) => (
        <Item
          key={m.segmentId}
          match={m}
          call={call}
          documentId={documentId}
          explainable={explainable}
          onSaved={(next) => setMatches((all) => all.map((x) => (x.segmentId === next.segmentId ? next : x)))}
          onDismiss={() => setDismissed((s) => new Set(s).add(m.segmentId))}
        />
      ))}
    </div>
  );
}

function Item({ match, call, documentId, explainable, onSaved, onDismiss }: { match: AssistantMatch; call: MatchCall; documentId: string; explainable: boolean; onSaved: (m: AssistantMatch) => void; onDismiss: () => void }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const send = async () => {
    setStatus("sending");
    const result = await explainAssistantMatch(call, documentId, match.segmentId, text);
    if (result.kind === "saved") {
      onSaved(result.match);
      setStatus("saved");
    } else setStatus(result.kind);
  };
  return (
    <aside role="status" aria-labelledby={`am-${match.segmentId}`} data-match={match.segmentId}>
      <h3 id={`am-${match.segmentId}`}>{t.title}</h3>
      <p>{t.body}</p>
      <p>{t.neutral}</p>
      {match.explanation !== undefined ? (
        <p>{t.yourExplanation} {match.explanation.text}</p>
      ) : !explainable ? null : (
        <>
          <label>
            {t.explainLabel}
            <textarea value={text} maxLength={MAX_EXPLANATION_LENGTH} onChange={(e) => setText(e.target.value)} aria-describedby={`am-hint-${match.segmentId}`} />
          </label>
          <p id={`am-hint-${match.segmentId}`}>{t.explainHint}</p>
          <Button onClick={() => void send()} disabled={status === "sending" || text.trim().length === 0}>
            {status === "sending" ? t.sending : t.send}
          </Button>
        </>
      )}
      {status === "saved" && <p role="status">{t.saved}</p>}
      {status === "failed" && <p role="alert">{t.failed}</p>}
      {status === "rejected" && <p role="alert">{t.rejected}</p>}
      {status === "signedOut" && <p role="alert">{t.signedOut}</p>}
      <Button onClick={onDismiss}>{t.dismiss}</Button>
    </aside>
  );
}
