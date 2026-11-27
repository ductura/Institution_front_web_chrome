// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuestionnairePanel } from "./Questionnaires";
import { questionnaireMessages as text } from "./messages.hr";
import type { Failure, QuestionnairePort, Result } from "./port";
import type { ListItem, Questionnaire } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const course = "c0000000-0000-4000-8000-000000000001";
const qid = "c0000000-0000-4000-8000-000000000002";
const q1 = "c0000000-0000-4000-8000-000000000003";
const q2 = "c0000000-0000-4000-8000-000000000004";
const item = (state: ListItem["state"], over: Partial<ListItem> = {}): ListItem => ({ id: qid, title: "Izmišljeno istraživanje: navike kompostiranja", state, createdOn: "2026-11-20", questionCount: 2, responseCount: 0, ...over });
const full = (state: Questionnaire["state"]): Questionnaire => ({ id: qid, courseId: course, title: item(state).title, state, questions: [
  { id: q1, order: 1, kind: "single", text: "Kompostirate li?", options: [{ code: "da", label: "Da" }, { code: "ne", label: "Ne" }], scale: null },
  { id: q2, order: 2, kind: "scale", text: "Koliko ste zadovoljni?", options: null, scale: { min: 1, max: 5 } },
] });
const ready = <T,>(value: T): Result<T> => ({ kind: "ready", value });

type Overrides = Partial<QuestionnairePort>;
function fake(overrides: Overrides = {}): QuestionnairePort & { calls: string[] } {
  const calls: string[] = [];
  const port: QuestionnairePort = {
    list: async () => ready([item("draft")]),
    read: async () => ready(full("draft")),
    create: async () => ready(full("draft")),
    change: async () => ready(full("draft")),
    setState: async (_id, state) => ready(state),
    addSheet: async () => ready(null),
    ...overrides,
  };
  const wrapped = Object.fromEntries(Object.entries(port).map(([name, fn]) => [name, (...args: unknown[]) => { calls.push(name); return (fn as (...a: unknown[]) => unknown)(...args); }])) as unknown as QuestionnairePort;
  return Object.assign(wrapped, { calls });
}

let root: Root | null = null;
let host: HTMLElement | null = null;
async function show(port: QuestionnairePort, onSignedOut = () => {}, exportHref?: (id: string) => string) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(QuestionnairePanel, { courseId: course, courseName: "Kolegij A", port, onSignedOut, exportHref })); });
}
const button = (label: string) => {
  const b = [...host!.querySelectorAll("button")].find((x) => x.textContent === label || x.getAttribute("aria-label") === label);
  if (!b) throw new Error(`no button ${label}: ${host!.textContent}`);
  return b;
};
const click = async (label: string) => { await act(async () => { button(label).click(); }); };
const type = async (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
};
const field = (label: string) => {
  const l = [...host!.querySelectorAll("label")].find((x) => x.textContent === label);
  if (!l) throw new Error(`no field ${label}`);
  return document.getElementById(l.htmlFor) as HTMLInputElement;
};
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

describe("questionnaire panel", () => {
  // F4-V18-22-R01: the export screen is reached from the list, for the questionnaires that took responses.
  it("links each open or closed questionnaire to its export, and a draft to none", async () => {
    const href = (id: string) => `/x/nastavnik/upitnici/${id}/izvoz`;
    await show(fake({ list: async () => ready([item("open"), item("draft", { id: q1, title: "Nacrt" })]) }), () => {}, href);
    const links = [...host!.querySelectorAll("a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([href(qid)]);
    expect(links[0]!.getAttribute("aria-label")).toBe(text.actionFor(text.exportResponses, item("open").title));
  });

  it("offers no export link where the page gives no address", async () => {
    await show(fake({ list: async () => ready([item("closed")]) }));
    expect(host!.querySelectorAll("a").length).toBe(0);
  });

  it("shows loading, then the list; a failed read is an error with retry, never 'no questionnaires'", async () => {
    let attempts = 0;
    const port = fake({ list: async () => (++attempts === 1 ? { kind: "unavailable" as Failure } : ready([item("open", { responseCount: 3 })])) });
    await show(port);
    expect(host!.textContent).toContain(text.unavailable);
    expect(host!.textContent).not.toContain(text.empty);
    await click(text.retry);
    expect(host!.textContent).toContain(text.state.open);
    expect(host!.textContent).toContain("Izmišljeno istraživanje");
  });

  it("an empty list says so only after the server answered", async () => {
    await show(fake({ list: async () => ready([]) }));
    expect(host!.textContent).toContain(text.empty);
  });

  it("signed out asks the page to sign in and offers no retry", async () => {
    const out = vi.fn();
    await show(fake({ list: async () => ({ kind: "signedOut" }) }), out);
    expect(out).toHaveBeenCalled();
    expect(host!.textContent).not.toContain(text.signedOut);
    expect(host!.querySelector("[role=alert]")).toBeNull();
    expect([...host!.querySelectorAll("button")].some((b) => b.textContent === text.retry)).toBe(false);
  });

  it("creates a questionnaire only with a valid draft and sends the contract body", async () => {
    const create = vi.fn(async () => ready(full("draft")));
    await show(fake({ create, list: async () => ready([]) }));
    await click(text.newQuestionnaire);
    await click(text.save);
    expect(create).not.toHaveBeenCalled();
    expect(host!.textContent).toContain(text.problem.title);
    await type(field(text.fieldTitle), "Izmišljeni upitnik");
    await click(text.save);
    expect(host!.textContent).toContain(text.problem.text);
    await type(field(text.fieldText), "Kompostirate li?");
    await click(text.save);
    expect(host!.textContent).toContain(text.problem.options);
    await type(field(text.fieldOptions), "Da\nNe");
    await click(text.save);
    expect(create).toHaveBeenCalledWith(course, { title: "Izmišljeni upitnik", questions: [{ kind: "single", text: "Kompostirate li?", options: [{ code: "da", label: "Da" }, { code: "ne", label: "Ne" }] }] });
    expect(host!.textContent).toContain(text.saved);
  });

  it("keeps the form and says so when the server refuses the draft", async () => {
    await show(fake({ list: async () => ready([]), create: async () => ({ kind: "invalid" }) }));
    await click(text.newQuestionnaire);
    await type(field(text.fieldTitle), "T");
    await type(field(text.fieldText), "Pitanje?");
    await type(field(text.fieldOptions), "A\nB");
    await click(text.save);
    expect(host!.textContent).toContain(text.saveInvalid);
    expect(host!.querySelector('[data-testid="questionnaire-form"]')).not.toBeNull();
  });

  it("edits only a draft and patches it", async () => {
    const change = vi.fn(async () => ready(full("draft")));
    await show(fake({ change }));
    await click(text.actionFor(text.edit, item("draft").title));
    await type(field(text.fieldTitle), "Novi naslov");
    await click(text.save);
    expect(change).toHaveBeenCalledWith(qid, expect.objectContaining({ title: "Novi naslov" }));
  });

  it("offers no edit on an open or closed questionnaire", async () => {
    await show(fake({ list: async () => ready([item("open")]) }));
    expect([...host!.querySelectorAll("button")].some((b) => b.textContent === text.edit)).toBe(false);
  });

  it("publishes only after confirmation and shows the state the server holds", async () => {
    let state: ListItem["state"] = "draft";
    const setState = vi.fn(async (_id: string, to: "open" | "closed") => { state = to; return ready(to); });
    await show(fake({ setState, list: async () => ready([item(state)]) }));
    await click(text.actionFor(text.publish, item("draft").title));
    expect(setState).not.toHaveBeenCalled();
    await click(text.cancel);
    expect(setState).not.toHaveBeenCalled();
    await click(text.actionFor(text.publish, item("draft").title));
    await click(text.confirm);
    expect(setState).toHaveBeenCalledWith(qid, "open");
    expect(host!.textContent).toContain(text.published);
    expect(host!.textContent).toContain(text.state.open);
  });

  it("a state conflict re-reads the list and says the state had already changed", async () => {
    let state: ListItem["state"] = "draft";
    const list = vi.fn(async () => ready([item(state)]));
    await show(fake({ list, setState: async () => { state = "closed"; return { kind: "conflict" as Failure }; } }));
    await click(text.actionFor(text.publish, item("draft").title));
    await click(text.confirm);
    expect(host!.textContent).toContain(text.stateConflict);
    expect(list.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("an unknown or foreign questionnaire is 'not found', not a blank form", async () => {
    await show(fake({ read: async () => ({ kind: "notFound" }) }));
    await click(text.actionFor(text.edit, item("draft").title));
    expect(host!.textContent).toContain(text.notFound);
    expect(host!.querySelector('[data-testid="questionnaire-form"]')).toBeNull();
  });

  it("takes a paper sheet only after it checks, and confirms only after the server did", async () => {
    const addSheet = vi.fn(async () => ready(null));
    await show(fake({ addSheet, list: async () => ready([item("open")]), read: async () => ready(full("open")) }));
    await click(text.actionFor(text.manual, item("open").title));
    await click(text.manualSubmit);
    expect(addSheet).not.toHaveBeenCalled();
    expect(host!.textContent).toContain(text.manualProblem.none);
    await type(field("2. Koliko ste zadovoljni?"), "9");
    await click(text.manualSubmit);
    expect(addSheet).not.toHaveBeenCalled();
    expect(host!.textContent).toContain(text.manualProblem.value);
    await type(field("2. Koliko ste zadovoljni?"), "4");
    await type(field("1. Kompostirate li?"), "da");
    await click(text.manualSubmit);
    expect(addSheet).toHaveBeenCalledWith(qid, [{ questionId: q1, value: "da" }, { questionId: q2, value: 4 }]);
    expect(host!.textContent).toContain(text.manualSaved);
  });

  it("a rejected sheet is not reported as saved", async () => {
    await show(fake({ addSheet: async () => ({ kind: "conflict" }), list: async () => ready([item("open")]), read: async () => ready(full("open")) }));
    await click(text.actionFor(text.manual, item("open").title));
    await type(field("2. Koliko ste zadovoljni?"), "3");
    await click(text.manualSubmit);
    expect(host!.textContent).not.toContain(text.manualSaved);
    expect(host!.textContent).toContain(text.manualConflict);
  });

  it("keeps the typed answers when the server rejects the sheet, and clears them after a saved one", async () => {
    let verdict: "conflict" | "ready" = "conflict";
    const addSheet = vi.fn(async (): Promise<Result<null>> => (verdict === "ready" ? ready(null) : { kind: "unavailable" }));
    await show(fake({ addSheet, list: async () => ready([item("open")]), read: async () => ready(full("open")) }));
    await click(text.actionFor(text.manual, item("open").title));
    await type(field("2. Koliko ste zadovoljni?"), "3");
    await click(text.manualSubmit);
    expect(field("2. Koliko ste zadovoljni?").value).toBe("3");
    verdict = "ready";
    await click(text.manualSubmit);
    expect(host!.textContent).toContain(text.manualSaved);
    expect(field("2. Koliko ste zadovoljni?").value).toBe("");
  });

  it("refuses manual entry for a draft that was read as one", async () => {
    await show(fake({ list: async () => ready([item("open")]), read: async () => ready(full("draft")) }));
    await click(text.actionFor(text.manual, item("open").title));
    expect(host!.textContent).toContain(text.manualOpen);
    expect(host!.querySelector('[data-testid="questionnaire-sheet"]')).toBeNull();
  });
});
