import { describe, expect, it } from "vitest";
import { FAKE_DATA, FAKE_EXTENSIONS, fakeN13Port } from "./fake-port";
import { filterByStudent, studentSeesText, detailText, leadText, loadN13, noteOf, reasonOptions, recordN13, titleText, whoText } from "./model";

const students = FAKE_DATA.students;
const draft = { scope: "all", studentId: "", dueAt: "2026-11-15T22:59:00.000Z", reasonId: "all" } as const;

describe("N-13 model", () => {
  it("leads with task, course and the deadline in Zagreb time", () => {
    expect(leadText(FAKE_DATA.context)).toBe("Zadatak „Lokalni mediji i izborna kampanja”, Kolegij A · rok 8. 11. 2026. u 23:59. Produljenje pokrećete samo Vi; student ga ne traži kroz Ducturu.");
    expect(leadText({ task: null, course: null, dueAt: null })).toBe("Produljenje pokrećete samo Vi; student ga ne traži kroz Ducturu.");
  });
  it("offers the reason for all only for all students", () => {
    expect(reasonOptions("one").map((o) => o.value)).toEqual(["justified", "technical", "agreement"]);
    expect(reasonOptions("all").map((o) => o.value)).toContain("all");
  });
  it("names who, hides another teacher's reason and says who recorded", () => {
    expect(whoText(FAKE_EXTENSIONS[0]!, students)).toBe("Dora Matić");
    expect(whoText(FAKE_EXTENSIONS[1]!, students)).toBe("Svi studenti zadatka");
    expect(whoText({ ...FAKE_EXTENSIONS[0]!, studentId: "x" }, students)).toBe("Ime nije dostupno");
    expect(titleText(FAKE_EXTENSIONS[0]!, students)).toBe("Dora Matić · novi rok 12. 11. 2026. u 23:59");
    expect(detailText(FAKE_EXTENSIONS[0]!)).toBe("Stari rok 8. 11. 2026. u 23:59 · razlog: Opravdan razlog · zabilježio Vi, 4. 11. 2026. u 9:20");
    expect(detailText(FAKE_EXTENSIONS[1]!)).toContain("Vidi ga nastavnik koji je zabilježio produljenje · zabilježio drugi nastavnik");
  });
  it("says success only for a recorded extension, the conflict with the student's name", () => {
    const ext = { ...FAKE_EXTENSIONS[0]!, studentId: "s-1" };
    expect(noteOf({ kind: "zabiljezeno", extension: ext, existingSubmissionsUnchanged: false }, students)).toMatchObject({ tone: "status", bold: "Produljenje je zabilježeno." });
    expect(noteOf({ kind: "zabiljezeno", extension: ext, existingSubmissionsUnchanged: true }, students)?.bold).toBe("Ana Horvat je predaju zatražio prije ovog produljenja.");
    expect(noteOf({ kind: "nepoznato" }, students)?.tone).toBe("alert");
    expect(noteOf({ kind: "greska", code: "not_found" }, students)?.bold).toBe("Zadatak ili student više nisu dostupni.");
    expect(noteOf({ kind: "session-expired" }, students)).toBeNull();
  });
  it("a failed read is unavailable and a failed record unknown", async () => {
    const broken = { read: async () => { throw new Error("x"); }, record: async () => { throw new Error("x"); } };
    expect(await loadN13(broken, "a-1")).toEqual({ kind: "unavailable" });
    expect(await recordN13(broken, "a-1", draft)).toEqual({ kind: "nepoznato" });
    expect((await loadN13(fakeN13Port(), "a-1")).kind).toBe("ready");
  });

  it("NZ-6: filters by student (own and for all) and shows what the student reads", () => {
    expect(filterByStudent(FAKE_EXTENSIONS, "").length).toBe(2);
    expect(filterByStudent(FAKE_EXTENSIONS, "s-4").map((e) => e.id)).toEqual(["e-1", "e-2"]);
    expect(filterByStudent(FAKE_EXTENSIONS, "s-1").map((e) => e.id)).toEqual(["e-2"]);
    expect(studentSeesText(FAKE_EXTENSIONS[0]!)).toBe("Student vidi: Bio 8. 11. 2026. u 23:59, razlog: Opravdan razlog");
    expect(studentSeesText(FAKE_EXTENSIONS[1]!)).toBe("Student vidi: Bio 12. 11. 2026. u 23:59, razlog: (skriven Vama)");
  });
});
