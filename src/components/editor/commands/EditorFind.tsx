"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { FindBar, stepHit } from "@ductura/ui";

import { replaceAllTransaction, replaceMatchTransaction } from "@/editor";
import { isSearchableText, MAX_SEARCH_TEXT_LENGTH } from "@/domain/text/find-literal";
import { findHighlights, highlightHits, highlightPlugin, rangeOf, searchWork, type FindScope } from "./find";
import { editorCommandsHr as t } from "./messages.hr";
import styles from "./EditorCommands.module.css";

const labels = { search: t.findPlaceholder, next: t.findNext, previous: t.findPrevious,
  close: t.findClose, none: t.findNone, count: t.findCount };
const scopes = Object.entries(t.findScopes).map(([value, label]) => ({ value, label }));

export function EditorFind({ editor, onClose, openCount }: { editor: Editor; onClose: () => void; openCount: number }) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [scope, setScope] = useState<FindScope>("all");
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const state = useEditorState({ editor, selector: ({ editor }) => ({
    doc: editor.state.doc, caret: editor.state.selection.from, editable: editor.isEditable,
  }), equalityFn: (a, b) => a?.doc === b?.doc && a?.caret === b?.caret && a?.editable === b?.editable });
  const result = useMemo(() => searchWork(state.doc, query, scope, state.caret), [state.doc, state.caret, query, scope]);
  const hits = result?.matches;
  const total = hits?.length ?? 0;
  const current = index < total ? index : 0;

  useEffect(() => {
    const input = root.current?.querySelector<HTMLInputElement>('input[type="search"]');
    input?.focus();
    input?.select();
  }, [openCount]);

  useEffect(() => {
    editor.registerPlugin(highlightPlugin());
    return () => { if (!editor.isDestroyed) editor.unregisterPlugin(findHighlights); };
  }, [editor]);

  useEffect(() => {
    if (editor.isDestroyed || editor.state.doc !== state.doc) return;
    const decorations = highlightHits(state.doc, hits ?? [], current, [styles.hit!, styles.current!]);
    editor.view.dispatch(editor.state.tr.setMeta(findHighlights, decorations).setMeta("addToHistory", false));
  }, [editor, state.doc, hits, current]);

  const step = (direction: -1 | 1) => {
    const next = stepHit(current, total, direction);
    const hit = hits?.[next];
    if (!hit || editor.isDestroyed) return;
    setIndex(next);
    const anchor = rangeOf(editor, hit).startContainer;
    (anchor instanceof Element ? anchor : anchor.parentElement)?.scrollIntoView({ block: "nearest" });
  };

  const replace = (all: boolean) => {
    if (!result || editor.isDestroyed || !editor.isEditable) return;
    const outcome = all ? replaceAllTransaction(editor.state, result, replacement)
      : replaceMatchTransaction(editor.state, result, current, replacement);
    if (!outcome.ok) return;
    editor.view.dispatch(outcome.tr);
    if (all) setCount(outcome.count);
  };
  const canReplace = total > 0 && isSearchableText(replacement);

  return (
    <div ref={root} className={styles.find}>
      <FindBar query={query} onQueryChange={(value) => { setQuery(value); setIndex(0); setCount(null); }}
        current={current} total={total} onNext={() => step(1)} onPrevious={() => step(-1)} onClose={onClose} labels={labels}
        scope={{ label: t.findScope, options: scopes, value: scope, onChange: (value) => {
          setScope(value as FindScope); setIndex(0); setCount(null);
        } }}
        replacement={state.editable ? {
          value: replacement, label: t.replacement, placeholder: `${t.replace}…`, maxLength: MAX_SEARCH_TEXT_LENGTH,
          replace: t.replace, all: t.replaceAll, disabled: !canReplace, allDisabled: result?.overLimit,
          onChange: (value) => { setReplacement(value); setCount(null); },
          onReplace: () => replace(false), onReplaceAll: () => replace(true),
        } : undefined}
        message={result?.overLimit ? t.tooManyMatches : count === null ? "" : t.replaced(count)} />
    </div>
  );
}
