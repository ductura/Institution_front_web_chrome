import { describe, expect, it } from "vitest";
import { extensionPath, gapsBanner, heading, links, sequence, showNotSubmittedBanner, stateLine, type Facts } from "./model";
import { workFrameMessages as text } from "./messages.hr";

const receipt = { submittedAt: "2026-11-02T08:50:00.000Z", dueAt: "2026-11-02T22:59:00.000Z", afterDeadline: false, version: 2, record: "continuous" as const };
const base: Facts = { studentName: "Student A", assignmentId: "a1", state: "predano", previousId: null, nextId: "d2", receipt };

describe("N-06 frame model", () => {
  it("heading uses the name or says it is missing", () => {
    expect(heading(base)).toBe("Student A · Rad");
    expect(heading({ studentName: null })).toBe(`${text.noName} · Rad`);
  });
  it("submitted line names time, due, version and the record", () => {
    expect(stateLine(base)).toBe("Predano 2. studenoga 2026. u 09:50 · rok 2. studenoga 2026. u 23:59 · verzija 2 · zapis je cjelovit");
    expect(stateLine({ ...base, state: "nakon_roka", receipt: { ...receipt, afterDeadline: true, record: "with_gaps" } })).toContain(", nakon roka (rok");
    expect(stateLine({ ...base, receipt: null })).toBe(text.submittedBare(false));
  });
  it("unsubmitted work is live and never gets an invented time", () => {
    expect(stateLine({ ...base, state: "nije_predano", receipt: null })).toBe(text.live);
  });
  it("sequence only lists what the server states", () => {
    expect(sequence(base)).toEqual(["Predano 2. studenoga 2026. u 09:50 · verzija 2"]);
    expect(sequence({ ...base, state: "nije_predano", receipt: null })).toEqual([]);
  });
  it("submission and compare links only for a submitted work", () => {
    expect(links(base, "/w").map((l) => l.key)).toEqual(["submission", "summary", "replay", "compare", "consultations"]);
    expect(links({ ...base, state: "nije_predano" }, "/w").map((l) => l.key)).toEqual(["summary", "replay", "consultations"]);
  });
  it("gaps banner spans the earliest to the latest gap, none without gaps", () => {
    expect(gapsBanner([])).toBeNull();
    expect(gapsBanner([{ previousEndedAt: "2026-10-26T20:45:00.000Z", nextStartedAt: "2026-10-28T09:50:00.000Z" }]))
      .toContain("Od verzije 26. listopada 2026. u 21:45 do verzije 28. listopada 2026. u 10:50");
  });
  it("not-submitted banner needs a known passed deadline and links to the extension", () => {
    const open = { state: "nije_predano" as const };
    expect(showNotSubmittedBanner(open, null)).toBe(false);
    expect(showNotSubmittedBanner(open, true)).toBe(true);
    expect(extensionPath("a/1")).toBe("/nastavnik/zadatak/a%2F1/produljenje");
  });
});
