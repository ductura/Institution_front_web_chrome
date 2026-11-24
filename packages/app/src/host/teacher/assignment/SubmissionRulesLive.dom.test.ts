// @vitest-environment jsdom
// NZ-4 on the edit page: read, ask before saving (dz-h), a note only after the server's answer, partial failure reads again.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HostContext, type HostValue } from "../../context";
import { assignmentFormHr as f } from "../assignment-form/messages.hr";
import type { Call } from "../assignment-form/rules";
import SubmissionRulesLive from "./SubmissionRulesLive";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
const HOST = { base: "/app/web", page: { path: "/nastavnik" }, role: "teacher" } as unknown as HostValue;
const l = f.submitRules.live;
const ok = (body: unknown) => ({ ok: true, status: 200, body });

describe("SubmissionRulesLive (NZ-4)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  async function mount(answer: (id: string, input: { body?: unknown }) => unknown) {
    const client = vi.fn(async (id: string, input: { body?: unknown }) => answer(id, input));
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(HostContext.Provider, { value: HOST }, h(SubmissionRulesLive, { assignmentId: "a1", client: client as unknown as Call }))); });
    return { host, client };
  }
  const state = (id: string, i: { body?: unknown }) => {
    if (id === "teacher.submission-withdrawal.get") return ok({ allowed: true, changedAt: null });
    if (id === "teacher.declaration-required.get") return ok({ required: true, changedAt: null });
    if (id === "teacher.submission-withdrawal.post") return ok({ allowed: (i.body as { allowed: boolean }).allowed, changedAt: null });
    return ok({ required: (i.body as { required: boolean }).required, changedAt: null });
  };
  const radio = async (name: string, value: string) => { await act(async () => { document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)!.click(); }); };
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label)!;

  it("shows the switches as the server has them and keeps save off until something changes", async () => {
    const { host } = await mount(state);
    expect(host.querySelector<HTMLInputElement>('input[name="live-withdrawal"][value="on"]')?.checked).toBe(true);
    expect(button(l.save).disabled).toBe(true);
  });

  it("asks first, then saves only the changed switch and says so after the answer", async () => {
    const { client } = await mount(state);
    await radio("live-withdrawal", "off");
    await act(async () => { button(l.save).click(); });
    expect(document.querySelector("dialog")?.textContent).toContain(l.confirmBody);
    expect(client).not.toHaveBeenCalledWith("teacher.submission-withdrawal.post", expect.anything());
    await act(async () => { button(l.confirm).click(); });
    expect(client).toHaveBeenCalledWith("teacher.submission-withdrawal.post", expect.objectContaining({ body: { allowed: false } }));
    expect(client).not.toHaveBeenCalledWith("teacher.declaration-required.put", expect.anything());
    expect(document.querySelector('[role="status"]')?.textContent).toBe(l.saved);
  });

  it("does not say saved when the answer names another value, and reads the switches again", async () => {
    const { client } = await mount((id, i) => (id === "teacher.submission-withdrawal.post" ? ok({ allowed: true, changedAt: null }) : state(id, i)));
    await radio("live-withdrawal", "off");
    await act(async () => { button(l.save).click(); });
    await act(async () => { button(l.confirm).click(); });
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(l.notSaved);
    expect(document.body.textContent).not.toContain(l.saved);
    expect(client.mock.calls.filter(([id]) => id === "teacher.submission-withdrawal.get").length).toBe(2);
  });

  it("says the rules cannot be read, with a retry, never an empty panel", async () => {
    await mount(() => ({ ok: false, status: 503, code: "unavailable" }));
    expect(document.body.textContent).toContain(l.unavailable);
    expect(button(l.retry)).toBeTruthy();
  });
});
