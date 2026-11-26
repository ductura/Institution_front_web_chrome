// @vitest-environment jsdom
// WEB-V18-KODIRANJE-GRADIVO: the page mounted in jsdom with a test double for the client. Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { qualMaterialsText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("@/client/api", () => ({ createApi: vi.fn(), goToSignIn: signIn }));
const { default: QualMaterialsPage } = await import("./QualMaterialsPage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no modal dialog: the confirmation opens by its attribute.
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const ROW_A = { id: "11111111-1111-4111-8111-111111111111", title: "Intervju A", kind: "interview", createdOn: "2026-04-01", charCount: 31, segmentCount: 2, locked: true };
const ROW_B = { id: "22222222-2222-4222-8222-222222222222", title: "Bilješka A", kind: "note", createdOn: "2026-04-02", charCount: 12, segmentCount: 0, locked: false };
const ONE_A = { id: ROW_A.id, title: "Intervju A", kind: "interview", text: "Prvi izmišljeni redak.\n\nDrugi izmišljeni redak.", createdOn: "2026-04-01", segmentCount: 2, locked: true };
const ok = (body: unknown, status = 200): Answer => ({ ok: true, status, body });
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });

function apiOf(routes: Record<string, () => Answer>) {
  const calls: { id: string; input: { body?: unknown; params?: unknown } }[] = [];
  const fn = vi.fn(async (id: string, input: { body?: unknown }) => { calls.push({ id, input }); return routes[id]!(); });
  return { calls, call: () => fn as never };
}
const LIST = (rows: unknown[]) => () => ok({ materials: rows });

describe("QualMaterialsPage in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const render = async (call: () => never) => {
    act(() => root?.unmount());
    root = createRoot(host);
    await act(async () => { root?.render(h(QualMaterialsPage, { call })); });
  };
  const text = () => host.textContent ?? "";
  const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const submit = async () => { await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); };
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label || b.getAttribute("aria-label") === label)!;

  it("lists the materials with kind, size, marked passages and the lock", async () => {
    const { call } = apiOf({ "student.qual-materials.get": LIST([ROW_A, ROW_B]) });
    await render(call);
    expect(host.querySelectorAll("[data-testid=material]")).toHaveLength(2);
    expect(text()).toContain("Intervju A");
    expect(text()).toContain(t.kind.note);
    expect(text()).toContain("2 označena odlomka");
    expect(text()).toContain(t.noSegments);
    expect(text()).toContain(t.locked);
  });

  it("says loading, error and empty as three different things", async () => {
    let d = apiOf({ "student.qual-materials.get": () => fail(503, "unavailable") });
    await render(d.call);
    expect(text()).toContain(t.unavailable);
    expect(text()).not.toContain(t.noMaterials.title);
    d = apiOf({ "student.qual-materials.get": LIST([]) });
    await render(d.call);
    expect(text()).toContain(t.noMaterials.title);
    expect(text()).not.toContain(t.unavailable);
  });

  it("goes to sign-in when the session is gone", async () => {
    await render(apiOf({ "student.qual-materials.get": () => fail(401, "unauthorized") }).call);
    expect(signIn).toHaveBeenCalledWith("/app/web/zadaci/gradivo-kodiranja");
  });

  it("refuses a bad material without calling the server, and says success only after the server answers", async () => {
    const d = apiOf({ "student.qual-materials.get": LIST([]), "student.qual-materials.post": () => ok(ONE_A, 201) });
    await render(d.call);
    await submit();
    expect(text()).toContain(t.errors.titleRequired);
    expect(d.calls.some((c) => c.id === "student.qual-materials.post")).toBe(false);
    expect(text()).not.toContain(t.saved);
    await type(host.querySelector("input")!, "Intervju A");
    await submit();
    expect(text()).toContain(t.errors.textRequired);
    await type(host.querySelector("textarea")!, "Izmišljeni tekst.");
    await submit();
    expect(d.calls.find((c) => c.id === "student.qual-materials.post")!.input.body).toEqual({ title: "Intervju A", kind: "interview", text: "Izmišljeni tekst." });
    expect(text()).toContain(t.saved);
  });

  it("shows a refusal as a refusal and a lost answer as unknown, never as saved", async () => {
    let d = apiOf({ "student.qual-materials.get": LIST([]), "student.qual-materials.post": () => fail(409, "conflict") });
    await render(d.call);
    await type(host.querySelector("input")!, "Intervju A");
    await type(host.querySelector("textarea")!, "Tekst.");
    await submit();
    expect(text()).toContain(t.conflict);
    expect(text()).not.toContain(t.saved);
    d = apiOf({ "student.qual-materials.get": LIST([]), "student.qual-materials.post": () => fail(503, "unavailable") });
    await render(d.call);
    await type(host.querySelector("input")!, "Intervju A");
    await type(host.querySelector("textarea")!, "Tekst.");
    await submit();
    expect(text()).toContain(t.unknown);
  });

  it("opens one material and shows its lines", async () => {
    const d = apiOf({ "student.qual-materials.get": LIST([ROW_A]), "student.qual-material.get": () => ok(ONE_A) });
    await render(d.call);
    await act(async () => { button(t.openAria.replace("{title}", "Intervju A")).click(); });
    expect(d.calls.find((c) => c.id === "student.qual-material.get")!.input.params).toEqual({ id: ROW_A.id });
    expect([...host.querySelectorAll("[data-testid=material-text] p")].map((p) => p.textContent)).toEqual(["Prvi izmišljeni redak.", "Drugi izmišljeni redak."]);
  });

  it("reads a material that is not found (another student's) as gone, and a failed read as an error", async () => {
    let d = apiOf({ "student.qual-materials.get": LIST([ROW_A]), "student.qual-material.get": () => fail(404, "not_found") });
    await render(d.call);
    await act(async () => { button(t.openAria.replace("{title}", "Intervju A")).click(); });
    expect(text()).toContain(t.gone);
    expect(host.querySelector("[data-testid=material-text]")).toBeNull();
    d = apiOf({ "student.qual-materials.get": LIST([ROW_A]), "student.qual-material.get": () => fail(503, "unavailable") });
    await render(d.call);
    await act(async () => { button(t.openAria.replace("{title}", "Intervju A")).click(); });
    expect(text()).toContain(t.oneUnavailable);
    expect(host.querySelector("[data-testid=material-text]")).toBeNull();
  });

  it("deletes only after the confirmation, and says it only after the server answers", async () => {
    let rows = [ROW_A, ROW_B];
    const d = apiOf({ "student.qual-materials.get": () => ok({ materials: rows }), "student.qual-material.delete": () => { rows = [ROW_B]; return ok(undefined, 204); } });
    await render(d.call);
    await act(async () => { button(t.removeAria.replace("{title}", "Intervju A")).click(); });
    expect(d.calls.some((c) => c.id === "student.qual-material.delete")).toBe(false);
    expect(host.querySelector("dialog")!.textContent).toContain(t.confirmBody.replace("{title}", "Intervju A").replace("{segments}", "2"));
    await act(async () => { button(t.confirmNo).click(); });
    expect(d.calls.some((c) => c.id === "student.qual-material.delete")).toBe(false);
    await act(async () => { button(t.removeAria.replace("{title}", "Intervju A")).click(); });
    await act(async () => { button(t.confirmYes).click(); });
    expect(d.calls.find((c) => c.id === "student.qual-material.delete")!.input.params).toEqual({ id: ROW_A.id });
    expect(text()).toContain(t.removed);
    expect(host.querySelectorAll("[data-testid=material]")).toHaveLength(1);
  });

  it("reports a delete whose answer was lost as unknown and reads the list again", async () => {
    const d = apiOf({ "student.qual-materials.get": LIST([ROW_B]), "student.qual-material.delete": () => fail(503, "unavailable") });
    await render(d.call);
    await act(async () => { button(t.removeAria.replace("{title}", "Bilješka A")).click(); });
    await act(async () => { button(t.confirmYes).click(); });
    expect(text()).toContain(t.removeUnknown);
    expect(text()).not.toContain(t.removed);
    expect(d.calls.filter((c) => c.id === "student.qual-materials.get")).toHaveLength(2);
  });

  it("locks the form while saving and unlocks it after a lost answer", async () => {
    let release: (a: Answer) => void = () => undefined;
    const pending = new Promise<Answer>((resolve) => { release = resolve; });
    const fn = vi.fn(async (id: string) => (id === "student.qual-materials.get" ? ok({ materials: [] }) : pending));
    await render(() => fn as never);
    await type(host.querySelector("input")!, "Intervju A");
    await type(host.querySelector("textarea")!, "Tekst.");
    await submit();
    expect(host.querySelector("textarea")!.readOnly).toBe(true);
    await submit();
    expect(fn.mock.calls.filter(([id]) => id === "student.qual-materials.post")).toHaveLength(1);
    await act(async () => { release(fail(503, "unavailable")); });
    expect(host.querySelector("textarea")!.readOnly).toBe(false);
    expect(text()).toContain(t.unknown);
  });

  it("does not cap the text by UTF-16 units and offers no file, audio or assistant control", async () => {
    await render(apiOf({ "student.qual-materials.get": LIST([]) }).call);
    expect(host.querySelector("textarea")!.hasAttribute("maxlength")).toBe(false);
    expect(host.querySelector("input[type=file], audio, video")).toBeNull();
  });
});
