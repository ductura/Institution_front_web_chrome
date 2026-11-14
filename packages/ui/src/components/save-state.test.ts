import { describe, expect, it } from "vitest";

import { SAVE_STATES, saveStateContent, type SaveStateName } from "./save-state";

// Wording and tones from Ductus src/domain/sync/labels.ts (d52a92c); PRODUCT §5:
// never a bare "Spremljeno", the device named only while the work is local,
// the server only in SYNCED.
const EXPECTED: Record<SaveStateName, [string, string]> = {
  EDITING: ["Uređivanje", "neutral"],
  SAVING_LOCAL: ["Spremam lokalno", "progress"],
  LOCAL_DURABLE: ["Spremljeno na uređaju", "neutral"],
  SYNCING: ["Sinkroniziram", "progress"],
  SYNCED: ["Spremljeno na poslužitelju", "ok"],
  CONFLICT: ["Sukob", "warn"],
  ERROR: ["Greška", "error"],
  RECOVERY_REQUIRED: ["Potreban oporavak", "error"],
};

describe("SaveState wording (Ductus labels.ts, PRODUCT §5)", () => {
  it("has exactly the eight sync states, each with its own text and tone", () => {
    expect(Object.keys(SAVE_STATES).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const [state, [label, tone]] of Object.entries(EXPECTED)) {
      expect([state, saveStateContent(state as SaveStateName)]).toEqual([state, { text: label, tone }]);
    }
  });

  it("never says a bare 'spremljeno' and names the server only in SYNCED", () => {
    for (const [state, { label }] of Object.entries(SAVE_STATES)) {
      expect(label.trim().toLowerCase()).not.toBe("spremljeno");
      if (/spremljeno/i.test(label)) expect(label).toMatch(/spremljeno na (uređaju|poslužitelju)$/i);
      expect([state, label.includes("poslužitelj")]).toEqual([state, state === "SYNCED"]);
    }
  });

  it("gives only SYNCED the all-clear tone", () => {
    const ok = Object.entries(SAVE_STATES).filter(([, v]) => v.tone === "ok").map(([k]) => k);
    expect(ok).toEqual(["SYNCED"]);
  });

  it("an unknown state never reads as saved", () => {
    for (const bogus of ["", "SAVED", "synced", "__proto__", "toString"]) {
      const content = saveStateContent(bogus as SaveStateName);
      expect(content.tone).not.toBe("ok");
      expect(content.text).not.toMatch(/spremljeno/i);
    }
  });

  it("the blocked notice replaces the state (another tab writes)", () => {
    expect(saveStateContent("SYNCED", true)).toEqual({ text: "Dokument je otvoren u drugoj kartici.", tone: "warn" });
  });
});
