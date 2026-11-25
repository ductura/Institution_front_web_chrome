// @vitest-environment jsdom
// NZ-3 and NZ-4 in the form: groups, summary-only and tools reach the create body, the switches are set after the answer.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HostContext, type HostValue } from "../../context";
import AssignmentForm from "./AssignmentForm";
import { assignmentFormHr as f } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const HOST = { base: "/app/web", page: { path: "/nastavnik" }, role: "teacher" } as unknown as HostValue;
const course = { id: "c1", name: "Izmišljeni kolegij", academicYear: "2026./2027.", aiPolicy: "partially_allowed" } as const;
const groups = { kind: "ready", groups: [{ id: "g1", name: "Grupa A" }, { id: "g2", name: "Grupa B" }] } as const;

describe("AssignmentForm flow (NZ-3, NZ-4)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  async function mount(props: Record<string, unknown>) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(HostContext.Provider, { value: HOST }, h(AssignmentForm, { course, ...props } as never))); });
    return host;
  }
  const typeInto = async (el: HTMLInputElement, value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };
  const box = (name: string, value: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)!;
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label)!;
  const fillBasics = async (host: HTMLElement) => {
    await typeInto([...host.querySelectorAll("input")].find((i) => i.maxLength === 160)!, "Izmišljeni seminar");
    const when = host.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    await typeInto(when[0]!, "2027-01-10T10:00");
    await typeInto(when[1]!, "2027-01-30T16:00");
  };

  it("sends the narrowed groups, summary-only and no outside tools, then sets the changed switches", async () => {
    const publish = vi.fn(async () => ({ kind: "available" as const, id: "a-new" }));
    const setRules = vi.fn(async () => []);
    const host = await mount({ publish, setRules, loadGroups: async () => groups });
    await fillBasics(host);
    await click(box("groups", "g2"));
    await click(box("ai", "summary"));
    await click(box("tools", "no"));
    await click(box("pr-withdrawal", "off"));
    await click(button(f.review));
    expect(document.body.textContent).toContain("Grupa A");
    expect(document.body.textContent).not.toContain("Grupa B");
    await click(button(f.publish));
    const body = (publish.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
    expect(body).toMatchObject({ groupIds: ["g1"], aiSummaryOnly: true, externalToolsAllowed: false, aiPurposes: ["literature_search"] });
    expect(setRules).toHaveBeenCalledWith("a-new", expect.objectContaining({ withdrawal: false, declarationRequired: true }));
  });

  it("sends no groupIds with every group ticked and asks for one when none is", async () => {
    const publish = vi.fn(async () => ({ kind: "available" as const, id: "a-new" }));
    const host = await mount({ publish, setRules: async () => [], loadGroups: async () => groups });
    await fillBasics(host);
    await click(box("groups", "g1"));
    await click(box("groups", "g2"));
    await click(button(f.review));
    expect(document.body.textContent).toContain(f.errors.groups);
    await click(box("groups", "g1"));
    await click(box("groups", "g2"));
    await click(button(f.review));
    await click(button(f.publish));
    expect(publish.mock.calls[0]).toBeTruthy();
    expect((publish.mock.calls[0] as unknown as [string, Record<string, unknown>])[1]).not.toHaveProperty("groupIds");
  });

  it("says when a switch could not be set after publishing", async () => {
    const host = await mount({ publish: async () => ({ kind: "available" as const, id: "a-new" }), setRules: async () => ["declaration"], loadGroups: async () => ({ kind: "ready", groups: [] }) });
    await fillBasics(host);
    await click(box("pr-declaration", "off"));
    await click(button(f.review));
    await click(button(f.publish));
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(f.submitRules.failed.declaration);
  });

  it("says the groups cannot be read and still lets the assignment go to everyone", async () => {
    const host = await mount({ publish: vi.fn(), loadGroups: async () => ({ kind: "unavailable" }) });
    expect(host.textContent).toContain(f.groups.unavailable);
  });
});

describe("AssignmentForm rubric (WEB-V17-RUBRIC-FORM)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };
  const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label)!;

  async function start(props: Record<string, unknown>) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(HostContext.Provider, { value: HOST }, h(AssignmentForm, { course, loadGroups: async () => ({ kind: "ready", groups: [] }), ...props } as never))); });
    await type([...host.querySelectorAll("input")].find((i) => i.maxLength === 160)!, "Izmišljeni seminar");
    const when = host.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    await type(when[0]!, "2027-01-10T10:00");
    await type(when[1]!, "2027-01-30T16:00");
    return host;
  }

  it("blocks the review while a criterion is incomplete, then saves the rubric after publishing", async () => {
    const publish = vi.fn(async () => ({ kind: "available" as const, id: "a-new" }));
    const setRubricFor = vi.fn(async () => "saved" as const);
    const host = await start({ publish, setRules: async () => [], setRubricFor });
    await click(button("Dodaj kriterij"));
    await click(button(f.review));
    expect(host.textContent).toContain("Rubrika nije potpuna");
    expect(host.querySelector("#zs-rubric")).not.toBeNull();
    expect(publish).not.toHaveBeenCalled();
    await type(host.querySelector<HTMLInputElement>('input[maxlength="120"]')!, "Struktura");
    for (const input of host.querySelectorAll<HTMLInputElement>('input[maxlength="80"]')) await type(input, "Razina");
    await click(button(f.review));
    await click(button(f.publish));
    expect(publish).toHaveBeenCalledTimes(1);
    expect(setRubricFor).toHaveBeenCalledTimes(1);
    const [id, sent] = setRubricFor.mock.calls[0] as unknown as [string, { title: string }[]];
    expect(id).toBe("a-new");
    expect(sent[0]!.title).toBe("Struktura");
  });

  it("publishes without a rubric and says so when the rubric is not saved", async () => {
    const publish = async () => ({ kind: "available" as const, id: "a-new" });
    const none = vi.fn(async () => "none" as const);
    await start({ publish, setRules: async () => [], setRubricFor: none });
    await click(button(f.review));
    const review = [...document.querySelectorAll("dt")].find((dt) => dt.textContent === "Kriteriji");
    expect(review?.nextElementSibling?.textContent).toBe("Zadani");
    await click(button(f.publish));
    expect(none).toHaveBeenCalledTimes(1);
    expect(none).toHaveBeenCalledWith("a-new", []);
    expect(document.body.textContent).not.toContain("Rubrika nije spremljena");
    act(() => root?.unmount()); document.body.innerHTML = "";
    const host = await start({ publish, setRules: async () => [], setRubricFor: async () => "conflict" as const });
    await click(button("Dodaj kriterij"));
    await type(host.querySelector<HTMLInputElement>('input[maxlength="120"]')!, "Struktura");
    for (const input of host.querySelectorAll<HTMLInputElement>('input[maxlength="80"]')) await type(input, "Razina");
    await click(button(f.review));
    await click(button(f.publish));
    expect(document.body.textContent).toContain("Rubrika nije spremljena");
  });
});
