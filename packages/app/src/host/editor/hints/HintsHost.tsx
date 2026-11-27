"use client";

// ED-82: the hints in the text, as in the prototype: while the work can be written, the hint kinds the
// student keeps on in "Što Ductura podcrtava dok pišete" get a quiet dotted underline, and a click on
// one opens its explanation with the prototype's actions (replace, join, insert a citation, mark
// [izvor], open the glossary, accept a transition). Rendered inside the LocalDocumentProvider next to
// MarksHost; it only draws, and the text changes only when the student picks an action.
import { useEffect, useRef, useState } from "react";
import { Button } from "@ductura/ui";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";

import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { requestPanel } from "../../../../../../src/components/editor/layout-prefs/open-panel.ts";
import { requestCiteAtCaret } from "../../../../../../src/components/editor/triggers/TriggerPopover.tsx";
import { HELP_CHANGED, readHelp, settingsKey, type HelpSettings } from "../../../../../../src/components/editor/help/preferences.ts";
import { loadTerms } from "../right/pregled-model";
import { requestPregledView } from "../right/pregled-view";
import { findHints, hintsAt, replacementFor, type Hint, type HintKind } from "./hints-model";
import { enabledHints, readTransOk, transOkKey } from "./hints-store";
import { hintsHr as t } from "./messages.hr";
import styles from "./Hints.module.css";

const KEY = new PluginKey<{ hints: Hint[]; set: DecorationSet }>("ductusHints");
const REFRESH = "ductusHintsRefresh";

type Editor = NonNullable<ReturnType<typeof useLocalEditor>>;
type Read = { enabled: ReadonlySet<HintKind>; glossary: ReturnType<typeof loadTerms>; transOk: ReadonlySet<string> };

const storage = (): Storage | null => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };

function compute(state: EditorState, read: () => Read) {
  const hints = findHints(state.doc, read());
  const set = DecorationSet.create(state.doc, hints.map((h) => Decoration.inline(h.from, h.to, { class: styles.hint ?? "hint", "data-hint": h.kind })));
  return { hints, set };
}

function hintsPlugin(read: () => Read, editable: () => boolean) {
  return new Plugin({
    key: KEY,
    state: {
      init: (_, state) => compute(state, read),
      apply: (tr, value, _old, state) => (tr.docChanged || tr.getMeta(REFRESH) ? compute(state, read) : value),
    },
    props: {
      decorations(state) { return editable() ? KEY.getState(state)?.set ?? null : null; },
    },
  });
}

type Pick = { x: number; y: number; hint: Hint };

export function HintsHost({ scope, workId }: { scope: string; workId: string }) {
  const editor = useLocalEditor();
  const okKey = transOkKey(scope, workId);
  const read = useRef<Read>({ enabled: new Set(), glossary: [], transOk: new Set() });
  const [pick, setPick] = useState<Pick | null>(null);
  const [phrases, setPhrases] = useState(false);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const load = (settings?: HelpSettings) => {
      const help = settings ?? readHelp(() => storage()?.getItem(settingsKey) ?? null);
      read.current = { enabled: enabledHints(help), glossary: loadTerms(storage(), workId), transOk: readTransOk(storage(), okKey) };
    };
    load();
    editor.registerPlugin(hintsPlugin(() => {
      // The glossary is edited in the Pregled group of this page; it is read again with each change.
      read.current = { ...read.current, glossary: loadTerms(storage(), workId) };
      return read.current;
    }, () => editor.isEditable));
    const refresh = () => { if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(REFRESH, true).setMeta("addToHistory", false)); };
    const onHelp = (event: Event) => { load((event as CustomEvent<HelpSettings>).detail); refresh(); };
    const onStorage = (event: StorageEvent) => { if (event.key === settingsKey || event.key === okKey) { load(); refresh(); } };
    window.addEventListener(HELP_CHANGED, onHelp);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(HELP_CHANGED, onHelp);
      window.removeEventListener("storage", onStorage);
      if (!editor.isDestroyed) editor.unregisterPlugin(KEY);
    };
  }, [editor, workId, okKey]);

  // One click on an underlined place opens its hint; a mark of the text keeps its own popover.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!editor.isEditable || !target?.closest("[data-hint]") || target.closest("[data-mark]") || !editor.state.selection.empty) { setPick(null); return; }
      const hit = editor.view.posAtCoords({ left: event.clientX, "top": event.clientY });
      const hint = hit ? hintsAt(KEY.getState(editor.state)?.hints ?? [], hit.pos)[0] : undefined;
      setPhrases(false);
      setPick(hint ? { x: event.clientX, y: event.clientY + 12, hint } : null);
    };
    dom.addEventListener("click", onClick);
    return () => dom.removeEventListener("click", onClick);
  }, [editor]);
  useEffect(() => {
    if (!pick) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setPick(null); };
    const onDown = (event: MouseEvent) => {
      if (pop.current && event.target instanceof Node && !pop.current.contains(event.target) && !editor?.view.dom.contains(event.target)) setPick(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [pick, editor]);

  if (!editor || editor.isDestroyed || !pick) return null;
  const h = pick.hint;
  const done = () => { setPick(null); setPhrases(false); };
  const replace = (alt: string) => {
    done();
    if (!editor.isEditable) return;
    const text = replacementFor(h, editor.state.doc.textBetween(h.from, h.to, "", "￼"), alt);
    editor.chain().focus().insertContentAt({ from: h.from, to: h.to }, text).run();
  };
  const cite = () => {
    done();
    editor.chain().setTextSelection(h.to).focus().run();
    // The source list opens at a focused caret; focus settles before the next frame.
    requestAnimationFrame(() => { if (!editor.isDestroyed && !requestCiteAtCaret(editor)) requestPanel("sources"); });
  };
  const hole = () => { done(); if (editor.isEditable) editor.chain().focus().insertContentAt(h.to, " [izvor]").run(); };
  const glossary = () => { done(); requestPanel("review"); requestPregledView("pojmovnik"); };
  const accept = (key: string) => {
    done();
    const ok = readTransOk(storage(), okKey);
    ok.add(key);
    try { storage()?.setItem(okKey, JSON.stringify([...ok])); } catch { /* The choice holds for this page. */ }
    read.current = { ...read.current, transOk: ok };
    editor.view.dispatch(editor.state.tr.setMeta(REFRESH, true).setMeta("addToHistory", false));
  };
  const phrase = (text: string) => {
    done();
    if (!editor.isEditable) return;
    const start = text.split("…")[0] ?? "";
    const first = editor.state.doc.textBetween(h.from, Math.min(h.to, h.from + 1));
    editor.chain().focus().insertContentAt({ from: h.from, to: h.from + first.length }, `${start}${first.toLocaleLowerCase("hr")}`).run();
  };

  const title = h.kind === "colloq" || h.kind === "absolute" || h.kind === "first" ? t.kt[h.kind][0]
    : h.kind === "term" ? t.term[h.sub] : t[h.kind].title;
  return (
    <div ref={pop} className={styles.pop} role="dialog" aria-label={title} data-hint-pop={h.kind}
      style={{ left: Math.max(8, Math.min(pick.x, window.innerWidth - 348)), "top": pick.y }}>
      <h3>{title}</h3>
      {(h.kind === "colloq" || h.kind === "absolute" || h.kind === "first") && <>
        <p>{t.kt[h.kind][1]}</p>
        {h.alts.length > 0 && <>
          <p className={styles.muted}>{t.replaceWith}</p>
          <div className={styles.actions}>{h.alts.map((alt) => <Button key={alt} onClick={() => replace(alt)}>{replacementFor(h, h.word, alt)}</Button>)}</div>
        </>}
      </>}
      {h.kind === "claim" && <>
        <p>{t.claim.why}</p>
        <p className={styles.muted}>{t.claim.example}</p>
        <div className={styles.actions}>
          <Button onClick={cite}>{t.claim.cite}</Button>
          <Button tone="quiet" onClick={hole}>{t.claim.hole}</Button>
        </div>
      </>}
      {h.kind === "long" && <><p>{t.long.why}</p><p className={styles.muted}>{t.long.example}</p></>}
      {h.kind === "passive" && <p>{t.passive.text(h.n)}</p>}
      {h.kind === "term" && <>
        <p>{t.term.why}</p>
        {h.def && <p className={styles.quote}>{h.def}</p>}
        <div className={styles.actions}><Button tone="quiet" onClick={glossary}>{t.term.open}</Button></div>
      </>}
      {h.kind === "abbr" && <>
        <p>{t.abbr.text(h.ab, h.full)}</p>
        {h.full && <div className={styles.actions}><Button onClick={() => replace(`${h.full} (${h.ab})`)}>{t.abbr.write}</Button></div>}
      </>}
      {h.kind === "trans" && <>
        <p>{t.trans.text}</p>
        <p className={styles.muted}>{t.trans.prev}</p>
        <p className={styles.quote}>{h.prev.replaceAll("￼", "")}</p>
        {phrases && <ul className={styles.phrases}>{t.trans.list.map((x) => <li key={x}><Button tone="quiet" onClick={() => phrase(x)}>{x}</Button></li>)}</ul>}
        <div className={styles.actions}>
          {!phrases && <Button onClick={() => setPhrases(true)}>{t.trans.phrases}</Button>}
          <Button tone="quiet" onClick={() => accept(h.key)}>{t.trans.ok}</Button>
        </div>
      </>}
      {h.kind === "short" && <>
        <p>{t.short.text(h.first)}</p>
        <p className={styles.muted}>{t.short.joined}</p>
        <p className={styles.quote}>{h.joined}</p>
        <div className={styles.actions}><Button onClick={() => replace(h.joined)}>{t.short.join}</Button></div>
      </>}
      <div className={styles.actions}><Button tone="quiet" onClick={done}>{t.close}</Button></div>
    </div>
  );
}
