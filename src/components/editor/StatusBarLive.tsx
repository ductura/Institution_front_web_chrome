"use client";

import { useLocalSaveRead } from "./LocalDocument";
import StatusBar, { statusSaveOf } from "./StatusBar";

/**
 * The status bar bound to the page's document provider (WEB-14b).
 *
 * `evidence`: the provider was given the assignment, so its saver is the
 * EvidenceSession. That session reports SYNCED only after a receipt passed
 * the Ed25519 check in this page session (G3, `state()` in
 * evidence-session.ts): a SYNCED left in the journal, by a reload or the
 * server's version taken over, it reports as LOCAL_DURABLE. So its SYNCED is
 * the verified result, and only its SYNCED. Without `evidence` the local
 * saver never sends and nothing is verified.
 */
export default function StatusBarLive({ evidence }: { evidence: boolean }) {
  const { phase, state } = useLocalSaveRead();
  return <StatusBar save={statusSaveOf({ phase, state, receiptVerifiedHere: evidence && state === "SYNCED" })} />;
}
