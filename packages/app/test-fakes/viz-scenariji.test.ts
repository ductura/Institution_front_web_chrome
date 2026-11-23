import { describe, expect, it } from "vitest";

import { generatedServer } from "../e2e/viz/server";
import { FIKSNI_DATUM, imeScenarija, SCENARIJI, T1, type Answer } from "./viz-scenariji";

const body = (r: unknown) => JSON.parse((r as Answer).body ?? "null") as Record<string, any>;

describe("VIZ scenarios of the fake server", () => {
  it("names: puno is the default, an unknown name fails loudly", () => {
    expect(imeScenarija(undefined)).toBe("puno");
    expect(imeScenarija("")).toBe("puno");
    for (const s of SCENARIJI) expect(imeScenarija(s)).toBe(s);
    expect(() => imeScenarija("nepoznat")).toThrow(/VIZ_SCENARIJ/);
  });

  it("the date is fixed to the prototype's today, 5. 11. 2026.", () => {
    expect(new Date(FIKSNI_DATUM).toISOString()).toBe("2026-11-05T22:59:00.000Z");
  });

  it("puno: Kolegij A, B and C with the prototype's tasks and states, no error on any contract read", () => {
    const s = generatedServer("puno");
    const a = body(s.answer("student", "GET", "/api/v1/student/assignments"));
    expect(a.courses.map((c: { name: string }) => c.name)).toEqual(["Kolegij A", "Kolegij B", "Kolegij C"]);
    expect(a.courses[0].assignments[0]).toMatchObject({ id: T1, title: "Lokalni mediji i izborna kampanja", dueAt: "2026-11-08T22:59:00.000Z" });
    expect(a.courses[1].assignments[0].noticeFirst).toBe(true);
    const w = body(s.answer("student", "GET", "/api/v1/student/assignment-work"));
    expect(w.assignments.map((x: { workState: string }) => x.workState)).toEqual(["in_progress", "not_started", "submitted"]);
    expect(body(s.answer("student", "GET", "/api/v1/me")).displayName).toBe("Student A");
    // The student's submission and the teacher's overview answer from the contract's own vectors.
    for (const path of [`/api/v1/student/assignments/${T1}/submission`, `/api/v1/teacher/assignments/${T1}/overview`, "/api/v1/institution/origin-thresholds"]) {
      const r = s.answer("teacher", "GET", path) as Answer;
      expect(r.status).toBe(200);
    }
  });

  it("prazno: the lists are empty, and still no error", () => {
    const s = generatedServer("prazno");
    expect(body(s.answer("student", "GET", "/api/v1/student/assignments")).courses).toEqual([]);
    expect(body(s.answer("teacher", "GET", "/api/v1/teacher/courses")).courses).toEqual([]);
    expect((s.answer("student", "GET", "/api/v1/student/assignments") as Answer).status).toBe(200);
  });

  it("ucitavanje hangs data reads, greska fails them, both still answer the session", () => {
    for (const name of ["ucitavanje", "greska"] as const) {
      expect((generatedServer(name).answer("student", "GET", "/api/v1/me") as Answer).status).toBe(200);
    }
    expect(generatedServer("ucitavanje").answer("student", "GET", "/api/v1/student/assignments")).toBe("hang");
    expect((generatedServer("greska").answer("student", "GET", "/api/v1/student/assignments") as Answer).status).toBe(503);
  });

  it("dugi-tekst: long names and titles with č ć đ š ž", () => {
    const a = body(generatedServer("dugi-tekst").answer("student", "GET", "/api/v1/student/assignments"));
    const title: string = a.courses[0].assignments[0].title;
    expect(title.length).toBeGreaterThan(100);
    for (const ch of "čćđšž") expect(title).toContain(ch);
  });

  it("signed out: 401, a request outside the contract: 404", () => {
    const s = generatedServer("puno");
    expect((s.answer(null, "GET", "/api/v1/me") as Answer).status).toBe(401);
    expect((s.answer("student", "GET", "/api/v1/nema-te-rute") as Answer).status).toBe(404);
  });
});

describe("the assignment's rhythm switch", () => {
  it("names its source, so the card is not 'unavailable'", () => {
    const r = body(generatedServer("puno").answer("teacher", "GET", `/api/v1/teacher/assignments/${T1}/input-rhythm`));
    expect(r.source).toBe("course");
  });
});
