import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Wizard } from "./Wizard";
import { advance, finishCheck, jumpTo, retreat, setValue, startState, type WizardStep } from "./wizard-logic";

type V = { title: string; due: string };
const steps: WizardStep<V>[] = [
  { id: "a", label: "Osnovno", validate: (v): Record<string, string> => (v.title.trim() ? {} : { title: "Upišite naslov." }), render: () => null },
  { id: "b", label: "Rok", validate: (v): Record<string, string> => (v.due ? {} : { due: "Odaberite rok." }), render: () => null },
  { id: "c", label: "Pregled", validate: () => ({}), render: () => null },
];
const labels = { steps: "Koraci", next: "Nastavi", back: "Natrag", finish: "Završi", finishing: "Završavam…" };

describe("wizard logic", () => {
  it("a step with errors cannot be skipped", () => {
    const state = advance(steps, startState<V>({ title: " ", due: "" }));
    expect(state.index).toBe(0);
    expect(state.errors).toEqual({ title: "Upišite naslov." });
  });

  it("a valid step moves on and marks the step as reached", () => {
    const state = advance(steps, startState<V>({ title: "Seminar", due: "" }));
    expect(state).toMatchObject({ index: 1, reached: 1, errors: {} });
  });

  it("going back keeps every entered value, and forward is still checked", () => {
    let state = setValue(startState<V>({ title: "", due: "" }), "title", "Seminar");
    state = advance(steps, state);
    state = setValue(state, "due", "2026-12-01");
    state = retreat(state);
    expect(state.index).toBe(0);
    expect(state.values).toEqual({ title: "Seminar", due: "2026-12-01" });
    expect(advance(steps, state).index).toBe(1);
  });

  it("editing a field clears only that field's error", () => {
    const failed = advance(steps, startState<V>({ title: "", due: "" }));
    expect(setValue(failed, "title", "x").errors).toEqual({});
  });

  it("cannot jump to a step that was never reached", () => {
    const state = startState<V>({ title: "Seminar", due: "2026-12-01" });
    expect(jumpTo(steps, state, 2)).toBe(state);
  });

  it("a jump forward lands on a step that has become invalid", () => {
    let state = advance(steps, advance(steps, startState<V>({ title: "Seminar", due: "2026-12-01" })));
    state = jumpTo(steps, state, 0);
    state = setValue(state, "title", "");
    const moved = jumpTo(steps, state, 2);
    expect(moved.index).toBe(0);
    expect(moved.errors).toEqual({ title: "Upišite naslov." });
  });

  it("finishing re-checks every step and returns to the first failing one", () => {
    const state = { ...startState<V>({ title: "Seminar", due: "" }), index: 2, reached: 2 };
    const check = finishCheck(steps, state);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.state).toMatchObject({ index: 1, errors: { due: "Odaberite rok." } });
    expect(finishCheck(steps, { ...state, values: { title: "Seminar", due: "2026-12-01" } })).toEqual({ ok: true });
  });
});

describe("Wizard markup", () => {
  const html = renderToStaticMarkup(
    <Wizard steps={steps} initialValues={{ title: "", due: "" }} labels={labels} onFinish={async () => ({ ok: true })} />,
  );
  it("lists the steps with the first one current and later ones disabled", () => {
    expect(html).toContain('aria-label="Koraci"');
    expect(html).toContain('aria-current="step"');
    expect(html.match(/<button type="button" class="[^"]*" disabled=""/g)).toHaveLength(2);
  });
  it("starts with the heading of the first step, a next button and no back button", () => {
    expect(html).toContain(">Osnovno</h2>");
    expect(html).toContain("Nastavi");
    expect(html).not.toContain("Natrag");
    expect(html).not.toContain("Završi");
  });
});
