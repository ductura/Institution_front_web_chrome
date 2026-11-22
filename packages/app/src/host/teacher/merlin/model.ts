// Pure rules of N-18 "Izvoz za Merlin" (WEB-2163): the eight CSV columns of the prototype, the status
// lines and the reading of the package. No network here: the port is src/client/merlin-export.ts.
import type { MerlinExtensionReason, MerlinPackage, MerlinRow, PackageRequest, PackageView } from "../../../../../../src/client/merlin-export.ts";
import { momentHr as formatDateTimeHr } from "../n12/model";
import { merlinMessages as text } from "./messages.hr";

export type { MerlinExtensionReason, MerlinPackage, MerlinRow, PackageRequest, PackageView };

/** How often a queued package is read again. */
export const POLL_MS = 3000;

export type AssignmentChoice = { readonly id: string; readonly title: string | null };

export type MerlinData = {
  readonly rows: readonly MerlinRow[];
  readonly extensionReasons: readonly MerlinExtensionReason[];
  /** Assignments of the teacher's courses for the "Zadatak" select; null when that read failed. */
  readonly assignments: readonly AssignmentChoice[] | null;
};

export type PackageRead =
  | { readonly kind: "paket"; readonly pkg: MerlinPackage }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  | { readonly kind: "nepoznato" };

export interface MerlinPort {
  requestPackage(assignmentId: string, key: string): Promise<PackageRequest>;
  readPackage(assignmentId: string, packageId: string): Promise<PackageRead>;
  /** Hands the browser the contract path of the ZIP or of the CSV. */
  leaveFor(path: string): void;
  csvPath(assignmentId: string): string;
}

export type ExportStatus =
  | { readonly kind: "none" }
  | { readonly kind: "pending" }
  | { readonly kind: "view"; readonly view: PackageView }
  | { readonly kind: "notFound" }
  | { readonly kind: "unknown" };

export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? "");
}

const yesNo = (value: boolean | null): string => (value === null ? text.none : value ? text.yes : text.no);

/** The eight cells of a CSV row, in the order of the prototype; whatever is missing reads "nema". */
export function rowCells(row: MerlinRow): string[] {
  return [
    row.familyName ?? text.unnamed,
    row.givenName ?? text.none,
    yesNo(row.submitted),
    row.submittedMinute === null ? text.none : formatDateTimeHr(row.submittedMinute),
    row.submitted ? yesNo(row.afterDeadline) : text.none,
    row.pdfName ?? text.none,
    row.pdfSha256 ?? text.none,
    row.docxSha256 ?? text.none,
  ];
}

export const COLUMN_HEADERS: readonly string[] = [
  text.columns.familyName, text.columns.givenName, text.columns.submitted, text.columns.submittedMinute,
  text.columns.afterDeadline, text.columns.fileName, text.columns.pdfSha256, text.columns.docxSha256,
];

export const hasSubmitted = (rows: readonly MerlinRow[]): boolean => rows.some((row) => row.submitted);

/** One line per extension reason of the caller's own, as the server sent them. */
export function reasonLines(reasons: readonly MerlinExtensionReason[], reasonText: Readonly<Record<string, string>>): string[] {
  return reasons.map((r) => fill(text.reasonLine, {
    due: formatDateTimeHr(r.dueAt),
    reason: reasonText[r.reasonId] ?? "",
    scope: r.studentId === null ? text.reasonAll : text.reasonOne,
  }));
}

/** The lines of the status area and whether it is a status or an alert; the ready view adds fingerprint and button. */
export function statusLines(status: ExportStatus): { tone: "status" | "alert"; lines: string[] } | null {
  switch (status.kind) {
    case "none": return null;
    case "pending": return { tone: "status", lines: [text.preparing] };
    case "notFound": return { tone: "alert", lines: [text.notFound] };
    case "unknown": return { tone: "alert", lines: [text.unknown] };
    case "view": {
      const v = status.view;
      if (v.kind === "priprema") return { tone: "status", lines: [text.preparing] };
      if (v.kind === "neuspjeh") return { tone: "alert", lines: [text.failed] };
      if (v.kind === "istekao") return { tone: "alert", lines: [fill(text.expired, { expires: formatDateTimeHr(v.expiresAt) })] };
      return { tone: "status", lines: [text.readyTitle, fill(text.ready, { expires: formatDateTimeHr(v.expiresAt) })] };
    }
  }
}

/** The package is downloaded only from a ready view (C-16). */
export const canDownload = (status: ExportStatus): status is { kind: "view"; view: Extract<PackageView, { kind: "spreman" }> } =>
  status.kind === "view" && status.view.kind === "spreman";

export const merlinHref = (assignmentId: string): string => `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/merlin`;
