"use client";

import { useEffect, useState } from "react";
import { Button } from "@ductura/ui";

import {
  draftMessage, publishDraftGroup, publishMessage, removeBankEntry, removeMessage, saveDraftComment, searchBank,
  type BankEntry, type CommentBankPort, type DraftAnchor, type DraftCommentsPort, type WorkComment,
} from "./model";
import { commentBankMessages as text } from "./messages.hr";

/**
 * The teacher's deferred comments and comment bank on one work (WEB-1704; M6.7). Comments are
 * saved as drafts the student does not see, a comment can be picked from the searchable bank, and
 * the drafts are published as one group.
 */
export default function CommentBank(
  { assignmentId, drafts: draftsPort, bank: bankPort, anchor, onPublished }:
  { assignmentId: string; drafts: DraftCommentsPort; bank: CommentBankPort; anchor?: DraftAnchor | null;
    onPublished?: (ids: readonly string[]) => void },
) {
  const [drafts, setDrafts] = useState<readonly WorkComment[]>([]);
  const [entries, setEntries] = useState<readonly BankEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void draftsPort.listDrafts(assignmentId)
      .then((read) => { if (active && read.kind === "ready") setDrafts(read.drafts); })
      .catch(() => undefined);
    void bankPort.read()
      .then((read) => { if (active) setEntries(read.kind === "ready" ? read.entries : null); })
      .catch(() => { if (active) setEntries(null); });
    return () => { active = false; };
  }, [assignmentId, draftsPort, bankPort, attempt]);

  const save = async () => {
    setBusy(true);
    const result = await saveDraftComment(draftsPort, assignmentId, body, anchor ?? undefined);
    setBusy(false);
    setNote(draftMessage(result));
    if (result.kind === "saved") { setDrafts((current) => [...current, result.draft]); setBody(""); }
  };

  const remove = async (entryId: string) => {
    setBusy(true);
    const result = await removeBankEntry(bankPort, entryId);
    setBusy(false);
    setNote(removeMessage(result));
    // The entry leaves the list only after the server confirmed it.
    if (result.kind === "removed") setEntries((current) => (current === null ? current : current.filter((entry) => entry.id !== entryId)));
  };

  const publish = async () => {
    setBusy(true);
    const result = await publishDraftGroup(draftsPort, assignmentId, drafts.map((draft) => draft.id));
    setBusy(false);
    setNote(publishMessage(result));
    if (result.kind === "published") { setDrafts([]); onPublished?.(result.ids); }
    // Nothing was published: the drafts on the server differ, so the list shown is read again.
    if (result.kind === "changed") {
      const read = await draftsPort.listDrafts(assignmentId).catch(() => null);
      if (read?.kind === "ready") setDrafts(read.drafts);
    }
  };

  const shown = entries === null ? [] : searchBank(entries, query);

  return (
    <section aria-label={text.title}>
      <h2>{text.title}</h2>
      <h3>{text.bankTitle}</h3>
      {entries === null ? (
        <>
          <p>{text.bankUnavailable}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button>
        </>
      ) : (
        <>
          <label>{text.search}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          {entries.length === 0 ? <p>{text.emptyBank}</p> : shown.length === 0 ? <p>{text.noMatch}</p> : (
            <ul>
              {shown.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.title}</strong>: {entry.body}{" "}
                  <Button onClick={() => setBody(entry.body)}>{text.pick}</Button>{" "}
                  <Button disabled={busy} onClick={() => void remove(entry.id)}>{text.remove}</Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <label>{text.field}<textarea value={body} onChange={(event) => setBody(event.target.value)} /></label>
      {!anchor && <p>{text.needAnchor}</p>}
      <Button disabled={busy || !anchor || body.trim() === ""} onClick={() => void save()}>{text.saveDraft}</Button>
      <h3>{text.draftsTitle}</h3>
      <p>{text.draftsNote}</p>
      {drafts.length === 0 ? <p>{text.noDrafts}</p> : (
        <ul>
          {drafts.map((draft) => <li key={draft.id} data-state="draft"><strong>{text.draftBadge}: </strong>{draft.body}</li>)}
        </ul>
      )}
      <Button disabled={busy || drafts.length === 0} onClick={() => void publish()}>{text.publish}</Button>
      <p role="status" aria-live="polite">{note}</p>
    </section>
  );
}
