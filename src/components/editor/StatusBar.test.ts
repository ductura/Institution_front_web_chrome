import { SAVE_STATES, BLOCKED_TEXT, type SaveStateName } from "@ductura/ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr as t } from "@/lib/i18n/messages.hr";

import StatusBar, { shownSaveState, type StatusSave } from "./StatusBar";

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
