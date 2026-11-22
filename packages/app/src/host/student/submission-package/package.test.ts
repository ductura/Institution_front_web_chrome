import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { isPackageHref, packageFilePath, requestPackageLink } from "./contract";
import { SUBMISSION, TOKEN, fakePackageServer } from "./fake-port";
import { submissionPackageText } from "./messages.hr";

const answer = (body: unknown, status = 201) => async () => ({ ok: true as const, status, body });
const good = { kind: "referada", downloadPath: `${packageFilePath(SUBMISSION, "referada")}?token=${TOKEN}`, expiresAt: "2026-12-01T12:00:00.000Z" };

describe("registrar's package (WEB-1803, WEB-2004)", () => {
  it("asks student.submission-package-link.post for the registrar's package of the submission", async () => {
    const server = fakePackageServer({ expiresAt: "2026-12-01T12:00:00.000Z" });
    const outcome = await requestPackageLink(server.call, SUBMISSION);
    expect(server.posts).toEqual([{ params: { submissionId: SUBMISSION }, body: { kind: "referada" } }]);
    expect(outcome).toEqual({ kind: "poveznica", link: { kind: "referada", href: good.downloadPath, expiresAt: "2026-12-01T12:00:00.000Z" } });
  });

  it("a broken, foreign or wrong-status answer is unknown", async () => {
    const unknown = { kind: "nepoznato" };
    expect(await requestPackageLink(answer({ ...good, extra: 1 }), SUBMISSION)).toEqual(unknown);
    expect(await requestPackageLink(answer({ ...good, downloadPath: "https://evil.example/x" }), SUBMISSION)).toEqual(unknown);
    expect(await requestPackageLink(answer({ ...good, kind: "package" }), SUBMISSION)).toEqual(unknown);
    expect(await requestPackageLink(answer(good, 200), SUBMISSION)).toEqual(unknown);
    expect(await requestPackageLink(async () => { throw new Error("offline"); }, SUBMISSION)).toEqual(unknown);
    expect(await requestPackageLink(async () => ({ ok: false, status: 503 }), SUBMISSION)).toEqual(unknown);
  });

  it("accepts only the file path of this submission with a token", () => {
    expect(isPackageHref(good.downloadPath, SUBMISSION, "referada")).toBe(true);
    expect(isPackageHref(good.downloadPath, "00000000-0000-4000-8000-0000000000c2", "referada")).toBe(false);
    expect(isPackageHref(packageFilePath(SUBMISSION, "referada"), SUBMISSION, "referada")).toBe(false);
  });

  it("hands a lost session back and names a missing submission", async () => {
    expect(await requestPackageLink(async () => ({ ok: false, status: 401, code: "unauthorized" }), SUBMISSION)).toEqual({ kind: "session-expired" });
    expect(await requestPackageLink(async () => ({ ok: false, status: 404, code: "not_found" }), SUBMISSION)).toEqual({ kind: "greska", code: "not_found" });
    expect(await requestPackageLink(fakePackageServer().call, "not-an-id")).toEqual({ kind: "greska", code: "not_found" });
  });

  it("holds no forbidden term in its copy", () => {
    for (const value of Object.values(submissionPackageText)) expect(findForbiddenTerms(value)).toEqual([]);
  });
});
