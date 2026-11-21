import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SubmissionPackage } from "./SubmissionPackage";
import { submissionPackageMessages as t } from "./messages.hr";
import { confirmationCode, packageBlocked, packageRows, type PackageInput } from "./package-rows";

// WEB-9E (E§3.3 paket). Invented digests only.
const DIGEST = "0123456789abcdef".repeat(4);
const base: PackageInput = { openPlaces: 0, summaryWritten: true, declaration: "filled", approval: "approved" };

describe("submission package", () => {
  it("yellow rows never block, only places left for later check do", () => {
    const yellow = packageRows({ ...base, summaryWritten: false, declaration: "missing", approval: "pending" });
    expect(yellow.filter((r) => r.status === "warn")).toHaveLength(3);
    expect(packageBlocked(yellow)).toBe(false);
    expect(packageBlocked(packageRows({ ...base, openPlaces: 2 }))).toBe(true);
  });
  it("derives the code from the receipt digest and none before submission", () => {
    expect(confirmationCode(DIGEST)).toBe("DUC-0123-4567-89AB");
    expect(confirmationCode(null)).toBeNull();
    expect(confirmationCode("nije-otisak")).toBeNull();
  });
  it("states only that the text has not changed since submission", () => {
    const html = renderToStaticMarkup(<SubmissionPackage rows={packageRows(base)} artifactSha256={DIGEST} submitHref="/rad/x/predaja" />);
    expect(html).toContain("DUC-0123-4567-89AB");
    expect(html).toContain(t.codeNote);
    expect(html).not.toMatch(/autorsk|nastao|nastala|putovnic/i);
    expect(html).toContain('href="/rad/x/predaja"');
  });
  it("shows the way on as not available while a row blocks, and no code before submission", () => {
    const html = renderToStaticMarkup(<SubmissionPackage rows={packageRows({ ...base, openPlaces: 1 })} artifactSha256={null} submitHref="/rad/x/predaja" />);
    expect(html).toContain(t.codeNever);
    expect(html).not.toContain("<code>");
    expect(html).not.toContain('href="/rad/x/predaja"');
    expect(html).toContain(t.details.workHoles);
  });
});
