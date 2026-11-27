import { SAVE_STATES, BLOCKED_TEXT, type SaveStateName } from "@ductura/ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr as t } from "@/lib/i18n/messages.hr";

import StatusBar, { scopeLine, scopeSaid, scopeStanding, shownSaveState, statusSaveOf, type DocumentPhase, type StatusSave } from "./StatusBar";

// WEB-14: the status bar claims "on the server" only with a signed receipt (B-6),
// shows the other tab's block instead of any state (A-12), and claims nothing
// while no journal is open.
const STATES = Object.keys(SAVE_STATES) as SaveStateName[];
const render = (save: StatusSave | null) => renderToStaticMarkup(createElement(StatusBar, { save }));

describe("shownSaveState", () => {
  it("never shows SYNCED without a signed receipt", () => {
    expect(shownSaveState({ state: "SYNCED", receiptSigned: false })).toBe("LOCAL_DURABLE");
    expect(shownSaveState({ state: "SYNCED", receiptSigned: true })).toBe("SYNCED");
  });

  it("passes every other state through, receipt or not", () => {
    for (const state of STATES.filter((s) => s !== "SYNCED")) {
      expect(shownSaveState({ state, receiptSigned: false })).toBe(state);
      expect(shownSaveState({ state, receiptSigned: true })).toBe(state);
    }
  });
});

describe("StatusBar", () => {
  it("says SYNCED only with the receipt", () => {
    expect(render({ state: "SYNCED", receiptSigned: true, blocked: false })).toContain(SAVE_STATES.SYNCED.label);
    const unsigned = render({ state: "SYNCED", receiptSigned: false, blocked: false });
    expect(unsigned).not.toContain(SAVE_STATES.SYNCED.label);
    expect(unsigned).toContain(SAVE_STATES.LOCAL_DURABLE.label);
  });

  it("shows the syncing and on-device states of the acceptance steps", () => {
    expect(render({ state: "SYNCING", receiptSigned: false, blocked: false })).toContain("Sinkroniziram");
    expect(render({ state: "LOCAL_DURABLE", receiptSigned: false, blocked: false })).toContain("Spremljeno na uređaju");
  });

  it("shows the block of another tab and no save state", () => {
    for (const state of STATES) {
      const html = render({ state, receiptSigned: true, blocked: true });
      expect(html).toContain(BLOCKED_TEXT);
      expect(html).not.toContain(SAVE_STATES[state].label);
    }
  });

  it("claims nothing about saving without a journal", () => {
    const html = render(null);
    expect(html).toContain(t.workspace.statusNoJournal);
    for (const state of STATES) expect(html).not.toContain(SAVE_STATES[state].label);
  });
});

// WEB-14b: the bar reads the document provider's phase and saver state.
describe("statusSaveOf", () => {
  const PHASES: DocumentPhase[] = ["loading", "blocked", "ready", "recovery", "unavailable", "signed-out"];

  it("shows SYNCED with a receipt verified in this page session", () => {
    const save = statusSaveOf({ phase: "ready", state: "SYNCED", receiptVerifiedHere: true });
    expect(save).toEqual({ state: "SYNCED", receiptSigned: true, blocked: false });
    expect(render(save)).toContain(SAVE_STATES.SYNCED.label);
  });

  it("never shows SYNCED read back from the journal without a new receipt here", () => {
    // Reopened sheet: the journal holds SYNCED (a reload, or the server's
    // version taken over), but no receipt has been verified in this session.
    const reopened = statusSaveOf({ phase: "ready", state: "SYNCED", receiptVerifiedHere: false });
    expect(reopened).not.toBeNull();
    expect(shownSaveState(reopened!)).toBe("LOCAL_DURABLE");
    const html = render(reopened);
    expect(html).not.toContain(SAVE_STATES.SYNCED.label);
    expect(html).toContain(SAVE_STATES.LOCAL_DURABLE.label);
  });

  it("never signs a state other than SYNCED", () => {
    for (const state of STATES.filter((s) => s !== "SYNCED")) {
      expect(statusSaveOf({ phase: "ready", state, receiptVerifiedHere: true })).toEqual({ state, receiptSigned: false, blocked: false });
    }
  });

  it("shows the block of another tab whatever the state", () => {
    for (const state of [null, ...STATES]) {
      const save = statusSaveOf({ phase: "blocked", state, receiptVerifiedHere: true });
      expect(save?.blocked).toBe(true);
      expect(render(save)).toContain(BLOCKED_TEXT);
    }
  });

  it("says recovery in recovery, never the last state", () => {
    for (const state of [null, ...STATES]) {
      expect(statusSaveOf({ phase: "recovery", state, receiptVerifiedHere: true })?.state).toBe("RECOVERY_REQUIRED");
    }
  });

  it("claims nothing while loading, without storage, after the session ended, or without a state", () => {
    for (const phase of ["loading", "unavailable", "signed-out"] as const) {
      for (const state of [null, ...STATES]) expect(statusSaveOf({ phase, state, receiptVerifiedHere: true })).toBeNull();
    }
    expect(statusSaveOf({ phase: "ready", state: null, receiptVerifiedHere: true })).toBeNull();
  });

  it("covers every phase", () => {
    expect(PHASES.map((phase) => statusSaveOf({ phase, state: "SYNCING", receiptVerifiedHere: true })?.state ?? null))
      .toEqual([null, "LOCAL_DURABLE", "SYNCING", "RECOVERY_REQUIRED", null, null]);
  });
});

// WEB-23 (S: E-7): the scope line beside the save state, and the read-only bar.
describe("scopeLine", () => {
  it("writes the count and the range as E-7 does", () => {
    expect(scopeLine(340, { min: 1200, max: 1600 })).toBe("340 riječi, opseg 1.200 do 1.600, ≈ 1 str., još 860 do donje granice, vidite samo Vi");
    expect(scopeLine(1, null)).toBe("1 riječ, ≈ 1 str., vidite samo Vi");
    expect(scopeLine(12500, null)).toBe("12.500 riječi, ≈ 36 str., vidite samo Vi");
  });

  it("estimates the pages from the count, never before the first word (ED-48, P2-24)", () => {
    expect(scopeLine(0, null)).toBe("0 riječi, vidite samo Vi");
    expect(scopeLine(1, null)).toContain("≈ 1 str.");
    expect(scopeLine(900, null)).toContain("≈ 3 str.");
    // As the prototype: 350 words a page, rounded up.
    expect(scopeLine(350, null)).toContain("≈ 1 str.");
    expect(scopeLine(351, null)).toContain("≈ 2 str.");
    expect(scopeLine(null, { min: 1200, max: 1600 })).not.toContain("str.");
  });

  it("names the standing against the range as a fact about the task, never about the student (ED-04, NF2-P6)", () => {
    const range = { min: 1200, max: 1600 };
    expect(scopeStanding(1199, range)).toBe("below");
    expect(scopeStanding(1200, range)).toBe("within");
    expect(scopeStanding(1600, range)).toBe("within");
    expect(scopeStanding(1601, range)).toBe("above");
    expect(scopeStanding(null, range)).toBeNull();
    expect(scopeStanding(500, null)).toBeNull();
    expect(scopeLine(1400, range)).toBe("1.400 riječi, opseg 1.200 do 1.600, ≈ 4 str., unutar opsega, vidite samo Vi");
    expect(scopeLine(1640, range)).toBe("1.640 riječi, opseg 1.200 do 1.600, ≈ 5 str., iznad gornje granice za 40, vidite samo Vi");
    expect(scopeLine(0, { min: 2000, max: 2500 })).toBe("0 riječi, opseg 2.000 do 2.500, još 2.000 do donje granice, vidite samo Vi");
  });

  it("says a crossing of a limit in one sentence, the same for every direction (NF2-P6)", () => {
    const range = { min: 1200, max: 1600 };
    expect(scopeSaid("below", 1100, range)).toBe("Opseg: ispod donje granice.");
    expect(scopeSaid("within", 1300, range)).toBe("Opseg: unutar granica.");
    expect(scopeSaid("above", 1640, range)).toBe("Opseg: iznad gornje granice za 40 riječi.");
    expect(scopeSaid("above", 1601, range)).toBe("Opseg: iznad gornje granice za 1 riječ.");
  });

  it("shows the range alone while no editor counts", () => {
    expect(scopeLine(null, { min: 1200, max: 1600 })).toBe("opseg 1.200 do 1.600, vidite samo Vi");
  });

  it("says nothing without a count or a range", () => {
    expect(scopeLine(null, null)).toBeNull();
  });

  it("grows with the count the bar is given", () => {
    const range = { min: 1200, max: 1600 };
    expect(render2({ words: 0, range })).toContain("<span>0 riječi</span><span>opseg 1.200 do 1.600</span>");
    expect(render2({ words: 1201, range })).toContain("<span>1.201 riječ</span><span>opseg 1.200 do 1.600</span>");
  });

  it("says read only for a submitted work, never a save state", () => {
    const html = renderToStaticMarkup(createElement(StatusBar, { save: { state: "SYNCED", receiptSigned: true, blocked: false }, readOnly: true }));
    expect(html).toContain(t.workspace.readOnly);
    for (const state of STATES) expect(html).not.toContain(SAVE_STATES[state].label);
  });
});

const render2 = (length: { words: number | null; range: { min: number; max: number } | null }) =>
  renderToStaticMarkup(createElement(StatusBar, { save: null, length }));
