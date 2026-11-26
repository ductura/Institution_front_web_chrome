// WEB-V22-ISVU-MODEL: pure model of the trial ISVU roster import preview (no network).
import { isvuImportMessages as m } from "./messages.hr";

export type IsvuRowStatus = "new" | "already_enrolled" | "unsuitable";
export type IsvuRowReason =
  | "invalid_identifier" | "missing_name" | "duplicate" | "unknown_account"
  | "ineligible_account" | "name_mismatch" | "removed" | "course_teacher";

export const ISVU_ROW_STATUSES: readonly IsvuRowStatus[] = ["new", "already_enrolled", "unsuitable"];
export const ISVU_ROW_REASONS: readonly IsvuRowReason[] = [
  "invalid_identifier", "missing_name", "duplicate", "unknown_account",
  "ineligible_account", "name_mismatch", "removed", "course_teacher",
];

export interface IsvuPreviewRow { readonly status: string; readonly reason?: string | null }

const own = (table: Readonly<Record<string, string>>, key: string | null | undefined): string | undefined =>
  key && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;

export const statusText = (status: string): string => own(m.status, status) ?? m.unknownReason;

/** Croatian text for a review reason; an unknown or missing reason never renders as empty. */
export const reasonText = (reason: string | null | undefined): string =>
  own(m.reason, reason) ?? m.unknownReason;

export interface IsvuCounts { readonly new: number; readonly already_enrolled: number; readonly unsuitable: number; readonly total: number }

/** Totals per state computed from rows; rows with an unknown state count as unsuitable. */
export const countByStatus = (rows: readonly IsvuPreviewRow[]): IsvuCounts => {
  let n = 0, a = 0, u = 0;
  for (const r of rows) {
    if (r.status === "new") n += 1;
    else if (r.status === "already_enrolled") a += 1;
    else u += 1;
  }
  return { new: n, already_enrolled: a, unsuitable: u, total: n + a + u };
};

export const countsSummary = (c: IsvuCounts): readonly string[] => [
  m.counts.new(c.new), m.counts.already_enrolled(c.already_enrolled), m.counts.unsuitable(c.unsuitable), m.counts.total(c.total),
];

/** Confirmation can enrol someone only when at least one row is new. */
export const hasNewStudents = (c: IsvuCounts): boolean => c.new > 0;
