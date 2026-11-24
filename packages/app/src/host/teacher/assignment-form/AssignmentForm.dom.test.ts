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
