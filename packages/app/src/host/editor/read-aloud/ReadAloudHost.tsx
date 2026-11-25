"use client";

// WEB-V20-NAGLAS-UREDNIK: reading aloud from the editor. Mounted inside the LocalDocumentProvider (sessionControls of
// the work page, next to MarksHost): it registers the "sentence being read" decoration, owns one reading per editor
// and stops it on Escape. It only reads the document; it never changes it and writes nothing to the journal.
import { useEffect, useSyncExternalStore } from "react";

import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { createReadAloud, type ReadAloudController, type ReadAloudState } from "./controller";
import { docRangeOf, readAloudPlugin, READ_ALOUD_KEY, setReadHighlight, sourceOfScope, type ReadScope, type ReadSource } from "./highlight";
import type { ReadAloudHost as SpeechHost } from "./support";
import { readAloudHr as t } from "./messages.hr";

type EditorLike = Parameters<typeof sourceOfScope>[0] extends infer S
  ? { state: S; view: { dispatch(tr: never): void }; isDestroyed: boolean }
  : never;

export type ReadNotice = keyof typeof t.status | null;
export type ReadSnapshot = { state: ReadAloudState; notice: ReadNotice; voiceFallback: boolean };

export type EditorReading = {
  read(scope: ReadScope): boolean;
  pause(): void;
  resume(): void;
  stop(): void;
  snapshot(): ReadSnapshot;
  subscribe(listener: () => void): () => void;
};

/** One reading over one editor. Pure of React so it can be tested with a fake `speechSynthesis`. */
export function createEditorReading(editor: EditorLike, speech: SpeechHost = globalThis as SpeechHost): EditorReading {
  const listeners = new Set<() => void>();
  let notice: ReadNotice = null;
  let source: ReadSource | null = null;
  let snap: ReadSnapshot = { state: "idle", notice: null, voiceFallback: false };
  const emit = () => {
    const next: ReadSnapshot = { state: controller.state, notice, voiceFallback: controller.voiceFallback };
    if (next.state !== snap.state || next.notice !== snap.notice || next.voiceFallback !== snap.voiceFallback) {
      snap = next;
      listeners.forEach((l) => l());
    }
  };
  const controller: ReadAloudController = createReadAloud({
    onChunkStart: (chunk) => {
      if (!source) return;
      setReadHighlight(editor as never, docRangeOf(source, chunk.start, chunk.end));
      emit();
    },
    onStateChange: () => emit(),
    onFinish: (reason) => {
      source = null;
      setReadHighlight(editor as never, null);
      notice = reason === "completed" ? "finished" : reason === "stopped" ? "stopped" : "failed";
      emit();
    },
  }, speech);
  notice = controller.state === "unsupported" ? "unsupported" : null;
  snap = { state: controller.state, notice, voiceFallback: false };

  return {
    read(scope) {
      if (editor.isDestroyed) return false;
      if (controller.state === "unsupported") { notice = "unsupported"; emit(); return false; }
      const next = sourceOfScope(editor.state as never, scope);
      if (!next || !next.text.trim()) {
        notice = scope === "selection" ? "noSelection" : "noText";
        emit();
        return false;
      }
      source = next;
      notice = null;
      const started = controller.start(next.text);
      if (!started) { source = null; notice = "noText"; }
      emit();
      return started;
    },
    pause() { controller.pause(); emit(); },
    resume() { controller.resume(); emit(); },
    stop() { controller.stop(); emit(); }, // the core wakes a paused synthesiser itself (#645)
    snapshot: () => snap,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

const sessions = new WeakMap<object, EditorReading>();

/** The reading of this editor (created on first use), shared by the host and the toolbar menu. */
export function readingOf(editor: object & EditorLike): EditorReading {
  let found = sessions.get(editor);
  if (!found) { found = createEditorReading(editor); sessions.set(editor, found); }
  return found;
}

const IDLE: ReadSnapshot = { state: "idle", notice: null, voiceFallback: false };

export function useEditorReading(editor: (object & EditorLike) | null): ReadSnapshot {
  return useSyncExternalStore(
    (listener) => (editor ? readingOf(editor).subscribe(listener) : () => undefined),
    () => (editor ? readingOf(editor).snapshot() : IDLE),
    () => IDLE,
  );
}

type Bindable = EditorLike & {
  registerPlugin(plugin: unknown): void;
  unregisterPlugin(key: unknown): void;
  on(event: "update", fn: () => void): unknown;
  off(event: "update", fn: () => void): unknown;
};

/** Text of the live region for a snapshot. */
export function statusText(snap: ReadSnapshot): string {
  const text = snap.notice ? t.status[snap.notice] : snap.state === "reading" ? t.status.reading : snap.state === "paused" ? t.status.paused : "";
  return snap.voiceFallback && snap.state !== "idle" ? `${text} ${t.status.voiceFallback}` : text;
}

/** Registers the highlight plugin, Escape and the stop-on-edit; returns the cleanup. Escape that another control already used (menu, dialog) is not ours. */
export function bindReading(editor: Bindable, reading: EditorReading, target: Pick<EventTarget, "addEventListener" | "removeEventListener">): () => void {
  editor.registerPlugin(readAloudPlugin());
  const active = () => { const state = reading.snapshot().state; return state === "reading" || state === "paused"; };
  const onKey = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.key === "Escape" && !key.defaultPrevented && active()) reading.stop();
  };
  // The read positions are those of the text when reading began: an edit ends the reading instead of highlighting stale text.
  const onUpdate = () => { if (active()) reading.stop(); };
  target.addEventListener("keydown", onKey);
  editor.on("update", onUpdate);
  return () => {
    target.removeEventListener("keydown", onKey);
    editor.off("update", onUpdate);
    reading.stop();
    if (!editor.isDestroyed) editor.unregisterPlugin(READ_ALOUD_KEY);
  };
}

export function ReadAloudHost() {
  const editor = useLocalEditor();
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    return bindReading(editor as never, readingOf(editor as never), window);
  }, [editor]);
  const snap = useEditorReading((editor as never) ?? null);
  if (!editor || editor.isDestroyed) return null;
  // One polite live region: the screen reader hears the state, nothing else is drawn here.
  return <span role="status" aria-live="polite" data-read-aloud-status="">{statusText(snap)}</span>;
}
