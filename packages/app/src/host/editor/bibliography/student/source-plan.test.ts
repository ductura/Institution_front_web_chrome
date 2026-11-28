// ED-117 (prototype sources2.js srcPlan): "Planirano za poglavlja". Invented texts only.
import { expect, it } from "vitest";

import { helpDocumentOf } from "../../left/chapter-help";
import { bibSources } from "./bibliography-model";
import { planChapters, planGaps, plannedChapters, readPlan, togglePlan, writePlan } from "./source-plan";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const book = (id: string, title: string, family: string) => ({
  id, type: "book", authors: [{ kind: "person", family, given: "Ana" }], year: 2019, title, place: "Zagreb", publisher: "Naklada",
});
const cite = (sourceId: string) => ({ type: "citation", attrs: { sourceId, locator: "14" } });
const par = (...content: object[]) => ({ type: "paragraph", content });
const h = (level: number, text: string, id?: string) => ({ type: "heading", attrs: { level, ...(id ? { id } : {}) }, content: [{ type: "text", text }] });
const doc = (content: object[]) => ({ type: "doc", attrs: { sources: [book(A, "Prvi", "Kovač"), book(B, "Drugi", "Horvat")] }, content });

const work = doc([
  h(1, "Naslov rada"), par(cite(B)),
  h(2, "Uvod"), par(cite(A)),
  h(2, "Metoda"), h(3, "Uzorak"), par(cite(B)),
  h(2, "Zaključak"),
]);

const memory = () => {
  const values = new Map<string, string>();
  return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, v), values };
};

it("reads the chapters with the sources each cites, subchapters included and the title left out", () => {
  const chapters = planChapters(work);
  expect(chapters.map((c) => [c.number, c.title, [...c.cited]])).toEqual([["1", "Uvod", [A]], ["2", "Metoda", [B]], ["3", "Zaključak", []]]);
  expect(chapters.map((c) => c.id)).toEqual(helpDocumentOf(work).chapters.filter((c) => c.level === 2).map((c) => c.id));
});

it("adds and removes a chapter for a source and leaves no key when nothing is planned", () => {
  const one = togglePlan({}, A, "x");
  expect(togglePlan(one, A, "y")).toEqual({ [A]: ["x", "y"] });
  expect(togglePlan(one, A, "x")).toEqual({});
  expect(togglePlan(one, B, "x")).toEqual({ [A]: ["x"], [B]: ["x"] });
});

it("lists the planned sources a chapter does not cite yet, in document order", () => {
  const chapters = planChapters(work);
  const [uvod, metoda, zakljucak] = chapters.map((c) => c.id) as [string, string, string];
  const plan = { [A]: [zakljucak, uvod, "nestalo"], [B]: [metoda, zakljucak] };
  expect(plannedChapters(plan, A, chapters).map((c) => c.number)).toEqual(["1", "3"]);
  const gaps = planGaps(plan, chapters, bibSources(work));
  expect(gaps.map((g) => [g.chapter.title, g.sources.map((s) => s.label)])).toEqual([["Zaključak", ["Kovač (2019)", "Horvat (2019)"]]]);
});

it("keeps the plan on the device per work and drops what it cannot read", () => {
  const store = memory();
  writePlan("w1", { [A]: ["x"] }, store);
  expect(readPlan("w1", store)).toEqual({ [A]: ["x"] });
  expect(readPlan("w2", store)).toEqual({});
  store.setItem("ductura.editor.source-plan:w3", JSON.stringify({ [A]: ["x", "x", 4, ""], [B]: "x", c: [] }));
  expect(readPlan("w3", store)).toEqual({ [A]: ["x"] });
  store.setItem("ductura.editor.source-plan:w4", "{");
  expect(readPlan("w4", store)).toEqual({});
  expect(readPlan("w1", null)).toEqual({});
});
