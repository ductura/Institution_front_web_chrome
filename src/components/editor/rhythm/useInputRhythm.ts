"use client";

import { useEffect } from "react";

import { createRhythmRecorder, originOfInput, type OriginKind, type RhythmPayload, type RhythmPort } from "@/client/input-rhythm";

import { onRhythmErased } from "./erased";

const FLUSH_MS = 10_000;

/**
 * Reads the teacher's switch again and sends `payload` only while it is on (PIL-P1-RITAM-PREKIDAC).
 * `onSetting` hands the answer to the recorder, so an "off" holds from this moment; with it off the
 * payload is dropped, never sent later. `stillWanted` is asked just before the send: false (the
 * student deleted the rhythm meanwhile) drops it as well. Resolves true when it was sent.
 */
export async function sendIfOn(port: RhythmPort, documentId: string, payload: RhythmPayload, onSetting: (on: boolean) => void, stillWanted: () => boolean = () => true): Promise<boolean> {
  const on = await port.recording(documentId);
  onSetting(on);
  if (!on || !stillWanted()) return false;
  await port.send(documentId, payload);
  return true;
}

/**
 * Watches the editor's DOM and sends the origin of each input and the rhythm of typing through
 * `port` (WEB-0910). It reads only `inputType`, never `data` or a key, changes nothing and
 * calls no `preventDefault`. Without a port, or with the setting off, it records no rhythm;
 * the origin is still counted (rhythm is the only part the teacher can turn off). The setting is
 * read when the editor opens and again before each send, so a teacher's "off" holds from then on.
 */
export function useInputRhythm(dom: HTMLElement | null, documentId: string, port: RhythmPort | null, now: () => number = () => Date.now()): void {
  useEffect(() => {
    if (dom === null || port === null) return;
    const recorder = createRhythmRecorder(now, false);
    const counts = new Map<OriginKind, number>();
    let alive = true;
    // A confirmed delete drops what is measured and not yet sent, also a send already on its way.
    let erasures = 0;
    const offErased = onRhythmErased((erased) => {
      if (erased !== documentId) return;
      erasures += 1;
      recorder.take();
      counts.clear();
    });

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
    // The teacher's switch is read again before every send (PIL-P1-RITAM-PREKIDAC): off holds from
    // that moment, and what was measured but not yet sent is dropped, never sent after the switch.
    const flush = () => {
      const bursts = recorder.take();
      const origins = [...counts].map(([kind, codePoints]) => ({ kind, codePoints }));
      counts.clear();
      if (bursts.length === 0 && origins.length === 0) return;
      const at = erasures;
      void sendIfOn(port, documentId, { origins, bursts }, (on) => { if (alive) recorder.setEnabled(on); }, () => at === erasures)
        .catch(() => { /* a later flush carries the next ones */ });
    };
    const onHidden = () => { if (document.visibilityState === "hidden") { recorder.breakBurst(); flush(); } };

    dom.addEventListener("beforeinput", onBeforeInput as EventListener);
    document.addEventListener("visibilitychange", onHidden);
    const timer = window.setInterval(flush, FLUSH_MS);
    return () => {
      alive = false;
      offErased();
      dom.removeEventListener("beforeinput", onBeforeInput as EventListener);
      document.removeEventListener("visibilitychange", onHidden);
      window.clearInterval(timer);
      flush();
    };
  }, [dom, documentId, port, now]);
}
