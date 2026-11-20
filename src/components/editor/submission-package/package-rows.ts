/**
 * Predajni paket (E§3.3 `paket`): the rows and the confirmation code.
 *
 * Assumption (decision of the orchestrator, B-3): the code is not issued by
 * the server. It is derived from the digest of the submitted text on the
 * signed receipt, `DUC-XXXX-XXXX-XXXX` from its first 12 hex characters, so
 * it says only that the submitted text has not changed since submission and
 * never says who wrote the work. Before submission there is no code.
 */

import { submissionPackageMessages as t } from "./messages.hr";

export type PackageRowId = "work" | "summary" | "declaration" | "approval";
export type PackageRow = {
  readonly id: PackageRowId;
  /** ✓ or !. "block" is the one place a row stops the package: work with places left for later check. */
  readonly status: "ok" | "warn" | "block";
  readonly detail: string;
};
export type PackageInput = {
  readonly openPlaces: number;
  readonly summaryWritten: boolean;
  readonly declaration: "filled" | "missing";
  readonly approval: "approved" | "pending" | "requested" | "none";
};

export function packageRows(input: PackageInput): readonly PackageRow[] {
  const d = t.details;
  const approval = input.approval === "approved" ? { status: "ok", detail: d.approved }
    : input.approval === "pending" ? { status: "warn", detail: d.pending }
    : input.approval === "requested" ? { status: "warn", detail: d.requested }
    : { status: "ok", detail: d.none };
  return [
    input.openPlaces > 0 ? { id: "work", status: "block", detail: d.workHoles } : { id: "work", status: "ok", detail: d.workStyle },
    input.summaryWritten ? { id: "summary", status: "ok", detail: "" } : { id: "summary", status: "warn", detail: d.summaryMissing },
    input.declaration === "filled" ? { id: "declaration", status: "ok", detail: d.declarationIn } : { id: "declaration", status: "warn", detail: d.declarationMissing },
    { id: "approval", ...approval },
  ] as readonly PackageRow[];
}

/** Yellow rows never stop the package; only a "block" row does. */
export const packageBlocked = (rows: readonly PackageRow[]): boolean => rows.some((row) => row.status === "block");

/** `DUC-XXXX-XXXX-XXXX` from the receipt's 64-character digest, or null while there is none. */
export function confirmationCode(artifactSha256: string | null): string | null {
  if (artifactSha256 === null || !/^[0-9a-f]{64}$/i.test(artifactSha256)) return null;
  const hex = artifactSha256.slice(0, 12).toUpperCase();
  return `DUC-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}
