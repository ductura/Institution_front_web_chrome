// Pure rules of NF-5 PG-11 in "Pregled rada": what the export of the work may show. No network call here.
// The PDF itself is read by the editor's reader of work.export-pdf.get (host/editor/export/pdf.ts), which
// checks the bytes against the SHA-256 the server named; nothing here trusts a file the server did not vouch for.
import type { PdfResult } from "../../../editor/export/pdf";
import type { Grade } from "./model";
import { exportMessages as t } from "./export-messages.hr";

/** A practice assignment is neither exported nor printed (P-D1, 409 practice_assignment); anything else may be. */
export const canExport = (grade: Grade): boolean => grade !== "practice";

export type ExportShown =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | Exclude<PdfResult, { kind: "signed-out" }>;

const FAILURE: Partial<Record<ExportShown["kind"], string>> = {
  "not-found": t.notFound,
  forbidden: t.forbidden,
  mismatch: t.mismatch,
  unavailable: t.unavailable,
};

/** The failure line of an export, or null when the export did not fail. */
export const failureOf = (shown: ExportShown): string | null => FAILURE[shown.kind] ?? null;

/** „Otisak datoteke: 0123456789ab…”: the first twelve hex digits, read as one word, not as groups. */
export const fingerprintLine = (sha256: string): string => t.fingerprint(sha256.slice(0, 12));

/** The name of the saved file: the server's „rad.pdf” with the student and the date, without characters a disk refuses. */
export function exportFileName(student: string | null, day: Date): string {
  const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  const who = (student ?? "").trim().replace(/[<>:"/\\|?*\p{Cc}]/gu, "_").replace(/\s+/gu, "-").replace(/[.-]+$/u, "");
  return who === "" ? `rad-${date}.pdf` : `rad-${who}-${date}.pdf`;
}
