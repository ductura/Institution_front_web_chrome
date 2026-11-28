"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Popover, SearchableList, TextField } from "@ductura/ui";
import { useEditorState, type Editor } from "@tiptap/react";

import { citationRange, insertCitation, validCitationPage } from "./citation-document";
import { citedBefore, citedThisSession, recentSources, rememberCited } from "./citation-recent";
import { citationMessagesHr as t } from "./messages.hr";

export type CitationSource = { id: string; label: string; description?: string };
type Range = NonNullable<ReturnType<typeof citationRange>>;

export function CitationPopover({ editor, sources, pending, error, onNewSource }: {
  editor: Editor | null; sources: readonly CitationSource[]; pending?: boolean; error?: string;
  /** ED-103: "Dodaj novi izvor…" at the foot of the popover; absent, the item is not shown. */
  onNewSource?: () => void;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [range, setRange] = useState<Range | null>(null);
  const canInsert = useEditorState({ editor, selector: ({ editor }) =>
    Boolean(editor?.isEditable && !editor.isDestroyed && citationRange(editor.state)) }) ?? false;

  return <>
    <Button ref={anchor} tone="quiet" disabled={!canInsert} aria-haspopup="dialog" aria-expanded={range !== null}
      onClick={() => { if (editor?.isEditable && !editor.isDestroyed) setRange(citationRange(editor.state)); }}>
      {t.cite}
    </Button>
    <Popover open={range !== null} anchor={anchor} label={t.insert} onClose={() => setRange(null)}>
      {range && editor && <CitationForm sources={sources} pending={pending} error={error}
        recent={recentSources(sources, citedThisSession(), citedBefore(editor.state.doc, range.from))}
        onNewSource={onNewSource && (() => { setRange(null); onNewSource(); })}
        onCancel={() => { setRange(null); anchor.current?.focus(); }} onInsert={(source, page) => {
          if (editor.isDestroyed || !editor.isEditable) return false;
          const tr = insertCitation(editor.state, range, source.id, page);
          if (!tr) return false;
          editor.view.dispatch(tr);
          rememberCited(source.id);
          setRange(null);
          editor.commands.focus();
          return true;
        }} />}
    </Popover>
  </>;
}

function CitationForm({ sources, recent, pending, error, onCancel, onInsert, onNewSource }: {
  sources: readonly CitationSource[]; recent: readonly CitationSource[]; pending?: boolean; error?: string;
  onCancel: () => void; onInsert: (source: CitationSource, page: string) => boolean; onNewSource?: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [page, setPage] = useState("");
  const [failed, setFailed] = useState(false);
  const selected = !pending && !error ? sources.find((source) => source.id === chosen) : undefined;
  const pageError = validCitationPage(page) ? undefined : t.pageInvalid;

  useEffect(() => {
    const frame = requestAnimationFrame(() => form.current?.querySelector("input")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [selected?.id]);

  return <form ref={form} onSubmit={(event) => {
    event.preventDefault();
    if (selected && !pageError && !onInsert(selected, page)) setFailed(true);
  }}>
    {selected ? <>
      <p>{selected.label}{selected.description && ` · ${selected.description}`}</p>
      <TextField label={t.page} placeholder={t.pageHint} value={page} error={pageError}
        onChange={(event) => setPage(event.currentTarget.value)} />
      <Button tone="quiet" onClick={() => setChosen(null)}>{t.chooseAgain}</Button>
      <Button type="submit" disabled={Boolean(pageError) || failed}>{t.insert}</Button>
    </> : <>
      {!pending && !error && recent.length > 0 && <section aria-label={t.recent}>
        <h3>{t.recent}</h3>
        <ul>{recent.map((source) => <li key={source.id}>
          <Button tone="quiet" onClick={() => setChosen(source.id)}>{source.label}</Button>
        </li>)}</ul>
        <h3>{t.allSources}</h3>
      </section>}
      <SearchableList items={sources} onSelect={(source) => setChosen(source.id)}
        resultsLabel={t.sources} emptyMessage={t.noSources} pending={pending} error={error} />
      <p>{t.fasterHint}</p>
      {onNewSource && <Button tone="quiet" onClick={onNewSource}>{t.newSource}</Button>}
    </>}
    {failed && <p role="alert">{t.selectionChanged}</p>}
    <Button tone="quiet" onClick={onCancel}>{t.cancel}</Button>
  </form>;
}
