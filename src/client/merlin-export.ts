/**
 * Export for Merlin (WEB-1114; N-18, C-16, D-286).
 *
 * teacher.merlin-roster.get is the roster preview: one row per student in the
 * order of the CSV (by surname, Croatian alphabet; a student without a name
 * last), which this module never reorders. teacher.merlin-packages.post asks
 * for the package under a request key of the client's (the same key is the
 * same package); teacher.merlin-package.get says whether it is queued, ready,
 * failed or expired. A package is downloadable only while it is ready and its
 * expiry (24 hours, C-16) is still ahead; the fingerprint shown and copied is
 * the server's SHA-256 of the ZIP, unchanged. The CSV and the ZIP are not JSON,
 * so the browser downloads them from their contract paths (the CSV path read
 * from the contract, the ZIP path from the package answer). Routes of
 * Institution_server SRV-1109 and SRV-1110, reached through the migration
 * supplement of createApi (WEB-07) until the contracts are published.
 */

import type { createApi } from "./api";
import migrationContracts from "./migration-contracts.generated.json" with { type: "json" };
import type { Read } from "./submission";

type Api = ReturnType<typeof createApi>;

export type MerlinRow = {
  readonly familyName: string | null;
  readonly givenName: string | null;
  readonly submitted: boolean;
  readonly submittedMinute: string | null;
  readonly afterDeadline: boolean | null;
  readonly pdfName: string | null;
  readonly pdfSha256: string | null;
  readonly docxName: string | null;
  readonly docxSha256: string | null;
};

export type MerlinExtensionReason = {
  readonly studentId: string | null;
  readonly dueAt: string;
  readonly reasonId: "justified" | "technical" | "agreement" | "all";
};

export type MerlinRoster = {
  readonly kind: "ready";
  readonly rows: readonly MerlinRow[];
  readonly extensionReasons: readonly MerlinExtensionReason[];
};

export type MerlinPackage =
  | { readonly id: string; readonly state: "queued" | "failed" }
  | { readonly id: string; readonly state: "ready"; readonly downloadPath: string; readonly expiresAt: string; readonly sha256: string }
  | { readonly id: string; readonly state: "expired"; readonly expiresAt: string; readonly sha256: string };

export type PackageRequest =
  | { readonly kind: "zatrazeno"; readonly id: string; readonly state: "queued" | "ready" | "failed" | "expired" }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "invalid" }
  /** 408, 503, a broken connection, any other shape: the package may exist; send the same key again. */
  | { readonly kind: "nepoznato" };

/** What the screen shows for a package at a moment. */
export type PackageView =
  | { readonly kind: "priprema" }
  | { readonly kind: "spreman"; readonly downloadPath: string; readonly expiresAt: string; readonly sha256: string }
  | { readonly kind: "istekao"; readonly expiresAt: string; readonly sha256: string }
  | { readonly kind: "neuspjeh" };

const UNKNOWN = { kind: "nepoznato" } as const;
const REQUEST_KEY = /^[A-Za-z0-9_-]{8,128}$/;

function failure(status: number): Exclude<PackageRequest, { kind: "zatrazeno" }> {
  if (status === 401) return { kind: "session-expired" };
  if (status === 404) return { kind: "greska", code: "not_found" };
  return UNKNOWN;
}

function fill(path: string, params: Readonly<Record<string, string>>): string {
  return path.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(params[name] ?? ""));
}

/** The contract's path of teacher.merlin-roster-csv.get for an assignment; the browser downloads it. */
export function merlinCsvPath(assignmentId: string): string {
  return fill(migrationContracts["teacher.merlin-roster-csv.get"].path, { assignmentId });
}

/** The download path of the package, exactly as the contract shapes it for these ids. */
export function merlinDownloadPath(assignmentId: string, packageId: string): string {
  return fill(migrationContracts["teacher.merlin-package-download.get"].path, { assignmentId, packageId });
}

/** A new request key (a UUID): one per preparation; an unknown outcome sends the same key again. */
export function newRequestKey(random: () => string = () => crypto.randomUUID()): string {
  const key = random();
  if (!REQUEST_KEY.test(key)) throw new Error("request key out of the contract");
  return key;
}

/** teacher.merlin-roster.get: the rows in the server's order, never sorted here. */
export async function readMerlinRoster(client: Api, assignmentId: string): Promise<Read<MerlinRoster>> {
  try {
    const result = await client("teacher.merlin-roster.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!result.ok) return failure(result.status);
    return { kind: "ready", rows: result.body.rows, extensionReasons: result.body.extensionReasons };
  } catch {
    return UNKNOWN;
  }
}

/** teacher.merlin-packages.post: the package of this key, as the server answered it. */
export async function requestMerlinPackage(client: Api, assignmentId: string, requestKey: string): Promise<PackageRequest> {
  if (!REQUEST_KEY.test(requestKey)) return { kind: "greska", code: "invalid" };
  try {
    const result = await client("teacher.merlin-packages.post", { params: { assignmentId }, query: undefined, body: { requestKey } });
    if (!result.ok) {
      if (result.status === 0 || result.status === 400 || result.status === 415 || result.status === 422) return { kind: "greska", code: "invalid" };
      return failure(result.status);
    }
    if (result.status !== 202) return UNKNOWN;
    return { kind: "zatrazeno", id: result.body.id, state: result.body.state };
  } catch {
    return UNKNOWN;
  }
}

/**
 * teacher.merlin-package.get. A ready package whose download path is not the
 * one of this assignment and package is not trusted: it reads as unknown.
 */
export async function readMerlinPackage(
  client: Api, assignmentId: string, packageId: string,
): Promise<Read<{ kind: "paket"; pkg: MerlinPackage }>> {
  try {
    const result = await client("teacher.merlin-package.get", { params: { assignmentId, packageId }, query: undefined, body: undefined });
    if (!result.ok) return failure(result.status);
    const pkg = result.body;
    if (pkg.id !== packageId.toLowerCase()) return UNKNOWN;
    if (pkg.state === "ready" && pkg.downloadPath !== merlinDownloadPath(assignmentId.toLowerCase(), pkg.id)) return UNKNOWN;
    return { kind: "paket", pkg };
  } catch {
    return UNKNOWN;
  }
}

/**
 * What the screen shows: a ready package is downloadable only before its
 * expiry; at or after it, it is expired even before the server says so.
 */
export function packageView(pkg: MerlinPackage, now: number): PackageView {
  switch (pkg.state) {
    case "queued":
      return { kind: "priprema" };
    case "failed":
      return { kind: "neuspjeh" };
    case "expired":
      return { kind: "istekao", expiresAt: pkg.expiresAt, sha256: pkg.sha256 };
    case "ready": {
      const expires = Date.parse(pkg.expiresAt);
      if (!Number.isFinite(expires) || now >= expires) return { kind: "istekao", expiresAt: pkg.expiresAt, sha256: pkg.sha256 };
      return { kind: "spreman", downloadPath: pkg.downloadPath, expiresAt: pkg.expiresAt, sha256: pkg.sha256 };
    }
  }
}

/** True when the roster has at least one submitted work, so a package has something to carry. */
export function hasSubmissions(rows: readonly MerlinRow[]): boolean {
  return rows.some((row) => row.submitted);
}
