"use client";

// WEB-V13-UREDNIK (val 13): the editor of a slides work: the list of slides,
// the canvas of the selected one, speaker notes, undo and redo. Every change is
// built and applied as steps of `ductus-slide-steps-v1` (editor-model.ts) and
// handed to `onSteps`; there is no API here, the journal and sync that keep the
// steps belong to WEB-V13-DNEVNIK-SINKRONIZACIJA. States: loading, error (never
// "no data"), ready, and ready read-only for a submitted work.
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { Button, Card } from "@ductura/ui";
import { LoadAlert } from "../../states/States";
import type { SlideLayout, SlideSlot, SlideStep, SlidesDocument } from "../../../../../editor-core/src/slides/index.ts";
import {
  addSlide, createEditorState, moveSlide, redo, removeSlide, selectSlide, selectedSlide, setBlockText, setLayout, setListItem, setNotes, undo,
  type EditorState, type Outcome,
} from "./editor-model.ts";
import { NotesField } from "./NotesField.tsx";
import { SlideCanvas } from "./SlideCanvas.tsx";
import { SlideList } from "./SlideList.tsx";
import { fill, refusalText, slidesEditorText as t } from "./messages.hr.ts";
import styles from "./editor.module.css";

export type SlideEditorSource =
  | { kind: "loading" }
  | { kind: "error"; onRetry: () => void }
  | { kind: "ready"; doc: SlidesDocument; readOnly?: boolean };

export type SlideEditorProps = {
  source: SlideEditorSource;
  /** Every change, as the steps it is made of, after the editor applied them. */
  onSteps?: (steps: SlideStep[], after: SlidesDocument) => void;
  /** Whether the editor says its changes are not saved (no journal behind it); the sync of a slides work turns it off. */
  unsavedNote?: boolean;
  /** A fresh lowercase UUID v4 for a new slide or block. */
  newId?: () => string;
};

const freshId = () => crypto.randomUUID();

export function SlideEditor({ source, onSteps, newId = freshId, unsavedNote = true }: SlideEditorProps) {
  if (source.kind === "loading") return <Card title={t.region} busy />;
  if (source.kind === "error") {
    return (
      // Card's own `error` slot has no room for the retry button, so the frame (A2, U7) is written here.
      <Card title={t.errorTitle}>
        <LoadAlert body={t.errorBody} />
        <Button tone="secondary" onClick={source.onRetry}>{t.retry}</Button>
      </Card>
    );
  }
  return <ReadyEditor doc={source.doc} readOnly={source.readOnly === true} onSteps={onSteps} newId={newId} unsavedNote={unsavedNote} />;
}

function ReadyEditor({ doc, readOnly, onSteps, newId, unsavedNote }: { doc: SlidesDocument; readOnly: boolean; onSteps?: SlideEditorProps["onSteps"]; newId: () => string; unsavedNote: boolean }) {
  const [state, setState] = useState<EditorState>(() => createEditorState(doc));
  const latest = useRef(state);
  const queue = useRef<Promise<void>>(Promise.resolve());
  // Changes run one after another against the newest state: hashing is async and typing is fast.
  const run = useCallback((op: (current: EditorState) => Promise<Outcome>) => {
    queue.current = queue.current.then(async () => {
      let out: Outcome;
      try {
        out = await op(latest.current);
      } catch {
        // A change that throws (e.g. no Web Crypto for the hash) is refused with a message; the queue stays usable.
        out = { state: { ...latest.current, refusal: "failed" }, steps: [] };
      }
      latest.current = out.state;
      setState(out.state);
      if (out.steps.length > 0) onSteps?.(out.steps, out.state.doc);
    });
  }, [onSteps]);

  const slide = selectedSlide(state);
  const index = state.doc.slides.findIndex((candidate) => candidate.id === slide.id);
  const onKeyDown = (event: KeyboardEvent) => {
    if (readOnly || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) { event.preventDefault(); run(undo); }
    else if ((key === "z" && event.shiftKey) || key === "y") { event.preventDefault(); run(redo); }
  };
  return (
    <div className={styles.editor} role="region" aria-label={t.region} onKeyDown={onKeyDown}>
      {(readOnly || unsavedNote) && <p>{readOnly ? t.submittedNote : t.notSavedNote}</p>}
      {!readOnly && (
        <div className={styles.row}>
          <Button tone="secondary" size="small" aria-disabled={state.past.length === 0 || undefined} onClick={() => run(undo)}>{t.undo}</Button>
          <Button tone="secondary" size="small" aria-disabled={state.future.length === 0 || undefined} onClick={() => run(redo)}>{t.redo}</Button>
        </div>
      )}
      {state.refusal !== null && <p role="alert">{refusalText[state.refusal]}</p>}
      <div className={styles.layout}>
        <SlideList slides={state.doc.slides} selectedId={slide.id} readOnly={readOnly}
          onSelect={(id) => run(async (s) => ({ state: selectSlide(s, id), steps: [] }))}
          onAdd={() => run((s) => addSlide(s, "titleContent", newId()))}
          onRemove={() => run((s) => removeSlide(s, slide.id))}
          onMove={(delta) => run((s) => moveSlide(s, slide.id, delta))} />
        <div className={styles.stack} key={slide.id}>
          <p>{fill(t.slideOf, { n: index + 1, total: state.doc.slides.length })}</p>
          <SlideCanvas slide={slide} readOnly={readOnly} epoch={state.epoch}
            onLayout={(layout: SlideLayout) => run((s) => setLayout(s, slide.id, layout))}
            onText={(slot: SlideSlot, blockId, raw) => run((s) => setBlockText(s, slide.id, slot, blockId, raw, newId()))}
            onItem={(blockId, item, raw) => run((s) => setListItem(s, slide.id, blockId, item, raw))} />
          <NotesField notes={slide.notes} readOnly={readOnly} epoch={state.epoch} onChange={(raw) => run((s) => setNotes(s, slide.id, raw))} />
        </div>
      </div>
    </div>
  );
}
