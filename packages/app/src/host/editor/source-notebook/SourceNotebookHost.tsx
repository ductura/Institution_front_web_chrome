"use client";

import { Button, Details, TextField } from "@ductura/ui";
import { useEffect, useState } from "react";
import type { useLocalEditor } from "@/components/editor/LocalDocument";
import type { ProofSource } from "@/components/editor/sources/proofs/proof-sources";
import { sourceNotebookHr as t } from "./messages.hr";
import { citationFromNote, findNotes, insertNotebookCitation, loadNotebook, type NotebookEntry } from "./notebook";
import styles from "./SourceNotebook.module.css";

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
    {feedback === "insertionFailed" && <p role="alert">{t.insertionFailed}</p>}
  </div>;
}
