"use client";

import type { ComponentProps, ReactNode } from "react";

import { useLocalSaveRead, useLocalStatus } from "./LocalDocument";
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
export default function StatusBarLive({
  evidence,
  length,
  online,
  liveWords = false,
  children,
}: {
  evidence: boolean;
  length?: ComponentProps<typeof StatusBar>["length"];
  online?: boolean;
  /** Count the words of the open text live instead of taking `length.words` (the host passes null). */
  liveWords?: boolean;
  children?: ReactNode;
}) {
  const status = useLocalStatus();
  const shown = length && liveWords ? { ...length, words: status.loading ? null : status.words } : length;
  const { phase, state } = useLocalSaveRead();
  const save = online !== undefined && phase === "unavailable"
    ? { state: "ERROR", receiptSigned: false, blocked: false } as const
    : statusSaveOf({ phase, state, receiptVerifiedHere: evidence && state === "SYNCED" });
  return <StatusBar save={save} length={shown} online={online}>{children}</StatusBar>;
}
