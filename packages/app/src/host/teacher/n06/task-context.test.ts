// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Context } from "../work/review/model";
import { workFrameMessages as text } from "./messages.hr";
import { duePassed } from "./model";
import { taskHeading, useTaskCrumb, type WorkContext } from "./task-context";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../work/review/read", () => ({ readContext: async () => null }));

const context: Context = { course: "Izmišljeni kolegij", title: "Izmišljeni esej", workType: "essay", dueAt: "2026-12-01T22:59:00.000Z" };

describe("taskHeading (F4-NAS-R12)", () => {
  it("names the student, the kind of work and the title", () => {
    expect(taskHeading("Ana Izmišljenić", context)).toBe("Ana Izmišljenić · Esej „Izmišljeni esej”");
    expect(taskHeading("Ana Izmišljenić", { ...context, workType: "master_thesis" })).toBe("Ana Izmišljenić · Diplomski rad „Izmišljeni esej”");
  });
  it("keeps the plain kind and no title without the assignment (B-6)", () => {
    expect(taskHeading("Ana Izmišljenić", null)).toBe(`Ana Izmišljenić · ${text.workKind}`);
  });
  it("says the name is unavailable rather than inventing one", () => {
    expect(taskHeading(null, context)).toBe(`${text.noName} · Esej „Izmišljeni esej”`);
  });
});

describe("duePassed (NAS-R05 with F4-NAS-R12)", () => {
  const now = Date.parse("2026-11-26T12:00:00.000Z");
  it("compares the due date with now", () => {
    expect(duePassed("2026-11-25T12:00:00.000Z", now)).toBe(true);
    expect(duePassed("2026-11-27T12:00:00.000Z", now)).toBe(false);
  });
  it("is unknown without a date or with one that is not a date", () => {
    expect(duePassed(undefined, now)).toBeNull();
    expect(duePassed("nije datum", now)).toBeNull();
  });
});

let root: Root | null = null;
let el: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); el?.remove(); root = null; el = null; });

async function crumbOf(read: (id: string) => Promise<WorkContext | null>): Promise<string> {
  function Probe() { return h("p", null, useTaskCrumb("d1", read) ?? "(bez retka)"); }
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  await act(async () => { root!.render(h(Probe)); });
  return el.textContent ?? "";
}

describe("useTaskCrumb (F4-NAS-R12)", () => {
  it("gives the heading line once the work and its assignment are read", async () => {
    const read = vi.fn(async () => ({ studentName: "Ana Izmišljenić", context }));
    expect(await crumbOf(read)).toBe("Ana Izmišljenić · Esej „Izmišljeni esej”");
    expect(read).toHaveBeenCalledWith("d1");
  });
  it("gives the plain kind when the course list does not name the assignment", async () => {
    expect(await crumbOf(async () => ({ studentName: "Ana Izmišljenić", context: null }))).toBe(`Ana Izmišljenić · ${text.workKind}`);
  });
  it("gives nothing when the work cannot be read, so the page keeps its own line", async () => {
    expect(await crumbOf(async () => null)).toBe("(bez retka)");
  });
});
