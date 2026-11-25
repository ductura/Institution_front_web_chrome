// @vitest-environment jsdom
// WEB-V16-ETAPE-ADMIN in the browser: react-dom/client over a stubbed fetch with invented answers.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGES, type Page } from "../../../routes";
import { HostContext } from "../../context";
import MilestoneTemplateRoute from "./routes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
const settle = () => act(async () => { await new Promise((done) => setTimeout(done, 0)); });
const v1 = { version: 1, effectiveFrom: "2026-10-01T10:00:00.000Z", requireFinalStageApproval: false, milestones: [{ title: "Prijedlog teme", relativeDue: 14, submits: "topic_text" }] };
const v2 = { ...v1, version: 2, requireFinalStageApproval: true };

type Call = { method: string; body: unknown };
function stub(handlers: { get: () => Response; put?: (body: unknown) => Response }) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const method = request.method;
    const body = method === "PUT" ? JSON.parse(await request.text()) : undefined;
    calls.push({ method, body });
    return method === "PUT" ? handlers.put!(body) : handlers.get();
  });
  return calls;
}
async function mount() {
  const page = PAGES.find((p) => p.path === "/ustanova/etape") as Page;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(HostContext.Provider, { value: { base: "/app/web", page, role: "admin" } }, createElement(MilestoneTemplateRoute))); });
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

describe("Predložak etapa", () => {
  it("prikazuje verziju na snazi i povijest", async () => {
    stub({ get: () => Response.json({ current: v2, versions: [v1, v2] }) });
    await mount();
    expect(host!.querySelector("h1")?.textContent).toBe("Predložak etapa");
    expect(text()).toContain("Verzija 2");
    expect(text()).toContain("Prijedlog teme");
    expect(host!.querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("sprema s expectedVersion i novim rokom; ne šalje ništa pri nevaljanom roku", async () => {
    const calls = stub({ get: () => Response.json({ current: v1, versions: [v1] }), put: () => Response.json({ ...v1, version: 2, milestones: [{ ...v1.milestones[0], relativeDue: 30 }] }) });
    await mount();
    type(inputByLabel("Rok u danima"), "1096");
    await click("Spremi novu verziju");
    expect(text()).toContain("Rok mora biti cijeli broj dana od 1 do 1095");
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
    type(inputByLabel("Rok u danima"), "30");
    await click("Spremi novu verziju");
    const put = calls.filter((c) => c.method === "PUT");
    expect(put).toHaveLength(1);
    expect(put[0]!.body).toEqual({ expectedVersion: 1, requireFinalStageApproval: false, milestones: [{ title: "Prijedlog teme", relativeDue: 30, submits: "topic_text" }] });
    expect(text()).toContain("spremljen kao verzija 2");
  });

  it("ne dopušta 21. etapu i ne šalje nepromijenjen predložak", async () => {
    const calls = stub({ get: () => Response.json({ current: v1, versions: [v1] }), put: () => Response.json(v2) });
    await mount();
    for (let i = 0; i < 25; i++) if (!button("Dodaj etapu").disabled) await click("Dodaj etapu");
    expect(host!.querySelectorAll("fieldset")).toHaveLength(20);
    expect(button("Dodaj etapu").disabled).toBe(true);
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
    await click("Dodaj etapu");
    type(inputByLabel("Naziv etape", 1), "Nacrt rada");
    await click("Spremi novu verziju");
    expect(text()).toContain("Predložak je u međuvremenu promijenjen");
    expect(text()).toContain("Verzija 2");
    expect(gets).toBe(2);
  });

  it("403 pokazuje da predložak vidi samo administrator, bez obrasca", async () => {
    stub({ get: () => Response.json({ error: "forbidden" }, { status: 403 }) });
    await mount();
    expect(text()).toContain("samo administrator ustanove");
    expect(host!.querySelector("button")).toBeNull();
  });

  it("greška poslužitelja nije 'nema predloška' i nudi ponovni pokušaj", async () => {
    stub({ get: () => new Response("{}", { status: 503 }) });
    await mount();
    expect(text()).toContain("trenutačno nije dostupan");
    expect(text()).not.toContain("još nije spremljen");
    expect(button("Pokušaj ponovno")).toBeTruthy();
  });
});
