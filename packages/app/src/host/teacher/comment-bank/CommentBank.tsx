"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Select, TextArea, TextField } from "@ductura/ui";

import {
  BANK_KINDS, BANK_LABEL_MAX, draftMessage, draftsAfterPublish, normalizeBankInput, publishDraftGroup, publishMessage, removeBankEntry,
  removeMessage, saveBankEntry, saveDraftComment, saveEntryMessage, searchBank, updateBankEntry, updateMessage,
  type BankEntry, type BankKind, type CommentBankPort, type DraftAnchor, type DraftCommentsPort, type WorkComment,
} from "./model";
import { commentBankMessages as text } from "./messages.hr";

/** The form of one bank entry (new or edited); it sends nothing the server would refuse and shows why. */
function EntryForm({ initial, busy, onSubmit, onCancel }: {
  initial: BankEntry | null; busy: boolean;
  onSubmit: (input: { text: string; kind: BankKind; label: string | null }) => void; onCancel: () => void;
}) {
  const [textValue, setTextValue] = useState(initial?.body ?? "");
  const [kind, setKind] = useState<BankKind>(initial?.kind ?? "sugg");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [error, setError] = useState<string | undefined>();
  const submit = () => {
    const checked = normalizeBankInput(textValue, kind, label);
    if (!checked.ok) return setError(text.inputErrors[checked.error]);
    setError(undefined);
    onSubmit(checked.input);
  };
  return (
    <div role="group" aria-label={initial ? text.edit : text.add}>
      <TextArea rows={3} label={text.entryText} value={textValue} busy={busy} error={error}
        onChange={(event) => setTextValue(event.target.value)} />
      <Select label={text.entryKind} value={kind} busy={busy}
        options={BANK_KINDS.map((value) => ({ value, label: text.kinds[value] }))}
        onChange={(event) => setKind(event.target.value as BankKind)} />
      <TextField label={text.entryLabel} hint={text.entryLabelHint} value={label} busy={busy} maxLength={BANK_LABEL_MAX * 2}
        onChange={(event) => setLabel(event.target.value)} />
      <Button disabled={busy} onClick={submit}>{text.saveEntry}</Button>{" "}
      <Button disabled={busy} onClick={onCancel}>{text.cancel}</Button>
    </div>
  );
}

/**
 * The teacher's deferred comments and comment bank on one work (WEB-1704; M6.7). Comments are
 * saved as drafts the student does not see, a comment can be picked from the searchable bank, and
 * the drafts are published as one group.
 */
export default function CommentBank(
  { assignmentId, drafts: draftsPort, bank: bankPort, anchor, onPublished, onInsert }:
  { assignmentId: string; drafts: DraftCommentsPort; bank: CommentBankPort; anchor?: DraftAnchor | null;
    onPublished?: (ids: readonly string[]) => void;
    /** Puts a bank text into the comment being written on the marked passage (needs the passage). */
    onInsert?: (text: string) => void },
) {
  const [drafts, setDrafts] = useState<readonly WorkComment[]>([]);
  const [entries, setEntries] = useState<readonly BankEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<BankKind | null>(null);
  // The id of the entry being edited, "new" for a new one, null for none.
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Set synchronously, so a second click before the button re-renders as disabled sends nothing.
  const publishing = useRef(false);

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

  const saveEntry = async (input: { text: string; kind: BankKind; label: string | null }) => {
    setBusy(true);
    const result = await saveBankEntry(bankPort, input);
    setBusy(false);
    setNote(saveEntryMessage(result));
    if (result.kind === "saved") { setEntries((current) => [...(current ?? []), result.entry]); setEditing(null); }
  };

  const changeEntry = async (entryId: string, input: { text: string; kind: BankKind; label: string | null }) => {
    setBusy(true);
    const result = await updateBankEntry(bankPort, entryId, input);
    setBusy(false);
    setNote(updateMessage(result));
    // The entry changes only after the server confirmed it; a 404 drops it, as it is not the teacher's.
    if (result.kind === "updated") {
      setEntries((current) => (current === null ? current : current.map((entry) => (entry.id === entryId ? result.entry : entry))));
      setEditing(null);
    }
    if (result.kind === "gone") {
      setEntries((current) => (current === null ? current : current.filter((entry) => entry.id !== entryId)));
      setEditing(null);
    }
  };

  const publish = async () => {
    if (publishing.current) return;
    publishing.current = true;
    setBusy(true);
    try {
      const result = await publishDraftGroup(draftsPort, assignmentId, drafts.map((draft) => draft.id));
      setNote(publishMessage(result));
      // On a 409 the list is read again before the button opens, so it never sends the stale list.
      const next = await draftsAfterPublish(draftsPort, assignmentId, result);
      if (next !== null) setDrafts(next);
      if (result.kind === "published") onPublished?.(result.ids);
    } finally {
      publishing.current = false;
      setBusy(false);
    }
  };

  const shown = entries === null ? [] : searchBank(entries, query, kindFilter);

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
          <Select label={text.kindFilter} value={kindFilter ?? ""} placeholder={text.allKinds}
            options={BANK_KINDS.map((value) => ({ value, label: text.kinds[value] }))}
            onChange={(event) => setKindFilter(event.target.value === "" ? null : (event.target.value as BankKind))} />
          {entries.length === 0 ? <p>{text.emptyBank}</p> : shown.length === 0 ? <p>{text.noMatch}</p> : (
            <ul>
              {shown.map((entry) => (
                <li key={entry.id}>
                  {editing === entry.id ? (
                    <EntryForm initial={entry} busy={busy} onSubmit={(input) => void changeEntry(entry.id, input)} onCancel={() => setEditing(null)} />
                  ) : (
                    <>
                      <strong>{entry.title}</strong>{entry.label === null ? null : <> ({entry.label})</>}: {entry.body}{" "}
                      {onInsert && <><Button disabled={!anchor} onClick={() => onInsert(entry.body)}>{text.insert}</Button>{" "}</>}
                      <Button onClick={() => setBody(entry.body)}>{text.pick}</Button>{" "}
                      <Button disabled={busy} onClick={() => setEditing(entry.id)}>{text.edit}</Button>{" "}
                      <Button disabled={busy} onClick={() => void remove(entry.id)}>{text.remove}</Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editing === "new"
            ? <EntryForm initial={null} busy={busy} onSubmit={(input) => void saveEntry(input)} onCancel={() => setEditing(null)} />
            : <Button disabled={busy} onClick={() => setEditing("new")}>{text.add}</Button>}
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
