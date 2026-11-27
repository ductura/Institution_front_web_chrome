import { SaveState, type SaveStateName } from "@ductura/ui";
import { SaveStatus } from "@ductura/ui/save-status";
import type { ReactNode } from "react";

import { pluralHr } from "../../lib/i18n/hr";
import { messagesHr as t } from "../../lib/i18n/messages.hr";

import { ScopeAnnounce } from "./ScopeAnnounce";
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
 * `receiptVerifiedHere`: the explicit result of the receipt check, true only
 * once a receipt for the text on the sheet passed the Ed25519 check in this
 * page session (G3). A SYNCED read back from the journal (a reload, or the
 * server's version taken over) is not that: until a new receipt is verified
 * here the bar says the text is on the device. The local saver never sends,
 * so it never passes true.
 */
export type SaveRead = {
  readonly phase: DocumentPhase;
  readonly state: SaveStateName | null;
  readonly receiptVerifiedHere: boolean;
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
  return { state: read.state, receiptSigned: read.receiptVerifiedHere && read.state === "SYNCED", blocked: false };
}

/** The assignment's word limits as student.assignment-requirements.get gives them (WEB-22). */
export type ScopeRange = { readonly min: number; readonly max: number } | null;

/**
 * ED-48 (P2-24): the page estimate as the prototype makes it (app.js, rules.js, text2.js):
 * 350 words a page, rounded up, at least one; none before the first word. The orchestrator
 * set the prototype as the source; length-line's 300 is a different, older measure.
 */
export const WORDS_PER_PAGE = 350;
export const pagesApprox = (words: number): number => (words > 0 ? Math.max(1, Math.ceil(words / WORDS_PER_PAGE)) : 0);

/** "1.200": thousands grouped with a dot, as E-7 writes the range. */
export const groupDot = (n: number): string => String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * The length part of the bar (WEB-23, S: E-7): "340 riječi", "opseg 1.200 do
 * 1.600", "vidite samo Vi". `words` counts the text of the work only (notes are
 * not counted) and is null while no editor counts it; `range` is null while
 * the assignment's range is not known. Null when there is nothing to say.
 * Design alignment 27. 11. 2026. (S-07): the parts, each its own element 12 px
 * apart, never joined by a dot.
 */
export function scopeLine(words: number | null, range: ScopeRange): readonly string[] | null {
  const parts: string[] = [];
  if (words !== null) parts.push(`${groupDot(words)} ${pluralHr(words, "riječ", "riječi", "riječi")}`);
  if (range !== null) {
    parts.push(t.workspace.scopeRange.replace("{min}", groupDot(range.min)).replace("{max}", groupDot(range.max)));
  }
  // ED-48 (P2-24): "≈ n str." after the count and the range, as in the prototype; none before the first word.
  const pages = words === null ? 0 : pagesApprox(words);
  if (pages > 0) parts.push(t.workspace.pagesApprox.replace("{pages}", String(pages)));
  const standing = scopeStanding(words, range);
  if (standing !== null && words !== null && range !== null) parts.push(scopeFact(standing, words, range));
  if (parts.length === 0) return null;
  parts.push(t.workspace.scopePrivate);
  return parts;
}

/** ED-04 (NF2-P6): where the count stands against the assignment's range; null without either. */
export type ScopeStanding = "below" | "within" | "above";

export function scopeStanding(words: number | null, range: ScopeRange): ScopeStanding | null {
  if (words === null || range === null) return null;
  return words < range.min ? "below" : words > range.max ? "above" : "within";
}

/** The plain fact beside the range, without colour: it describes the task, not the student. */
function scopeFact(standing: ScopeStanding, words: number, range: NonNullable<ScopeRange>): string {
  if (standing === "below") return t.workspace.scopeBelow.replace("{n}", groupDot(range.min - words));
  if (standing === "above") return t.workspace.scopeAbove.replace("{n}", groupDot(words - range.max));
  return t.workspace.scopeWithin;
}

/** The one sentence said when the count crosses a limit (never on opening, never while typing inside a band). */
export function scopeSaid(standing: ScopeStanding, words: number, range: NonNullable<ScopeRange>): string {
  if (standing === "below") return t.workspace.scopeSaidBelow;
  if (standing === "within") return t.workspace.scopeSaidWithin;
  const over = words - range.max;
  return t.workspace.scopeSaidAbove.replace("{n}", groupDot(over)).replace("{words}", pluralHr(over, "riječ", "riječi", "riječi"));
}

/**
 * The 30 px status bar under the sheet. `save` is null while no journal is
 * open on this page: the bar then says that nothing is saved here, never a
 * save state. A submitted work (`readOnly`) says it is read only instead.
 * `length` is the scope line (WEB-23); `children` takes the rest of the bar.
 *
 * With `online` (the product editor, ED-01c): the chip is not a live region,
 * so a pause in typing is not announced; `said` is, in its own region, and
 * the page sets it only when the level changes. Offline the chip adds what
 * `waiting` counts (NF2-P2 c).
 */
export default function StatusBar({
  save,
  readOnly = false,
  length,
  children,
  online,
  waiting = null,
  said = null,
}: {
  save: StatusSave | null;
  readOnly?: boolean;
  length?: { readonly words: number | null; readonly range: ScopeRange };
  children?: ReactNode;
  online?: boolean;
  /** Offline only: what waits to be sent, as `waitingText` writes it. */
  waiting?: string | null;
  said?: string | null;
}) {
  const scope = length === undefined ? null : scopeLine(length.words, length.range);
  const calm = online !== undefined;
  const waitingLine = online === false && waiting ? waiting : undefined;
  return (
    <footer className={styles.bar} aria-label={t.workspace.status}>
      {readOnly ? (
        <SaveState state="SYNCED" label={t.workspace.readOnly} />
      ) : save === null ? (
        <SaveState state="LOCAL_DURABLE" label={t.workspace.statusNoJournal} />
      ) : (
        calm ? <SaveStatus state={shownSaveState(save)} blocked={save.blocked} online={online} waiting={waitingLine} live={false} />
          : <SaveState state={shownSaveState(save)} blocked={save.blocked} />
      )}
      {calm ? <span className={styles.said} role="status">{said ?? ""}</span> : null}
      {scope === null ? null : <span className={styles.scope}>{scope.map((part) => <span key={part}>{part}</span>)}</span>}
      {length === undefined ? null : <ScopeAnnounce words={length.words} range={length.range} />}
      {children}
    </footer>
  );
}
