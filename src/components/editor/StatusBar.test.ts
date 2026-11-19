import { SAVE_STATES, BLOCKED_TEXT, type SaveStateName } from "@ductura/ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr as t } from "@/lib/i18n/messages.hr";

import StatusBar, { shownSaveState, statusSaveOf, type DocumentPhase, type StatusSave } from "./StatusBar";

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

  it("signs SYNCED only for the evidence session", () => {
    expect(statusSaveOf({ phase: "ready", state: "SYNCED", evidence: true })).toEqual({ state: "SYNCED", receiptSigned: true, blocked: false });
    const local = statusSaveOf({ phase: "ready", state: "SYNCED", evidence: false });
    expect(local).not.toBeNull();
    expect(shownSaveState(local!)).toBe("LOCAL_DURABLE");
  });

  it("never signs a state other than SYNCED", () => {
    for (const state of STATES.filter((s) => s !== "SYNCED")) {
      expect(statusSaveOf({ phase: "ready", state, evidence: true })).toEqual({ state, receiptSigned: false, blocked: false });
    }
  });

  it("shows the block of another tab whatever the state", () => {
    for (const state of [null, ...STATES]) {
      const save = statusSaveOf({ phase: "blocked", state, evidence: true });
      expect(save?.blocked).toBe(true);
      expect(render(save)).toContain(BLOCKED_TEXT);
    }
  });

  it("says recovery in recovery, never the last state", () => {
    for (const state of [null, ...STATES]) {
      expect(statusSaveOf({ phase: "recovery", state, evidence: true })?.state).toBe("RECOVERY_REQUIRED");
    }
  });

  it("claims nothing while loading, without storage, after the session ended, or without a state", () => {
    for (const phase of ["loading", "unavailable", "signed-out"] as const) {
      for (const state of [null, ...STATES]) expect(statusSaveOf({ phase, state, evidence: true })).toBeNull();
    }
    expect(statusSaveOf({ phase: "ready", state: null, evidence: true })).toBeNull();
  });

  it("covers every phase", () => {
    expect(PHASES.map((phase) => statusSaveOf({ phase, state: "SYNCING", evidence: true })?.state ?? null))
      .toEqual([null, "LOCAL_DURABLE", "SYNCING", "RECOVERY_REQUIRED", null, null]);
  });
});
