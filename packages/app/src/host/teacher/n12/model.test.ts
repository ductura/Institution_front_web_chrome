import { describe, expect, it } from "vitest";
import { n12Messages as t } from "./messages.hr";
import { checkAddition, checkForm, dayHr, momentHr, recordTitle, revisionLabel, sortRecords, todayIso, versionOptions } from "./model";

describe("N-12 model", () => {
  it("keeps the prototype wording", () => {
    expect(t.listNote).toBe("Zapise vide mentor i student. Dopunjuje ih samo mentor.");
    expect(t.newNote).toBe("Zapis vide mentor i student. Zapis je vezan uz verziju rada. Nakon bilježenja zapis se ne briše ni ne prepravlja; može ga dopuniti samo mentor.");
    expect(t.noAgreement).toBe("Nije upisano.");
    expect(t.backToWork).toBe("Natrag na rad");
    expect(recordTitle("5. 11. 2026.")).toBe("Konzultacija 5. 11. 2026.");
    expect(revisionLabel(3)).toBe("Verzija 3");
  });
  it("defaults the date to today and sorts newest first without mutating", () => {
    expect(todayIso(new Date(2026, 10, 5))).toBe("2026-11-05");
    const rows = [{ heldOn: "2026-10-01" }, { heldOn: "2026-11-05" }];
    expect(sortRecords(rows).map((r) => r.heldOn)).toEqual(["2026-11-05", "2026-10-01"]);
    expect(rows[0]?.heldOn).toBe("2026-10-01");
  });
  it("makes one option per revision, saved or submitted", () => {
    const options = versionOptions([
      { revision: 2, kind: "submission", savedMinute: "a" },
      { revision: 2, kind: "save", savedMinute: "b" },
      { revision: 1, savedMinute: "c" },
    ], (iso) => iso);
    expect(options).toEqual([
      { value: "2", label: "Verzija 2, predana a" },
      { value: "1", label: "Verzija 1, zabilježena c" },
    ]);
  });
  it("checks the form: date and version, then topic", () => {
    const base = { heldOn: "2026-11-05", revision: "2", topic: "Tema", agreement: " dogovor " };
    expect(checkForm({ ...base, heldOn: "" }, ["2"])).toEqual({ ok: false, message: t.needDateAndVersion });
    expect(checkForm({ ...base, revision: "9" }, ["2"])).toEqual({ ok: false, message: t.needDateAndVersion });
    expect(checkForm({ ...base, topic: "   " }, ["2"])).toEqual({ ok: false, message: t.needTopic });
    expect(checkForm(base, ["2"])).toEqual({ ok: true, value: { heldOn: "2026-11-05", revision: 2, topic: "Tema", agreement: "dogovor" } });
  });
  it("rejects an empty addition", () => {
    expect(checkAddition("  ")).toEqual({ ok: false, message: t.needAddition });
    expect(checkAddition(" x ")).toEqual({ ok: true, text: "x" });
  });
});

describe("prototype date writing", () => {
  it("writes a day and a moment in Zagreb time", () => {
    expect(dayHr("2026-11-05T22:30:00.000Z")).toBe("5. 11. 2026.");
    expect(dayHr("2026-11-05T23:30:00.000Z")).toBe("6. 11. 2026.");
    expect(momentHr("2026-11-04T07:30:00.000Z")).toBe("4. 11. 2026. u 8:30");
  });
});
