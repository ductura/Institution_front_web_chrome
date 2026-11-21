import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { isSafeHref, readBulkStatus, requestBulkPreparation } from "./contract";
import { ASSIGNMENT, fakeBulkServer } from "./fake-port";
import { bulkText } from "./messages.hr";
import { failureMessage, requestFailure, viewOf } from "./model";

const NOW = new Date("2026-12-01T10:00:00.000Z");

describe("bulk download of submissions (WEB-1902)", () => {
  it("an assignment without submissions is the empty state, not an error", async () => {
    const read = await readBulkStatus(fakeBulkServer({ state: "empty" }).call, ASSIGNMENT);
    expect(read).toEqual({ kind: "ready", status: { state: "empty" } });
    expect(viewOf({ state: "empty" }, NOW)).toEqual({ kind: "empty" });
  });

  it("goes idle -> preparing -> ready and shows the expiry the server states", async () => {
    const server = fakeBulkServer();
    expect(await requestBulkPreparation(server.call, ASSIGNMENT)).toEqual({ kind: "zaprimljeno", status: { state: "preparing", submissionCount: 2 } });
    expect(server.posts).toEqual([{ assignmentId: ASSIGNMENT }]);
    server.finish("2026-12-01T12:00:00.000Z");
    const read = await readBulkStatus(server.call, ASSIGNMENT);
    const view = viewOf(read.kind === "ready" ? read.status : { state: "empty" }, NOW);
    expect(view.kind).toBe("ready");
    if (view.kind === "ready") expect(view.until).toContain("2026");
  });

  it("an expired link is shown as expired, never as a link", () => {
    const status = { state: "ready", submissionCount: 2, href: "/x/y.zip", expiresAt: "2026-12-01T10:00:00.000Z" } as const;
    expect(viewOf(status, NOW)).toEqual({ kind: "expired" });
    expect(viewOf(status, new Date("2026-12-01T09:59:59.000Z")).kind).toBe("ready");
    expect(bulkText.expired).toContain("istekla");
  });

  it("a broken answer is unknown; unsafe links and a zero count in idle are refused", async () => {
    const bad = (body: unknown) => async () => ({ ok: true as const, status: 200, body });
    expect(await readBulkStatus(bad({ state: "idle", submissionCount: 0 }), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await readBulkStatus(bad({ state: "ready", submissionCount: 1, href: "https://evil.example/x", expiresAt: "2026-12-01T12:00:00.000Z" }), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await readBulkStatus(bad({ state: "empty", extra: 1 }), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(["//evil.example/x", "javascript:1", "/ok/file.zip"].map(isSafeHref)).toEqual([false, false, true]);
    const stale = async () => ({ ok: true as const, status: 202, body: { state: "idle", submissionCount: 2 } });
    expect(await requestBulkPreparation(stale, ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    const down = async () => { throw new Error("offline"); };
    expect(await readBulkStatus(down, ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(requestFailure({ kind: "nepoznato" })).toBe(bulkText.requestUnknown);
  });

  it("names a refusal and hands a lost session back", async () => {
    const forbidden = fakeBulkServer(undefined, { forbid: true });
    const read = await readBulkStatus(forbidden.call, ASSIGNMENT);
    expect(failureMessage(read)).toBe(bulkText.forbidden);
    expect(await readBulkStatus(async () => ({ ok: false, status: 401, code: "x" }), ASSIGNMENT)).toEqual({ kind: "session-expired" });
    expect(await readBulkStatus(forbidden.call, "not-an-id")).toEqual({ kind: "greska", code: "not_found" });
  });

  it("holds no forbidden term in its copy", () => {
    for (const value of Object.values(bulkText)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
