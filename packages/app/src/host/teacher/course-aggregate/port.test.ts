import { describe, expect, it } from "vitest";

import { createApi, signInHref } from "../../../../../../src/client/api";
import vectors from "../../../../../../src/client/migration-contract-vectors.generated.json" with { type: "json" };
import type { AssignmentRead } from "../assignment-card/model";
import { aggregatePath, loadAggregate, MIN_STUDENTS, type AggregateView } from "./model";
import { aggregateOfWire, courseAggregatePort, readCourseAssignments, signInToAggregate } from "./port";

// PIL-K-ZBIRNO: the aggregate read through the real port, createApi over invented answers of the contract.
const vector = (name: string) => {
  const found = vectors.find((v) => v.route === "course.aggregate.get" && v.name === name);
  if (found === undefined) throw new Error(`no vector ${name}`);
  return found.response;
};
const COURSE = "00000000-0000-4000-8000-0000000000c1";
const A1 = "00000000-0000-4000-8000-0000000000a1";
const A2 = "00000000-0000-4000-8000-0000000000a2";
const assignment = (id: string, title: string) => ({
  id, title, workType: "seminar_paper", opensAt: "2026-10-01T08:00:00.000Z", dueAt: "2026-12-15T22:59:00.000Z", currentVersion: 1, enrolledStudents: 15,
});
const COURSES = {
  courses: [{ id: COURSE, name: "Izmišljeni seminar iz ekologije grada", academicYear: "2026/2027", aiPolicy: "partially_allowed",
    assignments: [assignment(A1, "Kućno kompostiranje"), assignment(A2, "Probna vježba")] }],
};

type Answer = { status: number; body: unknown };
const json = ({ status, body }: Answer) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** createApi over a stand-in transport: the aggregate and the courses by path; records every URL. */
function client(aggregate: Answer, urls: string[] = [], courses: Answer = { status: 200, body: COURSES }) {
  return () => createApi({
    baseUrl: "http://127.0.0.1:1",
    fetchImpl: async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      urls.push(url);
      return json(url.includes("/aggregate") ? aggregate : courses);
    },
  });
}
const available = (stages: { notStarted: number; inProgress: number; submitted: number }) => ({
  status: 200, body: { status: "available", started: stages.inProgress + stages.submitted, submitted: stages.submitted, stages },
});
const practice = (flags: Record<string, boolean>) => async (id: string): Promise<AssignmentRead> =>
  ({ kind: "ready", value: { isPractice: flags[id] === true } } as unknown as AssignmentRead);
const regular = [{ assignmentId: A1, isPractice: false }];

async function view(aggregate: Answer, urls: string[] = []): Promise<AggregateView> {
  return loadAggregate(courseAggregatePort(client(aggregate, urls)), COURSE, regular);
}

describe("course aggregate real port (PIL-K-ZBIRNO)", () => {
  it("reads course.aggregate.get for the course and shows the stages as shares", async () => {
    const urls: string[] = [];
    const shown = await view(vector("course-aggregate"), urls);
    expect(urls).toEqual([`http://127.0.0.1:1/api/v1/courses/${COURSE}/aggregate`]);
    if (shown.kind !== "ready") throw new Error("expected ready");
    expect(shown.students).toBe(15);
    expect(shown.measures.map((m) => [m.key, m.shown && m.count])).toEqual([["submitted", 5], ["inProgress", 5], ["notStarted", 5]]);
  });

  it("(1) is suppressed as a whole below the threshold, by the server or by the count", async () => {
    expect(await view(vector("suppressed"))).toEqual({ kind: "suppressed" });
    expect(await view(available({ notStarted: 1, inProgress: 1, submitted: MIN_STUDENTS - 3 }))).toEqual({ kind: "suppressed" });
    const json = JSON.stringify(await view(vector("suppressed")));
    expect(json).not.toMatch(/\d/);
  });

  it("(2) hides a measure whose count or whose complement is below the threshold", async () => {
    const small = await view(available({ notStarted: 3, inProgress: 7, submitted: 10 }));
    if (small.kind !== "ready") throw new Error("expected ready");
    // 3 is below the threshold; 7 and 10 are hidden too, or 3 would be 20 − 7 − 10 (secondary suppression).
    expect(small.measures.map((m) => [m.key, m.shown])).toEqual([["submitted", false], ["inProgress", false], ["notStarted", false]]);
    expect(small.chartAlt).not.toMatch(/\d/);
    const complement = await view(available({ notStarted: 1, inProgress: 2, submitted: 17 }));
    if (complement.kind !== "ready") throw new Error("expected ready");
    expect(complement.measures.every((m) => !m.shown)).toBe(true);
    expect(complement.chartAlt).not.toMatch(/\d/);
  });

  it("(3) carries no name, no scale and no ranking", async () => {
    const text = JSON.stringify(await view(vector("course-aggregate")));
    expect(text).not.toMatch(/name|ime|rank|grade|ocjen|score|poredak/i);
  });

  it("(4) leaves practice assignments out and never asks the route for a practice-only course", async () => {
    const read = await readCourseAssignments(COURSE, client(vector("course-aggregate")), practice({ [A2]: true }));
    expect(read).toEqual({ kind: "ready", value: { courseName: "Izmišljeni seminar iz ekologije grada", assignments: [
      { assignmentId: A1, isPractice: false }, { assignmentId: A2, isPractice: true }] } });
    if (read.kind !== "ready") return;
    const urls: string[] = [];
    const shown = await loadAggregate(courseAggregatePort(client(vector("course-aggregate"), urls)), COURSE, read.value.assignments);
    expect(shown).toMatchObject({ kind: "ready", practiceLeftOut: 1 });
    const onlyPractice = await readCourseAssignments(COURSE, client(vector("course-aggregate")), practice({ [A1]: true, [A2]: true }));
    if (onlyPractice.kind !== "ready") throw new Error("expected ready");
    const none: string[] = [];
    expect(await loadAggregate(courseAggregatePort(client(vector("course-aggregate"), none)), COURSE, onlyPractice.value.assignments)).toEqual({ kind: "practiceOnly" });
    expect(none).toEqual([]);
  });

  it("maps 401 to signed out and every other failure to unavailable, never a made-up share", async () => {
    expect(await view(vector("unauthorized"))).toEqual({ kind: "signedOut" });
    for (const name of ["forbidden", "not-found", "unavailable"]) expect(await view(vector(name))).toEqual({ kind: "unavailable" });
    expect(await loadAggregate(courseAggregatePort(() => createApi({ baseUrl: "http://127.0.0.1:1", fetchImpl: async () => { throw new Error("x"); } })), COURSE, regular))
      .toEqual({ kind: "unavailable" });
    expect(aggregateOfWire({ status: "available", started: 9, submitted: 5, stages: { notStarted: 5, inProgress: 5, submitted: 5 } })).toEqual({ kind: "unavailable" });
    expect(aggregateOfWire({ status: "available", started: 10, submitted: 4, stages: { notStarted: 5, inProgress: 5, submitted: 5 } })).toEqual({ kind: "unavailable" });
  });

  it("reads the course's assignments: unknown course and failed reads are not an empty course", async () => {
    expect(await readCourseAssignments("00000000-0000-4000-8000-00000000dead", client(vector("course-aggregate")), practice({}))).toEqual({ kind: "unavailable" });
    expect(await readCourseAssignments(COURSE, client(vector("course-aggregate"), [], { status: 401, body: { code: "unauthorized" } }), practice({}))).toEqual({ kind: "signedOut" });
    expect(await readCourseAssignments(COURSE, client(vector("course-aggregate"), [], { status: 503, body: { code: "unavailable" } }), practice({}))).toEqual({ kind: "unavailable" });
  });

  it("sends a signed-out teacher to AAI@EduHr sign-in and back to this aggregate", () => {
    const left: string[] = [];
    signInToAggregate("/app/web", COURSE, (href) => left.push(href));
    expect(left).toEqual([signInHref(`/app/web${aggregatePath(COURSE)}`)]);
  });
});
