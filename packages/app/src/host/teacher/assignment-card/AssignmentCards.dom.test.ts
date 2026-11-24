// @vitest-environment jsdom
// WEB-NUZ-NZ NZ-1 and NZ-2: the course card as a teacher meets it. Every entry of an assignment is a link to a
// page of the host; "Produljenje roka…" and "Izvoz za Merlin…" ask which assignment (a passed one too);
// `?kod=` opens dk-h for the holder; a collaborator gets no entry that writes. Invented data only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HostContext, type HostValue } from "../../context";
import type { TeacherCourse } from "../../../../../../src/components/teacher/teacher-courses-read";
import { AssignmentCards } from "./AssignmentCards";
import { assignmentCardMessages as t } from "./messages.hr";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const search = { value: "" };
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
const role = { value: "holder" as "holder" | "assistant" };
vi.mock("../../../../../../src/client/teaching-team", () => ({
  createTeachingTeam: () => ({
    read: async () => ({ kind: "ready", view: role.value === "holder"
      ? { role: "holder", students: [], groups: [], assistantIds: [] }
      : { role: "assistant", groups: [] } }),
  }),
}));

const K1 = "00000000-0000-4000-8000-0000000000c1";
const A1 = "00000000-0000-4000-8000-0000000000a1";
const A2 = "00000000-0000-4000-8000-0000000000a2";
const task = (id: string, title: string, dueAt: string) => ({
  id, title, workType: "essay", opensAt: "2026-10-01T08:00:00.000Z", dueAt, currentVersion: 1, enrolledStudents: 3,
});
const COURSE = {
  id: K1, name: "Izmišljeni kolegij", academicYear: "2026/2027", aiPolicy: "partially_allowed",
  assignments: [task(A1, "Kućno kompostiranje", "2099-12-15T22:59:00.000Z"), task(A2, "Prikaz članka", "2020-11-08T22:59:00.000Z")],
} as unknown as TeacherCourse;
const HOST = { base: "/app/web", page: { path: "/nastavnik" }, role: "teacher" } as unknown as HostValue;

describe("N-01 course card entries (NZ-1, NZ-2)", () => {
  let root: Root | undefined;
  beforeEach(() => {
    search.value = "";
    role.value = "holder";
    // The practice flag reads institution.assignment.get; here it fails, so no badge.
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
  });
  afterEach(() => {
    act(() => root?.unmount());
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  async function mount() {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(h(HostContext.Provider, { value: HOST }, h(AssignmentCards, { courses: [COURSE], here: "/app/web/nastavnik" })));
    });
    return host;
  }
  const links = (host: HTMLElement, title: string) => [...host.querySelectorAll(`[aria-label="${t.taskActions}: ${title}"] a`)]
    .map((a) => [a.textContent, a.getAttribute("href")]);
  const button = (host: HTMLElement, name: string) => [...host.querySelectorAll("button")].find((b) => b.textContent === name)!;

  it("gives every assignment its six entries, each a page of the host", async () => {
    const host = await mount();
    expect(links(host, "Prikaz članka")).toEqual([
      ["Predaje", `/app/web/nastavnik/zadatak/${A2}/predaje`],
      ["Uredi (nova verzija)", `/app/web/nastavnik/zadatak/${A2}/uredi`],
      ["Kopiraj zadatak", `/app/web/nastavnik/zadatak/${A2}/uredi?kopiraj=1`],
      ["Produljenje", `/app/web/nastavnik/zadatak/${A2}/produljenje`],
      ["Izvoz", `/app/web/nastavnik/zadatak/${A2}/merlin`],
      ["Brz put kroz radove", `/app/web/nastavnik/brz-put?zadatak=${A2}`],
    ]);
    const overview = [...host.querySelectorAll("a")].find((a) => a.textContent === t.overview)!;
    expect(overview.getAttribute("href")).toBe(`/app/web/nastavnik/zbirni?kolegij=${K1}`);
  });

  it("asks which assignment for an extension, offers a passed one and goes to its page", async () => {
    const host = await mount();
    await act(async () => button(host, t.extension).click());
    const dialog = host.querySelector("dialog")!;
    expect(dialog.textContent).toContain(t.pickLead.extension);
    const select = dialog.querySelector("select")!;
    expect([...select.options].map((o) => o.textContent)).toEqual([t.pickPlaceholder, "Kućno kompostiranje · rok 15. 12. 2099. u 23:59", "Prikaz članka · rok je prošao"]);
    await act(async () => button(host, t.pickGo).click());
    expect(dialog.textContent).toContain(t.pickNone);
    await act(async () => {
      select.value = A2;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const go = [...dialog.querySelectorAll("a")].find((a) => a.textContent === t.pickGo)!;
    expect(go.getAttribute("href")).toBe(`/app/web/nastavnik/zadatak/${A2}/produljenje`);
  });

  it("asks which assignment for the Merlin export", async () => {
    const host = await mount();
    await act(async () => button(host, t.merlin).click());
    const select = host.querySelector("dialog select") as HTMLSelectElement;
    await act(async () => {
      select.value = A1;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const go = [...host.querySelectorAll("dialog a")].find((a) => a.textContent === t.pickGo)!;
    expect(go.getAttribute("href")).toBe(`/app/web/nastavnik/zadatak/${A1}/merlin`);
  });

  it("opens dk-h for the holder when the empty roster sent `?kod=`", async () => {
    search.value = `kod=${K1}`;
    const host = await mount();
    expect(host.querySelector("dialog")?.textContent).toContain(t.dialogLead);
  });

  it("a collaborator reads only: Predaje and Brz put, no chooser and no dk-h", async () => {
    role.value = "assistant";
    search.value = `kod=${K1}`;
    const host = await mount();
    expect(links(host, "Kućno kompostiranje").map(([label]) => label)).toEqual(["Predaje", "Brz put kroz radove"]);
    expect(button(host, t.extension)).toBeUndefined();
    expect(button(host, t.merlin)).toBeUndefined();
    expect(host.querySelector("dialog")).toBeNull();
  });
});
