"use client";

// PIL-P1-PODUDARANJE-EDITOR (P-1 rule 13): the student's notice of an assistant match, mounted in
// the student's own writing (/rad, the full editor) over the real route. The server stores no
// finding while the faculty switch is off, so the notice then shows nothing.
// ED-13 (NF2-P13): "Objasni, ako želiš…" sends the explanation over its own route, but only from the
// writable editor: a submitted work or a replay shows the notice without it.
// PIL-P1-PODUDARANJE-PROVJERA-WEB: a finding exists only once a segment is checked, so the host also
// sends the segments the student changed, after a pause in writing, and reads the notice again when
// one of them matched. Only the writable editor is followed: a submitted work or a replay is
// read-only and sends nothing.
import { useEffect, useMemo, useState } from "react";

import { createAssistantMatchCall, createSegmentCheck, type MatchCall, type SegmentCheck } from "@/client/assistant-match";

import { writableEditor } from "../save-status/InputRhythmHost";
import AssistantMatchNotice from "./AssistantMatchNotice";
import { segmentsIn, segmentsToCheck } from "./segment-check";

/** How long the student pauses before the changed segments are checked. */
export const IDLE_MS = 3000;

/** A refusal after which the check stops for this editor: signed out, or not the owner's work. */
const STOPS = new Set([401, 403, 404]);

export function AssistantMatchNoticeHost({ documentId, call, check }: { documentId: string; call?: MatchCall; check?: SegmentCheck }) {
  const port = useMemo(() => call ?? createAssistantMatchCall(), [call]);
  const send = useMemo(() => check ?? createSegmentCheck(), [check]);
  const [dom, setDom] = useState<HTMLElement | null>(null);
  const [version, setVersion] = useState(0);

  // The editor mounts after the page and becomes read-only on submit: follow it, do not assume it.
  useEffect(() => {
    const follow = () => setDom((current) => {
      const next = writableEditor();
      return current === next ? current : next;
    });
    follow();
    const observer = new MutationObserver(follow);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["contenteditable"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (dom === null) return;
    // What the editor opened with was written before: only what changes from now on is checked.
    const checked = new Map(segmentsIn(dom).map((s) => [s.segmentRef, s.text]));
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const writable = () => !stopped && dom.isConnected && dom.getAttribute("contenteditable") === "true";
    const run = async () => {
      if (!writable()) return;
      if (running) {
        timer = setTimeout(() => void run(), IDLE_MS);
        return;
      }
      running = true;
      let matched = false;
      for (const segment of segmentsToCheck(segmentsIn(dom), checked)) {
        if (!writable()) break;
        const answer = await send(documentId, segment);
        if (answer.ok) {
          checked.set(segment.segmentRef, segment.text);
          matched ||= answer.matched > 0;
        } else if (answer.status === 422) {
          checked.set(segment.segmentRef, segment.text);
        } else {
          if (STOPS.has(answer.status)) stopped = true;
          break;
        }
      }
      running = false;
      if (matched && !stopped) setVersion((v) => v + 1);
    };
    const onInput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void run(), IDLE_MS);
    };
    dom.addEventListener("input", onInput);
    return () => {
      stopped = true;
      clearTimeout(timer);
      dom.removeEventListener("input", onInput);
    };
  }, [dom, documentId, send]);

  return <AssistantMatchNotice call={port} documentId={documentId} explainable={dom !== null} version={version} />;
}
