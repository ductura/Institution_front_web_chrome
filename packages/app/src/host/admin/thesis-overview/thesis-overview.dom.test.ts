// @vitest-environment jsdom
// WEB-V16-POPIS-FAKULTET in the browser: react-dom/client over a stubbed fetch with invented answers.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGES, type Page } from "../../../routes";
import { HostContext } from "../../context";
import ThesisOverviewRoute from "./routes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
const settle = () => act(async () => { await new Promise((done) => setTimeout(done, 0)); });
const work = (id: string, over: Record<string, unknown> = {}) => ({
  documentId: id, workType: "master_thesis", mentorName: { givenName: "Ana", familyName: "Primjer" }, studentName: { givenName: "Ivo", familyName: `Student${id}` },
  stage: "submitted_to_office", defenseAt: null, topicState: "approved", committeeSize: 2, ...over,
});

type Call = { method: string; url: URL };
function stub(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const call = { method: request.method, url: new URL(request.url, "http://localhost") };
    calls.push(call);
    return handler(call);
  });
  return calls;
}
const overview = (calls: Call[]) => calls.filter((c) => c.url.pathname.endsWith("/institution/thesis-overview"));
async function mount() {
  const page = PAGES.find((p) => p.path === "/ustanova/zavrsni-radovi") as Page;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(HostContext.Provider, { value: { base: "/aplikacija", page, role: "admin" } }, createElement(ThesisOverviewRoute))); });
  await settle();
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; vi.unstubAllGlobals(); });
const text = () => host!.textContent ?? "";
const button = (label: string) => [...host!.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;
const click = async (label: string) => { await act(async () => { button(label).click(); }); await settle(); };
const rowsCount = () => host!.querySelectorAll("tbody tr").length;

describe("Završni i diplomski radovi", () => {
  it("prikazuje tablicu bez stupca ocjene", async () => {
    stub(() => Response.json({ works: [work("a", { defenseAt: "2026-12-01T09:00:00.000Z", stage: "defense_scheduled" }), work("b")], next: null }));
    await mount();
    expect(host!.querySelector("h1")?.textContent).toBe("Završni i diplomski radovi");
    expect(rowsCount()).toBe(2);
    expect(text()).toContain("Diplomski rad");
    expect(text()).toContain("Zakazana obrana");
    expect(text()).toContain("2 člana");
    expect(text()).not.toMatch(/ocjen/i);
    expect([...host!.querySelectorAll("th")].map((h) => h.textContent).join("|")).not.toMatch(/ocjen/i);
  });

  it("filtar šalje samo dopuštenu fazu", async () => {
    const calls = stub(() => Response.json({ works: [], next: null }));
    await mount();
    const select = host!.querySelector("select") as HTMLSelectElement;
    await act(async () => { select.value = "defended"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await settle();
    const stages = overview(calls).map((c) => c.url.searchParams.get("stage"));
    expect(stages).toEqual([null, "defended"]);
    expect(text()).toContain("Nema radova u ovoj fazi");
  });

  it("'Učitaj još' šalje kursor i dodaje ostatak bez ponavljanja", async () => {
    const calls = stub((c) => {
      const after = c.url.searchParams.get("after");
      return Response.json(after === null ? { works: [work("a"), work("b")], next: "k1" } : { works: [work("b"), work("c")], next: null });
    });
    await mount();
    expect(rowsCount()).toBe(2);
    await click("Učitaj još");
    expect(overview(calls).map((c) => c.url.searchParams.get("after"))).toEqual([null, "k1"]);
    expect(rowsCount()).toBe(3);
    expect(host!.textContent).not.toContain("Učitaj još");
  });

  it("neuspjelo dohvaćanje sljedeće stranice zadržava prikazane radove i nudi ponovni pokušaj", async () => {
    let n = 0;
    stub(() => (++n === 1 ? Response.json({ works: [work("a")], next: "k1" }) : new Response("{}", { status: 503 })));
    await mount();
    await click("Učitaj još");
    expect(rowsCount()).toBe(1);
    expect(text()).toContain("Sljedeći radovi trenutačno nisu dostupni");
    expect(button("Učitaj još")).toBeTruthy();
  });

  it("greška poslužitelja nije 'nema radova' i nudi ponovni pokušaj", async () => {
    stub(() => new Response("{}", { status: 503 }));
    await mount();
    expect(text()).toContain("trenutačno nije dostupan");
    expect(text()).not.toContain("nema završnih");
    expect(button("Pokušaj ponovno")).toBeTruthy();
  });

  it("odgovor pogrešnog oblika je nedostupno, ne prazan popis", async () => {
    stub(() => Response.json({ works: [{ stage: "graded" }], next: null }));
    await mount();
    expect(text()).toContain("trenutačno nije dostupan");
    expect(rowsCount()).toBe(0);
  });

  it("prazan popis ustanove je zasebno stanje", async () => {
    stub(() => Response.json({ works: [], next: null }));
    await mount();
    expect(text()).toContain("Ustanova još nema završnih ni diplomskih radova");
  });

  it("403 pokazuje samo „Nemate pristup ovom prikazu” i „Natrag na moj prostor”, bez tablice i bez teksta greške", async () => {
    stub(() => Response.json({ error: "forbidden" }, { status: 403 }));
    await mount();
    expect(host!.querySelector("h1")?.textContent).toBe("Nemate pristup ovom prikazu");
    expect(host!.querySelector("a")?.textContent).toBe("Natrag na moj prostor");
    expect(host!.querySelector("a")?.getAttribute("href")).toBe("/aplikacija/ustanova");
    expect(text()).not.toContain("samo administrator");
    expect(host!.querySelector("table")).toBeNull();
    expect(host!.querySelector("[role=alert]")).toBeNull();
  });

  it("401 ne ispisuje ništa na stranici, nego vodi na prijavu", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign, pathname: "/aplikacija/ustanova/zavrsni-radovi" });
    stub(() => Response.json({ error: "unauthorized" }, { status: 401 }));
    await mount();
    expect(text()).toBe("");
    expect(assign).toHaveBeenCalledTimes(1);
    expect(String(assign.mock.calls[0]![0])).toContain("zavrsni-radovi");
  });

  it("datum obrane je s punim mjesecom i bez „·”", async () => {
    stub(() => Response.json({ works: [work("a", { defenseAt: "2026-12-14T09:30:00.000Z", stage: "defense_scheduled" })], next: null }));
    await mount();
    expect(text()).toContain("14. prosinca 2026. u 10:30");
    expect(text()).not.toContain("·");
    expect(text()).not.toMatch(/14\. 12\./);
  });

  it("nedostupan popis je okvir role=alert s poveznicom, a poveznica čita ponovno", async () => {
    let n = 0;
    const calls = stub(() => (++n === 1 ? new Response("{}", { status: 503 }) : Response.json({ works: [work("a")], next: null })));
    await mount();
    const alert = host!.querySelector("[role=alert]")!;
    expect(alert.textContent).toContain("trenutačno nije dostupan");
    expect(alert.querySelector("button, a")).toBeNull();
    await click("Pokušaj ponovno");
    expect(overview(calls)).toHaveLength(2);
    expect(rowsCount()).toBe(1);
    expect(host!.querySelector("[role=alert]")).toBeNull();
  });

  it("sljedeći radovi: okvir role=alert bez poveznice „Pokušaj ponovno”, gumb „Učitaj još” radi isto", async () => {
    let n = 0;
    stub(() => (++n === 1 ? Response.json({ works: [work("a")], next: "k1" }) : new Response("{}", { status: 503 })));
    await mount();
    await click("Učitaj još");
    const alert = host!.querySelector("[role=alert]")!;
    expect(alert.textContent).toContain("Sljedeći radovi trenutačno nisu dostupni");
    expect(button("Pokušaj ponovno")).toBeUndefined();
    expect(button("Učitaj još")).toBeTruthy();
  });

  it("povjerenstvo nedostupno: okvir role=alert i poveznica koja ponovno čita povjerenstvo", async () => {
    let tries = 0;
    stub((c) => {
      if (c.url.pathname.endsWith("/institution/thesis-overview")) return Response.json({ works: [work("a")], next: null });
      if (c.url.pathname.endsWith("/works/a/thesis-committee")) return ++tries === 1 ? new Response("{}", { status: 503 }) : Response.json({ members: [], changedAt: null, changedByPart: null });
      return Response.json({ pending: [], confirmed: [] });
    });
    await mount();
    await click("Povjerenstvo");
    expect(host!.querySelector("section [role=alert]")?.textContent).toContain("Povjerenstvo trenutačno nije dostupno");
    await click("Pokušaj ponovno");
    expect(tries).toBe(2);
    expect(host!.querySelector("section [role=alert]")).toBeNull();
    expect(host!.querySelector("form")).not.toBeNull();
  });

  it("fokus ide na naslov povjerenstva pri otvaranju, a nakon „Zatvori” natrag na gumb „Povjerenstvo” u retku", async () => {
    stub((c) => {
      if (c.url.pathname.endsWith("/institution/thesis-overview")) return Response.json({ works: [work("a"), work("b")], next: null });
      if (c.url.pathname.includes("/thesis-committee")) return Response.json({ members: [], changedAt: null, changedByPart: null });
      return Response.json({ confirmed: [] });
    });
    await mount();
    const second = [...host!.querySelectorAll("button")].filter((b) => b.textContent === "Povjerenstvo")[1]!;
    await act(async () => { second.click(); });
    await settle();
    const heading = host!.querySelector("section h2") as HTMLElement;
    expect(heading.textContent).toBe("Povjerenstvo rada: Ivo Studentb");
    expect(document.activeElement).toBe(heading);
    await click("Zatvori");
    expect(host!.querySelector("section h2")).toBeNull();
    expect(document.activeElement).toBe(second);
  });

  it("redak otvara povjerenstvo rada; 404 je zasebno stanje", async () => {
    const calls = stub((c) => {
      if (c.url.pathname.endsWith("/institution/thesis-overview")) return Response.json({ works: [work("a")], next: null });
      if (c.url.pathname.endsWith("/works/a/thesis-committee")) return Response.json({ error: "not_found" }, { status: 404 });
      return Response.json({ confirmed: [] });
    });
    await mount();
    await click("Povjerenstvo");
    expect(calls.some((c) => c.url.pathname.endsWith("/works/a/thesis-committee"))).toBe(true);
    expect(text()).toContain("Ovaj rad nije dostupan");
    expect(text()).not.toContain("Povjerenstvo još nije imenovano");
  });

  it("redak bez rada nema gumb povjerenstva", async () => {
    stub(() => Response.json({ works: [work("a", { documentId: null })], next: null }));
    await mount();
    expect(rowsCount()).toBe(1);
    expect(button("Povjerenstvo")).toBeUndefined();
    expect(text()).toContain("Nije dostupno");
  });

  it("zakašnjeli 404 rada A ne zatvara uređivač rada B", async () => {
    let release: (r: Response) => void = () => undefined;
    const late = new Promise<Response>((done) => { release = done; });
    stub((c) => {
      const p = c.url.pathname;
      if (p.endsWith("/institution/thesis-overview")) return Response.json({ works: [work("a"), work("b")], next: null });
      if (p.endsWith("/works/a/thesis-committee")) return c.method === "PUT" ? (late as unknown as Response) : Response.json({ members: [{ userId: "5b1f2c3d-0000-4000-8000-000000000001", name: { givenName: "Eva", familyName: "Izmišljena" }, role: "member" }], changedAt: null, changedByPart: null });
      if (p.endsWith("/works/b/thesis-committee")) return Response.json({ members: [], changedAt: null, changedByPart: null });
      return Response.json({ confirmed: [{ personId: "5b1f2c3d-0000-4000-8000-000000000001", name: { givenName: "Eva", familyName: "Izmišljena" } }] });
    });
    await mount();
    const open = async (n: number) => { await act(async () => { [...host!.querySelectorAll("button")].filter((b) => b.textContent === "Povjerenstvo")[n]!.click(); }); await settle(); };
    await open(0);
    await click("Ukloni");
    await act(async () => { (host!.querySelector('button[type="submit"]') as HTMLButtonElement).click(); });
    await open(1);
        await act(async () => { release(Response.json({ error: "not_found" }, { status: 404 })); });
    await settle();
    expect(host!.querySelector("form")).not.toBeNull();
    expect(text()).toContain("Studentb");
  });
});
