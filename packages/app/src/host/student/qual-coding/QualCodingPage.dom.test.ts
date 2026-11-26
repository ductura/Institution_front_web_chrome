// @vitest-environment jsdom
// WEB-V18-KODIRANJE-OZNAKE: the page mounted in jsdom with a test double for the client. Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { qualCodingText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("@/client/api", () => ({ createApi: vi.fn(), goToSignIn: signIn }));
const { QualCodingPage } = await import("./QualCodingPage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) { this.removeAttribute("open"); };

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const M = "11111111-1111-4111-8111-111111111111";
const C1 = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Motivacija", description: "Zašto pristupa", order: 0 };
const C2 = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Prepreke", description: "", order: 1 };
const MATERIAL = { id: M, title: "Intervju A", kind: "interview", text: "Prvi izmišljeni redak.\n\nDrugi izmišljeni redak.", createdOn: "2026-04-01", segmentCount: 0, locked: false };
const SEG = { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", codeId: C2.id, paragraph: 2, start: 0, end: 5, quote: "Drugi", memo: "bilješka", createdOn: "2026-04-02" };
const SEG_FIRST = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", codeId: C1.id, paragraph: 0, start: 0, end: 5, quote: "Prvi ", memo: null, createdOn: "2026-04-02" };
const ok = (body: unknown, status = 200): Answer => ({ ok: true, status, body });
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });

function apiOf(routes: Record<string, (input: { params?: unknown; query?: unknown; body?: unknown }) => Answer>) {
  const calls: { id: string; input: { params?: unknown; query?: unknown; body?: unknown } }[] = [];
  const fn = vi.fn(async (id: string, input: { params?: unknown; query?: unknown; body?: unknown }) => { calls.push({ id, input }); return routes[id]!(input); });
  return { calls, call: () => fn as never };
}
const BASE = {
  "student.qual-material.get": () => ok(MATERIAL),
  "student.qual-codes.get": () => ok({ codes: [C1, C2] }),
  "student.qual-segments.get": () => ok({ segments: [SEG, SEG_FIRST] }),
};

describe("QualCodingPage in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const render = async (call: () => never, materialId: string | null = M) => {
    act(() => root?.unmount());
    root = createRoot(host);
    await act(async () => { root?.render(h(QualCodingPage, { materialId, call })); });
  };
  const text = () => host.textContent ?? "";
  const type = async (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => { Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const choose = async (el: HTMLSelectElement, value: string) => { await act(async () => { el.value = value; el.dispatchEvent(new Event("change", { bubbles: true })); }); };
  const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label || b.getAttribute("aria-label") === label)!;
  const field = (label: string) => host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`) ?? [...host.querySelectorAll("label")].find((l) => l.textContent?.startsWith(label))?.closest("div")?.querySelector("input,textarea") as HTMLInputElement;

  it("shows the codebook, the text and the marked passages in the codebook's order", async () => {
    await render(apiOf(BASE).call);
    expect([...host.querySelectorAll("[data-testid=code]")].map((e) => e.textContent)).toEqual([expect.stringContaining("Motivacija"), expect.stringContaining("Prepreke")]);
    expect([...host.querySelectorAll("[data-testid=segment]")].map((e) => e.querySelector("blockquote")?.textContent)).toEqual(["Prvi ", "Drugi"]);
    expect(host.querySelectorAll("[data-line]")).toHaveLength(2);
  });

  it("says loading, error, empty and not found as different things", async () => {
    await render(apiOf({ ...BASE, "student.qual-codes.get": () => fail(503, "unavailable") }).call);
    expect(text()).toContain(t.unavailable);
    expect(text()).not.toContain(t.noCodes.title);
    await render(apiOf({ ...BASE, "student.qual-codes.get": () => ok({ codes: [] }), "student.qual-segments.get": () => ok({ segments: [] }) }).call);
    expect(text()).toContain(t.noCodes.title);
    expect(text()).toContain(t.noSegments.title);
    expect(text()).not.toContain(t.unavailable);
    await render(apiOf({ ...BASE, "student.qual-material.get": () => fail(404, "not_found"), "student.qual-segments.get": () => fail(404, "not_found") }).call);
    expect(text()).toContain(t.gone.title);
    expect(host.querySelector("[data-testid=material-text]")).toBeNull();
  });

  it("does not call the server without a material", async () => {
    const d = apiOf(BASE);
    await render(d.call, null);
    expect(text()).toContain(t.noMaterial.title);
    expect(d.calls).toHaveLength(0);
  });

  it("goes to sign-in when the session is gone", async () => {
    await render(apiOf({ ...BASE, "student.qual-codes.get": () => fail(401, "unauthorized") }).call);
    expect(signIn).toHaveBeenCalledWith(`/app/web/zadaci/kodiranje?gradivo=${M}`);
  });

  it("refuses a bad or repeated code without calling the server, and says success only after the answer", async () => {
    const d = apiOf({ ...BASE, "student.qual-codes.post": () => ok({ id: "e", name: "Nada", description: "", order: 2 }, 201) });
    await render(d.call);
    const form = host.querySelectorAll("form")[0]!;
    const submit = async () => { await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); };
    await submit();
    expect(text()).toContain(t.errors.nameRequired);
    await type(form.querySelector("input")!, "motivacija");
    await submit();
    expect(text()).toContain(t.errors.nameTaken);
    expect(d.calls.some((c) => c.id === "student.qual-codes.post")).toBe(false);
    await type(form.querySelector("input")!, "Nada");
    await submit();
    expect(d.calls.find((c) => c.id === "student.qual-codes.post")!.input.body).toEqual({ name: "Nada" });
    expect(text()).toContain(t.codeAdded);
    expect(d.calls.filter((c) => c.id === "student.qual-codes.get").length).toBeGreaterThanOrEqual(2);
  });

  it("does not say the code was added when the server's answer is lost", async () => {
    const d = apiOf({ ...BASE, "student.qual-codes.post": () => fail(503, "unavailable") });
    await render(d.call);
    const form = host.querySelectorAll("form")[0]!;
    await type(form.querySelector("input")!, "Nada");
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(text()).toContain(t.codeUnknown);
    expect(text()).not.toContain(t.codeAdded);
  });

  it("moves a code to its neighbour's place and reads the codebook again", async () => {
    const d = apiOf({ ...BASE, "student.qual-code.patch": () => ok({ ...C2, order: 0 }) });
    await render(d.call);
    await click(button(t.codeUpAria.replace("{name}", "Prepreke")));
    expect(d.calls.find((c) => c.id === "student.qual-code.patch")!.input).toMatchObject({ params: { id: C2.id }, body: { order: 0 } });
    expect(button(t.codeUpAria.replace("{name}", "Motivacija")).hasAttribute("disabled")).toBe(true);
  });

  it("renames a code through the server and refuses an empty name", async () => {
    const d = apiOf({ ...BASE, "student.qual-code.patch": () => ok({ ...C1, name: "Potaknutost" }) });
    await render(d.call);
    await click(button(t.codeRenameAria.replace("{name}", "Motivacija")));
    const form = host.querySelectorAll("form")[0]!;
    await type(form.querySelector("input")!, "  ");
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(text()).toContain(t.errors.nameRequired);
    expect(d.calls.some((c) => c.id === "student.qual-code.patch")).toBe(false);
    await type(form.querySelector("input")!, "Potaknutost");
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(d.calls.find((c) => c.id === "student.qual-code.patch")!.input.body).toEqual({ name: "Potaknutost", description: "Zašto pristupa" });
    expect(text()).toContain(t.codeSaved);
  });

  it("deletes a code with marked passages only after the student confirms", async () => {
    const d = apiOf({
      ...BASE,
      "student.qual-code.delete": (input) => ((input.query as { confirm?: string }).confirm === "true" ? ok(undefined, 204) : fail(409, "conflict")),
    });
    await render(d.call);
    await click(button(t.codeRemoveAria.replace("{name}", "Motivacija")));
    expect(d.calls.filter((c) => c.id === "student.qual-code.delete")).toHaveLength(1);
    expect(text()).toContain(t.confirmCodeTitle);
    await click(button(t.confirmCodeYes));
    const deletes = d.calls.filter((c) => c.id === "student.qual-code.delete");
    expect(deletes).toHaveLength(2);
    expect(deletes[1]!.input.query).toEqual({ confirm: "true" });
    expect(text()).toContain(t.codeRemoved);
  });

  it("deletes a code without passages at once, and cancelling the confirmation deletes nothing", async () => {
    let d = apiOf({ ...BASE, "student.qual-code.delete": () => ok(undefined, 204) });
    await render(d.call);
    await click(button(t.codeRemoveAria.replace("{name}", "Prepreke")));
    expect(text()).toContain(t.codeRemoved);
    d = apiOf({ ...BASE, "student.qual-code.delete": () => fail(409, "conflict") });
    await render(d.call);
    await click(button(t.codeRemoveAria.replace("{name}", "Prepreke")));
    await click(button(t.confirmNo));
    expect(d.calls.filter((c) => c.id === "student.qual-code.delete")).toHaveLength(1);
    expect(text()).not.toContain(t.codeRemoved);
  });

  it("marks a whole line with the chosen code, the exact anchor and the memo", async () => {
    const d = apiOf({ ...BASE, "student.qual-segments.post": () => ok({ ...SEG, id: "f", codeId: C1.id }, 201) });
    await render(d.call);
    await choose(host.querySelector("select")!, C1.id);
    await type(host.querySelectorAll("textarea")[host.querySelectorAll("textarea").length - 1]!, " prva misao ");
    await click(button(t.markWholeAria.replace("{n}", "3")));
    const post = d.calls.find((c) => c.id === "student.qual-segments.post")!;
    expect(post.input).toEqual({ params: { id: M }, query: undefined, body: { codeId: C1.id, anchor: { paragraph: 2, start: 0, end: 23, quote: "Drugi izmišljeni redak." }, memo: "prva misao" } });
    expect(text()).toContain(t.marked);
  });

  it("marks the selected part of one line, and refuses no code, no selection and a selection across lines", async () => {
    const d = apiOf({ ...BASE, "student.qual-segments.post": () => ok({ ...SEG, id: "f", codeId: C1.id }, 201) });
    await render(d.call);
    const lines = host.querySelectorAll<HTMLElement>("[data-line]");
    const select = (from: HTMLElement, a: number, to: HTMLElement, b: number) => {
      const range = document.createRange();
      range.setStart(from.firstChild!, a); range.setEnd(to.firstChild!, b);
      const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range);
    };
    select(lines[0]!, 5, lines[0]!, 15);
    await click(button(t.markSelected));
    expect(text()).toContain(t.errors.noCode);
    await choose(host.querySelector("select")!, C1.id);
    window.getSelection()!.removeAllRanges();
    await click(button(t.markSelected));
    expect(text()).toContain(t.errors.noSelection);
    select(lines[0]!, 2, lines[1]!, 3);
    await click(button(t.markSelected));
    expect(text()).toContain(t.errors.noSelection);
    expect(d.calls.some((c) => c.id === "student.qual-segments.post")).toBe(false);
    select(lines[0]!, 5, lines[0]!, 15);
    await click(button(t.markSelected));
    expect(d.calls.find((c) => c.id === "student.qual-segments.post")!.input.body).toEqual({ codeId: C1.id, anchor: { paragraph: 0, start: 5, end: 15, quote: "izmišljeni" } });
  });

  it("does not say the passage was marked when the server refuses or the answer is lost", async () => {
    let status = fail(409, "conflict");
    const d = apiOf({ ...BASE, "student.qual-segments.post": () => status });
    await render(d.call);
    await choose(host.querySelector("select")!, C1.id);
    await click(button(t.markWholeAria.replace("{n}", "1")));
    expect(text()).toContain(t.markConflict);
    status = fail(503, "unavailable");
    await click(button(t.markWholeAria.replace("{n}", "1")));
    expect(text()).toContain(t.markUnknown);
    expect(text()).not.toContain(t.marked);
  });

  it("removes a mark, and a mark that is already gone is said so", async () => {
    let answer: Answer = ok(undefined, 204);
    const d = apiOf({ ...BASE, "student.qual-segment.delete": () => answer });
    await render(d.call);
    await click(button(t.segmentRemoveAria.replace("{quote}", "Drugi")));
    expect(d.calls.find((c) => c.id === "student.qual-segment.delete")!.input.params).toEqual({ id: SEG.id });
    expect(text()).toContain(t.segmentRemoved);
    answer = fail(404, "not_found");
    await click(button(t.segmentRemoveAria.replace("{quote}", "Drugi")));
    expect(text()).toContain(t.segmentGone);
  });

  it("never calls anything but the contract of this page (no assistant, no other operation)", async () => {
    const d = apiOf(BASE);
    await render(d.call);
    expect(new Set(d.calls.map((c) => c.id))).toEqual(new Set(["student.qual-material.get", "student.qual-codes.get", "student.qual-segments.get"]));
  });
});
