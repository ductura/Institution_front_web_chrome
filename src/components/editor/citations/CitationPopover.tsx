"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Popover, SearchableList, TextField } from "@ductura/ui";
import { useEditorState, type Editor } from "@tiptap/react";

import { citationRange, insertCitation, validCitationPage } from "./citation-document";
import { citationMessagesHr as t } from "./messages.hr";

export type CitationSource = { id: string; label: string; description?: string };
type Range = NonNullable<ReturnType<typeof citationRange>>;

export function CitationPopover({ editor, sources, pending, error }: {
  editor: Editor | null; sources: readonly CitationSource[]; pending?: boolean; error?: string;
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
        onCancel={() => { setRange(null); anchor.current?.focus(); }} onInsert={(source, page) => {
          if (editor.isDestroyed || !editor.isEditable) return false;
          const tr = insertCitation(editor.state, range, source.id, page);
          if (!tr) return false;
          editor.view.dispatch(tr);
          setRange(null);
          editor.commands.focus();
          return true;
        }} />}
    </Popover>
  </>;
}

function CitationForm({ sources, pending, error, onCancel, onInsert }: {
  sources: readonly CitationSource[]; pending?: boolean; error?: string;
  onCancel: () => void; onInsert: (source: CitationSource, page: string) => boolean;
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
    </> : <SearchableList items={sources} onSelect={(source) => setChosen(source.id)}
      resultsLabel={t.sources} emptyMessage={t.noSources} pending={pending} error={error} />}
    {failed && <p role="alert">{t.selectionChanged}</p>}
    <Button tone="quiet" onClick={onCancel}>{t.cancel}</Button>
  </form>;
}
