// @vitest-environment jsdom
// WEB-V22-UVOZ-EKRAN in the browser: react-dom/client over a stubbed fetch with invented answers.
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
type Call = { method: string; path: string; query: string };
type Handler = (call: Call) => Response | undefined;

const ownCourses = { academicYear: "2026/2027", courses: [{ courseId: COURSE, name: "Izmišljeni kolegij", students: 0, holder: null, team: [], groups: [] }] };
const sourceCourses = { mode: "mock", courses: [{ sourceCourseKey: "K1", name: "Probni kolegij", academicYear: "2026/2027", enrolledCount: 2 }] };
const row = (line: number, status: string, reason: string | null, id: string) => ({ line, identifier: id, givenName: "Ivo", familyName: `Student${line}`, status, reason });
const preview = (rows: unknown[]) => ({ importId: IMPORT, source: "isvu", expiresAt: "2026-11-26T10:00:00.000Z", counts: { new: 1, alreadyEnrolled: 0, unsuitable: 1 }, rows });
const mixed = preview([row(2, "new", null, "a@aai-test.hr"), row(3, "unsuitable", "unknown_account", "b@aai-test.hr")]);

function stub(handler: Handler) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const r = input instanceof Request ? input : new Request(String(input), init);
    const call = { method: r.method, path: new URL(r.url, "http://localhost").pathname, query: new URL(r.url, "http://localhost").search.slice(1) };
    calls.push(call);
    const own = handler(call);
    if (own) return own;
    if (call.path.endsWith("/institution/admin/academic-years")) return Response.json({ years: ["2026/2027"] });
    if (call.path.endsWith("/institution/admin/courses")) return Response.json(ownCourses);
    if (call.path.endsWith("/isvu/courses")) return Response.json(sourceCourses);
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
const pick = async () => { await choose("course", COURSE); await choose("source", "K1"); };
const isPreview = (c: Call) => c.path.endsWith("/isvu-roster-imports");
const isConfirm = (c: Call) => c.path.endsWith("/confirm");

describe("Povezivanje s ISVU-om", () => {
  it("shows the trial notice and the choices", async () => {
    stub(() => undefined);
    await mount();
    expect(host!.querySelector("h1")?.textContent).toBe("Povezivanje s ISVU-om (probni izvor)");
    expect(text()).toContain("Probni izvor, izmišljeni podaci; nije povezano sa stvarnim ISVU-om.");
    expect(text()).toContain("Probni kolegij (2)");
  });

  it("loading is its own state", async () => {
    stub((c) => (c.path.endsWith("/isvu/courses") ? new Promise<Response>(() => undefined) as unknown as Response : undefined));
    await mount();
    expect(text()).toContain("Učitavanje…");
  });

  it("an empty source is its own state", async () => {
    stub((c) => (c.path.endsWith("/isvu/courses") ? Response.json({ mode: "mock", courses: [] }) : undefined));
    await mount();
    expect(text()).toContain("Probni izvor nema kolegija.");
  });

  it("a read error is not 'no data' and offers a retry", async () => {
    stub((c) => (c.path.endsWith("/isvu/courses") ? new Response("{}", { status: 503 }) : undefined));
    await mount();
    expect(text()).toContain("Čitanje nije uspjelo");
    expect(text()).not.toContain("nema kolegija");
    expect(button("Pokušaj ponovno")).toBeTruthy();
  });

  it("404 on the source list says the source is not enabled", async () => {
    stub((c) => (c.path.endsWith("/isvu/courses") ? Response.json({ error: "not_found" }, { status: 404 }) : undefined));
    await mount();
    expect(text()).toContain("Izvor nije uključen za ovu ustanovu.");
  });

  it("a preview alone never calls the confirmation", async () => {
    const calls = stub((c) => (isPreview(c) ? Response.json(mixed) : undefined));
    await mount(); await pick(); await click("Pregledaj popis");
    expect(text()).toContain("Novi: 1");
    expect(text()).toContain("Student se još nije prijavio kroz AAI@EduHr");
    expect(calls.some(isConfirm)).toBe(false);
    await click("Potvrdi upis…");
    expect(calls.some(isConfirm)).toBe(false);
  });

  it("confirmation through the dialog shows the result", async () => {
    const calls = stub((c) => (isPreview(c) ? Response.json(mixed) : isConfirm(c) ? Response.json({ enrolled: 1, alreadyEnrolled: 0, skipped: 1, alreadyConfirmed: false }) : undefined));
    await mount(); await pick(); await click("Pregledaj popis"); await click("Potvrdi upis…"); await click("Potvrdi upis");
    expect(calls.filter(isConfirm)).toHaveLength(1);
    expect(text()).toContain("Upisano: 1");
    expect(text()).toContain("Preskočeno: 1");
  });

  it("a failed confirmation keeps the preview", async () => {
    stub((c) => (isPreview(c) ? Response.json(mixed) : isConfirm(c) ? new Response("{}", { status: 503 }) : undefined));
    await mount(); await pick(); await click("Pregledaj popis"); await click("Potvrdi upis…"); await click("Potvrdi upis");
    expect(document.body.textContent).toContain("Upis nije uspio");
    expect(host!.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("410 on the confirmation says the preview expired", async () => {
    stub((c) => (isPreview(c) ? Response.json(mixed) : isConfirm(c) ? Response.json({ error: "import_expired" }, { status: 410 }) : undefined));
    await mount(); await pick(); await click("Pregledaj popis"); await click("Potvrdi upis…"); await click("Potvrdi upis");
    expect(text()).toContain("Pregled je istekao");
    expect(button("Napravi novi pregled")).toBeTruthy();
  });

  it("an unknown or foreign course (404 on the preview) shows the 404 message", async () => {
    stub((c) => (isPreview(c) ? Response.json({ error: "not_found" }, { status: 404 }) : undefined));
    await mount(); await pick(); await click("Pregledaj popis");
    expect(text()).toContain("Kolegij nije dostupan");
    expect(host!.querySelector("table")).toBeNull();
  });

  it("a preview without new students offers no confirmation", async () => {
    stub((c) => (isPreview(c) ? Response.json(preview([row(2, "already_enrolled", null, "a@aai-test.hr")])) : undefined));
    await mount(); await pick(); await click("Pregledaj popis");
    expect(button("Potvrdi upis…")).toBeUndefined();
    expect(text()).toContain("Nema novih studenata");
  });

  it("preview needs both choices", async () => {
    const calls = stub(() => undefined);
    await mount(); await click("Pregledaj popis");
    expect(calls.some(isPreview)).toBe(false);
  });

  it("a late preview for course A is dropped after the choice changed to B", async () => {
    let release: (r: Response) => void = () => undefined;
    const late = new Promise<Response>((done) => { release = done; });
    const calls = stub((c) => (isPreview(c) ? (late as unknown as Response) : undefined));
    await mount(); await pick(); await click("Pregledaj popis");
    await choose("source", "");
    await act(async () => { release(Response.json(mixed)); });
    await settle();
    expect(host!.querySelector("table")).toBeNull();
    expect(button("Potvrdi upis…")).toBeUndefined();
    expect(calls.some(isConfirm)).toBe(false);
  });

  it("the year selector stays when the chosen year has no courses", async () => {
    stub((c) => (c.path.endsWith("/isvu/courses") ? Response.json({ mode: "mock", courses: [] }) : undefined));
    await mount();
    expect(host!.querySelector('select[name="year"]')).not.toBeNull();
  });

  it("a 404 on the own courses is a read error, not 'source not enabled'", async () => {
    stub((c) => (c.path.endsWith("/institution/admin/courses") ? Response.json({ error: "not_found" }, { status: 404 }) : undefined));
    await mount();
    expect(text()).toContain("Čitanje nije uspjelo");
    expect(text()).not.toContain("Izvor nije uključen");
  });

  it("changing the year keeps the year selector and its focus", async () => {
    let release: (r: Response) => void = () => undefined;
    const slow = new Promise<Response>((done) => { release = done; });
    stub((c) => {
      if (c.path.endsWith("/institution/admin/academic-years")) return Response.json({ years: ["2026/2027", "2025/2026"] });
      if (c.path.endsWith("/institution/admin/courses") && c.query === "academicYear=2025%2F2026") return slow as unknown as Response;
      return undefined;
    });
    await mount();
    const select = host!.querySelector('select[name="year"]') as HTMLSelectElement;
    select.focus();
    await act(async () => { select.value = "2025/2026"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(text()).toContain("Učitavanje…");
    expect(host!.querySelector('select[name="year"]')).toBe(select);
    expect(document.activeElement).toBe(select);
    await act(async () => { release(Response.json({ ...ownCourses, academicYear: "2025/2026" })); });
    await settle();
    expect(host!.querySelector('select[name="year"]')).toBe(select);
  });

  it("an answer arriving after unmount sets no state and logs nothing", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let release: (r: Response) => void = () => undefined;
    const late = new Promise<Response>((done) => { release = done; });
    stub((c) => (isPreview(c) ? (late as unknown as Response) : undefined));
    await mount(); await pick(); await click("Pregledaj popis");
    act(() => root!.unmount()); root = null;
    await act(async () => { release(Response.json(mixed)); });
    await settle();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("a 401 on the confirmation is signed out, not a retry loop", async () => {
    stub((c) => (isPreview(c) ? Response.json(mixed) : isConfirm(c) ? Response.json({ error: "unauthorized" }, { status: 401 }) : undefined));
    await mount(); await pick(); await click("Pregledaj popis"); await click("Potvrdi upis…"); await click("Potvrdi upis");
    expect(text()).toContain("Prijava je istekla");
  });
});
