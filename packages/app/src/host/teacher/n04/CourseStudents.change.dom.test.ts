// @vitest-environment jsdom
// F4-PM1-R09 on the screen: removal and permitted return after a confirmation; invented people only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HostContext, type HostValue } from "../../context";
import CourseStudents from "./CourseStudents";
import { courseStudentsMessages as t } from "./messages.hr";
import type { CourseStudentsPort, StudentChange } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
const HOST = { base: "/app/web", page: { path: "/nastavnik" }, role: "teacher" } as unknown as HostValue;
const STUDENTS = [{ studentId: "00000000-0000-4000-8000-0000000000b1", name: "Ana Šarić", group: null, works: [] }];

describe("CourseStudents removal and return (F4-PM1-R09)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  async function mount(answer: StudentChange, withChange = true) {
    const change = vi.fn(async () => answer);
    const reads = vi.fn(async () => ({ kind: "ready" as const, data: { courseName: "Izmišljeni kolegij", students: STUDENTS } }));
    const port: CourseStudentsPort = withChange ? { read: reads, change } : { read: reads };
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(HostContext.Provider, { value: HOST }, h(CourseStudents, { courseId: "c1", port }))); });
    return { host, change, reads };
  }
  const click = async (el: Element | undefined) => { await act(async () => { (el as HTMLElement).click(); }); };
  const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label);

  it("asks first, then removes and reads the roster again", async () => {
    const { change, reads } = await mount("done");
    await click(button(t.remove));
    expect(change).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(t.removeTitle("Ana Šarić"));
    await click([...document.querySelectorAll("dialog button")].find((b) => b.textContent === t.remove));
    expect(change).toHaveBeenCalledWith("remove", "c1", STUDENTS[0]!.studentId);
    expect(reads).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-testid="n04-change"]')?.textContent).toBe(t.changeOutcome.removed);
  });

  it("cancel sends nothing; a refusal is said, not hidden; a return is its own action", async () => {
    const { change } = await mount("forbidden");
    await click(button(t.remove));
    await click(button(t.cancel));
    expect(change).not.toHaveBeenCalled();
    await click(button(t.allowReturn));
    await click([...document.querySelectorAll("dialog button")].find((b) => b.textContent === t.allowReturn));
    expect(change).toHaveBeenCalledWith("return", "c1", STUDENTS[0]!.studentId);
    expect(document.querySelector('[role="alert"][data-testid="n04-change"]')?.textContent).toBe(t.changeOutcome.ended);
  });

  it("without a port change there are no buttons", async () => {
    await mount("done", false);
    expect(button(t.remove)).toBeUndefined();
  });
});
