// @vitest-environment jsdom
// INT-31: the portfolio's "Provjerljivi paket" asks for the verifiable package (kind "package"), the receipt
// keeps the registrar's package (kind "referada"). react-dom/client over the in-memory server, invented data.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { PAGES, type Page } from "../../../routes";
import { HostContext } from "../../context";
import { packageFilePath, type PackageKind } from "./contract";
import { SUBMISSION, TOKEN, fakePackageServer } from "./fake-port";
import { portablePackageText, submissionPackageText } from "./messages.hr";
import SubmissionPackage from "./SubmissionPackage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

async function mountAndAsk(kind: PackageKind | undefined) {
  const server = fakePackageServer();
  const page = PAGES[0] as Page;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const props = { assignmentId: ASSIGNMENT, submissionId: SUBMISSION, call: () => server.call, ...(kind === undefined ? {} : { kind }) };
  await act(async () => {
    root!.render(createElement(HostContext.Provider, { value: { base: "/app/web", page, role: "student" } }, createElement(SubmissionPackage, props)));
  });
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent !== "");
  await act(async () => {
    button!.click();
    await new Promise((done) => setTimeout(done, 0));
  });
  return { server, button: button!.textContent, link: host.querySelector("a")?.getAttribute("href") ?? null, text: host.textContent ?? "" };
}

describe("the package the card asks for (INT-31)", () => {
  it("the portfolio's card asks for the verifiable package and links to it", async () => {
    const seen = await mountAndAsk("package");
    expect(seen.button).toBe(portablePackageText.start);
    expect(seen.server.posts).toEqual([{ params: { submissionId: SUBMISSION }, body: { kind: "package" } }]);
    expect(seen.link).toBe(`${packageFilePath(SUBMISSION, "package")}?token=${TOKEN}`);
    expect(seen.text).toContain(portablePackageText.title);
    expect(seen.text).not.toContain("referad");
  });

  it("without a kind the card stays the registrar's package", async () => {
    const seen = await mountAndAsk(undefined);
    expect(seen.button).toBe(submissionPackageText.start);
    expect(seen.server.posts).toEqual([{ params: { submissionId: SUBMISSION }, body: { kind: "referada" } }]);
    expect(seen.link).toBe(`${packageFilePath(SUBMISSION, "referada")}?token=${TOKEN}`);
  });

  it("holds no forbidden term in the verifiable package's copy", () => {
    for (const value of Object.values(portablePackageText)) expect(findForbiddenTerms(value)).toEqual([]);
  });
});
