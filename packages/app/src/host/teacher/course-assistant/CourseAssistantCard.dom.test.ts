// @vitest-environment jsdom
// F4-PM1-R07 on the screen: the course's switch of the Asistent; invented answers only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import CourseAssistantCard from "./CourseAssistantCard";
import { courseAssistantMessages as t } from "./messages.hr";
import type { AssistantRead, AssistantWrite, CourseAssistantPort } from "./port";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("CourseAssistantCard", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  async function mount(reads: AssistantRead[], write: AssistantWrite = { kind: "done", enabled: true }) {
    const queue = [...reads];
    const port: CourseAssistantPort = {
      read: vi.fn(async () => queue.shift() ?? queue[0] ?? ({ kind: "unavailable" } as AssistantRead)),
      write: vi.fn(async () => write),
    };
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(CourseAssistantCard, { courseId: "c1", port })); });
    return port;
  }
  const click = async (label: string) => { await act(async () => { ([...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLElement).click(); }); };
  const state = () => document.querySelector('[data-testid="course-assistant-state"]')?.textContent;

  it("shows the server's state and turns the switch on, showing the answer's state", async () => {
    const port = await mount([{ kind: "ready", enabled: false }]);
    expect(state()).toBe(t.stateOff);
    await click(t.turnOn);
    expect(port.write).toHaveBeenCalledWith("c1", true);
    expect(state()).toBe(t.stateOn);
    expect(document.querySelector('[data-testid="course-assistant-notice"]')?.textContent).toBe(t.savedOn);
  });

  it("turns the switch off from on", async () => {
    const port = await mount([{ kind: "ready", enabled: true }], { kind: "done", enabled: false });
    await click(t.turnOff);
    expect(port.write).toHaveBeenCalledWith("c1", false);
    expect(state()).toBe(t.stateOff);
  });

  it("a failed read is unavailable with a button, never an off switch", async () => {
    const port = await mount([{ kind: "unavailable" }, { kind: "ready", enabled: true }]);
    expect(state()).toBeUndefined();
    expect(document.body.textContent).toContain(t.unavailable);
    expect(document.body.textContent).not.toContain(t.stateOff);
    await click(t.retry);
    expect(port.read).toHaveBeenCalledTimes(2);
    expect(state()).toBe(t.stateOn);
  });

  it("another course's id reads as not found, with no switch", async () => {
    await mount([{ kind: "notFound" }]);
    expect(document.body.textContent).toContain(t.notFound);
    expect(document.querySelectorAll("button")).toHaveLength(0);
  });

  it("an unconfirmed write is said so and the switch is read again, not shown as saved", async () => {
    const port = await mount([{ kind: "ready", enabled: false }, { kind: "ready", enabled: false }], { kind: "unknown" });
    await click(t.turnOn);
    expect(document.querySelector('[data-testid="course-assistant-notice"]')?.textContent).toBe(t.saveUnknown);
    expect(port.read).toHaveBeenCalledTimes(2);
    expect(state()).toBe(t.stateOff);
  });

  it("a refused write leaves the shown state as it was", async () => {
    await mount([{ kind: "ready", enabled: false }], { kind: "invalid" });
    await click(t.turnOn);
    expect(state()).toBe(t.stateOff);
    expect(document.querySelector('[data-testid="course-assistant-notice"]')?.textContent).toBe(t.saveFailed);
  });
});
