import { SaveState, type SaveStateName } from "@ductura/ui";
import type { ReactNode } from "react";

import { messagesHr as t } from "../../lib/i18n/messages.hr";

import styles from "./StatusBar.module.css";

/**
 * What the status bar is told about saving (WEB-14). `receiptSigned`: the
 * server's last answer carried a receipt whose Ed25519 signature checked out.
 * `blocked`: editor-core found the document open in another tab (A-12).
 */
export type StatusSave = {
  readonly state: SaveStateName;
  readonly receiptSigned: boolean;
  readonly blocked: boolean;
};

/**
 * The state the chip may show. SYNCED ("Spremljeno na poslužitelju") only with
 * a signed receipt (B-6): without one the text is known to be on the device
 * only, so the chip says that and nothing more.
 */
export function shownSaveState(save: Pick<StatusSave, "state" | "receiptSigned">): SaveStateName {
  return save.state === "SYNCED" && !save.receiptSigned ? "LOCAL_DURABLE" : save.state;
}

/** The phases of the writing page's document provider (LocalDocument). */
export type DocumentPhase = "loading" | "blocked" | "ready" | "recovery" | "unavailable" | "signed-out";

/**
 * What the document provider reports, as the bar reads it (WEB-14b).
 * `evidence`: the evidence session saves this sheet, so its SYNCED comes only
 * from a receipt verified in this page session (G3); the local saver never
 * sends, so nothing it reports is signed.
 */
export type SaveRead = {
  readonly phase: DocumentPhase;
  readonly state: SaveStateName | null;
  readonly evidence: boolean;
};

/**
 * The bar's `save` for one read of the provider, or null while there is no
 * state to claim: the journal is still read, the browser has no storage, or
 * the session has ended. Another tab's lock shows the block (A-12) and no
 * state; a sheet in recovery says RECOVERY_REQUIRED, never its last state.
 */
export function statusSaveOf(read: SaveRead): StatusSave | null {
  if (read.phase === "blocked") return { state: "LOCAL_DURABLE", receiptSigned: false, blocked: true };
  if (read.phase === "recovery") return { state: "RECOVERY_REQUIRED", receiptSigned: false, blocked: false };
  if (read.phase !== "ready" || read.state === null) return null;
  return { state: read.state, receiptSigned: read.evidence && read.state === "SYNCED", blocked: false };
}

/**
 * The 30 px status bar under the sheet. `save` is null while no journal is
 * open on this page: the bar then says that nothing is saved here, never a
 * save state. `children` takes the rest of the bar (length, network).
 */
export default function StatusBar({ save, children }: { save: StatusSave | null; children?: ReactNode }) {
  return (
    <footer className={styles.bar} aria-label={t.workspace.status}>
      {save === null ? (
        <span>{t.workspace.statusNoJournal}</span>
      ) : (
        <SaveState state={shownSaveState(save)} blocked={save.blocked} />
      )}
      {children}
    </footer>
  );
}
