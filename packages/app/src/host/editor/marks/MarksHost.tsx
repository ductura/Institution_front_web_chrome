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
import { GHOST_KEY, ghostPlugin } from "./ghost";

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
export function MarkActions({ place, more, editable, onNext, onRemove, onLink }: {
  place: Place; more: boolean; editable: boolean; onNext: () => void; onRemove: () => void; onLink: () => void;
}) {
  const hole = place.kind === "hole";
  const plain = place.kind === "plain";
  return (
    <>
      <p>{t.explain[place.kind]}</p>
      {(more || ((hole || plain) && editable)) && (
        <div className={styles.actions}>
          {hole && editable && <Button onClick={onRemove}>{t.actions.checked}</Button>}
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

  // One click, one popover: a single mark opens its own explanation, several open "Na ovom mjestu".
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const dom = editor.view.dom;
    const onClick = (event: MouseEvent) => {
      const hit = editor.view.posAtCoords({ left: event.clientX, "top": event.clientY });
      const at = hit ? placesAt(places, hit.pos) : [];
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
  const dots = !host || !base || !showGutter(width) ? [] : gutterDots(places, (pos) => {
    try { return editor.view.coordsAtPos(pos).top - base.top; } catch { return null; }
  });

  // ED-60 (Ductus#2058 c.7187555639): no counter bar under the editor, as in the prototype, whose
  // counts are in the review; the jump to the next mark of a kind is the popover's "Sljedeće mjesto ›".
  return (
    <>
      {host && dots.length > 0 ? createPortal(
        <div className={styles.gutter} aria-hidden="true" data-gutter="" aria-label={t.gutter}>
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
                onLink={() => { setPick(null); requestPanel("sources"); }} />}
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
