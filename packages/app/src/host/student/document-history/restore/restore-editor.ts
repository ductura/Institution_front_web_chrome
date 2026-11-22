"use client";

// PIL-D7-OBNOVA: the open editor as the restore port needs it. The restored text enters the sheet the
// way a change of the author does (one editor command, `onUpdate`), so LocalDocument's saver journals
// it, the evidence session records it and the drain sends it to evidence.commit.post; nothing here
// sends a request. The receipt is read from the saver itself (`useLocalUnconfirmed().now`), never
// from the last render.
import { useLayoutEffect, useRef, useState } from "react";

import {
  useLocalEditor, useLocalSignedOut, useLocalUnconfirmed,
} from "@/components/editor/LocalDocument";
import { canonicalToTiptap } from "@/editor";

import type { RestoreEditor } from "./client-port";

/** How often and how long the restore waits for the server's receipt before it says "pending". */
export const CONFIRM_POLL_MS = 250;
export const CONFIRM_WITHIN_MS = 20_000;

type Now = { signedOut: boolean; unconfirmed: () => boolean; editable: () => boolean; apply: RestoreEditor["apply"] };

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
  const { now } = useLocalUnconfirmed();
  const latest = useRef<Now>({ signedOut, unconfirmed: now, editable: () => false, apply: () => false });
  useLayoutEffect(() => {
    latest.current = {
      signedOut,
      unconfirmed: now,
      editable: () => editor !== null && !editor.isDestroyed && editor.isEditable,
      // One replacement of the whole sheet, emitted as an update: the save path takes it like typing.
      apply: (document) => editor !== null && !editor.isDestroyed && editor.isEditable &&
        editor.commands.setContent(canonicalToTiptap(document), { emitUpdate: true }),
    };
  });
  const [port] = useState<RestoreEditor>(() => ({
    signedOut: () => latest.current.signedOut,
    writable: () => !latest.current.signedOut && latest.current.editable(),
    unconfirmed: () => latest.current.unconfirmed(),
    apply: (document) => latest.current.apply(document),
    confirmed: () => waitForReceipt(() => ({ signedOut: latest.current.signedOut, unconfirmed: latest.current.unconfirmed() })),
  }));
  return port;
}
