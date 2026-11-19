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
