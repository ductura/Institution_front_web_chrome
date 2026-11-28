"use client";

// WEB-2129 (par-e-oznake): marks in the text, the gutter, "Na ovom mjestu", the
// legend (from the view menu) and the jump from a mark's popover. Rendered inside the LocalDocumentProvider
// (sessionControls of the work page), so it reads the live editor and only draws:
// decorations and an overlay, never a change of the document.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Dialog } from "@ductura/ui";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import { commentHighlightKey } from "../../../../../editor-core/src/editor/comment-anchor.ts";
import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { requestPanel } from "../../../../../../src/components/editor/layout-prefs/open-panel.ts";
import { useDialogRequest } from "../../../../../../src/components/editor/commands/dialog-request.ts";
import { allPlaces, gutterDots, hasNext, holeRemoval, nextPlace, placesAt, showGutter, type MarkKind, type Place } from "./marks-model";
import { marksHr as t } from "./messages.hr";
import styles from "./Marks.module.css";
import { reportAlert } from "../../../../../../src/components/editor/layout-prefs/context-alerts.ts";
import { GHOST_KEY, ghostPlugin } from "./ghost";
import { pageStarts, readPageEstimate, watchPageEstimate } from "./page-estimate";
import { cardFits, requestCommentCard, requestCommentFocus } from "../comments/comment-card";
import { askSourceInstead, holeNeedsSource, linkHoleToSource, sourcesOf } from "./hole-source";

const NEED_ALERT = "marks-need-proof";

/**
 * A click on a comment alone in the text: up to 1050 px its card (ED-98), wider the Komentari group of
 * the right panel with that comment in focus (ED-119, prototype app.js `.cmt`).
 */
export function openComment(pos: number, width = typeof window === "undefined" ? 0 : window.innerWidth): void {
  if (cardFits(width)) { requestCommentCard(pos); return; }
  requestPanel("comments");
  requestCommentFocus(pos);
}

const KEY = new PluginKey("ductusMarks");
const CLASS: Partial<Record<MarkKind, string>> = { hole: styles.hole, plain: styles.plain, need: styles.need };

type Editor = NonNullable<ReturnType<typeof useLocalEditor>>;

function commentRanges(editor: Editor): { from: number; to: number }[] {
  const set = commentHighlightKey.getState(editor.state);
  return set ? set.find().map((d) => ({ from: d.from, to: d.to })) : [];
}

function marksPlugin() {
  return new Plugin({
    key: KEY,
    props: {
      decorations(state) {
        const decos = allPlaces(state.doc, []).flatMap((p) => (CLASS[p.kind] ? [Decoration.inline(p.from, p.to, { class: CLASS[p.kind]!, "data-mark": p.kind })] : []));
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}

/**
 * ED-45 (P2-17): the popover of one mark, as in the prototype: the explanation, "Sljedeće mjesto ›",
 * for a citation typed as text "Poveži u Literaturi" (opens the Literatura group of the right panel),
 * when there is another mark of the kind, and for "Za provjeru" "Provjereno, ukloni" (only when the
 * text can be written; a submitted work only explains).
 */
export function MarkActions({ place, more, editable, onNext, onRemove, onLink, sources, onSource, onAskSource }: {
  place: Place; more: boolean; editable: boolean; onNext: () => void; onRemove: () => void; onLink: () => void;
  /** ED-104: set when the hole asks for a source; the work's sources to choose from. */
  sources?: readonly { id: string; label: string }[];
  onSource?: (id: string) => void;
  onAskSource?: () => void;
}) {
  const hole = place.kind === "hole";
  const plain = place.kind === "plain";
  if (hole && sources && editable && onSource) {
    return (
      <>
        <p><b>{t.actions.sourceTitle}</b></p>
        <p>{t.actions.sourceIntro}</p>
        {sources.length > 0 && <p>{t.actions.allSources(sources.length)}</p>}
        {sources.length > 0 && <ul>{sources.map((s) => (
          <li key={s.id}><Button tone="quiet" onClick={() => onSource(s.id)}>{s.label}</Button></li>))}
        </ul>}
        <div className={styles.actions}>
          <Button tone="quiet" onClick={onLink}>{t.actions.newSource}</Button>
          {more && <Button tone="quiet" onClick={onNext}>{t.actions.next}</Button>}
        </div>
      </>
    );
  }
  return (
    <>
      <p>{t.explain[place.kind]}</p>
      {(more || ((hole || plain) && editable)) && (
        <div className={styles.actions}>
          {hole && editable && <Button onClick={onRemove}>{t.actions.checked}</Button>}
          {hole && editable && onAskSource && <Button tone="quiet" onClick={onAskSource}>{t.actions.askSource}</Button>}
          {plain && editable && <Button onClick={onLink}>{t.actions.link}</Button>}
          {more && <Button tone="quiet" onClick={onNext}>{t.actions.next}</Button>}
        </div>
      )}
    </>
  );
}

export function MarksHost() {
  const editor = useLocalEditor();
  const [legend, setLegend] = useState(false);
  const [pick, setPick] = useState<{ x: number; y: number; at: Place[] } | null>(null);
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 0 : window.innerWidth));
  // ED-126: "Procjena stranica u rubu" from the view menu.
  const [pagesOn, setPagesOn] = useState(false);
  useEffect(() => { setPagesOn(readPageEstimate()); return watchPageEstimate(setPagesOn); }, []);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor || editor.isDestroyed || !pagesOn) return;
    const bump = (p: { transaction: { docChanged: boolean } }) => { if (p.transaction.docChanged) setTick((n) => n + 1); };
    editor.on("transaction", bump);
    return () => { editor.off("transaction", bump); };
  }, [editor, pagesOn]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.registerPlugin(marksPlugin());
    // ED-45: the ghost text of an empty paragraph; none while the text cannot be written.
    editor.registerPlugin(ghostPlugin(() => editor.isEditable, styles.ghost ?? ""));
    return () => { if (!editor.isDestroyed) { editor.unregisterPlugin(KEY); editor.unregisterPlugin(GHOST_KEY); } };
  }, [editor]);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Recomputed on every change of the text and of the comment highlight; a cursor move changes neither.
  const [places, setPlaces] = useState<Place[]>([]);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const read = () => {
      const next = allPlaces(editor.state.doc, commentRanges(editor));
      setPlaces((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    read();
    editor.on("transaction", read);
    return () => { editor.off("transaction", read); };
  }, [editor]);
  // ED-38 (prune.js ctxAlerts): citations with a confirmation the mentor asked for are a line in the
  // "Uz tekst" alert row; it opens the sources group, where the request is answered.
  const needs = places.filter((p) => p.kind === "need").length;
  useEffect(() => { reportAlert(NEED_ALERT, needs > 0 ? { group: "sources", text: t.needAlert(needs) } : null); }, [needs]);
  useEffect(() => () => reportAlert(NEED_ALERT, null), []);

  // One click, one popover: a single mark opens its own explanation, several open "Na ovom mjestu".
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom;
    const onClick = (event: MouseEvent) => {
      const hit = editor.view.posAtCoords({ left: event.clientX, "top": event.clientY });
      const at = hit ? placesAt(places, hit.pos) : [];
      // ED-98: on a phone a comment alone opens its card, not a popover (prototype text2.js).
      // ED-119: wider, it opens Komentari with that comment in focus (prototype app.js `.cmt`).
      if (hit && at.length > 0 && at.every((p) => p.kind === "cmt")) {
        setPick(null);
        openComment(hit.pos);
        return;
      }
      setPick(at.length ? { x: event.clientX, y: event.clientY + 12, at } : null);
    };
    dom.addEventListener("click", onClick);
    return () => dom.removeEventListener("click", onClick);
  }, [editor, places]);
  useEffect(() => {
    if (!pick) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setPick(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pick]);
  // ED-60: "Što znače oznake" opens from the view menu (dialog-request), as in the prototype.
  useDialogRequest("marks", () => setLegend(true), !!editor && !editor.isDestroyed);

  if (!editor || editor.isDestroyed) return null;
  const go = (p: Place) => {
    setPick(null);
    // ED-98: on a phone a comment chosen in the list „Na ovom mjestu” opens its card.
    if (p.kind === "cmt" && cardFits(window.innerWidth)) { requestCommentCard(p.from); return; }
    // ED-119: wider, the comment is also brought into focus in Komentari.
    if (p.kind === "cmt") { requestPanel("comments"); requestCommentFocus(p.from); }
    editor.chain().setTextSelection({ from: p.from, to: p.to }).scrollIntoView().focus().run();
  };
  const jump = (kind: MarkKind) => {
    const target = nextPlace(places, kind, editor.state.selection.to);
    if (target) go(target);
  };
  // ED-45: "Provjereno, ukloni" takes the [?] out; only while the text can be written.
  const remove = (p: Place) => {
    setPick(null);
    if (!editor.isEditable || p.kind !== "hole") return;
    editor.chain().focus().deleteRange(holeRemoval(editor.state.doc, p)).run();
  };
  const host = editor.view.dom.parentElement;
  const base = host?.getBoundingClientRect();
  // Not "top": the no-direct-api guard reads a bare `top` as the window alias.
  const topOf = (pos: number) => {
    try { return editor.view.coordsAtPos(pos).top - base!.top; } catch { return null; }
  };
  const dots = !host || !base || !showGutter(width) ? [] : gutterDots(places, topOf);
  const pageMarks = !pagesOn || !host || !base || !showGutter(width) ? []
    : pageStarts(editor.state.doc).map((p) => ({ ...p, y: topOf(p.pos) })).filter((p) => p.y !== null);

  // ED-60 (Ductus#2058 c.7187555639): no counter bar under the editor, as in the prototype, whose
  // counts are in the review; the jump to the next mark of a kind is the popover's "Sljedeće mjesto ›".
  return (
    <>
      {host && dots.length + pageMarks.length > 0 ? createPortal(
        <div className={styles.gutter} aria-hidden="true" data-gutter="" aria-label={t.gutter}>
          {pageMarks.map((p) => (
            <span key={`page:${p.page}`} className={styles.page} data-page-estimate={p.page} title={t.pages.title}
              style={{ top: p.y! }}>{t.pages.mark(p.page)}</span>
          ))}
          {dots.map((d) => (
            <button key={`${d.place.kind}:${d.place.from}`} type="button" tabIndex={-1}
              className={`${styles.dot} ${d.kind === "cmt" ? styles.dotCmt : styles.dotHole}`}
              style={{ top: d.y, left: -22 - d.offset }} onClick={() => go(d.place)} />
          ))}
        </div>, host) : null}
      {pick ? (
        <div className={styles.pick} role="dialog" aria-label={pick.at.length > 1 ? t.here : pick.at[0]!.name} style={{ left: Math.min(pick.x, window.innerWidth - 340), "top": pick.y }}>
          <h3>{pick.at.length > 1 ? t.here : pick.at[0]!.name}</h3>
          {pick.at.length > 1 ? (
            <ul>{pick.at.map((p) => (
              <li key={`${p.kind}:${p.from}`}>
                <Button tone="quiet" onClick={() => go(p)}>{p.name} <span className={styles.level}>· {t.levelNames[p.level]} · {t.open}</span></Button>
              </li>))}
            </ul>
          ) : <MarkActions place={pick.at[0]!} more={hasNext(places, pick.at[0]!.kind)}
                editable={editor.isEditable} onNext={() => jump(pick.at[0]!.kind)} onRemove={() => remove(pick.at[0]!)}
                onLink={() => { setPick(null); requestPanel("sources"); }}
                sources={holeNeedsSource(editor.state.doc, pick.at[0]!) ? sourcesOf(editor.state.doc) : undefined}
                onSource={(id) => { const p = pick.at[0]!; setPick(null); linkHoleToSource(editor, p, id); }}
                onAskSource={() => { const p = pick.at[0]!; setPick(null); askSourceInstead(editor, p); }} />}
          <Button tone="quiet" onClick={() => setPick(null)}>{t.close}</Button>
        </div>
      ) : null}
      <Dialog open={legend} title={t.legend.title} onClose={() => setLegend(false)}
        actions={<Button onClick={() => setLegend(false)}>{t.close}</Button>}>
        <p>{t.legend.intro}</p>
        {t.legend.groups.map((g) => (
          <section key={g.name}>
            <h3>{g.name}</h3>
            {g.rows.map((r) => (
              <div key={r.kind} className={styles.legendRow}>
                <span>{r.sample}</span>
                <span><strong>{r.kind}</strong>. {r.text} <span className={styles.level}>{t.legend.who}: {r.who}</span></span>
              </div>
            ))}
          </section>
        ))}
      </Dialog>
    </>
  );
}
