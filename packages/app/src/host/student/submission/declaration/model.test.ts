import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { FAKE_CHATS, FAKE_READS, fakeReader } from "./fake-port";
import { chatDialogText, declarationStepText } from "./messages.hr";
import {
  canProceed, chatTitle, entryLabel, mismatchTarget, mismatchText, recordedLine, stepView, unavailableReader,
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

  it("host reader says the block cannot load, a fake gives each variant", async () => {
    expect(await unavailableReader("x")).toEqual({ kind: "error" });
    expect(await fakeReader("puno")("x")).toBe(FAKE_READS.puno);
  });

  it("finds the mismatch only when 'no use' contradicts a recorded transfer", () => {
    const full = FAKE_READS.puno;
    if (full.kind !== "ready") throw new Error("fixture");
    expect(mismatchTarget(full.recorded, "no_use")).toBe("2. Teorijski okvir, odlomak 1");
    expect(mismatchTarget(full.recorded, "used")).toBeNull();
    expect(mismatchTarget([], "no_use")).toBeNull();
    expect(mismatchText("T")).toBe("Zapis bilježi prijenos iz AI pomoćnika na T. Provjerite odabrani obrazac.");
  });

  it("opens 'Dalje' only after the confirmation, and never while loading or submitted", () => {
    expect(canProceed("full", false)).toBe(false);
    expect(canProceed("full", true)).toBe(true);
    expect(canProceed("error", true)).toBe(true); // §5 rule 11
    expect(canProceed("loading", true)).toBe(false);
    expect(canProceed("submitted", true)).toBe(false);
  });
});

describe("PD-2 and the prototype's copy", () => {
  it("titles each conversation and labels its entries", () => {
    expect(chatTitle(FAKE_CHATS[0]!)).toBe("Razgovor 1 · 28. 10. 2026.");
    expect(chatTitle(FAKE_CHATS[1]!)).toBe("Razgovor 2 · 31. 10. 2026.");
    expect(FAKE_CHATS[0]!.entries.map(entryLabel)).toEqual(["Vi · 10:01", "AI pomoćnik, model M-2 · 10:02", "Prijenos u tekst · 10:05"]);
    expect(FAKE_CHATS.map((c) => c.required)).toEqual([true, false]);
  });

  it("formats the recorded lines", () => {
    const full = FAKE_READS.puno;
    if (full.kind !== "ready") throw new Error("fixture");
    expect(recordedLine(full.recorded[0]!)).toEqual({ line: "Prijenos iz AI pomoćnika, 28. 10. 2026. u 10:05", who: "Model M-2 · 2. Teorijski okvir, odlomak 1" });
    expect(recordedLine(full.recorded[1]!).line).toBe("Razgovor s AI pomoćnikom bez prijenosa, 31. 10. 2026.");
  });

  it("holds no forbidden term", () => {
    for (const text of [...Object.values(declarationStepText), ...Object.values(chatDialogText)]) {
      expect({ text, hits: findForbiddenTerms(text) }).toEqual({ text, hits: [] });
    }
  });
});
