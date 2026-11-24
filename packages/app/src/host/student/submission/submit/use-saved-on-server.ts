"use client";

// WEB-NUZ-PREDAJA-2 (NF-3 PR-8, R-58): after a refused submission ("Predaja nije prihvaćena"),
// "Pokušaj ponovno" opens only once this device holds nothing of the document the server has not
// confirmed: the same check as INT-16 (local-hold.ts), which is what the workspace shows as
// "Spremljeno na poslužitelju". Looked at on opening, every few seconds and when the connection
// comes back; the device's journal is only read.
import { useEffect, useState } from "react";

export const SAVED_EVERY_MS = 3_000;

/** "checking" before the first look; "pending" while the device holds unconfirmed text; "saved" once it does not. */
export type SavedState = "checking" | "pending" | "saved";

export function useSavedOnServer(documentId: string | null, hasNewer: (documentId: string) => Promise<boolean>): SavedState {
  const [state, setState] = useState<SavedState>("checking");
  useEffect(() => {
    if (documentId === null) return undefined;
    let live = true;
    setState("checking");
    const look = () => {
      void hasNewer(documentId).then((newer) => newer, () => true).then((newer) => { if (live) setState(newer ? "pending" : "saved"); });
    };
    look();
    const every = setInterval(look, SAVED_EVERY_MS);
    window.addEventListener("online", look);
    return () => { live = false; clearInterval(every); window.removeEventListener("online", look); };
  }, [documentId, hasNewer]);
  return state;
}
