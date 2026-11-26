// MEN-R14 (MEN-38): the mentor's private working notes of one mentorship, over the server's operations
// mentorship.notes.get and mentorship.notes.post through the contract client of src/client. Every answer is
// checked against the contract's own schema. A failed read is "unavailable", never an empty list; a write's
// result is read only from the server's answer (B-6, 2164); what the contract does not name is "unknown".
import migrationContracts from "../../../../../../src/client/migration-contracts.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "../../../../../../src/client/schema-check";

export type MentorNote = { readonly id: string; readonly body: string; readonly createdAt: string };
export type NotesRead =
  | { readonly kind: "ready"; readonly notes: readonly MentorNote[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };
export type NoteOutcome = "saved" | "invalid" | "forbidden" | "notFound" | "signedOut" | "unknown";
export type NoteWrite = { readonly outcome: NoteOutcome; readonly note?: MentorNote };

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code?: string };
export type NotesCall = (
  id: "mentorship.notes.get" | "mentorship.notes.post",
  input: { readonly params: { readonly id: string }; readonly query: undefined; readonly body: unknown },
) => Promise<Answer>;

const LIST = migrationContracts["mentorship.notes.get"].responses["200"].content["application/json"].schema as Schema;
const ONE = migrationContracts["mentorship.notes.post"].responses["201"].content["application/json"].schema as Schema;
/** The contract's limit of one note (1 to 4000 characters, not only blanks). */
export const NOTE_MAX = 4000;

export async function readNotes(call: NotesCall, mentorshipId: string): Promise<NotesRead> {
  try {
    const result = await call("mentorship.notes.get", { params: { id: mentorshipId }, query: undefined, body: undefined });
    if (!result.ok) return result.status === 401 ? { kind: "signedOut" } : result.status === 404 ? { kind: "notFound" } : { kind: "unavailable" };
    if (result.status !== 200 || !matchesSchema(LIST, result.body)) return { kind: "unavailable" };
    return { kind: "ready", notes: (result.body as { notes: MentorNote[] }).notes };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function addNote(call: NotesCall, mentorshipId: string, body: string): Promise<NoteWrite> {
  try {
    const result = await call("mentorship.notes.post", { params: { id: mentorshipId }, query: undefined, body: { body } });
    if (result.ok) return result.status === 201 && matchesSchema(ONE, result.body) ? { outcome: "saved", note: result.body as MentorNote } : { outcome: "unknown" };
    switch (result.status) {
      case 401: return { outcome: "signedOut" };
      case 403: return { outcome: result.code === "forbidden" ? "forbidden" : "unknown" };
      case 404: return { outcome: "notFound" };
      case 422: return { outcome: "invalid" };
      default: return { outcome: "unknown" };
    }
  } catch {
    return { outcome: "unknown" };
  }
}
