// WEB-2006: the frame of the teacher's live view over teacher.work.get; invented data only.
import { describe, expect, it } from "vitest";
import { readTeacherWorkFrame } from "./teacher-work";

const DOC = "demo-rad-1";
const ids = { studentId: "3f2b8c1e-4a5d-4e6f-8a7b-9c0d1e2f3a4b", assignmentId: "4a3c9d2f-5b6e-4f70-9b8c-0d1e2f3a4b5c" };
const body = { documentId: DOC, ...ids, studentName: "Demo Studentica", state: "predano", prevDocumentId: "demo-rad-0", nextDocumentId: null };

function fetchOf(status: number, answer: unknown, seen: string[] = []): typeof fetch {
  return (async (url: RequestInfo | URL) => {
    seen.push(String(url));
    return new Response(JSON.stringify(answer), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}
const options = (fetchImpl: typeof fetch) => ({ baseUrl: "http://localhost:3000", fetchImpl });

describe("readTeacherWorkFrame", () => {
  it("maps the answer of teacher.work.get; the title is never invented", async () => {
    const seen: string[] = [];
    expect(await readTeacherWorkFrame(DOC, options(fetchOf(200, body, seen)))).toEqual({
      studentName: "Demo Studentica", assignmentTitle: null, submitted: true, previousId: "demo-rad-0", nextId: null,
    });
    expect(seen).toEqual([`http://localhost:3000/api/v1/teacher/works/${DOC}`]);
  });
  it("a state other than predano is not submitted", async () => {
    const frame = await readTeacherWorkFrame(DOC, options(fetchOf(200, { ...body, state: "ceka", studentName: null })));
    expect(frame).toMatchObject({ submitted: false, studentName: null });
  });
  it("another document, an error and a broken connection give null", async () => {
    expect(await readTeacherWorkFrame(DOC, options(fetchOf(200, { ...body, documentId: "drugi" })))).toBeNull();
    expect(await readTeacherWorkFrame(DOC, options(fetchOf(404, { code: "not_found" })))).toBeNull();
    expect(await readTeacherWorkFrame(DOC, options((async () => { throw new TypeError("x"); }) as typeof fetch))).toBeNull();
  });
});
