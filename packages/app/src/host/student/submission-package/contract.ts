// WEB-1803 (M8.6; WEB-2004): the package for the registrar's office, on the receipt of a submission.
// Server operations (by submission, not by assignment):
//   student.submission-package-link.post  { kind: "package" | "referada" } -> 201 { kind, downloadPath, expiresAt }
//   student.submission-package.get        the downloadPath of that answer (the token is in the link) -> the file
// There is no asynchronous job, no status route and no cancellation: the server answers with a link that
// expires, and the screen renders it as a link. The registrar's package is the kind "referada".
import { SERVER_PREFIX } from "../../../../../../src/client/api";
import { matchesSchema, type Schema } from "../../../../../../src/client/schema-check";

export type PackageKind = "package" | "referada";
export const PACKAGE_KIND: PackageKind = "referada";

export type PackageCall = (
  id: "student.submission-package-link.post",
  input: { readonly params?: Readonly<Record<string, string>>; readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code?: string }>;

export type PackageLink = { readonly kind: PackageKind; readonly href: string; readonly expiresAt: string };

export type PackageRequest =
  | { readonly kind: "poveznica"; readonly link: PackageLink }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" }
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID: Schema = { type: "string", pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$" };
const KIND: Schema = { anyOf: [{ const: "package" }, { const: "referada" }] };
const LINK: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "downloadPath", "expiresAt"],
  properties: { kind: KIND, downloadPath: { type: "string" }, expiresAt: { type: "string", format: "date-time" } },
};

/** The path of the file of one submission and kind, without the token. */
export const packageFilePath = (submissionId: string, kind: PackageKind): string =>
  `${SERVER_PREFIX}student/submissions/${submissionId}/package/${kind}`;

/** A link the screen may render: exactly the file path of this submission and kind, with the token the server gives. */
export function isPackageHref(href: string, submissionId: string, kind: PackageKind): boolean {
  const path = packageFilePath(submissionId, kind);
  return href.startsWith(`${path}?token=`) && /^\d{1,15}\.[A-Za-z0-9_-]{43}$/.test(href.slice(path.length + "?token=".length));
}

/** Asks the server for a link to the package. Success only from a 201 answer that names this submission and kind. */
export async function requestPackageLink(call: PackageCall, submissionId: string, kind: PackageKind = PACKAGE_KIND): Promise<PackageRequest> {
  if (!matchesSchema(UUID, submissionId)) return { kind: "greska", code: "not_found" };
  try {
    const result = await call("student.submission-package-link.post", { params: { submissionId }, body: { kind } });
    if (result.ok) {
      if (result.status !== 201 || !matchesSchema(LINK, result.body)) return UNKNOWN;
      const answer = result.body as { kind: PackageKind; downloadPath: string; expiresAt: string };
      return answer.kind === kind && isPackageHref(answer.downloadPath, submissionId, kind)
        ? { kind: "poveznica", link: { kind, href: answer.downloadPath, expiresAt: answer.expiresAt } }
        : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    return result.status === 404 ? { kind: "greska", code: "not_found" } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
