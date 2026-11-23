// @vitest-environment jsdom
// PIL-D2-ZIP-DORADA: the bulk download as a user meets it (click, timer, focus), over the fake server. Invented data.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import BulkDownload from "./BulkDownload";
import type { BulkCall } from "./contract";
import { ASSIGNMENT, fakeBulkServer } from "./fake-port";
import { bulkText as t } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OTHER = "00000000-0000-4000-8000-0000000000b2";
const EXPIRES = "2026-12-01T12:00:00.000Z";

describe("BulkDownload in the browser (PIL-D2-ZIP-DORADA)", () => {
  let root: Root | undefined;
  let followed: boolean[] = [];
  // Records whether the screen let a click through, then stops jsdom's own navigation.
  const onClick = (event: Event) => {
    if (!(event.target instanceof HTMLAnchorElement)) return;
    followed.push(!event.defaultPrevented);
    event.preventDefault();
  };
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-12-01T11:59:00.000Z"));
    followed = [];
    window.addEventListener("click", onClick);
  });
  afterEach(() => {
    act(() => root?.unmount());
    window.removeEventListener("click", onClick);
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  const mount = async (call: BulkCall, onSignedOut?: () => void, assignmentId = ASSIGNMENT) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const render = (id: string) => act(async () => { root?.render(h(BulkDownload, { call, assignmentId: id, onSignedOut })); });
    await render(assignmentId);
    return { host, render };
  };
  const button = (host: HTMLElement) => host.querySelector("button") as HTMLButtonElement | null;
  const anchor = (host: HTMLElement) => host.querySelector("a") as HTMLAnchorElement | null;
  const status = (host: HTMLElement) => host.querySelector('[role="status"]')!;
  const alert = (host: HTMLElement) => host.querySelector('[role="alert"]')!.textContent;
  const click = (el: HTMLElement | null) => act(async () => { el!.click(); });

  it("a link before expiry is followed, focused, and offers a new request after the click", async () => {
    const { host } = await mount(fakeBulkServer({ expiresAt: EXPIRES }).call);
    const region = status(host);
    expect(region.textContent).toBe("");
    await click(button(host));
    expect(document.activeElement).toBe(anchor(host));
    expect(status(host)).toBe(region);
    expect(region.textContent).toBe(t.ready);
    await click(anchor(host));
    expect(followed).toEqual([true]);
    expect(status(host).textContent).toBe(t.started);
    expect(button(host)!.textContent).toBe(t.requestAgain);
  });

  it("at expiry the timer replaces the focused link with the note and the button, which takes the focus", async () => {
    const { host } = await mount(fakeBulkServer({ expiresAt: EXPIRES }).call);
    const region = status(host);
    await click(button(host));
    expect(document.activeElement).toBe(anchor(host));
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(anchor(host)).toBeNull();
    expect(status(host)).toBe(region);
    expect(region.textContent).toBe(t.expired);
    expect(button(host)!.textContent).toBe(t.requestAgain);
    expect(document.activeElement).toBe(button(host));
  });

  it("a click on a link whose expiry has passed is never followed and shows the note", async () => {
    const { host } = await mount(fakeBulkServer({ expiresAt: EXPIRES }).call);
    await click(button(host));
    vi.setSystemTime(new Date("2026-12-01T12:00:00.000Z")); // expiry reached before the timer ran
    await click(anchor(host));
    expect(followed).toEqual([false]);
    expect(anchor(host)).toBeNull();
    expect(status(host).textContent).toBe(t.expired);
    expect(document.activeElement).toBe(button(host));
  });

  it("an ended session calls onSignedOut once and shows no link", async () => {
    const onSignedOut = vi.fn();
    const { host } = await mount(async () => ({ ok: false, status: 401, code: "unauthorized" }), onSignedOut);
    await click(button(host));
    expect(onSignedOut).toHaveBeenCalledTimes(1);
    expect(anchor(host)).toBeNull();
    expect(alert(host)).toBe("");
  });

  it("a 403 (origin check) gives the neutral note, not a teacher-only one", async () => {
    const { host } = await mount(async () => ({ ok: false, status: 403, code: "cross_site" }));
    await click(button(host));
    expect(alert(host)).toBe(t.forbidden);
    expect(t.forbidden).not.toMatch(/nastavnik/i);
    expect(document.activeElement).toBe(button(host));
  });

  it("a new format drops the ready link and offers the button again", async () => {
    const server = fakeBulkServer({ expiresAt: EXPIRES });
    const { host } = await mount(server.call);
    await click(button(host));
    expect(anchor(host)!.getAttribute("href")).toContain("/pdf?token=");
    await click(host.querySelector('input[value="docx"]') as HTMLInputElement);
    expect(anchor(host)).toBeNull();
    expect(status(host).textContent).toBe("");
    await click(button(host));
    expect(anchor(host)!.getAttribute("href")).toContain("/docx?token=");
    expect(server.posts.map((p) => p.body)).toEqual([{ format: "pdf" }, { format: "docx" }]);
  });

  it("an error for the previous assignment is not shown on the next one", async () => {
    let answer: (value: Awaited<ReturnType<BulkCall>>) => void = () => {};
    const call: BulkCall = () => new Promise((resolve) => { answer = resolve; });
    const { host, render } = await mount(call);
    await click(button(host));
    expect(status(host).textContent).toBe(t.requesting);
    await render(OTHER);
    await act(async () => { answer({ ok: false, status: 404, code: "not_found" }); });
    expect(alert(host)).toBe("");
    expect(status(host).textContent).toBe("");
    expect(button(host)!.disabled).toBe(false);
  });

  it("an assignment id in upper case still gets its link (the contract's path is lower case)", async () => {
    const { host } = await mount(fakeBulkServer({ expiresAt: EXPIRES }).call, undefined, ASSIGNMENT.toUpperCase());
    await click(button(host));
    expect(anchor(host)!.getAttribute("href")).toContain(`/assignments/${ASSIGNMENT}/`);
    expect(alert(host)).toBe("");
  });
});
