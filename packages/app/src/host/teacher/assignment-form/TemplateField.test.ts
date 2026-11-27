// @vitest-environment jsdom
// WEB-V17-TEMPLATE-PICK: the template switch of the assignment form, its two routes and the mounting in the form.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HostContext, type HostValue } from "../../context";
import AssignmentForm from "./AssignmentForm";
import { assignmentFormHr as f, templateFieldHr as t } from "./messages.hr";
import { readOutline, saveTemplate, TemplateField, type Outline } from "./TemplateField";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type Call = Parameters<typeof saveTemplate>[0];
const callOf = (answer: (id: string, input: { body?: unknown }) => unknown) =>
  vi.fn(async (id: string, input: { body?: unknown }) => answer(id, input)) as unknown as Call & ReturnType<typeof vi.fn>;
const HOST = { base: "/aplikacija", page: { path: "/nastavnik" }, role: "teacher" } as unknown as HostValue;
const course = { id: "c1", name: "Izmišljeni kolegij", academicYear: "2026./2027.", aiPolicy: "partially_allowed" } as const;
// Invented outline.
const outline: Outline = { version: 3, titlePage: ["title", "author"], sections: [{ title: "Uvod", hint: "Tema i cilj" }, { title: "Zaključak", hint: "" }] };

describe("saveTemplate (teacher.assignment-template.put)", () => {
  it("sends nothing while the switch is off", async () => {
    const call = callOf(() => ({ ok: true, status: 200, body: { useInstitutionTemplate: false, version: null } }));
    expect(await saveTemplate(call, "a1", false)).toBe("none");
    expect(call).not.toHaveBeenCalled();
  });
  it("is saved only when the answer repeats the choice with a frozen version", async () => {
    const call = callOf(() => ({ ok: true, status: 200, body: { useInstitutionTemplate: true, version: 3 } }));
    expect(await saveTemplate(call, "a1", true)).toBe("saved");
    expect(call).toHaveBeenCalledWith("teacher.assignment-template.put", { params: { assignmentId: "a1" }, query: undefined, body: { useInstitutionTemplate: true } });
    expect(await saveTemplate(callOf(() => ({ ok: true, status: 200, body: { useInstitutionTemplate: true, version: null } })), "a1", true)).toBe("failed");
    expect(await saveTemplate(callOf(() => ({ ok: true, status: 200, body: { useInstitutionTemplate: false, version: null } })), "a1", true)).toBe("failed");
  });
  it("maps refusals: 401, 409, someone else's assignment (404) and a thrown call", async () => {
    const refuse = (status: number) => callOf(() => ({ ok: false, status, code: "x" }));
    expect(await saveTemplate(refuse(401), "a1", true)).toBe("signedOut");
    expect(await saveTemplate(refuse(409), "a1", true)).toBe("conflict");
    expect(await saveTemplate(refuse(404), "other", true)).toBe("failed");
    expect(await saveTemplate(callOf(() => { throw new Error("offline"); }), "a1", true)).toBe("failed");
  });
});

describe("readOutline (institution.work-template.get)", () => {
  it("reads the current version, an empty one as none, and any refusal as unavailable (never as none)", async () => {
    const ok = (current: unknown) => callOf(() => ({ ok: true, status: 200, body: { current, versions: [] } }));
    expect(await readOutline(ok({ effectiveFrom: "x", ...outline, citationStyle: "fpzg" }), "essay")).toEqual({ kind: "ready", outline });
    expect(await readOutline(ok(null), "essay")).toEqual({ kind: "none" });
    expect(await readOutline(callOf(() => ({ ok: false, status: 403, code: "forbidden" })), "essay")).toEqual({ kind: "unavailable" });
    expect(await readOutline(callOf(() => { throw new Error("x"); }), "essay")).toEqual({ kind: "unavailable" });
    const never = callOf(() => ({ ok: false, status: 500, code: "x" }));
    expect(await readOutline(never, "not_a_type")).toEqual({ kind: "unavailable" });
    expect(never).not.toHaveBeenCalled();
  });
});

describe("TemplateField and the form", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  async function mountNode(node: unknown) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(node as never); });
    return host;
  }
  const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label)!;
  const typeInto = async (el: HTMLInputElement, value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const fillBasics = async (host: HTMLElement) => {
    await typeInto([...host.querySelectorAll("input")].find((i) => i.maxLength === 160)!, "Izmišljeni seminar");
    const when = host.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    await typeInto(when[0]!, "2027-01-10T10:00");
    await typeInto(when[1]!, "2027-01-30T16:00");
  };
  const switchBox = () => [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((i) => i.closest("label")?.textContent?.includes(t.label))!;

  it("shows the outline only while the switch is on and says when it cannot be read", async () => {
    const load = vi.fn(async () => ({ kind: "ready", outline }) as const);
    await mountNode(h(TemplateField, { value: true, onChange: () => {}, workType: "essay", load }));
    expect(load).toHaveBeenCalledWith("essay");
    expect(document.body.textContent).toContain("Uvod – Tema i cilj");
    expect(document.body.textContent).toContain("Naslov, Autor");
    expect(document.body.textContent).toContain(t.version(3));
    act(() => root?.unmount());
    document.body.innerHTML = "";
    const off = vi.fn(async () => ({ kind: "ready", outline }) as const);
    await mountNode(h(TemplateField, { value: false, onChange: () => {}, workType: "essay", load: off }));
    expect(off).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("Uvod");
    act(() => root?.unmount());
    document.body.innerHTML = "";
    await mountNode(h(TemplateField, { value: true, onChange: () => {}, workType: "essay", load: async () => ({ kind: "unavailable" as const }) }));
    expect(document.body.textContent).toContain(t.unavailable);
    expect(document.body.textContent).not.toContain(t.none);
  });

  it("is mounted in the form: the choice reaches the template route after publishing, with the new assignment id", async () => {
    const publish = vi.fn(async () => ({ kind: "available" as const, id: "a-new" }));
    const setTemplateFor = vi.fn(async () => "saved" as const);
    const host = await mountNode(h(HostContext.Provider, { value: HOST }, h(AssignmentForm, {
      course, publish, setRules: async () => [], setRubricFor: async () => "none", setTemplateFor,
      loadGroups: async () => ({ kind: "ready", groups: [] }), loadOutline: async () => ({ kind: "ready" as const, outline }),
    } as never)));
    await fillBasics(host);
    await click(switchBox());
    expect(document.body.textContent).toContain("Zaključak");
    await click(button(f.review));
    expect(document.body.textContent).toContain(t.reviewOn);
    await click(button(f.publish));
    expect(setTemplateFor).toHaveBeenCalledWith("a-new", true);
  });

  it("reports a template that could not be switched on, while the assignment stays published", async () => {
    const host = await mountNode(h(HostContext.Provider, { value: HOST }, h(AssignmentForm, {
      course, publish: async () => ({ kind: "available" as const, id: "a-new" }), setRules: async () => [], setRubricFor: async () => "none",
      setTemplateFor: async () => "failed" as const, loadGroups: async () => ({ kind: "ready", groups: [] }), loadOutline: async () => ({ kind: "none" as const }),
    } as never)));
    await fillBasics(host);
    await click(switchBox());
    await click(button(f.review));
    await click(button(f.publish));
    expect(document.body.textContent).toContain(t.failed.failed);
  });
});
