// @vitest-environment jsdom
// ED-117 (prototype sources2.js s2Plan): the "Planirano za poglavlja" row of a source. Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import type { BibSource } from "./bibliography-model";
import { bibliographyStudentHr as t } from "./messages.hr";
import type { PlanChapter } from "./source-plan";
import { PlanRow } from "./StudentBibliographyHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

const source: BibSource = { id: "s1", label: "Kovač (2019)", type: "book", title: "Prvi", raw: {} };
const chapters: PlanChapter[] = [
  { id: "c1", number: "1", title: "Uvod", cited: new Set() },
  { id: "c2", number: "2", title: "Metoda", cited: new Set() },
];

function mount(plan: Record<string, string[]>, editable: boolean, onFlip = vi.fn()) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(h(PlanRow, { source, plan, chapters, editable, onFlip })));
  return { host, onFlip };
}

it("removes a planned chapter with its chip and adds another from the list", () => {
  const { host, onFlip } = mount({ s1: ["c2"] }, true);
  const chip = host.querySelector(`button[aria-label="${t.planRemove("2", source.label)}"]`) as HTMLButtonElement;
  expect(chip.textContent).toBe(t.planChip("2"));
  act(() => chip.click());
  expect(onFlip).toHaveBeenLastCalledWith("s1", "c2");
  const select = host.querySelector("select") as HTMLSelectElement;
  expect([...select.options].map((o) => o.textContent)).toEqual([t.planPick, t.planChapter("1", "Uvod")]);
  act(() => { select.value = "c1"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(onFlip).toHaveBeenLastCalledWith("s1", "c1");
});

it("read only shows the plan without changing it and says when nothing is planned", () => {
  const { host } = mount({}, false);
  expect(host.querySelector("select")).toBeNull();
  expect(host.textContent).toContain(t.planNone);
  act(() => root?.unmount());
  const again = mount({ s1: ["c1"] }, false).host;
  expect((again.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
  expect(again.textContent).not.toContain(t.planNone);
});
