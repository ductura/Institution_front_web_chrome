// @vitest-environment jsdom
// WEB-V13-PREDAJA: step 4 of a slides work: sends only a verified, written work with the server's
// declaration, exactly the confirmed revision, and says "not found"/"unavailable" for what it is.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ASSIGNMENT, CONFIRMED, DRAFT, gateServer } from "../../student/submission/summary/declaration-gate.fixture";
import { submitText as t } from "../../student/submission/submit/messages.hr";
import { slidesRevisionZeroDocument, type SlidesDocument } from "../../../../../editor-core/src/slides/index.ts";
import SlidesSubmit from "./SlidesSubmit";
import { slidesSubmitText as s } from "./messages.hr";
import type { SlidesWorkRead } from "./requirements";

const push = vi.fn();
const submitWork = vi.fn();
const router = { push };
const hostContext = { base: "" };
const online = { value: true };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../context", () => ({ useHost: () => hostContext }));
vi.mock("../../../../../../src/client/online-status", () => ({ useOnline: () => online.value }));
vi.mock("../../../../../../src/client/online-status.ts", () => ({ useOnline: () => online.value }));
vi.mock("../../student/submission/submit/local-hold", () => ({ deviceHasNewer: async () => false, LATEST_EVERY_MS: 1, LATEST_LIMIT_MS: 5 }));
vi.mock("../../../../../../src/client/submission.ts", async (actual) => ({ ...(await actual<object>()), submitWork: (...a: unknown[]) => submitWork(...a) }));
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const written = (n: number): SlidesDocument => ({
  documentKind: "slides", schemaVersion: 1,
  slides: Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-00000000010${i}`, layout: "titleContent" as const,
    blocks: [{ type: "heading" as const, id: `00000000-0000-4000-8000-00000000020${i}`, slot: "title" as const, text: `Izmišljeni naslov ${i}` }],
  })),
});
const ready = (document: SlidesDocument, extra: object = {}): SlidesWorkRead => ({ kind: "ready", documentId: "izmisljeni-dokument-1", revision: 2, document, submitted: false, ...extra }) as SlidesWorkRead;

let root: Root | null = null;
beforeEach(() => { push.mockReset(); submitWork.mockReset(); online.value = true; });
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); });
async function mount(read: SlidesWorkRead, props: object = {}, gate: unknown = CONFIRMED) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(h(SlidesSubmit, {
      assignmentId: ASSIGNMENT, title: "Izmišljena prezentacija", stage: { kind: "open" }, dueAt: "2026-12-01T10:00:00.000Z",
      declarationGate: gateServer(() => gate).read, readWork: async () => read, ...props,
    }));
  });
  await settle();
  return host;
}
const submitButton = (host: HTMLElement) => [...host.querySelectorAll("button")].find((b) => b.textContent === t.submit && !b.closest("dialog"));
const dialogSubmit = () => [...document.querySelectorAll("dialog button")].find((b) => b.textContent === t.submit);
async function trySubmit(host: HTMLElement) {
  await act(async () => { submitButton(host)?.click(); });
  await act(async () => { (dialogSubmit() as HTMLButtonElement | undefined)?.click(); });
  await settle();
}

describe("slides submission, step 4", () => {
  it("submits exactly the revision the server confirmed, naming the slide count in the dialog", async () => {
    submitWork.mockResolvedValue({ kind: "nepoznato" });
    const host = await mount(ready(written(3)));
    expect(host.textContent).toContain(s.slides);
    expect(submitButton(host)?.hasAttribute("aria-disabled")).toBe(false);
    await act(async () => { submitButton(host)?.click(); });
    expect(document.querySelector("dialog")?.textContent).toContain("Slajdova: 3.");
    await act(async () => { (dialogSubmit() as HTMLButtonElement).click(); });
    await settle();
    expect(submitWork).toHaveBeenCalledTimes(1);
    expect(submitWork.mock.calls[0]?.[0]).toEqual({ assignmentId: ASSIGNMENT, documentId: "izmisljeni-dokument-1", revision: 2 });
  });

  it("a work that is still revision zero is not sent, and the page says why", async () => {
    const host = await mount(ready(slidesRevisionZeroDocument()));
    expect(submitButton(host)?.getAttribute("aria-disabled")).toBe("true");
    expect(host.textContent).toContain(s.empty);
    await trySubmit(host);
    expect(submitWork).not.toHaveBeenCalled();
  });

  it("fewer slides than the assignment asks for are not sent", async () => {
    const host = await mount(ready(written(2)), { slideRange: { min: 5, max: null } });
    expect(submitButton(host)?.getAttribute("aria-disabled")).toBe("true");
    expect(host.textContent).toContain("najmanje 5 slajdova");
    await trySubmit(host);
    expect(submitWork).not.toHaveBeenCalled();
  });

  it("without the server's confirmed declaration nothing is sent", async () => {
    const host = await mount(ready(written(3)), {}, DRAFT);
    expect(submitButton(host)?.getAttribute("aria-disabled")).toBe("true");
    await trySubmit(host);
    expect(submitWork).not.toHaveBeenCalled();
  });

  it("offline closes sending", async () => {
    online.value = false;
    const host = await mount(ready(written(3)));
    expect(host.textContent).toContain(s.offline);
    await trySubmit(host);
    expect(submitWork).not.toHaveBeenCalled();
  });

  it("a failed read is an error with a retry, never an empty work and never a submit", async () => {
    const host = await mount({ kind: "unavailable" });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(s.loadError);
    // U10 (A2): the message is the frame; the existing "Pokušaj ponovno" button stays under it.
    expect(host.querySelector('[role="alert"]')?.querySelector("button")).toBeNull();
    expect(host.textContent).not.toContain(s.empty);
    expect(submitButton(host)).toBeUndefined();
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === t.retry)).toBe(true);
  });

  it("another person's or an unknown work is the notice page, not a panel", async () => {
    await mount({ kind: "notFound" });
    expect(push).toHaveBeenCalledWith("/zadatak/" + ASSIGNMENT);
    expect(submitWork).not.toHaveBeenCalled();
  });

  it("a text work is not submitted here", async () => {
    const host = await mount({ kind: "notSlides" });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(s.notSlides);
    expect(submitButton(host)).toBeUndefined();
  });

  it("a work already submitted goes on to the receipt", async () => {
    await mount(ready(written(3), { submitted: true }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/predaja/potvrda"));
  });

  it("a signed receipt is the only way on: predano goes to step 5", async () => {
    submitWork.mockResolvedValue({ kind: "predano", receipt: {} });
    const host = await mount(ready(written(3)));
    await trySubmit(host);
    expect(push).toHaveBeenCalledWith(expect.stringContaining("/predaja/potvrda"));
  });
});
