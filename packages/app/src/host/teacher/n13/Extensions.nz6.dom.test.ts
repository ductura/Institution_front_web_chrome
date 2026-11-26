// @vitest-environment jsdom
// NZ-6 on the screen: the filter "Prikaži produljenja za" keeps one student's extensions and those for all, and each
// row says what the student reads; the reason of another teacher is said as hidden. The port is a fake.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { HostContext, type HostValue } from "../../context";
import N13Extensions from "./Extensions";
import { fakeN13Port } from "./fake-port";
import { n13Messages as t } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const HOST = { base: "/app/web", page: { path: "/nastavnik" }, role: "teacher" } as unknown as HostValue;

describe("N13Extensions filter (NZ-6)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = async () => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(HostContext.Provider, { value: HOST }, h(N13Extensions, { assignmentId: "a-1", port: fakeN13Port() }))); });
    return host;
  };
  const choose = async (host: HTMLElement, label: string, value: string) => {
    const field = [...host.querySelectorAll("label")].find((l) => l.textContent === label)!;
    const select = document.getElementById(field.getAttribute("for")!) as HTMLSelectElement;
    await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
  };
  const rows = (host: HTMLElement) => [...host.querySelectorAll("ul.list > li")].map((li) => [...li.querySelectorAll("span")].map((s) => s.textContent));

  it("narrows to one student plus the extensions for all, and back", async () => {
    const host = await mount();
    expect(rows(host)).toHaveLength(2);
    await choose(host, t.filter, "s-1");
    expect(rows(host).map((r) => r[0])).toEqual([`${t.allStudents} · ${t.newDue} 14. 11. 2026. u 23:59`]);
    await choose(host, t.filter, "s-4");
    expect(rows(host)).toHaveLength(2);
    await choose(host, t.filter, "");
    expect(rows(host)).toHaveLength(2);
    expect(host.textContent).not.toContain(t.filterEmpty);
  });

  it("says what the student reads, with the reason or that it is hidden from this teacher", async () => {
    const host = await mount();
    const [own, other] = rows(host);
    expect(own).toContain("Student vidi: Bio 8. 11. 2026. u 23:59, razlog: Opravdan razlog");
    expect(own).not.toContain(t.studentSeesHidden);
    expect(other).toContain("Student vidi: Bio 12. 11. 2026. u 23:59, razlog: (skriven Vama)");
    expect(other).toContain(t.studentSeesHidden);
  });

  it("NAS-R14: warns with the submission time when a student who already submitted is chosen, and for all", async () => {
    const host = await mount();
    const warn = () => host.querySelector("[data-testid='n13-existing-submission']")?.textContent ?? null;
    expect(warn()).toBeNull();
    await act(async () => { host.querySelector<HTMLInputElement>("input[value='all']")!.click(); });
    expect(warn()).toContain("Predaja već postoji kod 1 studenta");
    await act(async () => { host.querySelector<HTMLInputElement>("input[value='one']")!.click(); });
    expect(warn()).toBeNull();
    await choose(host, t.student, "s-2");
    expect(warn()).toContain("Predaja studenta Marko Babić već postoji (zatraženo 8. 11. 2026. u 22:15)");
    await choose(host, t.student, "s-1");
    expect(warn()).toBeNull();
  });
});
