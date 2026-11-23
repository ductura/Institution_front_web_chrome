"use client";

// PIL-P1-PODUDARANJE-EDITOR (P-1 rule 13): the student's notice of an assistant match, mounted in
// the student's own writing (/rad, the full editor) over the real route. The server stores no
// finding while the faculty switch is off, so the notice then shows nothing. It has no route for
// the explanation yet, so the notice asks for none.
// PIL-P1-PODUDARANJE-PROVJERA-WEB: a finding exists only for a paragraph the editor sent, so the
// host also sends each changed paragraph after its save is confirmed (segment-checks.ts) and, when
// the server answers with a match, reads the notice again.
import { useEffect, useMemo, useRef, useState } from "react";

import { createAssistantMatchCall, createSegmentPort, type MatchCall, type SegmentPort } from "@/client/assistant-match";
import { useLocalEditor, useLocalSaveRead, useLocalSignedOut, useLocalSubmitted } from "@/components/editor/LocalDocument";

import AssistantMatchNotice from "./AssistantMatchNotice";
import { createSegmentSender, segmentsOfDocument } from "./segment-checks";

/** What the host reads of the editor it sits beside. */
export type EditorWatch = {
  readonly editor: ReturnType<typeof useLocalEditor>;
  /** True once the work's text is in the editor (the provider's phase "ready"). */
  readonly opened: boolean;
  /** True while the last save is confirmed by the server (SYNCED). */
  readonly synced: boolean;
  readonly submitted: boolean;
  readonly signedOut: boolean;
};

/** The provider's editor and save state; the host is mounted inside LocalDocumentProvider. */
export function useLocalEditorWatch(): EditorWatch {
  const editor = useLocalEditor();
  const { phase, state } = useLocalSaveRead();
  const submitted = useLocalSubmitted();
  const signedOut = useLocalSignedOut();
  return { editor, opened: phase === "ready", synced: state === "SYNCED", submitted, signedOut };
}

export function AssistantMatchNoticeHost({ documentId, call, segments, useWatch = useLocalEditorWatch }: {
  documentId: string;
  call?: MatchCall;
  segments?: SegmentPort;
  /** A hook, constant for the host's life; tests pass a fake one. */
  useWatch?: () => EditorWatch;
}) {
  const port = useMemo(() => call ?? createAssistantMatchCall(), [call]);
  const send = useMemo(() => segments ?? createSegmentPort(), [segments]);
  const [revision, setRevision] = useState(0);
  const watch = useWatch();
  const latest = useRef(watch);
  latest.current = watch;

  const sender = useMemo(() => createSegmentSender({
    documentId,
    port: send,
    allowed: () => {
      const { editor, submitted, signedOut } = latest.current;
      return editor !== null && !editor.isDestroyed && editor.isEditable && !submitted && !signedOut;
    },
    onMatched: () => setRevision((n) => n + 1),
  }), [documentId, send]);

  const { editor, opened, synced } = watch;
  useEffect(() => {
    if (opened && editor !== null && !editor.isDestroyed) sender.opened(segmentsOfDocument(editor.state.doc));
  }, [opened, editor, sender]);
  useEffect(() => {
    if (synced && editor !== null && !editor.isDestroyed) void sender.saved(segmentsOfDocument(editor.state.doc));
  }, [synced, editor, sender]);

  return <AssistantMatchNotice call={port} documentId={documentId} explainable={false} revision={revision} />;
}
