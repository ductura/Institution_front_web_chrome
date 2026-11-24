// WEB-NUZ-PG: the reads of "Pregled rada" through createApi on a recorded transport. Invented data only.
import { describe, expect, it } from "vitest";

import { readGrade, readHeader, readRhythm } from "./read";

const ORIGIN = "https://ductura.example.invalid";
const DOCUMENT = "rad-izmisljeni-b";
const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const STUDENT = "00000000-0000-4000-8000-0000000000e1";
const COURSE = "00000000-0000-4000-8000-0000000000b1";
const WORK = { documentId: DOCUMENT, studentId: STUDENT, studentName: "Student A", assignmentId: ASSIGNMENT, state: "nije_predano", prevDocumentId: null, nextDocumentId: null };
const COURSES = { courses: [{ id: COURSE, name: "Kolegij A", academicYear: "2026/2027", aiPolicy: "partially_allowed", assignments: [{
  id: ASSIGNMENT, title: "Lokalni mediji", workType: "seminar_paper", opensAt: "2026-10-01T08:00:00.000Z",
  dueAt: "2026-11-30T22:59:00.000Z", currentVersion: 1, enrolledStudents: 12,
}] }] };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (status: number, code: string) => json(status, { error: code, code, messageKey: "errors.x", status, requestId: "00000000-0000-4000-8000-000000000000" });

function server(answers: Record<string, () => Response>) {
  const sent: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    sent.push(path);
    const answer = answers[path];
    return answer === undefined ? error(503, "unavailable") : answer();
  };
  return { sent, options: { baseUrl: ORIGIN, fetchImpl } };
}

describe("WEB-NUZ-PG reads", () => {
  it("names course, task and deadline from the teacher's course list; a practice assignment from 409", async () => {
    const { sent, options } = server({
      [`/api/v1/teacher/works/${DOCUMENT}`]: () => json(200, WORK),
      "/api/v1/teacher/courses": () => json(200, COURSES),
      [`/api/v1/teacher/assignments/${ASSIGNMENT}/grade`]: () => error(409, "practice_assignment"),
    });
    const read = await readHeader(DOCUMENT, options);
    expect(read).toEqual({ kind: "ready", header: {
      facts: { studentName: "Student A", assignmentId: ASSIGNMENT, state: "nije_predano", previousId: null, nextId: null, receipt: null },
      context: { course: "Kolegij A", title: "Lokalni mediji", workType: "seminar_paper", dueAt: "2026-11-30T22:59:00.000Z" },
      grade: "practice",
    } });
    expect(sent).toContain("/api/v1/teacher/courses");
  });

  it("leaves the context out when the course list fails or does not list the assignment, never guessing", async () => {
    const { options } = server({
      [`/api/v1/teacher/works/${DOCUMENT}`]: () => json(200, WORK),
      "/api/v1/teacher/courses": () => json(200, { courses: [] }),
      [`/api/v1/teacher/assignments/${ASSIGNMENT}/grade`]: () => json(200, { eligible: true }),
    });
    const read = await readHeader(DOCUMENT, options);
    expect(read.kind === "ready" && read.header.context).toBeNull();
    expect(read.kind === "ready" && read.header.grade).toBe("eligible");
    expect(await readGrade(ASSIGNMENT, server({}).options)).toBe("unknown");
  });

  it("passes on 401 and 404 of the work itself", async () => {
    expect(await readHeader(DOCUMENT, server({ [`/api/v1/teacher/works/${DOCUMENT}`]: () => error(401, "unauthorized") }).options)).toEqual({ kind: "signedOut" });
    expect(await readHeader(DOCUMENT, server({ [`/api/v1/teacher/works/${DOCUMENT}`]: () => error(404, "not_found") }).options)).toEqual({ kind: "notFound" });
  });

  it("counts rhythm bursts; 404 is not given, 503 an error, nothing is sent after the session ended", async () => {
    const path = `/api/v1/works/${DOCUMENT}/input-rhythm`;
    const burst = { id: "00000000-0000-4000-8000-0000000000d1", gapsMs: [120, 90], recordedAt: "2026-11-01T10:00:00.000Z" };
    expect(await readRhythm(DOCUMENT, () => true, server({ [path]: () => json(200, { bursts: [burst, burst] }) }).options)).toEqual({ kind: "ok", value: 2 });
    expect(await readRhythm(DOCUMENT, () => true, server({ [path]: () => error(404, "not_found") }).options)).toEqual({ kind: "notFound" });
    expect(await readRhythm(DOCUMENT, () => true, server({}).options)).toEqual({ kind: "unavailable" });
    const idle = server({});
    expect(await readRhythm(DOCUMENT, () => false, idle.options)).toEqual({ kind: "signedOut" });
    expect(idle.sent).toEqual([]);
  });
});
