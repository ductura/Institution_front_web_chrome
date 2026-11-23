// @vitest-environment jsdom
// PIL-P1-RITAM-NASTAVNIK: the switch over a fake port. The box follows the server only, one change is
// sent at a time, a 401 goes to sign-in and a refusal says nothing about whether the course exists.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RhythmAnswer, RhythmState, RhythmSwitchPort } from "../../../../../../src/client/input-rhythm-teacher";
import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms";
import { rhythmSwitchHr as text } from "./messages.hr";
import { RhythmSwitch } from "./RhythmSwitch";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = (enabled: boolean, source: RhythmState["source"]): RhythmAnswer =>
  ({ kind: "ready", state: { enabled, source, changedBy: null, changedAt: null } });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("RhythmSwitch", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  async function mount(props: Parameters<typeof RhythmSwitch>[0]) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(RhythmSwitch, props)); });
    return host;
  }
  const box = (host: HTMLElement) => host.querySelector<HTMLInputElement>("input[type=checkbox]")!;

  it("shows the server's value and the level it comes from", async () => {
    const port: RhythmSwitchPort = { read: vi.fn(async () => state(false, "course")), set: vi.fn() };
    const host = await mount({ level: "assignment", port, name: "Seminar A", onSignedOut: vi.fn() });
    expect(box(host).checked).toBe(false);
    expect(host.textContent).toContain(text.assignment.course);
    expect(box(host).getAttribute("aria-label")).toBe(text.labelFor("Seminar A"));
    // Following the course: nothing to go back to.
    expect(host.textContent).not.toContain(text.reset);
  });

  it("changes the box only on the server's confirmation and sends one request for two clicks", async () => {
    const answer = deferred<RhythmAnswer>();
    const set = vi.fn(() => answer.promise);
    const onChanged = vi.fn();
    const port: RhythmSwitchPort = { read: vi.fn(async () => state(true, "default")), set };
    const host = await mount({ level: "course", port, onSignedOut: vi.fn(), onChanged });
    await act(async () => { box(host).click(); box(host).click(); });
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(false);
    // Not yet confirmed: still on.
    expect(box(host).checked).toBe(true);
    expect(onChanged).not.toHaveBeenCalled();
    await act(async () => { answer.resolve(state(false, "course")); });
    expect(box(host).checked).toBe(false);
    expect(host.textContent).toContain(text.course.course);
    expect(host.textContent).toContain(text.saved);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("negative control: an unconfirmed change keeps the old value and says it was not saved", async () => {
    const port: RhythmSwitchPort = { read: vi.fn(async () => state(true, "course")), set: vi.fn(async () => ({ kind: "unavailable" }) as const) };
    const onChanged = vi.fn();
    const host = await mount({ level: "course", port, onSignedOut: vi.fn(), onChanged });
    await act(async () => { box(host).click(); });
    expect(box(host).checked).toBe(true);
    expect(host.querySelector("[role=alert]")?.textContent).toBe(text.notSaved);
    expect(host.textContent).not.toContain(text.saved);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("an assignment's own setting offers the way back, and the answer names the level that now holds", async () => {
    const reset = vi.fn(async () => state(true, "default"));
    const port: RhythmSwitchPort = { read: vi.fn(async () => state(false, "assignment")), set: vi.fn(), reset };
    const host = await mount({ level: "assignment", port, name: "Seminar A", onSignedOut: vi.fn() });
    expect(host.textContent).toContain(text.assignment.assignment);
    const back = host.querySelector<HTMLButtonElement>(`button[aria-label="${text.resetFor("Seminar A")}"]`)!;
    await act(async () => { back.click(); back.click(); });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(box(host).checked).toBe(true);
    expect(host.textContent).toContain(text.assignment.default);
    expect(host.textContent).not.toContain(text.reset);
  });

  it("an assignment following a course with its own dated setting shows the course's level and no way back", async () => {
    const followed: RhythmAnswer = {
      kind: "ready", state: { enabled: false, source: "course", changedBy: { role: "teacher", name: null }, changedAt: "2026-11-22T10:00:00.000Z" },
    };
    const host = await mount({ level: "assignment", port: { read: vi.fn(async () => followed), set: vi.fn(), reset: vi.fn() }, name: "Seminar B", onSignedOut: vi.fn() });
    expect(host.textContent).toContain(text.assignment.course);
    expect(host.textContent).not.toContain(text.assignment.assignment);
    expect(host.textContent).not.toContain(text.reset);
  });

  it("keeps the box focusable while a change is out and drops a read that answers meanwhile", async () => {
    const answer = deferred<RhythmAnswer>();
    const read = vi.fn<() => Promise<RhythmAnswer>>(async () => state(true, "course"));
    const port: RhythmSwitchPort = { read, set: vi.fn(() => answer.promise) };
    const props = { level: "assignment" as const, port, name: "Seminar A", onSignedOut: vi.fn() };
    const host = await mount(props);
    box(host).focus();
    await act(async () => { box(host).click(); });
    expect(box(host).disabled).toBe(false);
    expect(box(host).getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(box(host));
    // The course changed meanwhile: a re-read starts while the change is out and answers after it.
    const stale = deferred<RhythmAnswer>();
    read.mockReturnValueOnce(stale.promise);
    await act(async () => { root?.render(h(RhythmSwitch, { ...props, refresh: 1 })); });
    await act(async () => { answer.resolve(state(false, "assignment")); });
    await act(async () => { stale.resolve(state(true, "course")); });
    // The change's answer stays: the older read does not overwrite it.
    expect(box(host).checked).toBe(false);
    expect(host.textContent).toContain(text.assignment.assignment);
    // A read started after the change is shown as usual.
    await act(async () => { root?.render(h(RhythmSwitch, { ...props, refresh: 2 })); });
    expect(box(host).checked).toBe(true);
  });

  it("a 401 on read or on change goes to sign-in", async () => {
    const onSignedOut = vi.fn();
    await mount({ level: "course", port: { read: vi.fn(async () => ({ kind: "signedOut" }) as const), set: vi.fn() }, onSignedOut });
    expect(onSignedOut).toHaveBeenCalledTimes(1);
    act(() => root?.unmount());
    const again = vi.fn();
    const host = await mount({
      level: "course", port: { read: vi.fn(async () => state(true, "default")), set: vi.fn(async () => ({ kind: "signedOut" }) as const) }, onSignedOut: again,
    });
    await act(async () => { box(host).click(); });
    expect(again).toHaveBeenCalledTimes(1);
    expect(box(host).checked).toBe(true);
  });

  it("a refused read says only 'unavailable' and asks again on retry", async () => {
    const read = vi.fn<() => Promise<RhythmAnswer>>(async () => ({ kind: "unavailable" }));
    const host = await mount({ level: "course", port: { read, set: vi.fn() }, onSignedOut: vi.fn() });
    expect(host.querySelector("[role=alert]")?.textContent).toBe(text.unavailable);
    expect(host.querySelector("input")).toBeNull();
    read.mockResolvedValueOnce(state(true, "default"));
    await act(async () => { host.querySelector("button")!.click(); });
    expect(read).toHaveBeenCalledTimes(2);
    expect(box(host).checked).toBe(true);
  });

  it("holds no forbidden term", () => {
    const lines = [
      ...(Object.values(text) as unknown[]).filter((v): v is string => typeof v === "string"),
      ...Object.values(text.course), ...Object.values(text.assignment), text.labelFor("Seminar A"), text.resetFor("Seminar A"),
    ];
    expect(lines.length).toBeGreaterThan(10);
    for (const line of lines) expect({ line, hits: findForbiddenTerms(line) }).toEqual({ line, hits: [] });
    // Negative control: the scanner does catch "saved" without saying where.
    expect(findForbiddenTerms("Promjena je spremljena.").length).toBeGreaterThan(0);
  });
});
