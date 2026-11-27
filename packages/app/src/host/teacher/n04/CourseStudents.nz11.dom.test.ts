// @vitest-environment jsdom
// NZ-11 on the screen: the state filter and the order narrow and reorder the list, "Nije započelo n" stays.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { HostContext, type HostValue } from "../../context";
import CourseStudents from "./CourseStudents";
import { courseStudentsMessages as t } from "./messages.hr";
import type { CourseStudentsPort, RosterStudent } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const HOST = { base: "/aplikacija", page: { path: "/nastavnik" }, role: "teacher" } as unknown as HostValue;
const w = (status: "submitted" | "writing" | "not_submitted", extra = {}) => ({ assignmentId: "a", title: "T", workType: "essay", status, ...extra });
const STUDENTS: RosterStudent[] = [
  { studentId: "1", name: "Ana Šarić", group: null, works: [w("submitted", { afterDeadline: true })] },
  { studentId: "2", name: "Ivan Babić", group: null, works: [w("not_submitted")] },
  { studentId: "3", name: "Marta Čović", group: null, works: [w("writing")] },
];
const port: CourseStudentsPort = { read: async () => ({ kind: "ready", data: { courseName: "Izmišljeni kolegij", students: STUDENTS } }) };

describe("CourseStudents filters (NZ-11)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  const choose = async (host: HTMLElement, label: string, value: string) => {
    const field = [...host.querySelectorAll("label")].find((l) => l.textContent === label)!;
    const select = document.getElementById(field.getAttribute("for")!) as HTMLSelectElement;
    await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
  };
  const shown = (host: HTMLElement) => [...host.querySelectorAll('[data-testid="n04-student"] .title')].map((e) => e.textContent);

  it("filters by state, orders by state and says how many have not started", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(HostContext.Provider, { value: HOST }, h(CourseStudents, { courseId: "c1", port }))); });
    expect(host.querySelector('[data-testid="n04-not-started"]')?.textContent).toBe(t.notStartedCount(1));
    expect(shown(host)).toEqual(["Ivan Babić", "Marta Čović", "Ana Šarić"]);
    await choose(host, t.stateLabel, "late");
    expect(shown(host)).toEqual(["Ana Šarić"]);
    await choose(host, t.stateLabel, "revision");
    expect(shown(host)).toEqual([]);
    expect(host.textContent).toContain(t.noMatch);
    await choose(host, t.stateLabel, "");
    await choose(host, t.orderLabel, "state");
    expect(shown(host)).toEqual(["Ivan Babić", "Marta Čović", "Ana Šarić"]);
  });
});
