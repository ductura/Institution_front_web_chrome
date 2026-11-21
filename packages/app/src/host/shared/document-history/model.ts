// Pure rules of the document history screen (WEB-1802; plan M8.13, D-198 t. 6). One list of imports
// for one work, the same component and the same answer for the student and the teacher: the port
// takes no role. Whatever the imported file says about itself (name, creator, dates, revisions) is
// shown as a claim from the file, never as a fact. The contract for the import event (M8.0-S1,
// M8.9) is still a proposal, so the port is the smallest shape the plan implies; a probe answer
// stands in for it in the tests. This module makes no network call.
import { documentHistoryMessages as text } from "./messages.hr";

export type ImportSource = "docx" | "pdf";

/** What the file says about itself; every field may be absent and none is verified. */
export type FileClaims = {
  readonly fileName?: string;
  readonly creator?: string;
  readonly createdAt?: string;
  readonly modifiedAt?: string;
  readonly revisions?: number;
};

export type ImportRecord = {
  readonly id: string;
  /** When the import was recorded by the system (ISO 8601). */
  readonly importedAt: string;
  readonly source: ImportSource;
  readonly claims: FileClaims;
};

export type HistoryRead =
  | { readonly kind: "ready"; readonly imports: readonly ImportRecord[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export interface DocumentHistoryPort {
  read(workId: string): Promise<HistoryRead>;
}

export type ClaimLine = { readonly key: keyof FileClaims; readonly label: string; readonly value: string; readonly text: string };

export type HistoryRow = {
  readonly id: string;
  readonly heading: string;
  readonly source: string;
  readonly claims: readonly ClaimLine[];
};

export type HistoryView =
  | { readonly kind: "ready"; readonly rows: readonly HistoryRow[] }
  | { readonly kind: "empty" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

const CLAIM_ORDER = ["fileName", "creator", "createdAt", "modifiedAt", "revisions"] as const;
const LABELS: Readonly<Record<keyof FileClaims, string>> = {
  fileName: text.fileName,
  creator: text.creator,
  createdAt: text.createdAt,
  modifiedAt: text.modifiedAt,
  revisions: text.revisions,
};

const stamp = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}. ${p(d.getUTCMonth() + 1)}. ${d.getUTCFullYear()}. ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
};

const isDateKey = (k: keyof FileClaims): boolean => k === "createdAt" || k === "modifiedAt";

/** Every claim line carries the "tvrdnja iz datoteke" mark in its text, so no reader can miss it. */
export function claimLines(claims: FileClaims): readonly ClaimLine[] {
  const lines: ClaimLine[] = [];
  for (const key of CLAIM_ORDER) {
    const raw = claims[key];
    if (raw === undefined || raw === null || raw === "") continue;
    if (key === "revisions" && !(Number.isInteger(raw) && (raw as number) >= 0)) continue;
    const value = isDateKey(key) ? stamp(String(raw)) : String(raw);
    lines.push({ key, label: LABELS[key], value, text: text.claimOf(LABELS[key], value) });
  }
  return lines;
}

export function historyRow(record: ImportRecord): HistoryRow {
  return {
    id: record.id,
    heading: text.importedAt(stamp(record.importedAt)),
    source: record.source === "pdf" ? text.sourcePdf : text.sourceDocx,
    claims: claimLines(record.claims),
  };
}

/** Newest import first; the order is by time only, never by who is reading. */
export function historyView(read: HistoryRead): HistoryView {
  if (read.kind !== "ready") return { kind: read.kind };
  if (read.imports.length === 0) return { kind: "empty" };
  const sorted = [...read.imports].sort((a, b) => Date.parse(b.importedAt) - Date.parse(a.importedAt));
  return { kind: "ready", rows: sorted.map(historyRow) };
}

/** Reads through the port; a failure is "unavailable", never a made-up value. */
export async function loadHistory(port: DocumentHistoryPort, workId: string): Promise<HistoryView> {
  try {
    return historyView(await port.read(workId));
  } catch {
    return { kind: "unavailable" };
  }
}
