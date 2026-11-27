// @vitest-environment jsdom
// F4-OPE-R04 (OPE-20): CoursesPanel as it runs in the browser. Making a group and assigning a teacher reach the server
// and the list is read again; nothing is shown as done before the answer. Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { courseGroupMessages as g } from "./messages.hr";
import { CoursesPanel } from "./InstitutionPanels";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const COURSE = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const T1 = "33333333-3333-4333-8333-333333333333";
const T2 = "44444444-4444-4444-8444-444444444444";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let root: Root | null = null;
let host: HTMLElement | null = null;
let calls: { method: string; path: string; body: unknown }[] = [];
let post: (path: string) => Response = () => json(200, { id: GROUP });
let teachersStatus = 200;

function server(input: RequestInfo | URL, init?: RequestInit): Response {
  const url = new URL(String(input), "https://ductura.example.invalid");
  const method = init?.method ?? "GET";
  calls.push({ method, path: url.pathname, body: init?.body === undefined ? undefined : JSON.parse(String(init.body)) });
  if (method === "POST") return post(url.pathname);
  if (url.pathname.endsWith("/academic-years")) return json(200, { years: ["2026/2027"] });
  if (url.pathname.endsWith("/admin/courses")) {
    return json(200, { academicYear: "2026/2027", courses: [{
      courseId: COURSE, name: "Izmišljeni seminar", students: 3, holder: null, team: [],
      groups: [{ groupId: GROUP, name: "Grupa A", students: 2, teachers: [{ personId: T1, name: { givenName: "Ana", familyName: "Izmišljena" } }] }],
    }] });
  }
  if (url.pathname.endsWith("/teachers")) {
    return teachersStatus === 200 ? json(200, { pending: [], confirmed: [
      { personId: T1, name: { givenName: "Ana", familyName: "Izmišljena" }, confirmedAt: "2026-10-01T08:00:00.000Z", forReview: false },
      { personId: T2, name: { givenName: "Ivo", familyName: "Primjer" }, confirmedAt: "2026-10-02T08:00:00.000Z", forReview: false },
    ] }) : json(teachersStatus, { error: "x", code: "x", messageKey: "errors.x", status: 0 });
  }
  return json(404, {});
}

const settle = () => act(async () => { await new Promise((done) => setTimeout(done, 0)); });
const text = () => host!.textContent ?? "";
const writes = () => calls.filter((c) => c.method === "POST");
const button = (name: string) => [...host!.querySelectorAll("button")].find((b) => b.textContent === name)!;

async function type(label: string, value: string) {
  const input = [...host!.querySelectorAll("input")].find((i) => i.labels?.[0]?.textContent?.startsWith(label))!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function click(target: HTMLButtonElement) {
  await act(async () => { target.click(); });
  await settle();
}
async function show() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(CoursesPanel)); });
  await settle();
}

beforeEach(() => {
  calls = []; post = () => json(200, { id: GROUP }); teachersStatus = 200;
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => server(input, init)));
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null; host = null;
  vi.unstubAllGlobals();
});

describe("CoursesPanel group tools", () => {
  it("keeps the button off until a name is typed, then creates the group and reads the courses again", async () => {
    await show();
    expect(button(g.create).disabled).toBe(true);
    await type(g.nameLabel, "  Grupa B ");
    const reads = calls.length;
    await click(button(g.create));
    expect(writes()).toEqual([{ method: "POST", path: `/api/v1/institution/courses/${COURSE}/groups`, body: { name: "Grupa B" } }]);
    expect(text()).toContain(g.created);
    expect(calls.length).toBeGreaterThan(reads + 1);
  });

  it("offers only confirmed teachers the group does not have yet, and assigns the chosen one", async () => {
    post = () => json(200, { assigned: true });
    await show();
    const select = host!.querySelector<HTMLSelectElement>("select[aria-label], select")!;
    const selects = [...host!.querySelectorAll("select")].filter((s) => s.closest("section")?.getAttribute("aria-label")?.startsWith(g.assignLabel));
    expect(selects).toHaveLength(1);
    expect([...selects[0]!.options].map((o) => o.value)).toEqual(["", T2]);
    expect(select).toBeDefined();
    expect(button(g.assign).disabled).toBe(true);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(selects[0], T2);
      selects[0]!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click(button(g.assign));
    expect(writes()).toEqual([{ method: "POST", path: `/api/v1/institution/groups/${GROUP}/teachers`, body: { teacherId: T2 } }]);
    expect(text()).toContain(g.assigned);
  });

  it("does not say it was done when the server refuses, and does not read again for a refusal", async () => {
    post = () => json(403, { error: "forbidden", code: "forbidden", messageKey: "errors.forbidden", status: 0 });
    await show();
    await type(g.nameLabel, "Grupa B");
    const reads = calls.length;
    await click(button(g.create));
    expect(text()).toContain(g.forbidden);
    expect(text()).not.toContain(g.ended);
    expect(text()).not.toContain(g.created);
    expect(calls.length).toBe(reads + 1);
  });

  it("says the sign-in ended only for a 401", async () => {
    post = () => json(401, { error: "unauthorized", code: "unauthorized", messageKey: "errors.unauthorized", status: 0 });
    await show();
    await type(g.nameLabel, "Grupa B");
    await click(button(g.create));
    expect(text()).toContain(g.ended);
    expect(text()).not.toContain(g.forbidden);
  });

  it("shows the administrator the instruction instead of removal and return controls", async () => {
    await show();
    expect(text()).toContain("radi nastavnik kolegija");
    expect(button("Ukloni iz kolegija")).toBeUndefined();
    expect(button("Dopusti povratak")).toBeUndefined();
    expect(writes()).toEqual([]);
  });

  it("says the outcome is not confirmed when the answer proves nothing, and reads again", async () => {
    post = () => json(503, { error: "unavailable", code: "unavailable", messageKey: "errors.unavailable", status: 0 });
    await show();
    await type(g.nameLabel, "Grupa B");
    await click(button(g.create));
    expect(text()).toContain(g.unknown);
    expect(text()).not.toContain(g.created);
  });

  it("states that teachers are unavailable instead of an empty list when their read fails", async () => {
    teachersStatus = 503;
    await show();
    expect(text()).toContain(g.teachersUnavailable);
    expect(text()).not.toContain(g.noTeachers);
    expect(button(g.assign)).toBeUndefined();
  });
});
