// @vitest-environment jsdom
// WEB-V13-VRSTA-ZADATKA: the teacher picks "Tekst" (default) or "Slajdovi"; the choice is `documentKind` on the wire.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApi } from "@/client/api";
import { assignmentBody, type AssignmentDraft } from "@/components/teacher/assignment-create";
import { publishAssignment, publishAssignmentVersion } from "@/components/teacher/TeacherSetup/assignment-mutations";

import { HostContext, type HostValue } from "../../context";
import AssignmentForm from "./AssignmentForm";
import { DocumentKindReadBack, kindOf, withDocumentKind } from "./DocumentKindField";
import { assignmentFormHr as f, documentKindHr as k } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Invented course, assignment and ids.
const HOST = { base: "/app/web", page: { path: "/nastavnik" }, role: "teacher" } as unknown as HostValue;
const course = { id: "c1", name: "Izmišljeni kolegij", academicYear: "2026./2027.", aiPolicy: "partially_allowed" } as const;
const courseId = "0b7c4f0e-6d1a-4c55-9a3e-2f1d8c9b7a61";
const assignmentId = "8c7b6a5d-4e3f-4b2a-8d9c-6e5f4a3b2c01";
const requestKey = "5e3a9c2d-8b14-4f7e-a0c6-1d2e3f4a5b6c";
const draft: AssignmentDraft = {
  title: "Izmišljeni zadatak", workType: "essay", opensAt: "2027-01-10T10:00", dueAt: "2027-01-30T16:00",
  instructions: "", wordMin: "", wordMax: "", aiPurposes: [],
};
const base = () => {
  const body = assignmentBody(draft, "prohibited");
  if (!body) throw new Error("the invented draft must be valid");
  return body;
};

describe("documentKind on the bodies", () => {
  it("is text unless slides is chosen", () => {
    expect(kindOf(undefined)).toBe("text");
    expect(kindOf("video")).toBe("text");
    expect(kindOf("slides")).toBe("slides");
    expect(kindOf("spreadsheet")).toBe("spreadsheet");
    expect(withDocumentKind(base(), {})).toMatchObject({ documentKind: "text" });
    expect(withDocumentKind(base(), { documentKind: "slides" })).toMatchObject({ documentKind: "slides" });
  });

  it("sends a table as workKind spreadsheet beside documentKind text (the enum is not widened)", () => {
    const body = withDocumentKind(base(), { documentKind: "spreadsheet" });
    expect(body).toMatchObject({ documentKind: "text", workKind: "spreadsheet" });
    expect(withDocumentKind(base(), { documentKind: "slides" })).not.toHaveProperty("workKind");
  });

  it("reaches the wire of the create route through the typed client", async () => {
    for (const kind of ["text", "slides"] as const) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "9f8e7d6c-5b4a-4321-8fed-cba987654321" }, { status: 201 }));
      const result = await publishAssignment(courseId, withDocumentKind(base(), { documentKind: kind }) as never, requestKey, createApi({ baseUrl: "https://ductura.invalid", fetchImpl }));
      expect(result.kind).toBe("available");
      expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({ documentKind: kind });
    }
  });

  it("reaches the wire of the new-version route and its answer is read", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ assignmentId, versionNo: 2 }, { status: 201 }));
    const { title, instructions, workType, opensAt, dueAt, aiPolicy, aiPurposes, evidenceProfile, importAllowed, wordMin, wordMax } = base();
    const result = await publishAssignmentVersion(assignmentId,
      { title, instructions, workType, opensAt, dueAt, aiPolicy, aiPurposes, evidenceProfile, importAllowed, wordMin, wordMax, expectedVersion: 1, documentKind: "text" } as never,
      createApi({ baseUrl: "https://ductura.invalid", fetchImpl }));
    expect(result).toEqual({ kind: "published", versionNo: 2 });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({ documentKind: "text" });
  });
});

describe("DocumentKindReadBack (edit page)", () => {
  const text = (current: object) => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => root.render(h(DocumentKindReadBack, { current })));
    const out = host.textContent ?? "";
    act(() => root.unmount());
    host.remove();
    return out;
  };
  it("shows the kind the server gave and says honestly when it gave none", () => {
    expect(text({ documentKind: "slides" })).toContain(k.options.slides);
    expect(text({ documentKind: "text" })).toContain(k.options.text);
    expect(text({})).toContain(k.unknown);
    expect(text({ documentKind: "video" })).toContain(k.unknown);
    expect(text({ documentKind: "text", workKind: "spreadsheet" })).toContain(k.options.spreadsheet);
  });
});

describe("AssignmentForm document kind", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label)!;
  const radio = (value: string) => document.querySelector<HTMLInputElement>(`input[name="document-kind"][value="${value}"]`)!;
  async function start(props: Record<string, unknown>) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(HostContext.Provider, { value: HOST }, h(AssignmentForm, { course, loadGroups: async () => ({ kind: "ready", groups: [] }), setRules: async () => [], setRubricFor: async () => "none", setTemplateFor: async () => "none", ...props } as never))); });
    const type = async (el: HTMLInputElement, value: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await type([...host.querySelectorAll("input")].find((i) => i.maxLength === 160)!, "Izmišljeni zadatak");
    const when = host.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    await type(when[0]!, "2027-01-10T10:00");
    await type(when[1]!, "2027-01-30T16:00");
  }
  const sentBody = (publish: ReturnType<typeof vi.fn>) => (publish.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];

  it("defaults to text and sends documentKind: text", async () => {
    const publish = vi.fn(async () => ({ kind: "available" as const, id: "a-new" }));
    await start({ publish });
    expect(radio("text").checked).toBe(true);
    expect(radio("slides").checked).toBe(false);
    await click(button(f.review));
    await click(button(f.publish));
    expect(sentBody(publish)).toMatchObject({ documentKind: "text" });
  });

  it("sends documentKind: slides when Slajdovi is picked and shows it in the review", async () => {
    const publish = vi.fn(async () => ({ kind: "available" as const, id: "a-new" }));
    await start({ publish });
    await click(radio("slides"));
    expect(document.body.textContent).toContain(k.slidesHint);
    await click(button(f.review));
    expect(document.body.textContent).toContain(f.labels.documentKind);
    expect(document.body.textContent).toContain(k.options.slides);
    await click(button(f.publish));
    expect(sentBody(publish)).toMatchObject({ documentKind: "slides" });
  });

  it("sends workKind: spreadsheet when Tablica is picked", async () => {
    const publish = vi.fn(async () => ({ kind: "available" as const, id: "a-new" }));
    await start({ publish });
    await click(radio("spreadsheet"));
    expect(document.body.textContent).toContain(k.spreadsheetHint);
    await click(button(f.review));
    expect(document.body.textContent).toContain(k.options.spreadsheet);
    await click(button(f.publish));
    expect(sentBody(publish)).toMatchObject({ documentKind: "text", workKind: "spreadsheet" });
  });

  it("shows a contract refusal as an error, not as published", async () => {
    const publish = vi.fn(async () => ({ kind: "invalid" as const }));
    await start({ publish });
    await click(radio("slides"));
    await click(button(f.review));
    await click(button(f.publish));
    expect(document.querySelector('[role="alert"]')?.textContent?.length).toBeGreaterThan(0);
    expect(button(f.publish)).toBeTruthy();
  });
});
