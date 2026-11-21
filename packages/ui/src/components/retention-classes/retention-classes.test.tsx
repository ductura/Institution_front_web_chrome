// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RetentionClasses, type RetentionClassesLabels, type RetentionClassesState } from "./RetentionClasses";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: RetentionClassesLabels = {
  title: "Klase podataka",
  lead: "Ovdje se samo prikazuje; ništa se ne briše.",
  caption: "Klase podataka i rokovi čuvanja",
  colClass: "Klasa",
  colPeriod: "Rok",
  colMode: "Način",
  periodUndecided: "Rok još nije određen",
  period: (days) => `${String(days)} dana`,
  modes: { dry_run: "Probni prolaz", delete: "Briše se" },
  empty: "Nema klasa podataka.",
  loading: "Učitavanje…",
  retry: "Pokušaj ponovno",
};

let root: Root | undefined;
let host: HTMLElement | undefined;
function mount(state: RetentionClassesState, onRetry?: () => void) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<RetentionClasses labels={labels} state={state} onRetry={onRetry} />));
  return host;
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
});
const violations = async (el: Element) => (await axe.run(el, { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } })).violations.map((x) => x.id);

describe("RetentionClasses", () => {
  it("lists the classes with period and mode, and says so when no period is decided", async () => {
    const el = mount({ kind: "ready", classes: [
      { classId: "DATA-CLASS-01", name: "Izmišljeni radni tekst", retentionDays: 365, mode: "delete" },
      { classId: "DATA-CLASS-02", name: "Izmišljeni zapis pristupa", retentionDays: null, mode: "dry_run" },
    ] });
    const rows = [...el.querySelectorAll("tbody tr")].map((r) => [...r.children].map((c) => c.textContent));
    expect(rows).toEqual([["Izmišljeni radni tekst", "365 dana", "Briše se"], ["Izmišljeni zapis pristupa", "Rok još nije određen", "Probni prolaz"]]);
    expect(el.querySelectorAll("button, input, select, textarea")).toHaveLength(0);
    expect(await violations(el)).toEqual([]);
  });

  it("shows the empty state", async () => {
    const el = mount({ kind: "ready", classes: [] });
    expect(el.textContent).toContain(labels.empty);
    expect(await violations(el)).toEqual([]);
  });

  it("shows the given message for an error, never a raw code, and retries", async () => {
    const retry = vi.fn();
    const el = mount({ kind: "error", message: "Čuvanje podataka vidi samo administrator ustanove." }, retry);
    expect(el.querySelector("[role=alert]")?.textContent).toBe("Čuvanje podataka vidi samo administrator ustanove.");
    expect(el.textContent).not.toContain("forbidden");
    act(() => (el.querySelector("button") as HTMLButtonElement).click());
    expect(retry).toHaveBeenCalledTimes(1);
    expect(await violations(el)).toEqual([]);
  });

  it("is busy while loading", () => {
    const el = mount({ kind: "loading" });
    expect(el.querySelector("[aria-busy=true]")).not.toBeNull();
  });
});
