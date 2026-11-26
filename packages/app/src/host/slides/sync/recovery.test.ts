import { describe, expect, it } from "vitest";

import { isEditable, shownSaveState, type SlidesSaveInput } from "./recovery.ts";

const base: SlidesSaveInput = {
  stored: "LOCAL_DURABLE", failed: false, unsaved: false, saving: false, syncing: false,
  receiptVerifiedHere: false, closedBySubmission: false,
};

describe("the state the slides status bar may claim", () => {
  it("says the device after a reload even when the journal recorded SYNCED", () => {
    expect(shownSaveState({ ...base, stored: "SYNCED" })).toBe("LOCAL_DURABLE");
  });
  it("says SYNCED only after a receipt verified in this page session", () => {
    expect(shownSaveState({ ...base, stored: "SYNCED", receiptVerifiedHere: true })).toBe("SYNCED");
  });
  it("never keeps a SYNCING the journal left outside a step of this page", () => {
    expect(shownSaveState({ ...base, stored: "SYNCING" })).toBe("LOCAL_DURABLE");
    expect(shownSaveState({ ...base, stored: "LOCAL_DURABLE", syncing: true })).toBe("SYNCING");
  });
  it("shows editing and saving for changes not yet in the journal, and a failure over a calm state", () => {
    expect(shownSaveState({ ...base, unsaved: true })).toBe("EDITING");
    expect(shownSaveState({ ...base, unsaved: true, saving: true })).toBe("SAVING_LOCAL");
    expect(shownSaveState({ ...base, failed: true, stored: "SYNCED", receiptVerifiedHere: true })).toBe("ERROR");
  });
  it("keeps a sticky state above everything, and the device after a submission", () => {
    expect(shownSaveState({ ...base, stored: "CONFLICT", failed: true, unsaved: true })).toBe("CONFLICT");
    expect(shownSaveState({ ...base, stored: "SYNCED", receiptVerifiedHere: true, closedBySubmission: true })).toBe("LOCAL_DURABLE");
    expect(shownSaveState({ ...base, stored: null })).toBe("EDITING");
  });
  it("edits only a ready, open session", () => {
    expect(isEditable({ kind: "ready", document: 1, readOnly: false })).toBe(true);
    expect(isEditable({ kind: "ready", document: 1, readOnly: true })).toBe(false);
    expect(isEditable({ kind: "unavailable" })).toBe(false);
    expect(isEditable({ kind: "recovery", reason: "sticky", document: 1 })).toBe(false);
  });
});
