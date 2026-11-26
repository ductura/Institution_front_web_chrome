// F4-MEN-R01: the student's notifications that a teacher opened a mentorship. Every id and name is invented.
import { describe, expect, it } from "vitest";

import { readOpened, withoutApproved, type OpenedCall } from "./opened";

const M1 = "6d3b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c31";
const M2 = "6d3b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c32";
const item = (id: string, targetId: string) => ({
  id, targetId, workType: "master_thesis", topic: null, mentorName: { givenName: "Vesna", familyName: "Izmišljena" },
  createdAt: "2026-11-20T10:00:00.000Z", readAt: null,
});
const answer = (a: Awaited<ReturnType<OpenedCall>>): OpenedCall => async () => a;

describe("readOpened", () => {
  it("is the server's list, the mentorship id taken from targetId", async () => {
    const read = await readOpened(answer({ ok: true, status: 200, body: { notifications: [item("n1", M1)], nextBefore: null } }));
    expect(read).toEqual({ kind: "ready", opened: [{ id: "n1", mentorshipId: M1, workType: "master_thesis", topic: null,
      mentorName: { givenName: "Vesna", familyName: "Izmišljena" }, createdAt: "2026-11-20T10:00:00.000Z", readAt: null }] });
  });
  it("a failure is unavailable, never an empty list; 401 is signed out", async () => {
    expect(await readOpened(answer({ ok: false, status: 503, code: "unavailable" }))).toEqual({ kind: "unavailable" });
    expect(await readOpened(answer({ ok: false, status: 401, code: "unauthorized" }))).toEqual({ kind: "signedOut" });
    expect(await readOpened(answer({ ok: true, status: 200, body: { notifications: [{ ...item("n1", M1), workType: "essay" }] } }))).toEqual({ kind: "unavailable" });
    expect(await readOpened(async () => { throw new Error("offline"); })).toEqual({ kind: "unavailable" });
  });
});

describe("withoutApproved", () => {
  it("leaves out an opened mentorship the approved requests already show", async () => {
    const read = await readOpened(answer({ ok: true, status: 200, body: { notifications: [item("n1", M1), item("n2", M2)], nextBefore: null } }));
    if (read.kind !== "ready") throw new Error("not ready");
    expect(withoutApproved(read.opened, [M1]).map((o) => o.id)).toEqual(["n2"]);
  });
});
