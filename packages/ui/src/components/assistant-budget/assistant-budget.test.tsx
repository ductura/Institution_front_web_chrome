// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { AssistantBudget, type AssistantBudgetLabels, type AssistantBudgetState } from "./AssistantBudget";
import { budgetShare } from "./budget-logic";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: AssistantBudgetLabels = {
  assignmentToday: "Danas na ovom zadatku",
  allToday: "Danas na svim zadacima",
  smallerPart: "Manji dio granice",
  largerPart: "Veći dio granice",
  usedUp: "Granica iskorištena",
  barSmaller: "Iskorišten manji dio današnje granice",
  barLarger: "Iskorišten veći dio današnje granice",
  barFull: "Današnja granica je iskorištena",
  resets: "Brojač se vraća na nulu sutra.",
  near: "Većina današnje granice je iskorištena.",
  assignmentReached: "Za ovaj zadatak danas ste iskoristili granicu.",
  dayReached: "Danas ste iskoristili granicu na svim zadacima.",
  serviceReached: "Asistent je trenutačno privremeno nedostupan svima.",
  serviceNote: "Pisanje i predaja ne ovise o Asistentu.",
  disabled: "Asistent na ovom zadatku nije uključen.",
  loading: "Brojač se učitava.",
  send: "Pošalji Asistentu",
};

let root: Root | undefined;
let host: HTMLElement | undefined;
function mount(state: AssistantBudgetState): HTMLElement {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<AssistantBudget labels={labels} state={state} />));
  return host;
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
});

const usage = (usedMicro: string, limitMicro: string): AssistantBudgetState => ({ kind: "usage", usedMicro, limitMicro });
const violations = async (el: Element) => (await axe.run(el, { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } })).violations.map((v) => v.id);

describe("budgetShare", () => {
  it("bands at half, four fifths and the limit, exactly at the boundary", () => {
    expect(budgetShare("0", "1000")).toEqual({ percent: 0, band: "small" });
    expect(budgetShare("499", "1000")).toEqual({ percent: 49, band: "small" });
    expect(budgetShare("500", "1000")).toEqual({ percent: 50, band: "large" });
    expect(budgetShare("799", "1000")).toEqual({ percent: 79, band: "large" });
    expect(budgetShare("800", "1000")).toEqual({ percent: 80, band: "near" });
    expect(budgetShare("999", "1000")).toEqual({ percent: 99, band: "near" });
    expect(budgetShare("1000", "1000")).toEqual({ percent: 100, band: "full" });
    expect(budgetShare("1500", "1000")).toEqual({ percent: 100, band: "full" });
  });

  it("works past the safe integer range without rounding", () => {
    const limit = "90071992547409930";
    expect(budgetShare("72057594037927944", limit)?.band).toBe("near");
    expect(budgetShare("72057594037927943", limit)?.band).toBe("large");
  });

  it("refuses anything that is not a whole micro-euro string, and a zero limit", () => {
    for (const [used, limit] of [["1.5", "10"], ["-1", "10"], ["1e3", "10"], ["", "10"], ["01", "10"], [" 1", "10"], ["1", "0"], ["1", "abc"]]) {
      expect(budgetShare(used!, limit!)).toBeNull();
    }
  });
});

describe("AssistantBudget", () => {
  it("B1 shows only the share, never an amount, with the reset note", async () => {
    const el = mount(usage("123456", "1000000"));
    expect(el.textContent).toContain("Manji dio granice");
    expect(el.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe(labels.barSmaller);
    expect(el.textContent).toContain(labels.resets);
    expect(el.textContent).not.toMatch(/[0-9€]/u);
    expect(el.querySelector('[role="alert"], button')).toBeNull();
    expect(await violations(el)).toEqual([]);
  });

  it("B2 near the limit announces it as a status", () => {
    const el = mount(usage("900000", "1000000"));
    expect(el.textContent).toContain("Veći dio granice");
    expect(el.querySelector('[role="status"]')?.textContent).toBe(labels.near);
    expect(el.textContent).not.toMatch(/[0-9€]/u);
  });

  it("B3 at the limit, from usage or from budget_exceeded, is an alert with an inert send", () => {
    for (const state of [usage("1000000", "1000000"), { kind: "budget_exceeded", scope: "assignment" } as const]) {
      const html = renderToStaticMarkup(<AssistantBudget labels={labels} state={state} />);
      expect(html).toMatch(/role="alert"[^>]*>Za ovaj zadatak danas ste iskoristili granicu\./u);
      expect(html).toMatch(/aria-label="Današnja granica je iskorištena"/u);
      expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Pošalji Asistentu/u);
    }
  });

  it("B4, B5 and ai_disabled say why sending is not possible and the send button points at it", async () => {
    for (const [state, text] of [
      [{ kind: "budget_exceeded", scope: "day" }, labels.dayReached],
      [{ kind: "budget_exceeded", scope: "service" }, labels.serviceReached],
      [{ kind: "ai_disabled" }, labels.disabled],
    ] as const) {
      const el = mount(state);
      const alert = el.querySelector('[role="alert"]');
      expect(alert?.textContent).toBe(text);
      const send = el.querySelector("button");
      expect(send?.getAttribute("aria-disabled")).toBe("true");
      expect(send?.getAttribute("aria-describedby")).toBe(alert?.id);
      expect(el.querySelector('[role="img"]')).toBeNull();
      expect(await violations(el)).toEqual([]);
      act(() => root?.unmount());
      host?.remove();
      root = undefined;
    }
  });

  it("B5 never presents the service limit as the student's own use", () => {
    const html = renderToStaticMarkup(<AssistantBudget labels={labels} state={{ kind: "budget_exceeded", scope: "service" }} />);
    expect(html).not.toContain(labels.assignmentToday);
    expect(html).not.toContain(labels.allToday);
    expect(html).toContain(labels.serviceNote);
  });

  it("B6 loading is busy, with one status and the bars hidden", () => {
    const el = mount({ kind: "loading" });
    expect(el.firstElementChild?.getAttribute("aria-busy")).toBe("true");
    expect(el.querySelector('[role="status"]')?.textContent).toBe(labels.loading);
    expect(el.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it("malformed amounts show no share at all", () => {
    const el = mount(usage("12.5", "1000000"));
    expect(el.querySelector('[role="img"]')).toBeNull();
    expect(el.textContent).toBe(labels.resets);
  });

  it("the counter is not in the focus order", () => {
    const el = mount(usage("900000", "1000000"));
    expect(el.querySelectorAll("button, [tabindex], a, input")).toHaveLength(0);
  });
});
