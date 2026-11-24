import { pluralHr } from "../../lib/i18n/hr";
import { messagesHr as t } from "../../lib/i18n/messages.hr";

import { shownSaveState, type StatusSave } from "./StatusBar";

/**
 * ED-01c (NF2-P2): the levels a screen reader hears about. A pause in typing
 * moves the chip between "Sprema se…" and "Spremljeno na uređaju", but stays
 * on one level, so it is never announced (G-9).
 */
export type SaveLevel = "device" | "server" | "error" | "conflict" | "offline";

/**
 * The level of what the chip shows. "server" only with a signed receipt
 * (B-6, `shownSaveState`); an error outranks the network; while another tab
 * holds the document, or nothing is claimed, there is no level.
 */
export function saveLevelOf(save: StatusSave | null, online: boolean | undefined): SaveLevel | null {
  if (save === null || save.blocked) return null;
  const state = shownSaveState(save);
  if (state === "CONFLICT") return "conflict";
  if (state === "ERROR" || state === "RECOVERY_REQUIRED") return "error";
  if (online === false) return "offline";
  return state === "SYNCED" ? "server" : "device";
}

/** What is said when the level changes; nothing for the first level or the same one. */
export function levelAnnouncement(before: SaveLevel | null, after: SaveLevel | null): string | null {
  if (before === null || after === null || before === after) return null;
  return t.workspace.saveLevel[after];
}

const changes = (n: number): string => `${n} ${pluralHr(n, "izmjena", "izmjene", "izmjena")}`;

/** "čeka slanje: 2 izmjene" (NF2-P2 c). */
export const waitingText = (n: number): string => t.workspace.waiting.replace("{n}", changes(n));

/** "Šalje se 2 izmjene." after the network returns; without a count, the text on the device. */
export const reconnectText = (n: number | null): string =>
  n === null ? t.workspace.reconnectSendingText : t.workspace.reconnectSending.replace("{n}", changes(n));

/** "Čeka slanje: 2 izmjene." in the offline notice (NF2-P2 c). */
export const offlineWaitingText = (n: number): string => t.workspace.offlineWaiting.replace("{n}", changes(n));

/**
 * Whether "Veza je vraćena." is shown (NF2-P2 b): from the moment the network
 * returns with changes waiting, until nothing waits (`settled`: the journal is
 * empty or a receipt was verified here). It never says the server; once it
 * goes, the chip says what holds.
 */
export function reconnectShown(
  shown: boolean,
  wasOnline: boolean,
  now: { readonly online: boolean; readonly pending: number | null; readonly settled: boolean },
): boolean {
  if (!now.online || now.settled) return false;
  return wasOnline ? shown : true;
}
