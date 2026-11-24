// MK-16 (NF-6): the VIZ "puno" mentorship can be clicked through. Mentorship 2901 is T1's work,
// the very document the student's workspace opens (DOKUMENT_T1), so the teacher's consultations
// and the student's Mentor card speak of one work; 2902 is the submitted T3. The answers to a
// slot's change, its closing and a record's addition say back what was sent, as the server does,
// because the client checks that the answer is about the slot and the action it asked for.
// Pure, no network. Invented people, dates and texts only.
import { DOKUMENT_T1 } from "./viz-predaja";

type Vector = { route: string; name: string; response?: { status: number; body?: unknown } };
export type Odgovor = { readonly status: number; readonly body: unknown };

export const MENTORSTVO_T1 = "7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2901";
export const MENTORSTVO_T3 = "7f6e5d4c-3b2a-4190-8f7e-6d5c4b3a2902";
export const RAD_T3 = "izmisljeni-rad-0003";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function vektor(vectors: readonly Vector[], route: string, name: string): Record<string, any> {
  const body = vectors.find((v) => v.route === route && v.name === name)?.response?.body;
  if (!isObject(body)) throw new Error(`VIZ: vektor ${route}/${name} ne postoji`);
  return structuredClone(body);
}

const PATCH: Readonly<Record<string, string>> = { confirm: "confirmed", counter: "countered", accept: "accepted" };
const CLOSE: Readonly<Record<string, string>> = { decline: "declined", withdraw: "withdrawn", cancel: "cancelled" };

export function mentorstvo(vectors: readonly Vector[], tasks: { t1: string; t1Rok: string; t3: string }, sada: string) {
  let added = 0;
  const now = new Date(sada).toISOString();

  /** The work of a mentored document, as teacher.work.get names it; undefined for any other. */
  const work = (documentId: string) => documentId === DOKUMENT_T1
    ? { documentId, studentId: "00000000-0000-4000-8000-0000000000e1", studentName: "Student A", assignmentId: tasks.t1,
      state: "nije_predano", prevDocumentId: null, nextDocumentId: RAD_T3 }
    : documentId === RAD_T3
      ? { documentId, studentId: "00000000-0000-4000-8000-0000000000e3", studentName: "Student C", assignmentId: tasks.t3,
        state: "predano", prevDocumentId: DOKUMENT_T1, nextDocumentId: null }
      : undefined;

  return function answer(operation: string, ids: Readonly<Record<string, string>>, body: unknown): Odgovor | undefined {
    const sent = isObject(body) ? body : {};
    switch (operation) {
      case "teacher.work.get": {
        const w = work(ids.documentId ?? "");
        return w === undefined ? undefined : { status: 200, body: w };
      }
      // T1 is being written: its versions are checkpoints, not a submission ("Rad je predan" would be untrue).
      case "work.versions.get":
        return ids.documentId === DOKUMENT_T1
          ? { status: 200, body: { versions: [{ kind: "checkpoint", revision: 1, savedMinute: "2026-11-02T10:15:00.000Z" }], nextBeforeRevision: null } }
          : undefined;
      case "mentorship.key-dates.get":
        if (ids.id === MENTORSTVO_T1) return { status: 200, body: { dates: [
          { kind: "deadline", id: "00000000-0000-4000-8000-0000000017a8", at: new Date(tasks.t1Rok).toISOString() },
          { kind: "consultation", id: "00000000-0000-4000-8000-0000000017a7", at: "2026-12-04T12:00:00.000Z", state: "confirmed" },
          { kind: "milestone", id: "00000000-0000-4000-8000-000000000103", at: "2026-12-04T12:00:00.000Z", title: "Nacrt" },
        ] } };
        return ids.id === MENTORSTVO_T3 ? { status: 200, body: { dates: [] } } : undefined;
      case "work.consultation-slots.patch": {
        const action = String(sent.action);
        const state = PATCH[action];
        if (state === undefined) return undefined;
        const slot = vektor(vectors, operation, state);
        return { status: 200, body: { ...slot, id: ids.slotId, ...(action === "counter" && typeof sent.startsAt === "string" ? { startsAt: sent.startsAt } : {}) } };
      }
      case "work.consultation-slot-close.post": {
        const state = CLOSE[String(sent.action)];
        if (state === undefined) return undefined;
        const slot = vektor(vectors, operation, state);
        const reason = typeof sent.reason === "string" && sent.reason.trim() !== "" ? sent.reason : null;
        return { status: 200, body: { ...slot, id: ids.slotId, closing: { ...slot.closing, reason, at: now } } };
      }
      case "work.consultation-additions.post": {
        added += 1;
        return { status: 201, body: { id: `6a5b4c3d-2e1f-4a0b-9c8d-7e6f5a4b3d${String(added).padStart(2, "0")}`,
          text: typeof sent.text === "string" ? sent.text : "", createdAt: now } };
      }
      default: return undefined;
    }
  };
}
