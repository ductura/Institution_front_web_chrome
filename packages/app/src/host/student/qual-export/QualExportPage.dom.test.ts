// @vitest-environment jsdom
// WEB-V18-KODIRANJE-IZVOZ: the page mounted in jsdom with a test double for the client. Invented texts only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { qualExportText as t } from "./messages.hr";

const signIn = vi.hoisted(() => vi.fn());
const download = vi.hoisted(() => vi.fn());
vi.mock("../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
vi.mock("@/client/api", () => ({ createApi: vi.fn(), goToSignIn: signIn }));
vi.mock("../../../../../../src/components/editor/EarlierDraft", () => ({ downloadBlob: download }));
const { default: QualExportPage } = await import("./QualExportPage");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const C1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const C2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const M1 = "11111111-1111-4111-8111-111111111111";
const EXPORT = {
  schema: "qualitative-export-v1",
  codebook: [{ code: C1, name: "Motivacija", description: "" }, { code: C2, name: "Prepreke", description: "Što otežava rad" }],
  segments: [
    { material: M1, code: C1, paragraph: 0, start: 0, end: 5, quote: "Prvi", memo: null },
    { material: M1, code: C2, paragraph: 1, start: 0, end: 5, quote: "Drugi", memo: null },
    { material: M1, code: C2, paragraph: 2, start: 0, end: 5, quote: "Treći", memo: null },
  ],
  counts: [{ code: C1, material: M1, n: 1 }, { code: C2, material: M1, n: 2 }],
};
const ok = (body: unknown): Answer => ({ ok: true, status: 200, body });
const fail = (status: number, code: string): Answer => ({ ok: false, status, code });
const MATERIALS = ok({ materials: [{ id: M1, title: "Intervju A", kind: "interview", createdOn: "2026-04-01", charCount: 9, segmentCount: 3, locked: true }] });

function apiOf(routes: Record<string, (query: unknown) => Answer>) {
  const calls: { id: string; query: unknown }[] = [];
  const fn = vi.fn(async (id: string, input: { query?: unknown }) => { calls.push({ id, query: input.query }); return routes[id]!(input.query); });
  return { calls, call: () => fn as never };
}

describe("QualExportPage in the browser", () => {
  let root: Root | undefined;
  let host: HTMLDivElement;
  beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); signIn.mockClear(); download.mockClear(); });
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const render = async (call: () => never) => {
    act(() => root?.unmount());
    root = createRoot(host);
    await act(async () => { root?.render(h(QualExportPage, { call })); });
  };
  const text = () => host.textContent ?? "";
  const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === label)!;
  const click = async (el: Element) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); };

  it("shows the counts in the codebook's order, not by size", async () => {
    const { call } = apiOf({ "student.qual-export.get": () => ok(EXPORT), "student.qual-materials.get": () => MATERIALS });
    await render(call);
    const names = [...host.querySelectorAll("tbody tr")].map((r) => r.querySelector("th")?.textContent);
    expect(names).toEqual(["Motivacija", "Prepreke"]);
    expect(host.querySelectorAll("tbody tr")[1]!.textContent).toContain("2");
    expect(text()).toContain(t.noDescription);
    expect(text()).toContain("Šifri: 2; označenih odlomaka: 3.");
  });

  it("offers the three files and notes success only after the file is prepared", async () => {
    const { call } = apiOf({ "student.qual-export.get": () => ok(EXPORT), "student.qual-materials.get": () => MATERIALS });
    await render(call);
    expect(text()).not.toContain(t.downloaded);
    await click(button(t.downloadJson));
    await click(button(t.downloadCsvSegments));
    await click(button(t.downloadCsvCodebook));
    expect(download.mock.calls.map((c) => c[1])).toEqual(["kodiranje-izvoz.json", "kodiranje-odlomci.csv", "kodiranje-sifrarnik.csv"]);
    expect(text()).toContain(t.downloaded);
  });

  it("says so when the file cannot be prepared", async () => {
    download.mockImplementationOnce(() => { throw new Error("no"); });
    const { call } = apiOf({ "student.qual-export.get": () => ok(EXPORT), "student.qual-materials.get": () => MATERIALS });
    await render(call);
    await click(button(t.downloadJson));
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.downloadFailed);
    expect(text()).not.toContain(t.downloaded);
  });

  it("shows empty, error and loading as different states", async () => {
    const empty = apiOf({ "student.qual-export.get": () => ok({ ...EXPORT, codebook: [], segments: [], counts: [] }), "student.qual-materials.get": () => MATERIALS });
    await render(empty.call);
    expect(text()).toContain(t.empty.title);
    expect(host.querySelector("button")).toBeNull();
    const broken = apiOf({ "student.qual-export.get": () => fail(503, "unavailable"), "student.qual-materials.get": () => MATERIALS });
    await render(broken.call);
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.unavailable);
    expect(text()).not.toContain(t.empty.title);
    expect(button(t.retry)).toBeDefined();
  });

  it("asks for one material and falls back to all of it when that material is not the student's (404)", async () => {
    const { call, calls } = apiOf({
      "student.qual-export.get": (q) => ((q as { materialId?: string }).materialId === undefined ? ok(EXPORT) : fail(404, "not_found")),
      "student.qual-materials.get": () => MATERIALS,
    });
    await render(call);
    const select = host.querySelector("select")!;
    await act(async () => { select.value = M1; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(calls.some((c) => (c.query as { materialId?: string } | undefined)?.materialId === M1)).toBe(true);
    expect(host.querySelector("[role=alert]")?.textContent).toBe(t.scopeGone);
    expect(text()).toContain("Motivacija");
    expect(host.querySelector("select")).toBeNull();
  });

  it("sends a signed-out student to sign in", async () => {
    const { call } = apiOf({ "student.qual-export.get": () => fail(401, "unauthorized"), "student.qual-materials.get": () => fail(401, "unauthorized") });
    await render(call);
    expect(signIn).toHaveBeenCalled();
  });
});
