/**
 * The eight save states and their wording, taken from Ductus
 * src/domain/sync/labels.ts at d52a92c (PROVENANCE.md). Never a bare
 * "Spremljeno" (PRODUCT §5); only SYNCED, reached with a server receipt,
 * earns the "ok" tone, and it is never the primary colour (tokens.test.ts).
 */
export type SaveTone = "neutral" | "progress" | "ok" | "warn" | "error";

export const SAVE_STATES = {
  EDITING: { label: "Uređivanje", tone: "neutral" },
  SAVING_LOCAL: { label: "Spremam lokalno", tone: "progress" },
  LOCAL_DURABLE: { label: "Spremljeno na uređaju", tone: "neutral" },
  SYNCING: { label: "Sinkroniziram", tone: "progress" },
  SYNCED: { label: "Spremljeno na poslužitelju", tone: "ok" },
  CONFLICT: { label: "Sukob", tone: "warn" },
  ERROR: { label: "Greška", tone: "error" },
  RECOVERY_REQUIRED: { label: "Potreban oporavak", tone: "error" },
} as const satisfies Record<string, { label: string; tone: SaveTone }>;

export type SaveStateName = keyof typeof SAVE_STATES;

/** Another tab holds the document: this tab claims nothing about saving. */
export const BLOCKED_TEXT = "Dokument je otvoren u drugoj kartici.";

export function saveStateContent(state: SaveStateName, blocked = false): { text: string; tone: SaveTone } {
  if (blocked) return { text: BLOCKED_TEXT, tone: "warn" };
  // A value from outside the table must never read as saved.
  const entry = Object.hasOwn(SAVE_STATES, state) ? SAVE_STATES[state] : SAVE_STATES.ERROR;
  return { text: entry.label, tone: entry.tone };
}
