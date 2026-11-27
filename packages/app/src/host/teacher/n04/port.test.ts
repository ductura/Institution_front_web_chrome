import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createApi } from "../../../../../../src/client/api";
import { signInHref } from "../../../../../../src/client/api";
import vectors from "../../../../../../src/client/migration-contract-vectors.generated.json" with { type: "json" };
import { loadRoster, notStartedCount, stateLine, workInState, workStatusOf } from "./model";
import { courseStudentsPort, signInWhenSignedOut } from "./port";

// PIL-K-N04: the roster read through the real port, createApi over invented answers of the contract.
const vector = (route: string, name: string) => {
  const found = vectors.find((v) => v.route === route && v.name === name);
  if (found === undefined) throw new Error(`no vector ${route} ${name}`);
  return found.response;
};
const ROSTER = vector("teacher.course-students.get", "course-students");
const COURSE = "00000000-0000-4000-8000-0000000000c1";
const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const COURSES = {
  courses: [{
    id: COURSE, name: "Izmišljeni seminar iz ekologije grada", academicYear: "2026/2027", aiPolicy: "partially_allowed",
    assignments: [{ id: ASSIGNMENT, title: "Kućno kompostiranje", workType: "seminar_paper", opensAt: "2026-10-01T08:00:00.000Z",
      dueAt: "2026-12-15T22:59:00.000Z", currentVersion: 1, enrolledStudents: 3 }],
  }],
};

type Answer = { status: number; body: unknown };
/** createApi over a stand-in transport: the roster and the courses by path; records every URL. */
function port(roster: Answer, courses: Answer = { status: 200, body: COURSES }, urls: string[] = []) {
  return courseStudentsPort(() => createApi({
    baseUrl: "http://127.0.0.1:1",
    fetchImpl: async (input) => {
      const url = String(input instanceof Request ? input.url : input);
      urls.push(url);
      const { status, body } = url.includes("/students") ? roster : courses;
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    },
  }));
}

describe("N-04 real port (PIL-K-N04)", () => {
  it("reads the roster through teacher.course-students.get and names each work from teacher.courses.get", async () => {
    const urls: string[] = [];
    const read = await loadRoster(port(ROSTER, undefined, urls), COURSE);
    expect(urls.some((u) => u.endsWith(`/api/v1/teacher/courses/${COURSE}/students`))).toBe(true);
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    expect(read.data.courseName).toBe("Izmišljeni seminar iz ekologije grada");
    expect(read.data.students.map((s) => [s.name, s.group])).toEqual([["Demo Kompost", "Grupa A"], [null, "Grupa B"], ["Demo Vrt", "Grupa B"]]);
    expect(read.data.students.map((s) => s.works.map((w) => [w.title, w.workType, w.status, w.documentId]))).toEqual([
      [["Kućno kompostiranje", "seminar_paper", "submitted", "izmisljeni-rad-predaje-0001"]],
      [["Kućno kompostiranje", "seminar_paper", "writing", "izmisljeni-rad-0002"]],
      [["Kućno kompostiranje", "seminar_paper", "not_submitted", null]],
    ]);
    // Nothing the route does not give is invented.
    for (const s of read.data.students) for (const w of s.works) {
      expect(w).not.toHaveProperty("submittedAt");
      expect(w).not.toHaveProperty("version");
      expect(w).not.toHaveProperty("record");
      expect(w).not.toHaveProperty("revision");
    }
  });

  it("NAS-10/NAS-11: the revision of each work and the unconfirmed notice come from teacher.assignment-follow-up.get", async () => {
    const ids = (ROSTER as { body: { students: { studentId: string }[] } }).body.students.map((s) => s.studentId);
    const item = (studentId: string, over: object) => ({
      studentId, noticeReadAt: null, noticeAcknowledgedAt: null, noticeVersionNo: null, revisionState: null, revisionChangedAt: null, openRevisionCount: 0, ...over,
    });
    const follow = { students: [
      item(ids[0]!, { noticeAcknowledgedAt: "2026-11-02T10:00:00.000Z", noticeVersionNo: 1, revisionState: "open", revisionChangedAt: "2026-11-03T10:00:00.000Z", openRevisionCount: 1 }),
      item(ids[1]!, { noticeAcknowledgedAt: "2026-11-02T10:00:00.000Z", noticeVersionNo: 1 }),
      item(ids[2]!, { revisionState: "withdrawn", revisionChangedAt: "2026-11-03T10:00:00.000Z", openRevisionCount: 1 }),
    ] };
    const call = courseStudentsPort(() => createApi({
      baseUrl: "http://127.0.0.1:1",
      fetchImpl: async (input) => {
        const url = String(input instanceof Request ? input.url : input);
        const body = url.endsWith("/follow-up") ? follow : url.includes("/students") ? ROSTER.body : COURSES;
        return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      },
    }));
    const read = await loadRoster(call, COURSE);
    if (read.kind !== "ready") throw new Error("not ready");
    const works = read.data.students.map((s) => s.works[0]!);
    expect(works.map((w) => w.revision)).toEqual([{ state: "open", deadline: null }, null, { state: "open", deadline: null }]);
    expect(works.map((w) => w.status)).toEqual(["submitted", "writing", "unconfirmed"]);
    // An unconfirmed work is still not started: it stays in that filter and count.
    expect(notStartedCount(read.data.students)).toBe(1);
    expect(workInState(works[2]!, "revision")).toBe(true);
  });
  it("keeps the roster when the course read fails, without names", async () => {
    const read = await loadRoster(port(ROSTER, vector("teacher.courses.get", "unavailable")), COURSE);
    expect(read.kind).toBe("ready");
    if (read.kind !== "ready") return;
    expect(read.data.courseName).toBeUndefined();
    expect(read.data.students[0]?.works[0]).toMatchObject({ title: null, workType: null, status: "submitted" });
  });

  it("an empty roster is an empty list, a failed one is unavailable, never empty", async () => {
    expect(await loadRoster(port(vector("teacher.course-students.get", "empty-roster")), COURSE))
      .toEqual({ kind: "ready", data: { courseName: COURSES.courses[0]?.name, students: [] } });
    expect(await loadRoster(port(vector("teacher.course-students.get", "unavailable")), COURSE)).toEqual({ kind: "unavailable" });
    expect(await loadRoster(port(vector("teacher.course-students.get", "forbidden")), COURSE)).toEqual({ kind: "unavailable" });
    const broken = courseStudentsPort(() => createApi({ baseUrl: "http://127.0.0.1:1", fetchImpl: () => Promise.reject(new TypeError("Failed to fetch")) }));
    expect(await loadRoster(broken, COURSE)).toEqual({ kind: "unavailable" });
  });

  it("says a state it does not know neutrally", async () => {
    expect(workStatusOf("returned")).toBe("unknown");
    expect(workStatusOf(undefined)).toBe("unknown");
    expect(stateLine({ assignmentId: "a", title: null, workType: null, status: workStatusOf("returned") })).toBe("Stanje rada nije poznato");
    const odd = { students: [{ ...(ROSTER.body as { students: object[] }).students[0], assignments: [{ assignmentId: ASSIGNMENT, documentId: null, workState: "returned" }] }] };
    expect(await loadRoster(port({ status: 200, body: odd }), COURSE)).toEqual({ kind: "unavailable" });
  });

  it("a 401 is signed out and goes to sign-in, back to this roster", async () => {
    const read = await loadRoster(port(vector("teacher.course-students.get", "unauthorized")), COURSE);
    expect(read).toEqual({ kind: "signedOut" });
    const left: string[] = [];
    signInWhenSignedOut(read, "/aplikacija", COURSE, (href) => left.push(href));
    expect(left).toEqual([signInHref(`/aplikacija/nastavnik/kolegiji/${COURSE}/studenti`)]);
    signInWhenSignedOut({ kind: "unavailable" }, "/aplikacija", COURSE, (href) => left.push(href));
    expect(left).toHaveLength(1);
  });

  it("the route mounts the real port, not the default", () => {
    const page = readFileSync(join(import.meta.dirname, "../../../../app/(host)/nastavnik/kolegiji/[courseId]/studenti/page.tsx"), "utf8");
    expect(page).toMatch(/from "\.\.\/(?:\.\.\/)*src\/host\/teacher\/n04\/CourseStudentsPage"/);
    const wrapper = readFileSync(join(import.meta.dirname, "CourseStudentsPage.tsx"), "utf8");
    expect(wrapper).toMatch(/courseStudentsPort\(\)/);
    expect(wrapper).toMatch(/port=\{port\}/);
  });
});
