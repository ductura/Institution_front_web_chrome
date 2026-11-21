import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { FAKE_VERSIONS } from "../../time-machine/fake-port";
import { fakeRestorePort } from "./fake-port";
import { restoreMessages } from "./messages.hr";
import { headRevision, replayItems, restorableVersions, restoreVersion, versionsAfterRestore } from "./model";

describe("restore own text", () => {
  it("offers only earlier versions, newest first, never the head", () => {
    expect(headRevision(FAKE_VERSIONS)).toBe(3);
    expect(restorableVersions(FAKE_VERSIONS).map((v) => v.revision)).toEqual([2, 1]);
  });

  it("(1) restoring saves a NEW revision through the save path, on top of the head", async () => {
    const port = fakeRestorePort();
    expect(await restoreVersion(port, "doc-1", FAKE_VERSIONS, 1)).toEqual({ kind: "saved", revision: 4 });
    expect(port.calls).toEqual([["doc-1", 1, 3]]);
  });

  it("refuses the head, an unknown revision and a saved answer that is not a new revision", async () => {
    const port = fakeRestorePort();
    expect(await restoreVersion(port, "d", FAKE_VERSIONS, 3)).toEqual({ kind: "unavailable" });
    expect(await restoreVersion(port, "d", FAKE_VERSIONS, 9)).toEqual({ kind: "unavailable" });
    expect(port.calls).toEqual([]);
    expect(await restoreVersion(fakeRestorePort({ kind: "saved", revision: 3 }), "d", FAKE_VERSIONS, 1)).toEqual({ kind: "unavailable" });
  });

  it("passes stale, signed-out and a thrown failure on without inventing a result", async () => {
    expect(await restoreVersion(fakeRestorePort({ kind: "stale", currentRevision: 5 }), "d", FAKE_VERSIONS, 1)).toEqual({ kind: "stale", currentRevision: 5 });
    expect(await restoreVersion(fakeRestorePort({ kind: "signedOut" }), "d", FAKE_VERSIONS, 1)).toEqual({ kind: "signedOut" });
    const failing = { restore: async () => { throw new Error("x"); } };
    expect(await restoreVersion(failing, "d", FAKE_VERSIONS, 1)).toEqual({ kind: "unavailable" });
  });

  it("(2) older revisions stay after a restore", () => {
    const after = versionsAfterRestore(FAKE_VERSIONS, { fromRevision: 1, newRevision: 4, minute: "2026-11-21T10:00:00.000Z" });
    expect(after.map((v) => v.revision).sort()).toEqual([1, 2, 3, 4]);
    for (const old of FAKE_VERSIONS) expect(after).toContainEqual(old);
    expect(versionsAfterRestore(FAKE_VERSIONS, { fromRevision: 1, newRevision: 2, minute: "2026-11-21T10:00:00.000Z" })).toBe(FAKE_VERSIONS);
  });

  it("(3) the replay shows a restore as its own step and drops no change", () => {
    const changes = [{ index: 1, kind: "insert" }, { index: 2, kind: "replace" }, { index: 3, kind: "insert" }];
    const items = replayItems(changes, { 2: 1 });
    expect(items).toHaveLength(3);
    expect(items[1]).toEqual({ type: "restore", index: 2, fromRevision: 1 });
    expect(items.filter((i) => i.type === "restore")).toHaveLength(1);
    expect(items[0]).toEqual({ type: "change", change: changes[0] });
    expect(replayItems(changes, {}).every((i) => i.type === "change")).toBe(true);
  });

  it("holds no forbidden term and no duration or pace wording (PRODUCT §5)", () => {
    const m = restoreMessages;
    const strings: string[] = [...Object.values(m).filter((v) => typeof v === "string") as string[], m.done(1, 2), m.version(1, "2026-11-20T09:15:00.000Z"), m.replayStep(1)];
    for (const s of strings) expect(findForbiddenTerms(s, "hr")).toEqual([]);
    expect(strings.join(" ")).not.toMatch(/trajanj|ritam|brzin/i);
  });
});
