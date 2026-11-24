// NZ-18 and PG-15: the VIZ "puno" teacher's reads join the scenario's tasks and keep the contract's shapes.
import { describe, expect, it } from "vitest";

import { RESPONSES } from "../../../src/client/api";
import { matchesSchema, type Schema } from "../../../src/client/schema-check";
import { generatedServer } from "../e2e/viz/server";
import { PREDANI_RAD, ZIVI_ETAG, ZIVI_TEKST } from "./viz-nastavnik";
import { T1, T2, type Answer, type Result } from "./viz-scenariji";

const answered = (r: Result) => r as Answer;
const body = (r: Result) => JSON.parse(answered(r).body ?? "null") as Record<string, any>;
const schema = (id: string) => RESPONSES.get(id)?.["200"]?.content?.["application/json"]?.schema as Schema;
const COURSE_A = "2c1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e01";
const READS: readonly [string, string][] = [
  ["institution.teaching-team.get", `/api/v1/courses/${COURSE_A}/team`],
  ["institution.teaching-team-view.get", `/api/v1/courses/${COURSE_A}/team/view`],
  ["teacher.course-students.get", `/api/v1/teacher/courses/${COURSE_A}/students`],
  ["teacher.work.get", `/api/v1/teacher/works/${PREDANI_RAD}`],
  ["live.document.get", `/api/v1/live/${PREDANI_RAD}`],
  ["teacher.submission-detail.get", `/api/v1/teacher/assignments/${T1}/submissions/00000000-0000-4000-8000-0000000000e1`],
  ["work.interview.get", `/api/v1/works/${PREDANI_RAD}/interview`],
];

describe("NZ-18, PG-15: the puno teacher", () => {
  it("every joined read is the contract's 200 shape", () => {
    const s = generatedServer("puno");
    for (const [id, path] of READS) {
      const r = s.answer("teacher", "GET", path);
      expect(answered(r).status, id).toBe(200);
      expect(matchesSchema(schema(id), body(r)), id).toBe(true);
    }
  });

  it("the team's ids agree with each other, untouched by the course id", () => {
    const s = generatedServer("puno");
    const team = body(s.answer("teacher", "GET", `/api/v1/courses/${COURSE_A}/team`));
    const view = body(s.answer("teacher", "GET", `/api/v1/courses/${COURSE_A}/team/view`));
    expect(view.assistants.map((a: { id: string }) => a.id)).toEqual(team.assistantIds);
    expect(JSON.stringify(view)).not.toContain(COURSE_A);
  });

  it("the course's students and the work join T1 and T2, and the work names its own document", () => {
    const s = generatedServer("puno");
    const students = body(s.answer("teacher", "GET", `/api/v1/teacher/courses/${COURSE_A}/students`)).students;
    const tasks = new Set(students.flatMap((x: { assignments: { assignmentId: string }[] }) => x.assignments.map((a) => a.assignmentId)));
    expect([...tasks].sort()).toEqual([T1, T2].sort());
    expect(students.every((x: { givenName: string | null }) => x.givenName !== null)).toBe(true);
    expect(body(s.answer("teacher", "GET", "/api/v1/teacher/works/izmisljeni-rad-0002"))).toMatchObject({ documentId: "izmisljeni-rad-0002", assignmentId: T1 });
  });

  it("the live text carries the ETag of its exact bytes, and the submitted version is that text", async () => {
    const s = generatedServer("puno");
    const live = answered(s.answer("teacher", "GET", `/api/v1/live/${PREDANI_RAD}`));
    expect(live.body).toBe(JSON.stringify(ZIVI_TEKST));
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(live.body!));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(live.headers?.etag).toBe(ZIVI_ETAG);
    expect(ZIVI_ETAG).toBe(`"${hex}"`);
    expect(live.headers?.etag).toMatch(/^"[0-9a-f]{64}"$/);
    const detail = body(s.answer("teacher", "GET", `/api/v1/teacher/assignments/${T1}/submissions/00000000-0000-4000-8000-0000000000e2`));
    expect(detail.studentId).toBe("00000000-0000-4000-8000-0000000000e2");
    expect(JSON.parse(detail.document)).toEqual(ZIVI_TEKST);
  });

  it("the interview has the student's explanation, and prazno joins nothing", () => {
    expect(body(generatedServer("puno").answer("teacher", "GET", `/api/v1/works/${PREDANI_RAD}/interview`)).explanations).toHaveLength(1);
    expect(body(generatedServer("prazno").answer("teacher", "GET", `/api/v1/teacher/courses/${COURSE_A}/students`)).students).toEqual([]);
  });
});
