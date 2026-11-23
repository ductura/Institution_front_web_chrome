"use client";

// PIL-D7-OBNOVA: the open editor as the restore port needs it. The restored text enters the sheet the
// way a change of the author does (one editor command, `onUpdate`), so LocalDocument's saver journals
// it, the evidence session records it and the drain sends it to evidence.commit.post; nothing here
// sends a request. The receipt is read from the saver itself (`useLocalUnconfirmed().now`), never
// from the last render.
import type { Editor } from "@tiptap/core";
import { useLayoutEffect, useRef, useState } from "react";

import {
  useLocalEditor, useLocalSignedOut, useLocalUnconfirmed,
} from "@/components/editor/LocalDocument";
import type { CanonicalDocument } from "@/domain/document";
import { canonicalToTiptap } from "@/editor";

import type { RestoreEditor } from "./client-port";

/** How often and how long the restore waits for the server's receipt before it says "pending". */
export const CONFIRM_POLL_MS = 250;
export const CONFIRM_WITHIN_MS = 20_000;

type Now = {
  signedOut: boolean; unconfirmed: () => boolean; edits: () => number; editable: () => boolean; apply: RestoreEditor["apply"];
};

/**
 * One replacement of the whole sheet with the restored document, emitted as an update, so the editor's
 * `onUpdate` and `transaction` listeners take it like typing: journal, evidence recorder, drain.
 * evidence-path.test.ts runs this very function against a real editor and EvidenceSession.
 */
export function applyRestoredDocument(editor: Editor, document: CanonicalDocument): boolean {
  if (!editor.isEditable) return false;
  return editor.commands.setContent(canonicalToTiptap(document), { emitUpdate: true });
}

/**
 * Waits until nothing in the sheet is unconfirmed, the session ends, or the time is up. A timer, not a
 * subscription: LocalDocument offers no listener, and a poll of a few reads costs nothing.
 */
export function waitForReceipt(
  read: () => { signedOut: boolean; unconfirmed: boolean },
  { pollMs = CONFIRM_POLL_MS, withinMs = CONFIRM_WITHIN_MS, schedule = setTimeout }: {
    pollMs?: number; withinMs?: number; schedule?: (run: () => void, ms: number) => unknown;
  } = {},
): Promise<"confirmed" | "signedOut" | "waiting"> {
  return new Promise((resolve) => {
    let waited = 0;
    const check = () => {
      const now = read();
      if (now.signedOut) return resolve("signedOut");
      if (!now.unconfirmed) return resolve("confirmed");
      if (waited >= withinMs) return resolve("waiting");
      waited += pollMs;
      schedule(check, pollMs);
    };
    // The change waits out the editor's debounce first, so the first look is one poll later.
    schedule(check, pollMs);
  });
}

export function useRestoreEditor(): RestoreEditor {
  const editor = useLocalEditor();
  const signedOut = useLocalSignedOut();
  const { now, edits } = useLocalUnconfirmed();
  const latest = useRef<Now>({ signedOut, unconfirmed: now, edits, editable: () => false, apply: () => false });
  useLayoutEffect(() => {
    latest.current = {
      signedOut,
      unconfirmed: now,
      edits,
      editable: () => editor !== null && !editor.isDestroyed && editor.isEditable,
      // A destroyed editor (the sheet unmounted meanwhile) takes nothing.
      apply: (document) => editor !== null && !editor.isDestroyed && applyRestoredDocument(editor, document),
    };
  });
  const [port] = useState<RestoreEditor>(() => ({
    signedOut: () => latest.current.signedOut,
    writable: () => !latest.current.signedOut && latest.current.editable(),
    unconfirmed: () => latest.current.unconfirmed(),
    edits: () => latest.current.edits(),
    apply: (document) => latest.current.apply(document),
    confirmed: () => waitForReceipt(() => ({ signedOut: latest.current.signedOut, unconfirmed: latest.current.unconfirmed() })),
  }));
  return port;
}
