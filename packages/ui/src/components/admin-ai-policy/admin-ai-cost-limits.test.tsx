// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminAiCostLimits, type AdminAiCostLimitsLabels, type AdminAiCostLimitsProps, type AdminAiCostLimitsState, type CostConfigVersion } from "./AdminAiCostLimits";
import { checkLimits, eurToMicro, microToEur } from "./cost-logic";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: AdminAiCostLimitsLabels = {
  title: "Granice troška Asistenta",
  cap: (money) => `Strop operatera: ${money} u razdoblju.`,
  noCap: "Operater još nije objavio strop.",
  money: (eur) => `${eur} EUR`,
  fields: { studentDayMicro: "Dnevna granica po studentu", studentAssignmentDayMicro: "Dnevna granica po studentu i zadatku", reserveMicro: "Iznos rezervacije" },
  amountHint: "Iznos u eurima.",
  invalid: "Upišite iznos veći od 0.",
  aboveCap: (cap) => `Granica ne smije biti veća od stropa operatera (${cap}).`,
  assignmentAboveDay: "Granica po zadatku ne smije biti veća od dnevne granice.",
  notConfigured: "Konfiguracija troška je prazna, pa je Asistent isključen.",
  review: "Pregledaj prije objave",
  previewTitle: "Pregled nove verzije",
  previewNote: "Nova verzija vrijedi od objave.",
  current: "Sada",
  notSet: "nije postavljeno",
  publish: "Objavi novu verziju",
  back: "Natrag na uređivanje",
  publishing: "Objava je u tijeku.",
  published: (n) => `Verzija ${String(n)} je objavljena.`,
  serverAboveCap: "Objava je odbijena: granica je veća od stropa operatera.",
  publishFailed: "Objava nije uspjela.",
  spentTitle: "Potrošnja ustanove",
  spent: (money) => `${money} u tekućem razdoblju`,
  spentNote: "Zbroj za cijelu ustanovu.",
  historyTitle: "Povijest verzija",
  historyEmpty: "Još nema verzija.",
  version: (n, at) => `Verzija ${String(n)} · ${at}`,
  loading: "Granice se učitavaju.",
  loadFailed: "Granice nije bilo moguće učitati.",
  retry: "Pokušaj ponovno",
};

const v = (versionNo: number, day: string, assignment: string, reserve: string): CostConfigVersion => ({
  versionNo, publishedAt: `${String(versionNo)}. 11. 2026.`, studentDayMicro: day, studentAssignmentDayMicro: assignment, reserveMicro: reserve,
});
const ready = (versions: CostConfigVersion[], capMicro: string | null = "5000000"): AdminAiCostLimitsState => ({ kind: "ready", capMicro, spentMicro: "12340000", versions });
const VERSIONS = [v(1, "1000000", "500000", "20000"), v(2, "2000000", "1000000", "20000")];

let root: Root | undefined;
let host: HTMLElement | undefined;
function mount(props: Partial<AdminAiCostLimitsProps> = {}): HTMLElement {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  render(props);
  return host;
}
function render(props: Partial<AdminAiCostLimitsProps>) {
  act(() => root!.render(<AdminAiCostLimits labels={labels} state={ready(VERSIONS)} onPublish={() => undefined} {...props} />));
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
});

const input = (el: HTMLElement, label: string) => {
  const id = [...el.querySelectorAll("label")].find((l) => l.textContent === label)!.htmlFor;
  return document.getElementById(id) as HTMLInputElement;
};
function type(field: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const button = (el: HTMLElement, name: string) => [...el.querySelectorAll("button")].find((b) => b.textContent === name);
const click = (b: HTMLElement | undefined) => act(() => b!.click());
const violations = async (el: Element) => (await axe.run(el, { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } })).violations.map((x) => x.id);

describe("cost-logic", () => {
  it("reads euros with a comma or a dot into micro-euros, past the safe integer range", () => {
    expect(eurToMicro("0,20")).toBe("200000");
    expect(eurToMicro(" 20 ")).toBe("20000000");
    expect(eurToMicro("1.234567")).toBe("1234567");
    expect(eurToMicro("007")).toBe("7000000");
    expect(eurToMicro("90071992547409930")).toBe("90071992547409930000000");
    for (const bad of ["", "abc", "-1", "1e3", "1,2345678", "1,", ",5", "1 000", "1,2,3"]) expect(eurToMicro(bad)).toBeNull();
  });

  it("formats micro-euros with two to six decimals and refuses malformed amounts", () => {
    expect(microToEur("200000")).toBe("0,20");
    expect(microToEur("20000000")).toBe("20,00");
    expect(microToEur("1234567")).toBe("1,234567");
    expect(microToEur("0")).toBe("0,00");
    expect(microToEur("90071992547409930000001")).toBe("90071992547409930,000001");
    for (const bad of ["1.5", "-1", "01", ""]) expect(microToEur(bad)).toBeNull();
    for (const micro of ["1", "200000", "123456789"]) expect(eurToMicro(microToEur(micro)!)).toBe(micro);
  });

  it("checks zero, the cap and the per-assignment limit", () => {
    const draft = (day: string, assignment: string, reserve: string) => ({ studentDayMicro: day, studentAssignmentDayMicro: assignment, reserveMicro: reserve });
    expect(checkLimits(draft("2", "1", "0,02"), "5000000")).toEqual({ limits: { studentDayMicro: "2000000", studentAssignmentDayMicro: "1000000", reserveMicro: "20000" }, errors: {} });
    expect(checkLimits(draft("5", "5", "1"), "5000000").errors).toEqual({});
    expect(checkLimits(draft("5,000001", "1", "1"), "5000000")).toEqual({ limits: null, errors: { studentDayMicro: "limit_above_cap" } });
    expect(checkLimits(draft("6", "6", "1"), "5000000").errors).toEqual({ studentDayMicro: "limit_above_cap", studentAssignmentDayMicro: "limit_above_cap" });
    expect(checkLimits(draft("2", "3", "1"), "5000000").errors).toEqual({ studentAssignmentDayMicro: "assignment_above_day" });
    expect(checkLimits(draft("0", "", "x"), "5000000").errors).toEqual({ studentDayMicro: "invalid", studentAssignmentDayMicro: "invalid", reserveMicro: "invalid" });
    expect(checkLimits(draft("60", "1", "1"), null).errors).toEqual({});
  });
});

describe("AdminAiCostLimits", () => {
  it("prefills the latest version and is axe clean", async () => {
    const el = mount();
    expect(input(el, labels.fields.studentDayMicro).value).toBe("2,00");
    expect(input(el, labels.fields.reserveMicro).value).toBe("0,02");
    expect(el.textContent).toContain("Strop operatera: 5,00 EUR u razdoblju.");
    expect(el.textContent).not.toContain(labels.notConfigured);
    expect(await violations(el)).toEqual([]);
  });

  it("a limit above the cap is an alert on the field and blocks the preview", async () => {
    const onPublish = vi.fn();
    const el = mount({ onPublish });
    const day = input(el, labels.fields.studentDayMicro);
    type(day, "120");
    const alert = el.querySelector('[role="alert"]')!;
    expect(alert.textContent).toBe("Granica ne smije biti veća od stropa operatera (5,00 EUR).");
    expect(day.getAttribute("aria-invalid")).toBe("true");
    expect(day.getAttribute("aria-describedby")).toBe(alert.id);
    const review = button(el, labels.review)!;
    expect(review.getAttribute("aria-disabled")).toBe("true");
    expect(review.getAttribute("aria-describedby")).toBe(alert.id);
    click(review);
    expect(el.textContent).not.toContain(labels.previewTitle);
    expect(button(el, labels.publish)).toBeUndefined();
    expect(onPublish).not.toHaveBeenCalled();
    expect(await violations(el)).toEqual([]);
  });

  it("publishes only after the preview, with exactly the values it shows", async () => {
    const onPublish = vi.fn();
    const el = mount({ onPublish });
    expect(button(el, labels.publish)).toBeUndefined();
    type(input(el, labels.fields.studentDayMicro), "3,5");
    type(input(el, labels.fields.reserveMicro), "0.05");
    click(button(el, labels.review));
    const preview = el.querySelector("section")!;
    expect(preview.textContent).toContain("Dnevna granica po studentu3,50 EUR Sada: 2,00 EUR");
    expect(preview.textContent).toContain("Iznos rezervacije0,05 EUR Sada: 0,02 EUR");
    expect(document.activeElement?.textContent).toBe(labels.previewTitle);
    expect(el.querySelector("input")).toBeNull();
    expect(onPublish).not.toHaveBeenCalled();
    expect(await violations(el)).toEqual([]);
    click(button(el, labels.publish));
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onPublish).toHaveBeenCalledWith({ studentDayMicro: "3500000", studentAssignmentDayMicro: "1000000", reserveMicro: "50000" });
  });

  it("going back drops the preview, and an edit needs a new one", () => {
    const onPublish = vi.fn();
    const el = mount({ onPublish });
    click(button(el, labels.review));
    click(button(el, labels.back));
    expect(document.activeElement?.textContent).toBe(labels.review);
    type(input(el, labels.fields.studentDayMicro), "4");
    expect(button(el, labels.publish)).toBeUndefined();
    click(button(el, labels.review));
    click(button(el, labels.publish));
    expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({ studentDayMicro: "4000000" }));
  });

  it("limit_above_cap from the server is an alert and the publish stays inert", () => {
    const onPublish = vi.fn();
    const el = mount({ onPublish });
    click(button(el, labels.review));
    render({ onPublish, publishError: "limit_above_cap" });
    const alert = el.querySelector('[role="alert"]')!;
    expect(alert.textContent).toBe(labels.serverAboveCap);
    const publish = button(el, labels.publish)!;
    expect(publish.getAttribute("aria-disabled")).toBe("true");
    expect(publish.getAttribute("aria-describedby")).toBe(alert.id);
    click(publish);
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("a new version resets the form and is announced", () => {
    const el = mount();
    type(input(el, labels.fields.studentDayMicro), "4");
    click(button(el, labels.review));
    click(button(el, labels.publish));
    render({ state: ready([...VERSIONS, v(3, "4000000", "1000000", "20000")]) });
    expect(el.querySelector('[role="status"]')?.textContent).toBe("Verzija 3 je objavljena.");
    expect(input(el, labels.fields.studentDayMicro).value).toBe("4,00");
  });

  it("history is newest first and read only", () => {
    const el = mount();
    const history = el.querySelector(`[aria-label="${labels.historyTitle}"]`)!;
    expect([...history.querySelectorAll("li > p")].map((p) => p.textContent)).toEqual(["Verzija 2 · 2. 11. 2026.", "Verzija 1 · 1. 11. 2026."]);
    expect(history.querySelectorAll("input, button, select, textarea, a, [contenteditable], [tabindex]")).toHaveLength(0);
  });

  it("spend is one institution total with no student in it", () => {
    const el = mount();
    const spend = el.querySelector(`[aria-label="${labels.spentTitle}"]`)!;
    expect(spend.textContent).toBe(`${labels.spentTitle}12,34 EUR u tekućem razdoblju${labels.spentNote}`);
    expect(spend.querySelectorAll("li, tr, table, a, button")).toHaveLength(0);
  });

  it("an empty configuration says the assistant is off and asks for every value", () => {
    const el = mount({ state: ready([]) });
    expect(el.textContent).toContain(labels.notConfigured);
    expect(el.textContent).toContain(labels.historyEmpty);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    click(button(el, labels.review));
    expect(el.querySelectorAll('[role="alert"]')).toHaveLength(3);
    expect(button(el, labels.review)?.getAttribute("aria-disabled")).toBe("true");
  });

  it("without a cap the fields are read only and the review is inert, with the reason", async () => {
    const el = mount({ state: ready(VERSIONS, null) });
    expect(input(el, labels.fields.studentDayMicro).readOnly).toBe(true);
    const review = button(el, labels.review)!;
    expect(review.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(review.getAttribute("aria-describedby")!)?.textContent).toBe(labels.noCap);
    click(review);
    expect(button(el, labels.publish)).toBeUndefined();
    expect(await violations(el)).toEqual([]);
  });

  it("loading is busy with one status; a load failure is an alert with retry", async () => {
    const el = mount({ state: { kind: "loading" } });
    expect(el.firstElementChild?.getAttribute("aria-busy")).toBe("true");
    expect(el.querySelector('[role="status"]')?.textContent).toBe(labels.loading);
    const onRetry = vi.fn();
    render({ state: { kind: "load_failed" }, onRetry });
    expect(el.querySelector('[role="alert"]')?.textContent).toBe(labels.loadFailed);
    click(button(el, labels.retry));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(await violations(el)).toEqual([]);
  });
});
