// @vitest-environment jsdom
// OPE-R08 as it runs in the browser: the real page over a stubbed fetch with invented answers.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import ConfigPage from "./ConfigPage";
import { configMessages as t } from "./messages.config.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
const settle = () => act(async () => { await new Promise((done) => setTimeout(done, 0)); });
const v1 = { version: 1, effectiveFrom: "2026-10-01T10:00:00.000Z", rules: { citationStyle: "fpzg", workLanguages: ["hr"], defaultWorkLanguage: "hr" } };
const v2 = { version: 2, effectiveFrom: "2026-11-01T10:00:00.000Z", rules: { citationStyle: "fpzg", workLanguages: ["hr", "en"], defaultWorkLanguage: "hr" } };

function stub(get: () => Response, post?: () => Response) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = String(request?.url ?? input);
    const method = request?.method ?? init?.method ?? "GET";
    calls.push({ url, method });
    return method === "POST" && post !== undefined ? post() : get();
  });
  return calls;
}
async function mount() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(ConfigPage)); });
  await settle();
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; vi.unstubAllGlobals(); });
const text = () => host!.textContent ?? "";
const click = async (label: string) => {
  const button = [...host!.querySelectorAll("button")].find((b) => b.textContent === label);
  expect(button, label).toBeDefined();
  await act(async () => { button!.click(); });
  await settle();
};

describe("Postavke ustanove (OPE-R08)", () => {
  it("pokazuje verziju na snazi i povijest", async () => {
    const calls = stub(() => Response.json({ current: v2, versions: [v1, v2] }));
    await mount();
    expect(text()).toContain(t.currentHeading);
    expect(text()).toContain("hrvatski, engleski");
    expect(text()).toContain(t.historyHeading);
    expect(calls.map((c) => c.method)).toEqual(["GET"]);
  });
  it("greška poslužitelja nije prazno stanje", async () => {
    stub(() => Response.json({ error: "unavailable", code: "unavailable", messageKey: "errors.unavailable", status: 503 }, { status: 503 }));
    await mount();
    expect(text()).toContain(t.unavailable);
    expect(text()).not.toContain(t.noVersion);
  });
  it("403 pokazuje da stranicu vidi samo administrator", async () => {
    stub(() => Response.json({ error: "forbidden", code: "forbidden", messageKey: "errors.forbidden", status: 403 }, { status: 403 }));
    await mount();
    expect(text()).toContain(t.denied);
  });
  it("bez verzije: prvu objavu treba pregledati razliku, pa objava šalje expectedVersion 0", async () => {
    const calls = stub(() => Response.json({ current: null, versions: [] }), () => Response.json(v1, { status: 201 }));
    await mount();
    expect(text()).toContain(t.noVersion);
    await click(t.review);
    expect(text()).toContain(t.diffHeadingFirst);
    await click(t.publish);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(text()).toContain(t.published.replace("{n}", "1"));
  });
  it("nepromijenjen obrazac ne nudi objavu", async () => {
    const calls = stub(() => Response.json({ current: v2, versions: [v1, v2] }));
    await mount();
    await click(t.review);
    expect(text()).toContain(t.diffNone);
    expect([...host!.querySelectorAll("button")].some((b) => b.textContent === t.publish)).toBe(false);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });
  it("409 pokazuje obavijest o novijoj verziji", async () => {
    stub(() => Response.json({ current: v1, versions: [v1] }), () => Response.json({ error: "conflict", code: "conflict", messageKey: "errors.conflict", status: 409 }, { status: 409 }));
    await mount();
    const checkbox = [...host!.querySelectorAll<HTMLInputElement>("input[type=checkbox]")].find((i) => i.parentElement?.textContent?.includes("engleski") || i.labels?.[0]?.textContent === "engleski")!;
    await act(async () => { checkbox.click(); });
    await click(t.review);
    await click(t.publish);
    expect(text()).toContain(t.stale);
  });
});
