// @vitest-environment jsdom
// F4-OPE-R05 in the browser: the CSV roster import over a stubbed fetch with invented answers.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGES, type Page } from "../../../routes";
import { HostContext } from "../../context";
import IsvuRoute from "./IsvuRoute";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const COURSE = "5b1f2c3d-0000-4000-8000-000000000001";
const IMPORT = "5b1f2c3d-0000-4000-8000-000000000002";
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };
let root: Root | null = null;
let host: HTMLElement | null = null;
const settle = () => act(async () => { await new Promise((done) => setTimeout(done, 0)); });
type Call = { method: string; path: string; body: string };
type Handler = (call: Call) => Response | undefined;

const ownCourses = { academicYear: "2026/2027", courses: [{ courseId: COURSE, name: "Izmišljeni kolegij", students: 0, holder: null, team: [], groups: [] }] };
const row = (line: number, status: string, reason: string | null, id: string) => ({ line, identifier: id, givenName: "Ivo", familyName: `Student${line}`, status, reason });
const preview = (rows: unknown[]) => ({ importId: IMPORT, source: "merlin", expiresAt: "2026-11-26T10:00:00.000Z", counts: { new: 1, alreadyEnrolled: 0, unsuitable: 1 }, rows });
const mixed = preview([row(2, "new", null, "a@aai-test.hr"), row(3, "unsuitable", "unknown_account", "b@aai-test.hr")]);
const CSV = "identifier,givenName,familyName\na@aai-test.hr,Ivo,Student2\n";

function stub(handler: Handler) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const r = input instanceof Request ? input : new Request(String(input), init);
    const call = { method: r.method, path: new URL(r.url, "http://localhost").pathname, body: await r.clone().text() };
    calls.push(call);
    const own = handler(call);
    if (own) return own;
    if (call.path.endsWith("/institution/admin/academic-years")) return Response.json({ years: ["2026/2027"] });
    if (call.path.endsWith("/institution/admin/courses")) return Response.json(ownCourses);
    if (call.path.endsWith("/isvu/courses")) return Response.json({ mode: "mock", courses: [] });
    return Response.json({ error: "not_found" }, { status: 404 });
  });
  return calls;
}
async function mount() {
  const page = PAGES.find((p) => p.path === "/ustanova/isvu") as Page;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(HostContext, { value: { base: "/aplikacija", page, role: "admin" } }, createElement(IsvuRoute))); });
  await settle(); await settle();
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; vi.unstubAllGlobals(); });
const text = () => host!.textContent ?? "";
const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement | undefined;
const click = async (label: string) => { await act(async () => { button(label)!.click(); }); await settle(); };
const choose = async (name: string, value: string) => {
  const s = host!.querySelector(`select[name="${name}"]`) as HTMLSelectElement;
  await act(async () => { s.value = value; s.dispatchEvent(new Event("change", { bubbles: true })); });
};
const paste = async (value: string) => {
  const t = host!.querySelector('textarea[name="csv-text"]') as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(t, value);
    t.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const fill = async () => { await choose("csv-course", COURSE); await choose("csv-source", "isvu"); await paste(CSV); };
const isPreview = (c: Call) => c.path === `/api/v1/institution/admin/courses/${COURSE}/roster-imports`;
const isConfirm = (c: Call) => c.path.endsWith("/confirm");

describe("Uvoz popisa iz CSV-a", () => {
  it("works although the trial source is empty, and sends no request before the click", async () => {
    const calls = stub(() => undefined);
    await mount();
    expect(text()).toContain("Uvoz popisa iz CSV-a");
    await fill();
    expect(calls.some(isPreview)).toBe(false);
  });

  it("the preview posts the chosen source and the text and enrols nobody", async () => {
    const calls = stub((c) => (isPreview(c) ? Response.json(mixed) : undefined));
    await mount(); await fill(); await click("Pregledaj CSV");
    expect(JSON.parse(calls.find(isPreview)!.body)).toEqual({ source: "isvu", csv: CSV });
    expect(text()).toContain("Novi: 1");
    expect(text()).toContain("Student se još nije prijavio kroz AAI@EduHr");
    await click("Potvrdi upis…");
    expect(calls.some(isConfirm)).toBe(false);
  });

  it("an empty text is not sent", async () => {
    const calls = stub(() => undefined);
    await mount(); await choose("csv-course", COURSE); await click("Pregledaj CSV");
    expect(calls.some(isPreview)).toBe(false);
  });

  it("the confirmation through the dialog shows the result and is sent once", async () => {
    const calls = stub((c) => (isPreview(c) ? Response.json(mixed) : isConfirm(c) ? Response.json({ enrolled: 1, alreadyEnrolled: 0, skipped: 1, alreadyConfirmed: false }) : undefined));
    await mount(); await fill(); await click("Pregledaj CSV"); await click("Potvrdi upis…"); await click("Potvrdi upis");
    expect(calls.filter(isConfirm)).toHaveLength(1);
    expect(calls.find(isConfirm)!.path).toBe(`/api/v1/institution/admin/roster-imports/${IMPORT}/confirm`);
    expect(text()).toContain("Upisano: 1");
  });

  it("a failed confirmation keeps the preview", async () => {
    stub((c) => (isPreview(c) ? Response.json(mixed) : isConfirm(c) ? new Response("{}", { status: 503 }) : undefined));
    await mount(); await fill(); await click("Pregledaj CSV"); await click("Potvrdi upis…"); await click("Potvrdi upis");
    expect(document.body.textContent).toContain("Upis nije uspio");
    expect(host!.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it.each([
    ["roster_columns_missing", "nedostaju obavezni stupci"],
    ["roster_too_many_rows", "previše redaka"],
    ["roster_malformed", "nije valjan CSV"],
  ])("422 %s says what is wrong with the list and shows no table", async (code, words) => {
    stub((c) => (isPreview(c) ? Response.json({ error: code }, { status: 422 }) : undefined));
    await mount(); await fill(); await click("Pregledaj CSV");
    expect(text()).toContain(words);
    expect(host!.querySelector("table")).toBeNull();
  });

  it("a foreign or unknown course (404) is not an empty preview", async () => {
    stub((c) => (isPreview(c) ? Response.json({ error: "not_found" }, { status: 404 }) : undefined));
    await mount(); await fill(); await click("Pregledaj CSV");
    expect(text()).toContain("Kolegij nije dostupan u ovoj ustanovi.");
    expect(host!.querySelector("table")).toBeNull();
  });

  it("an outage is a read error, not 'no new students'", async () => {
    stub((c) => (isPreview(c) ? new Response("{}", { status: 503 }) : undefined));
    await mount(); await fill(); await click("Pregledaj CSV");
    expect(text()).toContain("Čitanje nije uspjelo");
    expect(text()).not.toContain("Nema novih studenata");
  });

  it("changing the text discards a preview made for the old one", async () => {
    stub((c) => (isPreview(c) ? Response.json(mixed) : undefined));
    await mount(); await fill(); await click("Pregledaj CSV");
    expect(host!.querySelector("table")).not.toBeNull();
    await paste(`${CSV}b@aai-test.hr,Ivo,Student3\n`);
    expect(host!.querySelector("table")).toBeNull();
  });

  it("a list the server reports as expired offers a new preview", async () => {
    stub((c) => (isPreview(c) ? Response.json(mixed) : isConfirm(c) ? Response.json({ error: "import_expired" }, { status: 410 }) : undefined));
    await mount(); await fill(); await click("Pregledaj CSV"); await click("Potvrdi upis…"); await click("Potvrdi upis");
    expect(text()).toContain("Pregled je istekao");
    expect(button("Napravi novi pregled")).toBeTruthy();
  });
});
