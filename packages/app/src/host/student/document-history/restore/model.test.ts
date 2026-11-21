import { describe, expect, it } from "vitest";

import { FAKE_REVISIONS, fakeRestorePort } from "./fake-port";
import { canRestore, restoreRevision, type RestorePort } from "./model";

const request = { documentId: "doc-izmisljen-1", revision: 1, currentRevision: 3 };

describe("restoring own earlier text (WEB-1907)", () => {
  it("saves the older text as a new revision through the save path", async () => {
    const port = fakeRestorePort();
    expect(await restoreRevision(port, request)).toEqual({ kind: "done", from: 1, revision: 4 });
    expect(port.revisions.at(-1)).toEqual({ revision: 4, document: FAKE_REVISIONS[0]!.document });
  });

  it("keeps every older revision unchanged", async () => {
    const port = fakeRestorePort();
    await restoreRevision(port, request);
    expect(port.revisions.slice(0, 3)).toEqual(FAKE_REVISIONS);
    expect(port.revisions.map((r) => r.revision)).toEqual([1, 2, 3, 4]);
  });

  it("restores only a revision older than the current one", async () => {
    expect(canRestore(1, 3)).toBe(true);
    expect([canRestore(3, 3), canRestore(4, 3), canRestore(-1, 3), canRestore(1.5, 3)]).toEqual([false, false, false, false]);
    const port = fakeRestorePort();
    expect(await restoreRevision(port, { ...request, revision: 3 })).toEqual({ kind: "unavailable" });
    expect(port.revisions).toHaveLength(3);
  });

  it("reports a conflict when the document moved on, and saves nothing", async () => {
    const port = fakeRestorePort();
    expect(await restoreRevision(port, { ...request, currentRevision: 2 })).toEqual({ kind: "conflict" });
    expect(port.revisions).toHaveLength(3);
  });

  it("never takes a save without a later revision, or a failure, as done", async () => {
    const base = fakeRestorePort();
    const stale: RestorePort = { readRevision: base.readRevision, saveAsNewRevision: async () => ({ kind: "saved", revision: 3 }) };
    expect(await restoreRevision(stale, request)).toEqual({ kind: "unavailable" });
    const failing: RestorePort = { readRevision: async () => { throw new Error("x"); }, saveAsNewRevision: base.saveAsNewRevision };
    expect(await restoreRevision(failing, request)).toEqual({ kind: "unavailable" });
    expect(await restoreRevision(fakeRestorePort([{ revision: 3, document: {} }]), request)).toEqual({ kind: "notFound" });
  });

  it("gives the port no way to delete or overwrite a revision", () => {
    expect(Object.keys(fakeRestorePort()).filter((k) => k !== "revisions").sort()).toEqual(["readRevision", "saveAsNewRevision"]);
  });
});
