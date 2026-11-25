// @vitest-environment jsdom
// WEB-V16-OBRASCI: forms and consent as a student and a mentor meet them. Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { allowedStates, setConsent, setFormState } from "./actions";
import { formsHr } from "./messages.hr";
import { parseConsent, parseForms, readForms, type Call, type ThesisForm } from "./read";
import { FormsView } from "./section";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const form = (state: ThesisForm["state"] = "not_submitted", code = "obrazac-a"): ThesisForm =>
  ({ code, title: "Izmišljeni obrazac A", state, changedAt: null, changedByPart: null });
const consent = (state: "none" | "given" | "withdrawn" = "none") =>
  ({ state, changedBy: null, changedAt: null, comment: null, requiredForSubmission: false, history: [] });
const ok = (body: unknown) => ({ ok: true, status: 200, body, headers: {} });
const fail = (status: number) => ({ ok: false, status, code: "x" });
const fake = (fn: (id: string, input: { body?: unknown }) => unknown) => vi.fn(async (id: string, input: { body?: unknown }) => fn(id, input)) as unknown as Call & ReturnType<typeof vi.fn>;
const wire = (f: ThesisForm) => ({ ...f, version: 1, stateFormVersion: null, changedBy: null });

describe("read", () => {
  it("a 404 on either read is notFound (another's work), other failures are unavailable, not empty", async () => {
    expect(await readForms(fake((id) => (id.includes("forms") ? fail(404) : ok(consent())) ), "d1")).toEqual({ kind: "notFound" });
    expect(await readForms(fake((id) => (id.includes("consent") ? fail(404) : ok({ forms: [] }))), "d1")).toEqual({ kind: "notFound" });
    expect(await readForms(fake((id) => (id.includes("forms") ? fail(500) : ok(consent()))), "d1")).toEqual({ kind: "unavailable" });
    expect(await readForms(fake((id) => (id.includes("forms") ? ok({ forms: "x" }) : ok(consent()))), "d1")).toEqual({ kind: "unavailable" });
  });
  it("no forms and no consent yet is still ready, so the mentor can give the first consent", async () => {
    expect((await readForms(fake((id) => (id.includes("forms") ? ok({ forms: [] }) : ok(consent()))), "d1")).kind).toBe("ready");
    const r = await readForms(fake((id) => (id.includes("forms") ? ok({ forms: [wire(form())] }) : ok(consent()))), "d1");
    expect(r.kind).toBe("ready");
  });
  it("parsers refuse a wrong state", () => {
    expect(parseForms({ forms: [{ ...wire(form()), state: "zaključeno" }] })).toBeNull();
    expect(parseConsent({ ...consent(), state: "x" })).toBeNull();
  });
});

describe("rules", () => {
  it("the student only flips submitted ↔ not_submitted and cannot touch accepted; the mentor sets any state", () => {
    expect(allowedStates("student", "not_submitted")).toEqual(["submitted"]);
    expect(allowedStates("student", "submitted")).toEqual(["not_submitted"]);
    expect(allowedStates("student", "accepted")).toEqual([]);
    expect(allowedStates("mentor", "submitted")).toEqual(["not_submitted", "accepted"]);
  });
  it("the same state twice is 'unchanged' with no request; a student's forbidden move sends nothing", async () => {
    const call = fake(() => ok(wire(form())));
    expect(await setFormState(call, "d1", "student", form("submitted"), "submitted")).toBe("unchanged");
    expect(await setFormState(call, "d1", "student", form("not_submitted"), "accepted")).toBe("forbidden");
    expect(await setFormState(call, "d1", "student", form("accepted"), "not_submitted")).toBe("forbidden");
    expect(call).not.toHaveBeenCalled();
  });
  it("server answers map to messages: 403, 404, 409 and a thrown call", async () => {
    for (const [status, out] of [[403, "forbidden"], [404, "notFound"], [409, "conflict"], [422, "invalid"], [500, "unknown"]] as const) {
      expect(await setFormState(fake(() => fail(status)), "d1", "mentor", form(), "accepted")).toBe(out);
    }
    expect(await setFormState(fake(() => { throw new Error("izmišljena"); }), "d1", "mentor", form(), "accepted")).toBe("unknown");
  });
  it("only the mentor writes consent; the same state twice is a message; a long comment is refused unsent", async () => {
    const call = fake(() => ok(consent("given")));
    expect(await setConsent(call, "d1", "student", "none", true, "")).toBe("forbidden");
    expect(await setConsent(call, "d1", "mentor", "given", true, "")).toBe("unchanged");
    expect(await setConsent(call, "d1", "mentor", "none", true, "x".repeat(1001))).toBe("invalid");
    expect(call).not.toHaveBeenCalled();
    expect(await setConsent(call, "d1", "mentor", "none", true, "  dobro  ")).toBe("saved");
    expect(call).toHaveBeenCalledWith("work.mentor-consent.put", { params: { documentId: "d1" }, query: undefined, body: { given: true, comment: "dobro" } });
  });
});

let root: Root | null = null;
async function mount(role: "student" | "mentor", call: Call, value = { forms: [form()], consent: consent() }, reload = vi.fn()) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(FormsView, { documentId: "d1", role, value, reload, call })); });
  return { host, reload };
}
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });
const button = (host: HTMLElement, text: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === text);

describe("FormsView", () => {
  it("the student sees no consent button, flips the form, and the message survives the re-read", async () => {
    const call = fake((id) => (id === "work.thesis-forms.get" ? ok({ forms: [wire(form("submitted"))] }) : id === "work.mentor-consent.get" ? ok(consent()) : ok(wire(form("submitted")))));
    const { host, reload } = await mount("student", call);
    expect(host.textContent).toContain("Izmišljeni obrazac A");
    expect(button(host, formsHr.give)).toBeUndefined();
    expect(button(host, formsHr.withdraw)).toBeUndefined();
    await act(async () => { button(host, formsHr.markSubmitted)!.click(); });
    expect(call).toHaveBeenCalledWith("work.thesis-form.put", { params: { documentId: "d1", code: "obrazac-a" }, query: undefined, body: { state: "submitted" } });
    expect(call).toHaveBeenCalledWith("work.thesis-forms.get", expect.anything());
    expect(host.textContent).toContain(formsHr.saved);
  });
  it("an accepted form is read-only for the student", async () => {
    const { host } = await mount("student", fake(() => ok({})), { forms: [form("accepted")], consent: consent() });
    expect(host.textContent).toContain(formsHr.readOnlyAccepted);
    expect(button(host, formsHr.markSubmitted) ?? button(host, formsHr.markNotSubmitted)).toBeUndefined();
  });
  it("a 403/409 from the server is shown as a message, not thrown; 409 also reads again", async () => {
    const call = fake(() => fail(409));
    const { host } = await mount("mentor", call, { forms: [form()], consent: consent() });
    await act(async () => { button(host, formsHr.give)!.click(); });
    expect(host.textContent).toContain(formsHr.conflict);
    expect(call).toHaveBeenCalledWith("work.thesis-forms.get", expect.anything());
  });
  it("the mentor gives consent; the same state twice shows 'unchanged' and sends nothing", async () => {
    const call = fake(() => ok(consent("given")));
    const { host } = await mount("mentor", call, { forms: [], consent: consent("given") });
    expect(button(host, formsHr.give)!.disabled).toBe(true);
    const { host: h2 } = await mount("mentor", call, { forms: [form()], consent: consent("none") });
    await act(async () => { button(h2, formsHr.give)!.click(); });
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe("texts", () => {
  it("hold no forbidden term (PRODUCT §5), so the form name must come from the server", () => {
    const all: string[] = [];
    const walk = (v: unknown) => (typeof v === "string" ? all.push(v) : Object.values(v as object).forEach(walk));
    walk(formsHr);
    for (const text of all) expect(findForbiddenTerms(text, "hr")).toEqual([]);
  });
});
