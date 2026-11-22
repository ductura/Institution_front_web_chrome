import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { bulkFilePath, isBulkHref, requestBulkLink } from "./contract";
import { ASSIGNMENT, TOKEN, fakeBulkServer } from "./fake-port";
import { bulkText } from "./messages.hr";
import { requestFailure, viewOf } from "./model";

const NOW = new Date("2026-12-01T10:00:00.000Z");
const answer = (body: unknown, status = 201) => async () => ({ ok: true as const, status, body });
const good = { format: "pdf", downloadPath: `${bulkFilePath(ASSIGNMENT, "pdf")}?token=${TOKEN}`, expiresAt: "2026-12-01T12:00:00.000Z" };

describe("bulk download of submissions (WEB-1902, WEB-2004)", () => {
  it("asks teacher.submissions-bulk-link.post for the chosen format and returns the server's link", async () => {
    const server = fakeBulkServer({ expiresAt: "2026-12-01T12:00:00.000Z" });
    const outcome = await requestBulkLink(server.call, ASSIGNMENT, "docx");
    expect(server.posts).toEqual([{ params: { assignmentId: ASSIGNMENT }, body: { format: "docx" } }]);
    expect(outcome).toEqual({
      kind: "poveznica",
      link: { format: "docx", href: `${bulkFilePath(ASSIGNMENT, "docx")}?token=${TOKEN}`, expiresAt: "2026-12-01T12:00:00.000Z" },
    });
  });

  it("shows the expiry the server states and treats an expired link as expired, never as a link", () => {
    const link = { format: "pdf", href: good.downloadPath, expiresAt: "2026-12-01T10:00:00.000Z" } as const;
    expect(viewOf(link, NOW)).toEqual({ kind: "expired" });
    const view = viewOf(link, new Date("2026-12-01T09:59:59.000Z"));
    expect(view.kind).toBe("ready");
    if (view.kind === "ready") expect(view.until).toContain("2026");
    expect(bulkText.expired).toContain("istekla");
  });

  it("a broken, foreign or wrong-status answer is unknown", async () => {
    const unknown = { kind: "nepoznato" };
    expect(await requestBulkLink(answer({ ...good, extra: 1 }), ASSIGNMENT, "pdf")).toEqual(unknown);
    expect(await requestBulkLink(answer({ ...good, downloadPath: "https://evil.example/x" }), ASSIGNMENT, "pdf")).toEqual(unknown);
    expect(await requestBulkLink(answer({ ...good, downloadPath: `${bulkFilePath(ASSIGNMENT, "docx")}?token=${TOKEN}` }), ASSIGNMENT, "pdf")).toEqual(unknown);
    expect(await requestBulkLink(answer({ ...good, format: "docx" }), ASSIGNMENT, "pdf")).toEqual(unknown);
    expect(await requestBulkLink(answer(good, 200), ASSIGNMENT, "pdf")).toEqual(unknown);
    expect(await requestBulkLink(async () => { throw new Error("offline"); }, ASSIGNMENT, "pdf")).toEqual(unknown);
    expect(requestFailure({ kind: "nepoznato" })).toBe(bulkText.requestUnknown);
  });

  it("accepts only the file path of this assignment with a token", () => {
    const other = "00000000-0000-4000-8000-0000000000b2";
    expect(isBulkHref(good.downloadPath, ASSIGNMENT, "pdf")).toBe(true);
    expect(isBulkHref(good.downloadPath, other, "pdf")).toBe(false);
    expect(isBulkHref(`${bulkFilePath(ASSIGNMENT, "pdf")}?token=x`, ASSIGNMENT, "pdf")).toBe(false);
    expect(isBulkHref(bulkFilePath(ASSIGNMENT, "pdf"), ASSIGNMENT, "pdf")).toBe(false);
  });

  it("names a refusal and hands a lost session back", async () => {
    const forbidden = await requestBulkLink(fakeBulkServer({ forbid: true }).call, ASSIGNMENT, "pdf");
    expect(requestFailure(forbidden)).toBe(bulkText.forbidden);
    expect(await requestBulkLink(async () => ({ ok: false, status: 401, code: "unauthorized" }), ASSIGNMENT, "pdf")).toEqual({ kind: "session-expired" });
    const gone = await requestBulkLink(async () => ({ ok: false, status: 404, code: "not_found" }), ASSIGNMENT, "pdf");
    expect(requestFailure(gone)).toBe(bulkText.notFound);
    expect(await requestBulkLink(fakeBulkServer().call, "not-an-id", "pdf")).toEqual({ kind: "greska", code: "not_found" });
  });

  it("holds no forbidden term in its copy", () => {
    for (const value of Object.values(bulkText)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
