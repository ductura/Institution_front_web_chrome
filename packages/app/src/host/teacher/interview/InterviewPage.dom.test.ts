// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { fakeTeacherPort } from "./fake-port";
import InterviewPage from "./InterviewPage";
import { interviewMessages as text } from "./messages.hr";
import type { InterviewTeacherPort } from "./port";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";

// jsdom has no modal <dialog>: the open attribute stands in for it.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
});

describe("N-14 teacher interview page (WEB-DIZ-B-N14)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  const mount = async (port: InterviewTeacherPort, originHref?: string) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(h(InterviewPage, { port, documentId: ID, workHref: "/aplikacija/nastavnik/rad/x", summaryHref: "/aplikacija/nastavnik/rad/x/sazetak", originHref }));
    });
    return host;
  };
  const button = (host: HTMLElement, label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label);
  const click = async (el: Element | undefined) => { await act(async () => { el?.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); };

  it("asks before sending the invitation and sends only after the confirmation", async () => {
    const port = fakeTeacherPort();
    const host = await mount(port);
    expect(host.querySelector("dialog[open]")).toBeNull();
    await click(button(host, text.invite));
    const dialog = host.querySelector("dialog[open]");
    expect(dialog?.textContent).toContain(text.confirmTitle);
    expect(dialog?.textContent).toContain(text.confirmBody);
    expect(port.calls).not.toContain("invite");
    await click(button(host, text.cancel));
    expect(host.querySelector("dialog[open]")).toBeNull();
    expect(port.calls.filter((c) => c.startsWith("invite"))).toHaveLength(0);
    await click(button(host, text.invite));
    await click(button(host, text.confirmSend));
    expect(port.calls.some((c) => c.startsWith("invite"))).toBe(true);
    expect(host.textContent).toContain("Poziv je poslan");
  });

  it("names the paragraph, shows the origin link and the before-invitation sentence", async () => {
    const host = await mount(fakeTeacherPort(), "/aplikacija/nastavnik/rad/x#podrijetlo");
    expect(host.textContent).toContain("Odlomak 3");
    expect(host.textContent).toContain(text.studentSeesThemLater);
    expect(host.querySelector(`a[href="/aplikacija/nastavnik/rad/x#podrijetlo"]`)?.textContent).toBe(text.originLink);
    expect(host.textContent).toContain(text.dateLabel);
    expect(host.textContent).toContain(text.timeLabel);
    expect(host.textContent).not.toContain("(hh:mm)");
  });

  it("a load error is a role=alert frame with the retry link; 404 and 401 are not read errors", async () => {
    const fail = (kind: "unavailable" | "notFound" | "signedOut"): InterviewTeacherPort => ({ ...fakeTeacherPort(), read: async () => ({ kind }) });
    const unavailable = await mount(fail("unavailable"));
    expect(unavailable.querySelector('[role="alert"]')?.textContent).toContain(text.unavailable);
    expect(button(unavailable, text.retry)).toBeDefined();
    act(() => root?.unmount()); document.body.innerHTML = "";
    const missing = await mount(fail("notFound"));
    expect(missing.querySelector('[role="alert"]')).toBeNull();
    expect(missing.textContent).toContain("Stranica ne postoji");
    act(() => root?.unmount()); document.body.innerHTML = "";
    const out = await mount(fail("signedOut"));
    expect(out.querySelector('[role="alert"]')).toBeNull();
    expect(button(out, text.retry)).toBeUndefined();
  });
});
