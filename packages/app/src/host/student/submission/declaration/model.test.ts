import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { FAKE_CHATS, FAKE_READS, fakeReader } from "./fake-port";
import { chatDialogText, declarationStepText } from "./messages.hr";
import {
  canConfirm, canProceed, chatTitle, confirmLine, entryLabel, formMenuShown, mismatchTarget, mismatchText, recordedLine, stepView,
} from "./model";

describe("E-9 variants (WEB-2107)", () => {
  it("reads the work's state first, then what was read", () => {
    expect(stepView("not_started", FAKE_READS.puno)).toBe("notStarted");
    expect(stepView("submitted", FAKE_READS.puno)).toBe("submitted");
    expect(stepView("in_progress", FAKE_READS.puno)).toBe("full");
    expect(stepView("in_progress", FAKE_READS.nesklad)).toBe("full");
    expect(stepView("in_progress", FAKE_READS.prazno)).toBe("empty");
    expect(stepView("in_progress", FAKE_READS.ucitavanje)).toBe("loading");
    expect(stepView("in_progress", FAKE_READS.greska)).toBe("error");
  });

  it("a fake gives each variant", async () => {
    expect(await fakeReader("puno")("x")).toBe(FAKE_READS.puno);
  });

  it("finds the mismatch only when 'no use' contradicts a recorded transfer", () => {
    const full = FAKE_READS.puno;
    if (full.kind !== "ready") throw new Error("fixture");
    expect(mismatchTarget(full.recorded, "no_use")).toBe("2. Teorijski okvir, odlomak 1");
    expect(mismatchTarget(full.recorded, "used")).toBeNull();
    expect(mismatchTarget([], "no_use")).toBeNull();
    // F4-PRE-R06 (R-34): the menu is there only when something is recorded to compare it with.
    expect(formMenuShown(full.recorded)).toBe(true);
    expect(formMenuShown([])).toBe(false);
    expect(mismatchText("T")).toBe("Zapis bilježi prijenos iz Asistenta na T. Provjerite odabrani obrazac.");
  });

  it("opens 'Dalje' only once the server holds the confirmation, and never while loading or submitted", () => {
    for (const state of ["none", "sending", "reopened", "conflict", "stale", "refused", "technical"] as const) {
      expect(canProceed("full", state), state).toBe(false);
      expect(canProceed("error", state), state).toBe(false);
    }
    expect(canProceed("full", "saved")).toBe(true);
    expect(canProceed("empty", "saved")).toBe(true);
    expect(canProceed("error", "saved")).toBe(false);
    expect(canProceed("loading", "saved")).toBe(false);
    expect(canProceed("submitted", "saved")).toBe(false);
  });

  it("confirms only a declaration the student filled in, once at a time", () => {
    const full = FAKE_READS.puno;
    expect(canConfirm("full", full, "none")).toBe(true);
    expect(canConfirm("empty", FAKE_READS.prazno, "none")).toBe(false); // declared: null
    expect(canConfirm("error", FAKE_READS.greska, "none")).toBe(false);
    expect(canConfirm("full", full, "sending")).toBe(false);
    expect(canConfirm("full", full, "saved")).toBe(false);
    expect(canConfirm("full", full, "technical")).toBe(true);
  });

  it("a failed confirmation stays on screen as an alert, never as saved", () => {
    expect(confirmLine("none")).toBeNull();
    expect(confirmLine("saved")?.role).toBe("status");
    expect(confirmLine("sending")?.role).toBe("status");
    expect(confirmLine("reopened")?.role).toBe("status");
    for (const state of ["conflict", "stale", "refused", "technical"] as const) expect(confirmLine(state)?.role, state).toBe("alert");
    expect(confirmLine("stale")?.text).toContain("Ponovno pregledajte sve");
    expect(confirmLine("technical")?.text).not.toContain("nastaviti");
  });
});

describe("PD-2 and the prototype's copy", () => {
  it("titles each conversation and labels its entries", () => {
    expect(chatTitle(FAKE_CHATS[0]!)).toBe("Razgovor 1 · 28. 10. 2026.");
    expect(chatTitle(FAKE_CHATS[1]!)).toBe("Razgovor 2 · 31. 10. 2026.");
    expect(FAKE_CHATS[0]!.entries.map(entryLabel)).toEqual(["Vi · 10:01", "Asistent · 10:02", "Prijenos u tekst · 10:05"]);
    expect(FAKE_CHATS.map((c) => c.required)).toEqual([true, false]);
  });

  it("formats the recorded lines", () => {
    const full = FAKE_READS.puno;
    if (full.kind !== "ready") throw new Error("fixture");
    expect(recordedLine(full.recorded[0]!)).toEqual({ line: "Prijenos iz Asistenta, 28. 10. 2026. u 10:05", who: "Asistent · 2. Teorijski okvir, odlomak 1" });
    expect(recordedLine(full.recorded[1]!).line).toBe("Razgovor s Asistentom bez prijenosa, 31. 10. 2026.");
  });

  it("Q-10: names no provider and no model, only Asistent", () => {
    for (const text of [...Object.values(declarationStepText), ...Object.values(chatDialogText)]) {
      expect(text, text).not.toMatch(/model|pomoćnik|\{model\}/iu);
    }
  });

  it("holds no forbidden term", () => {
    for (const text of [...Object.values(declarationStepText), ...Object.values(chatDialogText)]) {
      expect({ text, hits: findForbiddenTerms(text) }).toEqual({ text, hits: [] });
    }
  });
});
