// @vitest-environment jsdom
// PIL-K-IZJAVA-VRATA: step 4 sends only on the server's declaration; its 409 declaration_required stays a warning.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { confirmationKey } from "../../../../../../../src/components/predaja/flow";
import { ASSIGNMENT, CONFIRMED, DRAFT, gateServer } from "../summary/declaration-gate.fixture";
import { submitText as t } from "./messages.hr";
import { rehearsalMessagesHr as r } from "../../../../../../../src/components/editor/submission-rehearsal/messages.hr.ts";
import SubmitStep from "./SubmitStep";
import { dialogTexts as d } from "../declaration/dialog-model";

const push = vi.fn();
const submitWork = vi.fn();
// One router and one host for the page's life, as Next and the host give them.
const router = { push };
const hostContext = { base: "" };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../../context", () => ({ useHost: () => hostContext }));
vi.mock("../../../../../../../src/client/online-status", () => ({ useOnline: () => true }));
vi.mock("./local-hold", () => ({ deviceHasNewer: async () => false, sendLatestFromDevice: async () => null }));
vi.mock("../../../../../../../src/components/student/Submission", async (actual) => ({
  ...(await actual<object>()),
  readWork: async () => ({ kind: "ready", documentId: "izmisljeni-dokument-1", revision: 2, nodes: [{ children: [{ text: "Izmišljen tekst rada." }] }] }),
}));
vi.mock("../../../../../../../src/client/submission", async (actual) => ({ ...(await actual<object>()), submitWork: (...a: unknown[]) => submitWork(...a) }));
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
beforeEach(() => { push.mockReset(); submitWork.mockReset(); });
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; window.sessionStorage.clear(); });

const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); });
async function mount(read: ReturnType<typeof gateServer>["read"]) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(h(SubmitStep, { assignmentId: ASSIGNMENT, title: "Izmišljeni rad", stage: { kind: "open" }, dueAt: "2026-12-01T10:00:00.000Z", declarationGate: read }));
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

describe("step 4 declaration gate (PIL-K-IZJAVA-VRATA)", () => {
  it("a confirmation set by hand in sessionStorage does not open sending", async () => {
    window.sessionStorage.setItem(confirmationKey("tag-1", ASSIGNMENT), "1");
    const host = await mount(gateServer(() => DRAFT).read);
    expect(submitButton(host)?.getAttribute("aria-disabled")).toBe("true");
    expect(host.textContent).toContain(r.declarationDraft);
    await trySubmit(host);
    expect(submitWork).not.toHaveBeenCalled();
  });

  it("a failed read does not open sending", async () => {
    for (const answer of [503, "offline"]) {
      const host = await mount(gateServer(() => answer).read);
      expect(submitButton(host)?.getAttribute("aria-disabled"), String(answer)).toBe("true");
      expect(host.textContent).toContain(r.declarationUnavailable);
      await trySubmit(host);
      act(() => root?.unmount());
      root = null;
    }
    expect(submitWork).not.toHaveBeenCalled();
  });

  it("a declaration the server holds as confirmed opens sending", async () => {
    submitWork.mockResolvedValue({ kind: "nepoznato" });
    const host = await mount(gateServer(() => CONFIRMED).read);
    expect(submitButton(host)?.hasAttribute("aria-disabled")).toBe(false);
    await trySubmit(host);
    expect(submitWork).toHaveBeenCalledTimes(1);
    expect(submitWork.mock.calls[0]?.[0]).toEqual({ assignmentId: ASSIGNMENT, documentId: "izmisljeni-dokument-1", revision: 2 });
  });

  // NF-3 PR-5 (PD-10): the way to the declaration is now its dialog on this step, not a link to step 2.
  it("409 declaration_required stays visible as a warning with the declaration's dialog, and sending closes", async () => {
    submitWork.mockResolvedValue({ kind: "izjava" });
    let state: unknown = CONFIRMED;
    const server = gateServer(() => state);
    const host = await mount(server.read);
    state = DRAFT;
    await trySubmit(host);
    expect(host.textContent).toContain(t.declarationRequired);
    expect(host.textContent).not.toContain(t.unknown);
    const open = [...host.querySelectorAll("button")].find((b) => b.textContent === d.open);
    expect(open).toBeDefined();
    await act(async () => { open?.click(); });
    expect(document.querySelector("dialog h2")?.textContent).toBe(d.title);
    expect(server.paths).toHaveLength(2);
    expect(submitButton(host)?.getAttribute("aria-disabled")).toBe("true");
    expect(push).not.toHaveBeenCalled();
  });
});
