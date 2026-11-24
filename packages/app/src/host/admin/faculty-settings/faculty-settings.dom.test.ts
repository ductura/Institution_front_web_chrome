// @vitest-environment jsdom
// NF-7 OA-2, OA-9, OA-5 as they run in the browser: react-dom/client over a stubbed fetch with invented answers.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAGES, type Page } from "../../../routes";
import { HostContext } from "../../context";
import MyRightsPage from "../../public/my-rights/MyRightsPage";
import { myRightsMessages } from "../../public/my-rights/messages.hr";
import FacultySettingsRoute from "./routes";
import { facultySettingsMessages as t } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
const settle = () => act(async () => { await new Promise((done) => setTimeout(done, 0)); });
const rules = { rules: [{ workType: "essay", versions: [{ versionNo: 1, aiPolicy: "partially_allowed", aiPurposes: ["formatting"], evidenceProfile: "basic", importAllowed: false, origin: "administrator", publishedAt: "2026-10-01T10:00:00.000Z" }] }] };
const thresholds = { thresholds: [{ origin: "typed", thresholdPercent: 20, strictness: "soft" }] };
const retention = { classes: [{ key: "sessions", label: "retention.sessions", retentionDays: null, mode: "dry-run", candidates: null, lastRunAt: null }] };

function stub(answers: Record<string, () => Response>) {
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    urls.push(url);
    const key = Object.keys(answers).find((k) => url.includes(k));
    return key === undefined ? new Response("{}", { status: 404 }) : answers[key]!();
  });
  return urls;
}

async function mount(path: string, view: "settings" | "assistant") {
  const page = PAGES.find((p) => p.path === path) as Page;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(HostContext.Provider, { value: { base: "/app/web", page, role: "admin" } }, createElement(FacultySettingsRoute, { view })));
  });
  await settle();
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null; host = null;
  vi.unstubAllGlobals();
});
const text = () => host!.textContent ?? "";

describe("Postavke fakulteta (OA-2)", () => {
  it("pokazuje tri kartice s poveznicama, rok koji čeka odluku i obrasce kao nedostupne; samo čita (GET)", async () => {
    const urls = stub({
      "/institution/faculty-rules": () => Response.json(rules),
      "/institution/origin-thresholds": () => Response.json(thresholds),
      "/institution/retention": () => Response.json(retention),
    });
    await mount("/ustanova/postavke", "settings");
    expect(host!.querySelector("h1")?.textContent).toBe(t.title);
    expect(text()).toContain(t.rules.count(1, 7));
    expect(text()).toContain(t.thresholds.count(1, 6));
    expect(text()).toContain(t.retention.awaiting);
    expect(text()).toContain(t.forms.unavailable);
    const links = [...host!.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toEqual(expect.arrayContaining(["/app/web/ustanova/pravila", "/app/web/ustanova/pragovi", "/app/web/ustanova/cuvanje"]));
    expect(urls.length).toBe(3);
  });
  it("kad jedna kartica ne uspije, ostale se vide, a ona nudi ponovni pokušaj", async () => {
    stub({
      "/institution/faculty-rules": () => Response.json(rules),
      "/institution/origin-thresholds": () => Response.json({ error: "unavailable", code: "unavailable", messageKey: "errors.unavailable", status: 503 }, { status: 503 }),
      "/institution/retention": () => Response.json(retention),
    });
    await mount("/ustanova/postavke", "settings");
    expect(text()).toContain(t.rules.count(1, 7));
    expect(text()).toContain(t.unavailable);
    expect([...host!.querySelectorAll("button")].some((b) => b.textContent === t.retry)).toBe(true);
  });
});

describe("Asistent na fakultetu (OA-9)", () => {
  it("kaže da je asistent isključen i pokazuje pravila po vrsti rada, bez imenovanja pružatelja", async () => {
    stub({ "/institution/faculty-rules": () => Response.json(rules) });
    await mount("/ustanova/postavke/asistent", "assistant");
    expect(text()).toContain(t.assistant.off);
    expect(text()).toContain(t.assistant.studentSees);
    expect(host!.querySelectorAll("tbody tr").length).toBe(7);
    expect(text()).toContain("Djelomično dopuštena");
    expect(text()).toContain(t.assistant.noRule);
    expect(host!.querySelectorAll("input, select, textarea").length).toBe(0);
  });
  it("kad pravila nisu dostupna, i dalje kaže da je asistent isključen i nudi ponovni pokušaj", async () => {
    stub({ "/institution/faculty-rules": () => Response.json({}, { status: 503 }) });
    await mount("/ustanova/postavke/asistent", "assistant");
    expect(text()).toContain(t.assistant.off);
    expect(text()).toContain(t.unavailable);
  });
});

describe("Moja prava (OA-5)", () => {
  it("je statična: naslov, četiri odjeljka i napomena o pravnom pregledu, bez mreže", async () => {
    const urls = stub({});
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root!.render(createElement(MyRightsPage)); });
    expect(host.querySelector("h1")?.textContent).toBe(myRightsMessages.title);
    expect(host.querySelectorAll("h2").length).toBe(4);
    expect(text()).toContain(myRightsMessages.pendingReview);
    expect(urls).toEqual([]);
  });
});
