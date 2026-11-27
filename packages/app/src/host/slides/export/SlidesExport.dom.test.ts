// @vitest-environment jsdom
// WEB-V13-IZVOZ: the export buttons mounted in jsdom with a test double for the request. Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExportResult } from "./export-model.ts";
import { slidesExportText as t } from "./messages.hr.ts";

const signIn = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/aplikacija" }) }));
vi.mock("../../../../../../src/client/api", () => ({ goToSignIn: signIn, SERVER_PREFIX: "/api/v1/", browserTransport: vi.fn() }));
vi.mock("../../../../../../src/components/editor/EarlierDraft", () => ({ downloadBlob: download }));
const { default: SlidesExport } = await import("./SlidesExport.tsx");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SHA = "cd".repeat(32);
const ready = (format: "pptx" | "pdf"): ExportResult => ({ kind: "ready", blob: new Blob(["x"]), snapshotSha256: SHA, format });

describe("SlidesExport in the browser", () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); download.mockClear(); });
  afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ""; });
  const render = async (confirmed: boolean, answer: ExportResult | Promise<ExportResult>) => {
    const request = vi.fn(async () => answer);
    await act(async () => { root.render(h(SlidesExport, { documentId: "doc-1", title: "Moji slajdovi", confirmed, here: "/rad/a1", request: request as never })); });
    return request;
  };
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label)!;
  const click = async (el: Element) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); };

  it("offers nothing until the server has confirmed the last revision", async () => {
    const request = await render(false, ready("pdf"));
    expect(button(t.pptx).disabled).toBe(true);
    expect(button(t.pdf).disabled).toBe(true);
    expect(host.textContent).toContain(t.notConfirmed);
    await click(button(t.pdf));
    expect(request).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it("downloads the .pptx under the title and shows the snapshot digest", async () => {
    const request = await render(true, ready("pptx"));
    await click(button(t.pptx));
    expect(request).toHaveBeenCalledWith("doc-1", "pptx", null, expect.anything());
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "Moji slajdovi.pptx");
    expect(host.textContent).toContain(t.readyPptx);
    expect(host.textContent).toContain(t.snapshot(SHA.slice(0, 12)));
  });

  it("shows the preparation state while the answer is pending", async () => {
    let finish!: (r: ExportResult) => void;
    await render(true, new Promise<ExportResult>((resolve) => { finish = resolve; }));
    await click(button(t.pdf));
    expect(host.querySelector("[role=status]")?.textContent).toBe(t.preparing);
    expect(button(t.pdf).disabled).toBe(true);
    await act(async () => { finish(ready("pdf")); });
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "Moji slajdovi.pdf");
  });

  it.each([
    ["not-found", t.notFound], ["failed", t.failed], ["expired", t.expired], ["mismatch", t.mismatch], ["invalid", t.invalid],
  ] as const)("%s is its own message and downloads nothing", async (kind, message) => {
    await render(true, { kind } as ExportResult);
    await click(button(t.pdf));
    expect(host.querySelector("[role=alert]")?.textContent).toContain(message);
    expect(download).not.toHaveBeenCalled();
    expect(button(t.pdf).disabled).toBe(false);
  });

  it("goes to sign-in when signed out", async () => {
    await render(true, { kind: "signed-out" });
    await click(button(t.pdf));
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(download).not.toHaveBeenCalled();
  });
});
