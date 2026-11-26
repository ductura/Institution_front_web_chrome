"use client";

import { Button, Details, Select, TextArea, TextField } from "@ductura/ui";
import { useEffect, useState } from "react";
import { createSourceNote, deleteSourceNote, updateSourceNote } from "@/client/source-notebook";
import type { useLocalEditor } from "@/components/editor/LocalDocument";
import type { ProofSource } from "@/components/editor/sources/proofs/proof-sources";
import { sourceNotebookHr as t } from "./messages.hr";
import { citationFromNote, findNotes, insertNotebookCitation, loadNotebook, type NotebookEntry } from "./notebook";
import styles from "./SourceNotebook.module.css";

type Form = { sourceId: string; noteId: string | null; draft: { quote: string; page: string; note: string } };
type Notice = "saved" | "removed" | "invalid" | "notFound" | "saveFailed" | "removeFailed" | null;

type Props = {
  documentId: string;
  editor: NonNullable<ReturnType<typeof useLocalEditor>>;
  sources: readonly ProofSource[];
  canInsert: boolean;
};

export function SourceNotebookHost({ supported, ...props }: Props & { supported: boolean }) {
  const [open, setOpen] = useState(false);

  return <Details summary={t.title} onToggle={(event) => setOpen(event.currentTarget.open)}>
    {open && (!supported ? <p>{t.unsupported}</p>
      : props.sources.length === 0 ? <p>{t.noSources}</p>
      : <NotebookNotes key={JSON.stringify([props.documentId, props.sources])} {...props} />)}
  </Details>;
}

function NotebookNotes({ documentId, editor, sources, canInsert }: Props) {
  // The parent remounts this view whenever the work or the sources change.
  const [workSources] = useState(sources);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<"inserted" | "insertionFailed" | null>(null);
  const [load, setLoad] = useState<Awaited<ReturnType<typeof loadNotebook>> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState<"needSource" | "needText" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadNotebook(documentId, workSources, controller.signal).then(
      (result) => { if (!controller.signal.aborted) setLoad(result); },
      () => { if (!controller.signal.aborted) setLoadFailed(true); },
    );
    return () => controller.abort();
  }, [documentId, workSources, attempt]);

  const insert = (entry: NotebookEntry) => {
    const tr = !editor.isDestroyed && editor.isEditable ? insertNotebookCitation(editor.state, entry) : null;
    if (!tr) return setFeedback("insertionFailed");
    editor.view.dispatch(tr);
    setFeedback("inserted");
    editor.commands.focus();
  };

  const reload = () => { setLoad(null); setLoadFailed(false); setAttempt((n) => n + 1); };
  const outcome = (kind: string, failed: "saveFailed" | "removeFailed") => {
    if (kind === "signedOut") return reload(); // the next read answers signedOut and shows its message
    setNotice(kind === "invalid" ? "invalid" : kind === "notFound" ? "notFound" : failed);
    if (kind === "notFound") { setForm(null); setConfirming(null); reload(); }
  };
  const submit = async () => {
    if (!form || busy) return;
    const { quote, page, note } = form.draft;
    if (!form.sourceId) return setFormError("needSource");
    if (!quote.trim() && !page.trim() && !note.trim()) return setFormError("needText");
    setFormError(null);
    setBusy(true);
    const result = form.noteId
      ? await updateSourceNote(documentId, form.sourceId, form.noteId, form.draft)
      : await createSourceNote(documentId, form.sourceId, form.draft);
    setBusy(false);
    if (result.kind !== "ok") return outcome(result.kind, "saveFailed");
    setForm(null);
    setNotice("saved");
    reload();
  };
  const remove = async (entry: NotebookEntry) => {
    if (busy) return;
    if (confirming !== `${entry.source.id}:${entry.id}`) return setConfirming(`${entry.source.id}:${entry.id}`);
    setBusy(true);
    const result = await deleteSourceNote(documentId, entry.source.id, entry.id);
    setBusy(false);
    setConfirming(null);
    if (result.kind !== "ok") return outcome(result.kind, "removeFailed");
    setNotice("removed");
    reload();
  };
  const field = (key: keyof Form["draft"], value: string) => {
    if (form) { setForm({ ...form, draft: { ...form.draft, [key]: value } }); setFormError(null); }
  };

  if (load?.kind === "signedOut") return <p role="status">{t.signedOut}</p>;
  const entries = load?.entries ?? [];
  const results = findNotes(entries, query);
  const error = loadFailed || load?.incomplete;

  return <div className={styles.content}>
    {error && <div>
      <p role="alert">{entries.length > 0 ? t.partial : t.unavailable}</p>
      <Button tone="quiet" onClick={() => { setLoad(null); setLoadFailed(false); setAttempt(attempt + 1); }}>
        {t.retry}
      </Button>
    </div>}
    {form
      ? <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        {form.noteId === null && <Select label={t.formSource} busy={busy} placeholder={t.formSourcePlaceholder} value={form.sourceId}
          options={workSources.map((s) => ({ value: s.id, label: s.label }))}
          error={formError === "needSource" ? t.needSource : undefined}
          onChange={(event) => setForm({ ...form, sourceId: event.currentTarget.value })} />}
        <TextArea label={t.formQuote} busy={busy} value={form.draft.quote} maxLength={4000} onChange={(e) => field("quote", e.currentTarget.value)} />
        <TextField label={t.formPage} busy={busy} value={form.draft.page} maxLength={80} onChange={(e) => field("page", e.currentTarget.value)} />
        <TextArea label={t.formNote} busy={busy} value={form.draft.note} maxLength={4000}
          error={formError === "needText" ? t.needText : undefined} onChange={(e) => field("note", e.currentTarget.value)} />
        <Button type="submit" disabled={busy}>{t.save}</Button>
        <Button type="button" tone="quiet" disabled={busy} onClick={() => { setForm(null); setFormError(null); }}>{t.cancel}</Button>
      </form>
      : <Button tone="quiet" onClick={() => {
        setNotice(null);
        setForm({ sourceId: workSources.length === 1 ? workSources[0]!.id : "", noteId: null, draft: { quote: "", page: "", note: "" } });
      }}>{t.add}</Button>}
    {entries.length > 0 && <>
      <TextField type="search" autoComplete="off" label={t.search} value={query}
        onChange={(event) => { setQuery(event.currentTarget.value); setFeedback(null); }} />
      {!canInsert && editor.isEditable && <p>{t.selectText}</p>}
      <ul className={styles.notes}>
        {results.map((entry) => {
          const citation = citationFromNote(entry);
          return <li className={styles.note} key={`${entry.source.id}:${entry.id}`}>
            <strong>{entry.source.label}{entry.page && ` · ${t.page(entry.page)}`}</strong>
            {entry.quote && <blockquote>{entry.quote}</blockquote>}
            {entry.note && <p>{entry.note}</p>}
            {citation.kind === "ready"
              ? <Button tone="quiet" disabled={!canInsert}
                  onClick={(event) => { if (event.nativeEvent.isTrusted) insert(entry); }}>
                  {citation.text ? t.insertQuote : t.insertReference}
                </Button>
              : <small>{t[citation.kind]}</small>}
            <Button tone="quiet" disabled={busy} onClick={() => {
              setNotice(null); setConfirming(null);
              setForm({ sourceId: entry.source.id, noteId: entry.id,
                draft: { quote: entry.quote ?? "", page: entry.page ?? "", note: entry.note ?? "" } });
            }}>{t.edit}</Button>
            <Button tone="quiet" disabled={busy} onClick={() => void remove(entry)}>
              {confirming === `${entry.source.id}:${entry.id}` ? t.confirmRemove : t.remove}
            </Button>
          </li>;
        })}
      </ul>
    </>}
    <p role="status">
      {feedback === "inserted" ? t.inserted
        : !load && !error ? t.loading
        : load && !error && !entries.length ? t.empty
        : entries.length > 0 && !results.length ? t.noMatches : null}
    </p>
    {notice && <p role={notice === "saved" || notice === "removed" ? "status" : "alert"}>{t[notice]}</p>}
    {feedback === "insertionFailed" && <p role="alert">{t.insertionFailed}</p>}
  </div>;
}
