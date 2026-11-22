// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LegalHolds, type LegalHold, type LegalHoldsLabels, type LegalHoldsProps } from "./LegalHolds";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: LegalHoldsLabels = {
  title: "Pravna zadržavanja", lead: "Zadržavanje zaustavlja brisanje.", listTitle: "Aktivna zadržavanja", empty: "Nema aktivnih zadržavanja.",
  loading: "Učitavanje…", retry: "Pokušaj ponovno",
  placedBy: (name, at) => `Postavio/la: ${name}, ${at}`, placedOn: (at) => `Postavljeno: ${at}`, reference: (ref) => `Referenca slučaja: ${ref}`,
  placeTitle: "Postavi zadržavanje", subjectType: "Vrsta predmeta", subjectTypes: { work: "Rad", student: "Student", assignment: "Zadatak" },
  subjectTypePlaceholder: "Odaberite…", subjectTypeMissing: "Odaberite vrstu predmeta.", subject: "Predmet", subjectHint: "Što se zadržava.", caseReference: "Referenca slučaja", caseReferenceHint: "Broj slučaja.",
  subjectMissing: "Upišite predmet.", caseReferenceMissing: "Upišite referencu slučaja.", place: "Postavi zadržavanje", placing: "Postavljam…",
  release: "Skini zadržavanje", releaseOwn: "Zadržavanje koje ste postavili skida drugi administrator ili operater.",
  releaseTitle: (s) => `Skidanje zadržavanja: ${s}`, reason: "Razlog skidanja", reasonHint: "Upisuje se u zapis.", reasonMissing: "Upišite razlog.",
  confirmRelease: "Skini", releasing: "Skidam…", cancel: "Odustani",
};
const hold = (over: Partial<LegalHold>): LegalHold => ({
  id: "b1301000-0000-4000-8000-000000000001", subject: "Izmišljeni kolegij za test", caseReference: "IZM-2026-001",
  placedAt: "20. 11. 2026.", placedByName: "Ana Izmišljena", own: false, ...over,
});

let root: Root | undefined;
let host: HTMLElement | undefined;
function mount(props: Partial<LegalHoldsProps> = {}) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<LegalHolds labels={labels} state={{ kind: "ready", holds: [] }} onPlace={() => undefined} onRelease={() => undefined} {...props} />));
  return host;
}
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
});
const violations = async (el: Element) => (await axe.run(el, { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } })).violations.map((x) => x.id);
const field = (el: HTMLElement, label: string) => {
  const id = [...el.querySelectorAll("label")].find((l) => l.textContent === label)!.htmlFor;
  return document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
};
function choose(el: HTMLElement, label: string, value: string) {
  const select = document.getElementById([...el.querySelectorAll("label")].find((l) => l.textContent === label)!.htmlFor) as HTMLSelectElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
function type(f: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = f instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(f, value);
    f.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const button = (el: HTMLElement, name: string) => [...el.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLButtonElement | undefined;
const submit = (form: HTMLFormElement) => act(() => form.requestSubmit());

describe("LegalHolds", () => {
  it("shows the empty state, and the place form has labelled fields (axe clean)", async () => {
    const el = mount();
    expect(el.textContent).toContain(labels.empty);
    expect(field(el, "Predmet")).toBeTruthy();
    expect(field(el, "Vrsta predmeta")).toBeTruthy();
    expect(field(el, "Predmet").maxLength).toBe(256);
    expect(field(el, "Referenca slučaja").maxLength).toBe(120);
    expect(field(el, "Referenca slučaja")).toBeTruthy();
    expect(await violations(el)).toEqual([]);
  });

  it("lists the holds with reference and placer", async () => {
    const el = mount({ state: { kind: "ready", holds: [hold({}), hold({ id: "b1301000-0000-4000-8000-000000000002", subject: "Drugi izmišljeni predmet", caseReference: "IZM-2026-002" })] } });
    expect(el.querySelectorAll("li")).toHaveLength(2);
    expect(el.textContent).toContain("Referenca slučaja: IZM-2026-001");
    expect(el.textContent).toContain("Postavio/la: Ana Izmišljena, 20. 11. 2026.");
    expect(await violations(el)).toEqual([]);
  });

  it("shows only the time for a hold whose placer has no name", () => {
    const el = mount({ state: { kind: "ready", holds: [hold({ placedByName: undefined })] } });
    expect(el.textContent).toContain("Postavljeno: 20. 11. 2026.");
    expect(el.textContent).not.toContain("Postavio/la");
  });

  it("shows the given message for an error, not a raw code, and retries", () => {
    const retry = vi.fn();
    const el = mount({ state: { kind: "error", message: "Pravna zadržavanja vidi samo administrator ustanove." }, onRetry: retry });
    expect(el.querySelector("[role=alert]")?.textContent).toBe("Pravna zadržavanja vidi samo administrator ustanove.");
    act(() => button(el, "Pokušaj ponovno")!.click());
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("refuses an empty place form beside its fields, then sends the trimmed values", async () => {
    const onPlace = vi.fn();
    const el = mount({ onPlace });
    const form = el.querySelectorAll("form")[0] as HTMLFormElement;
    submit(form);
    expect(onPlace).not.toHaveBeenCalled();
    expect(el.textContent).toContain("Odaberite vrstu predmeta.");
    expect(el.textContent).toContain("Upišite predmet.");
    expect(el.textContent).toContain("Upišite referencu slučaja.");
    expect(field(el, "Predmet").getAttribute("aria-invalid")).toBe("true");
    expect(await violations(el)).toEqual([]);
    type(field(el, "Predmet"), "  rad-izm-9  ");
    type(field(el, "Referenca slučaja"), " IZM-2026-009 ");
    submit(form);
    expect(onPlace).not.toHaveBeenCalled();
    choose(el, "Vrsta predmeta", "work");
    submit(form);
    expect(onPlace).toHaveBeenCalledWith({ subjectType: "work", subjectId: "rad-izm-9", caseReference: "IZM-2026-009" });
  });

  it("shows an action error from the server catalogue under the form", () => {
    const el = mount({ actionError: "Za ovaj račun nije dopušteno postavljanje zadržavanja." });
    expect(el.querySelector("[role=alert]")?.textContent).toBe("Za ovaj račun nije dopušteno postavljanje zadržavanja.");
  });

  it("releases someone else's hold only with a reason", async () => {
    const onRelease = vi.fn();
    const el = mount({ state: { kind: "ready", holds: [hold({})] }, onRelease });
    act(() => button(el, "Skini zadržavanje")!.click());
    const form = el.querySelector("form[aria-label^='Skidanje']") as HTMLFormElement;
    submit(form);
    expect(onRelease).not.toHaveBeenCalled();
    expect(el.textContent).toContain("Upišite razlog.");
    expect(await violations(el)).toEqual([]);
    type(field(el, "Razlog skidanja"), " Slučaj je zatvoren. ");
    submit(form);
    expect(onRelease).toHaveBeenCalledWith("b1301000-0000-4000-8000-000000000001", "Slučaj je zatvoren.");
  });

  it("cancels the release form with its button", () => {
    const el = mount({ state: { kind: "ready", holds: [hold({})] } });
    act(() => button(el, "Skini zadržavanje")!.click());
    act(() => button(el, "Odustani")!.click());
    expect(el.querySelector("form[aria-label^='Skidanje']")).toBeNull();
    expect(button(el, "Skini zadržavanje")).toBeTruthy();
  });

  it("disables releasing the own hold with an explanation, and it does nothing", async () => {
    const onRelease = vi.fn();
    const el = mount({ state: { kind: "ready", holds: [hold({ own: true })] }, onRelease });
    const release = button(el, "Skini zadržavanje")!;
    expect(release.getAttribute("aria-disabled")).toBe("true");
    const note = document.getElementById(release.getAttribute("aria-describedby")!)!;
    expect(note.textContent).toBe(labels.releaseOwn);
    act(() => release.click());
    expect(el.querySelector("form[aria-label^='Skidanje']")).toBeNull();
    expect(onRelease).not.toHaveBeenCalled();
    expect(await violations(el)).toEqual([]);
  });

  it("does nothing while busy", () => {
    const onPlace = vi.fn();
    const el = mount({ busy: true, onPlace });
    choose(el, "Vrsta predmeta", "student");
    type(field(el, "Predmet"), "x");
    type(field(el, "Referenca slučaja"), "y");
    submit(el.querySelectorAll("form")[0] as HTMLFormElement);
    expect(onPlace).not.toHaveBeenCalled();
  });
});
