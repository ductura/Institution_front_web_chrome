// Bulk download of the submissions of one assignment (WEB-1902; plan P-D2; WEB-2004). Server operations:
//   teacher.submissions-bulk-link.post  { format: "pdf" | "docx" } -> 201 { format, downloadPath, expiresAt }
//   teacher.submissions-bulk.get        the downloadPath of that answer (the token is in the link) -> the file
// There is no asynchronous job and no status route: the server answers with a link that expires, and the
// screen renders it as a link. A 410 on the file means the link expired; the screen asks for a new one.
import { SERVER_PREFIX } from "../../../../../../../src/client/api";
import { matchesSchema, type Schema } from "../../../../../../../src/client/schema-check";

export type BulkFormat = "pdf" | "docx";
export const BULK_FORMATS: readonly BulkFormat[] = ["pdf", "docx"];

export type BulkCall = (
  id: "teacher.submissions-bulk-link.post",
  input: { readonly params?: Readonly<Record<string, string>>; readonly body?: unknown },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

export type BulkLink = { readonly format: BulkFormat; readonly href: string; readonly expiresAt: string };

export type BulkRequest =
  | { readonly kind: "poveznica"; readonly link: BulkLink }
  | { readonly kind: "session-expired" }
  | { readonly kind: "greska"; readonly code: "not_found" | "forbidden" }
  | { readonly kind: "nepoznato" };

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID_SOURCE = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const UUID: Schema = { type: "string", pattern: `^${UUID_SOURCE}$` };
const FORMAT: Schema = { anyOf: BULK_FORMATS.map((value): Schema => ({ const: value })) };
const LINK: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["format", "downloadPath", "expiresAt"],
  properties: { format: FORMAT, downloadPath: { type: "string" }, expiresAt: { type: "string", format: "date-time" } },
};

/** The path of the file of one assignment and format, without the token. */
export const bulkFilePath = (assignmentId: string, format: BulkFormat): string =>
  `${SERVER_PREFIX}teacher/assignments/${assignmentId}/submissions-bulk/${format}`;

/** A link the screen may render: exactly the file path of this assignment and format, with the token the server gives. */
export function isBulkHref(href: string, assignmentId: string, format: BulkFormat): boolean {
  const path = bulkFilePath(assignmentId, format);
  return href.startsWith(`${path}?token=`) && /^\d{1,15}\.[A-Za-z0-9_-]{43}$/.test(href.slice(path.length + "?token=".length));
}

function parse(body: unknown, assignmentId: string, format: BulkFormat): BulkLink | null {
  if (!matchesSchema(LINK, body)) return null;
  const answer = body as { format: BulkFormat; downloadPath: string; expiresAt: string };
  if (answer.format !== format || !isBulkHref(answer.downloadPath, assignmentId, format)) return null;
  return { format, href: answer.downloadPath, expiresAt: answer.expiresAt };
}

/** Asks the server for a link to the file. Success only from a 201 answer that names this assignment and format. */
export async function requestBulkLink(call: BulkCall, assignmentId: string, format: BulkFormat): Promise<BulkRequest> {
  if (!matchesSchema(UUID, assignmentId) || !BULK_FORMATS.includes(format)) return { kind: "greska", code: "not_found" };
  try {
    const result = await call("teacher.submissions-bulk-link.post", { params: { assignmentId }, body: { format } });
    if (result.ok) {
      const link = result.status === 201 ? parse(result.body, assignmentId, format) : null;
      return link === null ? UNKNOWN : { kind: "poveznica", link };
    }
    if (result.status === 401) return { kind: "session-expired" };
    if (result.status === 403) return { kind: "greska", code: "forbidden" };
    if (result.status === 404) return { kind: "greska", code: "not_found" };
    return UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}
