import { describe, expect, it } from "vitest";
import { FAKE_ROSTER, fakeCourseStudentsPort } from "./fake-port";
import { groupOptions, loadRoster, revisionLine, seminarDocumentId, stateLine, unavailablePort, visibleStudents, whenHr, type RosterWork } from "./model";

const sub = (over: Partial<RosterWork> = {}): RosterWork => ({ assignmentId: "a", title: "T", workType: "essay", status: "submitted", ...over });

describe("N-04 model", () => {
  it("formats time in Zagreb like the prototype", () => {
    expect(whenHr("2026-11-05T20:14:00Z")).toBe("5. 11. 2026. u 21:14");
    expect(whenHr("nope")).toBeNull();
  });
  it("says the submitted state in words", () => {
    expect(stateLine(sub({ submittedAt: "2026-11-05T20:14:00Z", afterDeadline: false, version: 2, record: "with_gaps" })))
      .toBe("Predano 5. 11. 2026. u 21:14, prije roka, verzija 2, zapis ima praznine");
    expect(stateLine(sub({ submittedAt: "2026-11-05T20:14:00Z", afterDeadline: true, version: 1, record: "continuous" })))
      .toBe("Predano 5. 11. 2026. u 21:14, nakon roka, verzija 1, zapis je cjelovit");
    expect(stateLine(sub({ status: "writing" }))).toBe("U pisanju");
    expect(stateLine(sub({ status: "not_submitted" }))).toBe("Nije predano");
    expect(stateLine(sub({ status: "unconfirmed" }))).toBe("Obavijest o zadatku još nije potvrđena");
  });
  it("leaves out what the read does not say", () => {
    expect(stateLine(sub())).toBe("Predano");
  });
  it("shows the revision only while it waits, as text", () => {
    expect(revisionLine(sub({ revision: { state: "open", deadline: "2026-11-12T22:59:00Z" } })))
      .toBe("Čeka doradu, rok za doradu 12. 11. 2026. u 23:59.");
    expect(revisionLine(sub({ revision: { state: "reopened", deadline: null } }))).toBe("Čeka doradu.");
    expect(revisionLine(sub({ revision: { state: "accepted", deadline: null } }))).toBeNull();
    expect(revisionLine(sub())).toBeNull();
  });
  it("links only a seminar paper with a safe document id", () => {
    expect(seminarDocumentId(sub({ workType: "seminar_paper", documentId: "doc-a" }))).toBe("doc-a");
    expect(seminarDocumentId(sub({ workType: "essay", documentId: "doc-a" }))).toBeNull();
    expect(seminarDocumentId(sub({ workType: "seminar_paper", documentId: ".." }))).toBeNull();
    expect(seminarDocumentId(sub({ workType: "seminar_paper", documentId: null }))).toBeNull();
  });
  it("filters by group with counts and sorts by name", () => {
    expect(groupOptions(FAKE_ROSTER.students).map((o) => o.label)).toEqual(["Svi (2)", "Grupa 2 (1)", "Grupa 4 (1)"]);
    expect(groupOptions([{ studentId: "x", name: null, group: null, works: [] }])).toEqual([]);
    expect(visibleStudents(FAKE_ROSTER.students, "Grupa 4").map((s) => s.name)).toEqual(["Student B"]);
    expect(visibleStudents([{ studentId: "1", name: null, group: null, works: [] }, ...FAKE_ROSTER.students], "").map((s) => s.name))
      .toEqual(["Student A", "Student B", null]);
  });
  it("is unavailable on failure, contradiction and without a route", async () => {
    expect(await loadRoster(unavailablePort, "c")).toEqual({ kind: "unavailable" });
    expect(await loadRoster({ read: async () => { throw new Error("x"); } }, "c")).toEqual({ kind: "unavailable" });
    const dup = { courseName: "K", students: [FAKE_ROSTER.students[0]!, FAKE_ROSTER.students[0]!] };
    expect(await loadRoster(fakeCourseStudentsPort({ kind: "ready", data: dup }), "c")).toEqual({ kind: "unavailable" });
    expect((await loadRoster(fakeCourseStudentsPort(), "c")).kind).toBe("ready");
  });
});
