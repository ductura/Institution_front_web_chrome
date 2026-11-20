/**
 * N-07, the submission of one work as the teacher sees it (WEB-35). The page
 * is reached by the work's document id (`/nastavnik/rad/<documentId>/predaja`,
 * from N-06 and N-17), so it first reads who and what the work is
 * (teacher.work.get) and then the receipt of that student for that
 * assignment (teacher.submission-receipt.get, `readTeacherReceipt`, WEB-30).
 *
 * The receipt is the student's: the same read and schema-check (WEB-22) and
 * the same mapping onto `ReceiptPanel` (`studentReceiptRead`, WEB-27), so the
 * teacher sees the same receipt in the same words (PRODUCT §5 rule 5).
 * "Predano" only with the signed receipt the client checked (B-6); anything
 * this page cannot read is the error variant, never "predano" and never
 * "prazno". The server writes the access log of the read (rule 17; its
 * surface waits for P-5).
 *
 * TODO(ugovor): teacher.work.get (`GET /api/v1/teacher/works/{documentId}`,
 * Ductus#2028 c.7024185874) and teacher.submission-receipt.get (SRV-27,
 * SRV-30) are not in the published contract yet. Until then the work's shape
 * is local (below), the page passes no transport and only tests call these
 * reads, with invented answers. On the release the work read moves to
 * src/client over createApi and this schema gives way to the contract's.
 */

import { matchesSchema, type Schema } from "../../../../../client/schema-check";
import type { Read, SubmissionRead } from "../../../../../client/submission";
import { readTeacherReceipt, type TeacherCall, type WorkState } from "../../../../../client/teacher-reads";
import { studentReceiptRead, type ReceiptRead } from "../../../../../components/predaja/ReceiptPanel";

/** TODO(ugovor): the transport of teacher.work.get. */
export type WorkCall = (
  id: "teacher.work.get",
  input: { readonly params: { readonly documentId: string } },
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

/** TODO(ugovor): teacher.work.get. A name the server does not have is `null`, never a stand-in. */
export type TeacherWork = {
  readonly documentId: string;
  readonly studentId: string;
  readonly studentName: string | null;
  readonly assignmentId: string;
  readonly state: WorkState;
  readonly prevDocumentId: string | null;
  readonly nextDocumentId: string | null;
};

const UNKNOWN = { kind: "nepoznato" } as const;
const UUID = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" } as const;
const DOCUMENT = { type: "string", minLength: 1, maxLength: 256 } as const;
const OR_NULL = (schema: Schema): Schema => ({ anyOf: [{ type: "null" }, schema] });
const STATES: readonly WorkState[] = ["predano", "nije_predano", "nakon_roka", "ceka"];

// TODO(ugovor): local shape until the contract has teacher.work.get.
const WORK: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["documentId", "studentId", "studentName", "assignmentId", "state", "prevDocumentId", "nextDocumentId"],
  properties: {
    documentId: DOCUMENT,
    studentId: UUID,
    studentName: OR_NULL({ type: "string", minLength: 1, maxLength: 256 }),
    assignmentId: UUID,
    state: { anyOf: STATES.map((c) => ({ const: c })) },
    prevDocumentId: OR_NULL(DOCUMENT),
    nextDocumentId: OR_NULL(DOCUMENT),
  },
};

/** teacher.work.get (TODO(ugovor)): another work than the one asked for is `nepoznato`; another teacher's is 404. */
export async function readTeacherWork(call: WorkCall, documentId: string): Promise<Read<{ kind: "ready"; work: TeacherWork }>> {
  try {
    const result = await call("teacher.work.get", { params: { documentId } });
    if (result.ok) {
      const fits = result.status === 200 && matchesSchema(WORK, result.body) && (result.body as TeacherWork).documentId === documentId;
      return fits ? { kind: "ready", work: result.body as TeacherWork } : UNKNOWN;
    }
    if (result.status === 401) return { kind: "session-expired" };
    // Another teacher's, an unknown and a malformed id are the same 404 (SRV-30).
    return result.status === 404 ? { kind: "greska", code: "not_found" } : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

/**
 * The teacher's receipt read of `work`, onto the student's variants. The work
 * state stands in for student.assignment-work.get: a work the server holds a
 * submission of (`predano`, `nakon_roka`, `ceka`) without a readable receipt
 * is an error. A receipt of another work is an error, never shown.
 */
export function teacherReceiptRead(read: SubmissionRead, work: TeacherWork): ReceiptRead {
  if (read.kind === "potvrdeno" && read.receipt.payload.documentId !== work.documentId) return { kind: "error" };
  return studentReceiptRead(read, work.state === "nije_predano" ? "open" : "submitted");
}

export type TeacherReceiptView =
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "ready"; readonly work: TeacherWork | null; readonly read: ReceiptRead };

/** Both reads of N-07; an absent transport (TODO(ugovor)) reads as unknown, so the page shows the error variant. */
export async function loadTeacherReceipt(
  workCall: WorkCall | undefined, receiptCall: TeacherCall | undefined, documentId: string,
): Promise<TeacherReceiptView> {
  const work = workCall === undefined ? UNKNOWN : await readTeacherWork(workCall, documentId);
  if (work.kind === "session-expired") return { kind: "signedOut" };
  if (work.kind === "greska") return { kind: "notFound" };
  if (work.kind !== "ready") return { kind: "ready", work: null, read: { kind: "error" } };
  const { assignmentId, studentId } = work.work;
  const receipt = receiptCall === undefined ? UNKNOWN : await readTeacherReceipt(receiptCall, assignmentId, studentId);
  if (receipt.kind === "session-expired") return { kind: "signedOut" };
  if (receipt.kind === "greska" && receipt.code === "not_found") return { kind: "notFound" };
  return { kind: "ready", work: work.work, read: teacherReceiptRead(receipt, work.work) };
}
