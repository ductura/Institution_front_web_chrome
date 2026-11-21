// Pure rules of the teacher's direct edits (WEB-1703; plan M6.4, D-34). The teacher edits only
// while the student allows it, and the teacher's text is marked. Every doubt locks: an unread
// setting, a refused write or an answer that does not name the saved text leaves the editor
// closed. A revocation is felt on the very next write, which the server refuses.
import {
  directEditBadge,
  type DirectEditPort,
  type DirectEditRead,
} from "../../student/direct-edit-setting/model";
import { directEditMessages as text } from "./messages.hr";

export { directEditBadge };

export type EditAccess =
  | { readonly kind: "open" }
  | { readonly kind: "locked"; readonly reason: "off" | "revoked" | "unavailable" | "signedOut" };

export type TeacherEditResult =
  | { readonly kind: "saved"; readonly text: string }
  | { readonly kind: "revoked" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "rejected" }
  | { readonly kind: "unknown" };

export interface TeacherEditPort extends DirectEditPort {
  /** Writes the teacher's text; the server refuses it with `revoked` once the setting is off. */
  submitEdit(assignmentId: string, body: string): Promise<TeacherEditResult>;
}

/** A piece of the work and who wrote it; the teacher's pieces carry the mark. */
export type MarkedSegment = { readonly author: "student" | "teacher"; readonly text: string };

/** What the setting allows. Anything but an explicit "on" keeps the editor locked. */
export function accessFrom(read: DirectEditRead): EditAccess {
  if (read.kind === "signedOut") return { kind: "locked", reason: "signedOut" };
  if (read.kind !== "ready") return { kind: "locked", reason: "unavailable" };
  return read.state.enabled ? { kind: "open" } : { kind: "locked", reason: "off" };
}

export function accessNote(access: EditAccess): string {
  if (access.kind === "open") return text.open;
  switch (access.reason) {
    case "off": return text.locked;
    case "revoked": return text.revoked;
    case "signedOut": return text.signedOut;
    case "unavailable": return text.unavailable;
  }
}

/** The access after a write: a revocation or an expired session locks at once. */
export function accessAfter(previous: EditAccess, result: TeacherEditResult): EditAccess {
  if (result.kind === "revoked") return { kind: "locked", reason: "revoked" };
  if (result.kind === "signedOut") return { kind: "locked", reason: "signedOut" };
  return previous;
}

/** Sends the teacher's text only while access is open, and trusts it only when the answer repeats it. */
export async function submitTeacherEdit(
  port: TeacherEditPort,
  assignmentId: string,
  access: EditAccess,
  body: string,
): Promise<TeacherEditResult> {
  if (access.kind !== "open" || body.trim() === "") return { kind: "rejected" };
  let result: TeacherEditResult;
  try {
    result = await port.submitEdit(assignmentId, body);
  } catch {
    return { kind: "unknown" };
  }
  if (result.kind === "saved" && result.text !== body) return { kind: "unknown" };
  return result;
}

export function editMessage(result: TeacherEditResult): string {
  switch (result.kind) {
    case "saved": return text.saved;
    case "revoked": return text.revoked;
    case "signedOut": return text.signedOut;
    case "rejected": return text.failed;
    case "unknown": return text.unknown;
  }
}

/** The label shown over a segment, or null for the student's own text. */
export function segmentMark(segment: MarkedSegment): string | null {
  return segment.author === "teacher" ? text.mark : null;
}
