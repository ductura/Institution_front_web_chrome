// In-memory stand-in for the N-17 read (WEB-2149); invented people and times only.
import type { N17Card, N17Port, N17Read } from "./model";

export const FAKE_CARDS: readonly N17Card[] = [
  {
    assignmentId: "a-1", title: "Lokalni mediji i izborna kampanja", courseName: "Kolegij A",
    rows: [
      { studentId: "s-1", name: "Ana Horvat", group: "Grupa 2", submitted: true, requestedMinute: "2026-11-05T20:14Z", afterDeadline: false, evidenceRecord: "with_gaps", documentId: "doc-a", revision: { state: "open" } },
      { studentId: "s-2", name: "Marko Babić", group: "Grupa 4", submitted: false, requestedMinute: null, afterDeadline: false, evidenceRecord: null, documentId: "doc-b", phase: "writing", deadlineExtended: true, revision: null },
      { studentId: "s-3", name: "Iva Kovač", group: null, submitted: false, requestedMinute: null, afterDeadline: false, evidenceRecord: null, phase: "writing" },
      { studentId: "s-4", name: null, group: null, submitted: false, requestedMinute: null, afterDeadline: false, evidenceRecord: null, phase: "unconfirmed" },
    ],
  },
  { assignmentId: "a-2", title: "Prikaz članka", courseName: "Kolegij A", rows: [] },
  { assignmentId: "a-3", title: "Esej", courseName: "Kolegij B", rows: null },
];

export function fakeN17Port(answer: N17Read = { kind: "ready", cards: FAKE_CARDS }): N17Port {
  return { read: async () => answer };
}
