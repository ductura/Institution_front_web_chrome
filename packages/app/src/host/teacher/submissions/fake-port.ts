// Probe port for the tests and the catalogue until the SRV-1508 contract is published. Invented data.
import type { SubmittedRow, TeacherSubmissionsPort } from "../../../../../../src/client/teacher-submissions.ts";

export const FAKE_ROWS: readonly SubmittedRow[] = [
  { studentId: "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d01", revision: 42, late: false, requestedMinute: "2026-12-15T21:30:00.000Z" },
  { studentId: "5e4d3c2b-1a09-4f8e-8d7c-6b5a4f3e2d02", revision: 7, late: true, requestedMinute: null },
];

const DOCUMENT = JSON.stringify({
  schemaVersion: 2, sources: [],
  nodes: [
    { type: "heading", level: 1, children: [{ type: "text", text: "Izmišljeni naslov" }] },
    { type: "paragraph", children: [{ type: "text", text: "Izmišljeni odlomak predanog rada." }] },
  ],
});

export function fakeSubmissionsPort(rows: readonly SubmittedRow[] = FAKE_ROWS): TeacherSubmissionsPort & { readonly opened: string[] } {
  const opened: string[] = [];
  return {
    opened,
    async list() { return { kind: "ready", rows: [...rows] }; },
    async open(_assignmentId, studentId) {
      opened.push(studentId);
      const row = rows.find((r) => r.studentId === studentId);
      if (!row) return { kind: "greska", code: "not_found" };
      return { kind: "ready", version: { studentId, revision: row.revision, late: row.late, document: DOCUMENT } };
    },
  };
}
