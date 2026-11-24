"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

import { useLocalSaveRead, useLocalStatus } from "./LocalDocument";
import { levelAnnouncement, saveLevelOf, waitingText, type SaveLevel } from "./save-level";
import StatusBar, { statusSaveOf } from "./StatusBar";

/**
 * The status bar bound to the page's document provider (WEB-14b).
 *
 * `evidence`: the provider was given the assignment, so its saver is the
 * EvidenceSession. "Na poslužitelju" needs that session's `receiptVerified`
 * (INT-11): a receipt passed the Ed25519 check in this page session. A SYNCED
 * state without it, such as one read back from the journal, shows as saved
 * on the device. Without `evidence` the local saver never sends and nothing
 * is verified.
 *
 * With `online` (ED-01c, NF2-P2): only a change of level is announced, and
 * offline the chip says how many changes wait (`pending`, from the journal).
 */
export default function StatusBarLive({
  evidence,
  length,
  online,
  pending = null,
  liveWords = false,
  children,
}: {
  evidence: boolean;
  length?: ComponentProps<typeof StatusBar>["length"];
  online?: boolean;
  pending?: number | null;
  /** Count the words of the open text live instead of taking `length.words` (the host passes null). */
  liveWords?: boolean;
  children?: ReactNode;
}) {
  const status = useLocalStatus();
  const shown = length && liveWords ? { ...length, words: status.loading ? null : status.words } : length;
  const { phase, state, receiptVerified } = useLocalSaveRead();
  const save = online !== undefined && phase === "unavailable"
    ? { state: "ERROR", receiptSigned: false, blocked: false } as const
    : statusSaveOf({ phase, state, receiptVerifiedHere: evidence && receiptVerified });
  const level = saveLevelOf(save, online);
  const said = useLevelAnnouncement(level);
  return (
    <StatusBar save={save} length={shown} online={online} said={said}
      waiting={pending !== null && pending > 0 ? waitingText(pending) : null}>{children}</StatusBar>
  );
}

/** The last change of level, as said; the level the page opens on is not announced. */
function useLevelAnnouncement(level: SaveLevel | null): string | null {
  const lastRef = useRef<SaveLevel | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    if (level === null) return;
    const text = levelAnnouncement(lastRef.current, level);
    lastRef.current = level;
    if (text !== null) setSaid(text);
  }, [level]);
  return said;
}
