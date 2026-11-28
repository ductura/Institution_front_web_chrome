// @vitest-environment jsdom
// WEB-V17-TEMPLATE-ADMIN in the browser: react-dom/client over a stubbed fetch with invented answers.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGES, type Page } from "../../../routes";
import { HostContext } from "../../context";
import FacultySettingsRoute from "../faculty-settings/routes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
const settle = () => act(async () => { await new Promise((done) => setTimeout(done, 0)); });
const v1 = { version: 1, effectiveFrom: "2026-10-01T10:00:00.000Z", titlePage: ["title", "author"], sections: [{ title: "Uvod", hint: "Cilj rada" }], citationStyle: "fpzg" };
const v2 = { ...v1, version: 2, titlePage: ["title"] };

type Call = { method: string; url: string; body: unknown };
function stub(handlers: { get: (type: string) => Response; put?: (body: unknown, type: string) => Response }) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const type = new URL(request.url).pathname.split("/").pop()!;
    const body = request.method === "PUT" ? JSON.parse(await request.text()) : undefined;
    calls.push({ method: request.method, url: request.url, body });
    return request.method === "PUT" ? handlers.put!(body, type) : handlers.get(type);
  });
  return calls;
}
async function mount() {
  const page = PAGES.find((p) => p.path === "/ustanova/predlozak-rada") as Page;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(HostContext.Provider, { value: { base: "/aplikacija", page, role: "admin" } }, createElement(FacultySettingsRoute, { view: "work-template" }))); });
  await settle();
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; vi.unstubAllGlobals(); });
const text = () => host!.textContent ?? "";
const button = (label: string) => [...host!.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;
const click = async (label: string) => { await act(async () => { button(label).click(); }); await settle(); };
function type(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => { set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
}
const inputByLabel = (label: string, nth = 0) =>
  [...host!.querySelectorAll("label")].filter((l) => l.textContent === label).map((l) => document.getElementById(l.htmlFor) as HTMLInputElement)[nth]!;
async function pick(value: string) {
  const select = host!.querySelector("select") as HTMLSelectElement;
  await act(async () => { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await settle();
}

describe("Predložak rada", () => {
  it("prikazuje verziju na snazi i povijest za zadanu vrstu rada", async () => {
    const calls = stub({ get: () => Response.json({ current: v2, versions: [v1, v2] }) });
    await mount();
    expect(host!.querySelector("h1")?.textContent).toBe("Predložak rada");
    expect(calls[0]!.url).toContain("/api/v1/institution/work-templates/short_paper");
    expect(text()).toContain("Verzija 2");
    expect(text()).toContain("Uvod");
    expect(host!.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("promjena vrste rada čita predložak te vrste", async () => {
    const calls = stub({ get: (type) => Response.json(type === "essay" ? { current: null, versions: [] } : { current: v1, versions: [v1] }) });
    await mount();
    await pick("essay");
    expect(calls.map((c) => c.url.split("/").pop())).toEqual(["short_paper", "essay"]);
    expect(text()).toContain("još nije spremljen");
    expect(text()).not.toContain("Verzija 1");
  });

  it("sprema s expectedVersion; ne šalje ništa za prazan naziv odjeljka", async () => {
    const calls = stub({ get: () => Response.json({ current: v1, versions: [v1] }), put: () => Response.json({ ...v1, version: 2 }) });
    await mount();
    await click("Dodaj odjeljak");
    await click("Spremi novu verziju");
    expect(text()).toContain("Naziv odjeljka je obavezan");
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
    type(inputByLabel("Naziv odjeljka", 1), "Zaključak");
    await click("Spremi novu verziju");
    const put = calls.filter((c) => c.method === "PUT");
    expect(put).toHaveLength(1);
    expect(put[0]!.url).toContain("/short_paper");
    expect(put[0]!.body).toEqual({ expectedVersion: 1, titlePage: ["title", "author"], sections: [{ title: "Uvod", hint: "Cilj rada" }, { title: "Zaključak", hint: "" }], citationStyle: "fpzg" });
    expect(text()).toContain("spremljen na poslužitelju kao verzija 2");
  });

  it("ne dopušta 31. odjeljak i ne šalje nepromijenjen predložak", async () => {
    const calls = stub({ get: () => Response.json({ current: v1, versions: [v1] }), put: () => Response.json(v2) });
    await mount();
    for (let i = 0; i < 35; i++) if (!button("Dodaj odjeljak").disabled) await click("Dodaj odjeljak");
    expect(host!.querySelectorAll("fieldset")).toHaveLength(31); // 30 sections + the title-page group
    expect(button("Dodaj odjeljak").disabled).toBe(true);
    await click("Vrati na verziju na snazi");
    await click("Spremi novu verziju");
    expect(text()).toContain("Nema promjena");
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("konflikt 409 prikazuje poruku i učitava verziju na snazi", async () => {
    let gets = 0;
    stub({
      get: () => Response.json(++gets === 1 ? { current: v1, versions: [v1] } : { current: v2, versions: [v1, v2] }),
      put: () => Response.json({ error: "conflict" }, { status: 409 }),
    });
    await mount();
    await click("Dodaj odjeljak");
    type(inputByLabel("Naziv odjeljka", 1), "Zaključak");
    await click("Spremi novu verziju");
    expect(text()).toContain("Predložak je u međuvremenu promijenjen");
    expect(text()).toContain("Verzija 2");
    expect(gets).toBe(2);
  });

  it("403 pokazuje da predložak vidi samo administrator, bez obrasca", async () => {
    stub({ get: () => Response.json({ error: "forbidden" }, { status: 403 }) });
    await mount();
    expect(text()).toContain("Nemate pristup ovom prikazu");
    expect(text()).not.toContain("samo administrator");
    expect([...host!.querySelectorAll("a")].map((a) => a.textContent)).toContain("Natrag na moj prostor");
    expect(button("Spremi novu verziju")).toBeUndefined();
  });

  it("greška poslužitelja nije 'nema predloška' i nudi ponovni pokušaj", async () => {
    stub({ get: () => new Response("{}", { status: 503 }) });
    await mount();
    expect(text()).toContain("trenutačno nije dostupan");
    expect(text()).not.toContain("još nije spremljen");
    expect(button("Pokušaj ponovno")).toBeTruthy();
  });
});
