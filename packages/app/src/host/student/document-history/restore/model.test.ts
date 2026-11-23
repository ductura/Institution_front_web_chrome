import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { FAKE_VERSIONS } from "../../time-machine/fake-port";
import { fakeRestorePort } from "./fake-port";
import { restoreMessages } from "./messages.hr";
import {
  awaitRestoreReceipt, confirmRestored, headRevision, recordRestored, replayItems, restorableVersions, restoreVersion,
  versionsAfterRestore, type RestorePort,
} from "./model";

describe("restore own text", () => {
  it("offers only earlier versions, newest first, never the head", () => {
    expect(headRevision(FAKE_VERSIONS)).toBe(3);
    expect(restorableVersions(FAKE_VERSIONS).map((v) => v.revision)).toEqual([2, 1]);
  });

  it("(1) restoring saves a NEW revision through the save path, on top of the head", async () => {
    const port = fakeRestorePort();
    expect(await restoreVersion(port, "doc-1", FAKE_VERSIONS, 1)).toEqual({ kind: "saved" });
    expect(port.calls).toEqual([["doc-1", 1, 3]]);
  });

  it("refuses the head and an unknown revision without asking the port", async () => {
    const port = fakeRestorePort();
    expect(await restoreVersion(port, "d", FAKE_VERSIONS, 3)).toEqual({ kind: "unavailable" });
    expect(await restoreVersion(port, "d", FAKE_VERSIONS, 9)).toEqual({ kind: "unavailable" });
    expect(port.calls).toEqual([]);
  });

  it("passes stale, signed-out and a thrown failure on without inventing a result", async () => {
    expect(await restoreVersion(fakeRestorePort({ kind: "stale", currentRevision: 5 }), "d", FAKE_VERSIONS, 1)).toEqual({ kind: "stale", currentRevision: 5 });
    expect(await restoreVersion(fakeRestorePort({ kind: "signedOut" }), "d", FAKE_VERSIONS, 1)).toEqual({ kind: "signedOut" });
    expect(await restoreVersion(fakeRestorePort({ kind: "pending" }), "d", FAKE_VERSIONS, 1)).toEqual({ kind: "pending" });
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

  it("INT-21: a pending label turns confirmed only for its own restore; the others stay", () => {
    let labels = recordRestored([], 0, 2, false);
    labels = recordRestored(labels, 1, 2, false);
    labels = recordRestored(labels, 2, 1, true);
    expect(confirmRestored(labels, 1)).toEqual([
      { at: 0, from: 2, confirmed: false }, { at: 1, from: 2, confirmed: true }, { at: 2, from: 1, confirmed: true },
    ]);
    expect(confirmRestored(labels, 9)).toEqual(labels);
  });

  it("INT-21: a pending restore follows the receipt until it comes, and never guesses one", async () => {
    const answers = (list: ("confirmed" | "signedOut" | "waiting")[]): RestorePort & { asked: number } => {
      const port = { asked: 0, restore: async () => ({ kind: "pending" as const }), receipt: async () => list[port.asked++] ?? "waiting" };
      return port;
    };
    const late = answers(["waiting", "waiting", "confirmed"]);
    expect(await awaitRestoreReceipt(late, () => true)).toBe(true);
    expect(late.asked).toBe(3);
    expect(await awaitRestoreReceipt(answers(["waiting", "signedOut", "confirmed"]), () => true)).toBe(false);
    expect(await awaitRestoreReceipt(fakeRestorePort({ kind: "pending" }), () => true)).toBe(false);
    const failing = { restore: async () => ({ kind: "pending" as const }), receipt: async () => { throw new Error("x"); } };
    expect(await awaitRestoreReceipt(failing, () => true)).toBe(false);
    // The page went away while it waited: a later receipt changes nothing.
    let open = true;
    const leaving = { restore: async () => ({ kind: "pending" as const }), receipt: async () => { open = false; return "confirmed" as const; } };
    expect(await awaitRestoreReceipt(leaving, () => open)).toBe(false);
    const gone = answers(["confirmed"]);
    expect(await awaitRestoreReceipt(gone, () => false)).toBe(false);
    expect(gone.asked).toBe(0);
  });

  it("holds no forbidden term and no duration or pace wording (PRODUCT §5)", () => {
    const m = restoreMessages;
    const strings: string[] = [...Object.values(m).filter((v) => typeof v === "string") as string[], m.done(1), m.version(1, "2026-11-20T09:15:00.000Z"), m.replayStep(1), m.restoredVersion(1), m.restoredPending(1)];
    for (const s of strings) expect(findForbiddenTerms(s, "hr")).toEqual([]);
    expect(strings.join(" ")).not.toMatch(/trajanj|ritam|brzin/i);
  });
});
