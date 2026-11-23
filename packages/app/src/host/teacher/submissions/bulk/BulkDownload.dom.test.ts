// @vitest-environment jsdom
// PIL-D2-ZIP: the bulk download as the submissions page mounts it (inside GradeGate), driven by clicks and a
// controlled clock: the link, its expiry, the started state, a lost session, a refusal and a change of
// assignment. Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GradeGate } from "../grade/GradeGate";
import type { GradeRead } from "../grade/contract";
import BulkDownload from "./BulkDownload";
import { bulkFilePath, type BulkCall } from "./contract";
import { ASSIGNMENT, TOKEN, fakeBulkServer } from "./fake-port";
import { bulkText as t } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OTHER = "00000000-0000-4000-8000-0000000000b2";
const T0 = Date.parse("2026-12-01T11:59:00.000Z");
const EXPIRES = "2026-12-01T12:00:00.000Z";

describe("BulkDownload on the submissions page (PIL-D2-ZIP)", () => {
  let root: Root | undefined;
  let host: HTMLElement;
  let clock = T0;
  const now = () => new Date(clock);
  const followed: boolean[] = [];
  // Records whether a click on a link went through, then stops jsdom from navigating.
  const onClick = (event: Event) => {
    if ((event.target as Element | null)?.closest("a") === null) return;
    followed.push(!event.defaultPrevented);
    event.preventDefault();
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    clock = T0;
    followed.length = 0;
    document.addEventListener("click", onClick);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root?.unmount());
    document.removeEventListener("click", onClick);
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  const render = async (call: BulkCall, opts: { read?: GradeRead | null; assignmentId?: string; onSignedOut?: () => void } = {}) => {
    const read = opts.read === undefined ? { kind: "graded" } as const : opts.read;
    await act(async () => {
      root?.render(h(GradeGate, {
        read, onRetry: () => {},
        children: h(BulkDownload, { call, assignmentId: opts.assignmentId ?? ASSIGNMENT, now, onSignedOut: opts.onSignedOut }),
      }));
    });
  };
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label);
  const click = async (el: Element | undefined | null) => { await act(async () => { (el as HTMLElement).click(); }); };
  const status = () => host.querySelector('[role="status"]')?.textContent ?? "";
  const alert = () => host.querySelector('[role="alert"]')?.textContent ?? null;

  it("a regular assignment offers the button; a practice one (P-D1) or an unread grade route offers nothing", async () => {
    await render(fakeBulkServer().call);
    expect(button(t.action)).toBeDefined();
    expect(host.querySelector("a")).toBeNull();
    for (const read of [{ kind: "practice" }, null, { kind: "unavailable" }, { kind: "notFound" }, { kind: "signedOut" }] as (GradeRead | null)[]) {
      await render(fakeBulkServer().call, { read });
      expect(button(t.action)).toBeUndefined();
      expect(host.textContent).not.toContain(t.title);
    }
  });

  it("the button asks for a link once; the ZIP is the link the server gave, and focus moves to it", async () => {
    const server = fakeBulkServer({ expiresAt: EXPIRES });
    await render(server.call);
    await click(button(t.action));
    expect(server.posts).toEqual([{ params: { assignmentId: ASSIGNMENT }, body: { format: "pdf" } }]);
    const link = host.querySelector("a");
    expect(link?.getAttribute("href")).toBe(`${bulkFilePath(ASSIGNMENT, "pdf")}?token=${TOKEN}`);
    expect(link?.hasAttribute("download")).toBe(true);
    expect(link?.textContent).toBe(`${t.download} (${t.formatPdf})`);
    expect(document.activeElement).toBe(link);
    expect(status()).toBe(t.ready);
    await click(link);
    expect(followed).toEqual([true]);
    expect(status()).toBe(t.started);
    expect(button(t.requestAgain)).toBeDefined();
  });

  it("at the server's expiry the link gives way to a calm note and a new request, which takes focus", async () => {
    await render(fakeBulkServer({ expiresAt: EXPIRES }).call);
    await click(button(t.action));
    expect(host.querySelector("a")).not.toBeNull();
    await act(async () => { clock = Date.parse(EXPIRES); vi.advanceTimersByTime(60_000); });
    expect(host.querySelector("a")).toBeNull();
    expect(status()).toBe(t.expired);
    expect(alert()).toBeNull();
    expect(document.activeElement).toBe(button(t.requestAgain));
  });

  it("a click on a link that has just expired is not followed", async () => {
    await render(fakeBulkServer({ expiresAt: EXPIRES }).call);
    await click(button(t.action));
    clock = Date.parse(EXPIRES) + 1;
    await click(host.querySelector("a"));
    expect(followed).toEqual([false]);
    expect(host.querySelector("a")).toBeNull();
    expect(status()).toBe(t.expired);
  });

  it("another format drops the link of the first one", async () => {
    await render(fakeBulkServer({ expiresAt: EXPIRES }).call);
    await click(button(t.action));
    await click(host.querySelector('input[value="docx"]'));
    expect(host.querySelector("a")).toBeNull();
    expect(button(t.action)).toBeDefined();
  });

  it("a lost session signs in again once; a refusal gives a neutral note and no link", async () => {
    const onSignedOut = vi.fn();
    await render(async () => ({ ok: false, status: 401, code: "unauthorized" }), { onSignedOut });
    await click(button(t.action));
    expect(onSignedOut).toHaveBeenCalledTimes(1);
    expect(alert()).toBeNull();
    await render(async () => ({ ok: false, status: 403, code: "cross_site" }));
    await click(button(t.action));
    expect(alert()).toBe(t.forbidden);
    expect(host.querySelector("a")).toBeNull();
  });

  it("an answer for an assignment the screen no longer shows is dropped", async () => {
    let answer: (value: Awaited<ReturnType<BulkCall>>) => void = () => {};
    const call: BulkCall = () => new Promise((resolve) => { answer = resolve; });
    await render(call);
    await click(button(t.action));
    await render(call, { assignmentId: OTHER });
    await act(async () => { answer({ ok: false, status: 404, code: "not_found" }); });
    expect(alert()).toBeNull();
    expect(button(t.action)).toBeDefined();
  });
});
