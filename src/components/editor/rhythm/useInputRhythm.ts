"use client";

import { useEffect } from "react";

import { createRhythmRecorder, originOfInput, type OriginKind, type RhythmPort } from "@/client/input-rhythm";

const FLUSH_MS = 10_000;

/**
 * Watches the editor's DOM and sends the origin of each input and the rhythm of typing through
 * `port` (WEB-0910). It reads only `inputType`, never `data` or a key, changes nothing and
 * calls no `preventDefault`. Without a port, or with the setting off, it records no rhythm;
 * the origin is still counted (rhythm is the only part the teacher can turn off).
 */
export function useInputRhythm(dom: HTMLElement | null, documentId: string, port: RhythmPort | null, now: () => number = () => Date.now()): void {
  useEffect(() => {
    if (dom === null || port === null) return;
    const recorder = createRhythmRecorder(now, false);
    const counts = new Map<OriginKind, number>();
    let alive = true;

    void port.recording(documentId).then((on) => { if (alive) recorder.setEnabled(on); }, () => { /* stays off */ });

    const onBeforeInput = (event: InputEvent) => {
      if (!event.isTrusted) return;
      const kind = originOfInput({ inputType: event.inputType });
      if (kind === null) { recorder.breakBurst(); return; }
      if (kind === "typed") recorder.noteTyped();
      else recorder.breakBurst();
      const length = kind === "typed" ? 1 : 0; // pasted length is counted by the segment, not here
      counts.set(kind, (counts.get(kind) ?? 0) + length);
    };
    const flush = () => {
      const bursts = recorder.take();
      const origins = [...counts].map(([kind, codePoints]) => ({ kind, codePoints }));
      counts.clear();
      if (bursts.length === 0 && origins.length === 0) return;
      void port.send(documentId, { origins, bursts }).catch(() => { /* a later flush carries the next ones */ });
    };
    const onHidden = () => { if (document.visibilityState === "hidden") { recorder.breakBurst(); flush(); } };

    dom.addEventListener("beforeinput", onBeforeInput as EventListener);
    document.addEventListener("visibilitychange", onHidden);
    const timer = window.setInterval(flush, FLUSH_MS);
    return () => {
      alive = false;
      dom.removeEventListener("beforeinput", onBeforeInput as EventListener);
      document.removeEventListener("visibilitychange", onHidden);
      window.clearInterval(timer);
      flush();
    };
  }, [dom, documentId, port, now]);
}
