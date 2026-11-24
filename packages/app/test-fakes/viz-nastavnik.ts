// NZ-18 (NF-4) and PG-15 (NF-5): the VIZ "puno" teacher sees data on the course cards, the
// aggregate, the work and its review, not "unavailable". The contract's vectors carry ids of
// their own that do not join the scenario's tasks (assignmentId ...a1, bbbbbbbb-...), and a few
// are rewritten by `sameIds` where they must not be; the answers below join them to T1 and T2.
// Pure, no network (no node: imports here: no-direct-api). Invented people and texts only.

type Vector = { route: string; name: string; response?: { status: number; body?: unknown } };
export type Odgovor = { readonly status: number; readonly body: unknown; readonly headers?: Readonly<Record<string, string>> };

/** The student the receipt vectors name, and the submitted work of the contract's receipt. */
const STUDENT_1 = "00000000-0000-4000-8000-0000000000e1";
const STUDENT_2 = "00000000-0000-4000-8000-0000000000e2";
export const PREDANI_RAD = "izmisljeni-rad-predaje-0001";

/** The live text: its words hold the place of the contract's comment anchor ("izmišljeni odlomak" + " teksta"). */
export const ZIVI_TEKST = {
  nodes: [{ children: [{ marks: [], text: "Na kraju, izmišljeni odlomak teksta rada.", type: "text" }], id: "0f1e2d3c-4b5a-4968-8776-655443322110", type: "paragraph" }],
  schemaVersion: 1,
};

/** The ETag of ZIVI_TEKST: the SHA-256 of its exact JSON bytes (live.document.get), quoted; the unit test recomputes it. */
export const ZIVI_ETAG = "\"a0b4f3ca485a8b6f7723668bf4404bf99de5fd7e8144be771828064447b2de2b\"";

function vektor(vectors: readonly Vector[], route: string, name: string): unknown {
  const body = vectors.find((v) => v.route === route && v.name === name)?.response?.body;
  if (body === undefined) throw new Error(`VIZ: vektor ${route}/${name} ne postoji`);
  return structuredClone(body);
}

export function nastavnik(vectors: readonly Vector[], tasks: { t1: string; t2: string }) {
  // The team is answered as the contract has it: its ids must agree with each other (teaching-team.ts),
  // and `sameIds` would write the course id into every assistant, student and group.
  const team = vektor(vectors, "institution.teaching-team.get", "success");
  const teamView = vektor(vectors, "institution.teaching-team-view.get", "success-holder");
  const interview = vektor(vectors, "work.interview.get", "prepared") as Record<string, unknown>;
  const detail = vektor(vectors, "teacher.submission-detail.get", "submitted-version") as Record<string, unknown>;
  const live = JSON.stringify(ZIVI_TEKST);
  const students = {
    students: [
      { studentId: STUDENT_1, givenName: "Demo", familyName: "Kompost", groupName: "Grupa A", assignments: [
        { assignmentId: tasks.t1, documentId: PREDANI_RAD, workState: "submitted" },
        { assignmentId: tasks.t2, documentId: null, workState: "not_started" },
      ] },
      { studentId: STUDENT_2, givenName: "Demo", familyName: "Lonac", groupName: "Grupa B", assignments: [
        { assignmentId: tasks.t1, documentId: "izmisljeni-rad-0002", workState: "in_progress" },
      ] },
    ],
  };

  return function answer(operation: string, ids: Readonly<Record<string, string>>): Odgovor | undefined {
    switch (operation) {
      case "institution.teaching-team.get": return { status: 200, body: team };
      case "institution.teaching-team-view.get": return { status: 200, body: teamView };
      case "teacher.course-students.get": return { status: 200, body: students };
      // The work belongs to T1 of Kolegij A, so the review's header names its course and task.
      case "teacher.work.get": return { status: 200, body: {
        documentId: ids.documentId, studentId: STUDENT_1, studentName: "Demo Kompost", assignmentId: tasks.t1,
        state: "predano", prevDocumentId: null, nextDocumentId: "izmisljeni-rad-0002",
      } };
      case "live.document.get": return { status: 200, body: ZIVI_TEKST, headers: { etag: ZIVI_ETAG } };
      case "teacher.submission-detail.get": return { status: 200, body: {
        ...detail, studentId: ids.studentId, document: live,
      } };
      case "work.interview.get": return { status: 200, body: { ...interview, explanations: [{
        id: "6a5b4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c51", questionId: "00000000-0000-4000-8000-0000000000a1",
        text: "Izmišljeno objašnjenje: odlomak je nastao nakon razgovora s mentorom.", createdAt: "2026-11-04T10:00:00.000Z",
      }] } };
      default: return undefined;
    }
  };
}
