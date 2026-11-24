// NF-3 PR-16: the teacher's request for revision of this work, read over the contract's own vectors.
import { describe, expect, it } from "vitest";

import vectors from "../../../../../../../src/client/migration-contract-vectors.generated.json" with { type: "json" };
import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { readRevisionRequest, type RevisionCall } from "./contract";
import { revisionText } from "./messages.hr";

const TARGET = "a5000000-0000-4000-8000-000000000001";
const vector = (name: string) => (vectors as { route: string; name: string; response: { status: number; body: unknown } }[])
  .find((v) => v.route === "notifications.returned-for-revision.list.get" && v.name === name)!;
const answering = (name: string): RevisionCall => async () => {
  const { status, body } = vector(name).response;
  return status === 200 ? { ok: true, status, body } : { ok: false, status, code: (body as { code: string }).code };
};
const page = (notifications: unknown[]): RevisionCall => async () => ({ ok: true, status: 200, body: { notifications, nextBefore: null } });
const item = (id: string, targetId: string, createdAt: string, revisionDueAt: string | null = "2026-12-15T12:00:00.000Z") =>
  ({ id, targetId, documentId: "izmisljeni-rad-1", comment: `Izmišljeni komentar ${id.slice(-1)}.`, revisionDueAt, createdAt, readAt: null });

describe("notifications.returned-for-revision.list.get (PO-40)", () => {
  it("finds the request for this assignment with its comment and deadline", async () => {
    expect(await readRevisionRequest(answering("inbox"), TARGET)).toEqual({
      kind: "ready",
      request: { id: "00000000-0000-4000-8000-000000001711", comment: "Doradi uvod i ispravi navode.", dueAt: "2026-12-15T12:00:00.000Z", createdAt: "2026-11-21T09:00:00.000Z" },
    });
  });

  it("is no request for another assignment, and the newest when there are several", async () => {
    expect(await readRevisionRequest(answering("inbox"), "00000000-0000-4000-8000-0000000000a1")).toEqual({ kind: "ready", request: null });
    const two = page([
      item("00000000-0000-4000-8000-000000000001", TARGET, "2026-11-20T09:00:00.000Z"),
      item("00000000-0000-4000-8000-000000000002", TARGET.toUpperCase(), "2026-11-22T09:00:00.000Z", null),
    ]);
    expect(await readRevisionRequest(two, TARGET)).toMatchObject({ kind: "ready", request: { id: "00000000-0000-4000-8000-000000000002", dueAt: null } });
  });

  it("reads a failure or a broken answer as unknown, never as no request", async () => {
    expect(await readRevisionRequest(answering("unauthorized"), TARGET)).toEqual({ kind: "session-expired" });
    expect(await readRevisionRequest(answering("unavailable"), TARGET)).toEqual({ kind: "nepoznato" });
    expect(await readRevisionRequest(page([{ id: "x" }]), TARGET)).toEqual({ kind: "nepoznato" });
    expect(await readRevisionRequest(async () => { throw new Error("offline"); }, TARGET)).toEqual({ kind: "nepoznato" });
  });

  it("holds no forbidden term", () => {
    for (const value of Object.values(revisionText)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
