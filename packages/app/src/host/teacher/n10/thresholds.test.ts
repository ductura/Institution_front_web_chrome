// @vitest-environment jsdom
// P-1 rule 12 in the N-10 summary (PIL-P1-PRAGOVI-PRIKAZ): the three labels per kind, the notice, and nothing
// at all without faculty thresholds. Invented work and rules only; no real person or text.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FAKE_DETAILS, FAKE_SUMMARY, FAKE_THRESHOLDS, FAKE_VERSIONS, fakeN10Port } from "./fake-port";
import { n10Messages as text } from "./messages.hr";
import { loadSummary, thresholdRows, type N10Port, type ThresholdsOutcome } from "./model";
import { readOriginThresholds } from "./port";
import SummaryPage from "./SummaryPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORIGIN = "https://ductura.example.invalid";
const DOCUMENT = "izmisljeni-rad-1";
const DETAILS = { kind: "ok", details: FAKE_DETAILS } as const;
const VERSIONS = { kind: "ready", versions: FAKE_VERSIONS } as const;
const withRules = (rules: ThresholdsOutcome) => fakeN10Port(FAKE_SUMMARY, DETAILS, VERSIONS, rules);

function reader(response: Response | Error, current = true) {
  const transport = vi.fn<typeof fetch>();
  if (response instanceof Error) transport.mockRejectedValue(response);
  else transport.mockResolvedValue(response);
  return { transport, read: () => readOriginThresholds(DOCUMENT, () => current, { baseUrl: ORIGIN, fetchImpl: transport }) };
}

let root: Root | null = null;
async function show(port: N10Port) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(h(SummaryPage, { port, documentId: "d1", workHref: "/aplikacija/nastavnik/rad/d1", signInHref: "/x", map: h("div") }));
  });
  return host;
}
const rulesSection = (host: HTMLElement) =>
  [...host.querySelectorAll("section")].find((s) => s.querySelector("h2")?.textContent === text.rulesTitle) ?? null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("faculty rules: model", () => {
  it("orders the kinds by the closed list, never by state", () => {
    const rows = thresholdRows([
      { origin: "pasted_unknown", state: "exceeded" },
      { origin: "typed", state: "in_line" },
      { origin: "assistant_inserted", state: "for_review" },
    ]);
    expect(rows?.map((r) => r.origin)).toEqual(["typed", "assistant_inserted", "pasted_unknown"]);
  });

  it("refuses an answer that names a kind twice", () => {
    expect(thresholdRows([{ origin: "typed", state: "in_line" }, { origin: "typed", state: "exceeded" }])).toBeNull();
  });

  it("adds the rules to the summary only when the faculty has thresholds", async () => {
    expect(await loadSummary(withRules({ kind: "ok", rows: FAKE_THRESHOLDS }), "d1"))
      .toEqual({ kind: "ready", summary: FAKE_SUMMARY, details: FAKE_DETAILS, versions: FAKE_VERSIONS, thresholds: FAKE_THRESHOLDS });
    for (const rules of [{ kind: "ok", rows: [] }, { kind: "unavailable" }, { kind: "notFound" }, { kind: "signedOut" }] as const) {
      expect(await loadSummary(withRules(rules), "d1")).not.toHaveProperty("thresholds");
    }
    const { thresholds: _, ...withoutRules } = withRules({ kind: "ok", rows: FAKE_THRESHOLDS });
    expect(await loadSummary(withoutRules, "d1")).not.toHaveProperty("thresholds");
    const boom: N10Port = { ...withRules({ kind: "ok", rows: [] }), thresholds: async () => { throw new Error("x"); } };
    expect((await loadSummary(boom, "d1")).kind).toBe("ready");
  });
});

describe("faculty rules: read", () => {
  it("asks work.origin-thresholds.get for the work", async () => {
    const { transport, read } = reader(Response.json({ comparison: [{ origin: "pasted_unknown", state: "exceeded" }] }));
    expect(await read()).toEqual({ kind: "ok", rows: [{ origin: "pasted_unknown", state: "exceeded" }] });
    const [url, init] = transport.mock.calls[0] ?? [];
    expect(String(url)).toBe(`${ORIGIN}/api/v1/works/${DOCUMENT}/origin-thresholds`);
    expect(init?.method).toBe("GET");
  });

  it("gives no rows when the faculty has no thresholds", async () => {
    expect(await reader(Response.json({ comparison: [] })).read()).toEqual({ kind: "ok", rows: [] });
  });

  it("refuses an answer carrying a threshold, a share or an unknown state", async () => {
    for (const extra of [
      { origin: "typed", state: "in_line", thresholdPercent: 10 },
      { origin: "typed", state: "in_line", percent: 12 },
      { origin: "typed", state: "suspicious" },
    ]) expect(await reader(Response.json({ comparison: [extra] })).read()).toEqual({ kind: "unavailable" });
    expect(await reader(Response.json({ comparison: [], rank: 1 })).read()).toEqual({ kind: "unavailable" });
  });

  it("maps 401, 404, 503 and a network failure, and sends nothing after sign-out", async () => {
    const json = (status: number, code: string) => Response.json({ code }, { status });
    expect(await reader(json(401, "unauthorized")).read()).toEqual({ kind: "signedOut" });
    expect(await reader(json(404, "not_found")).read()).toEqual({ kind: "notFound" });
    expect(await reader(json(503, "unavailable")).read()).toEqual({ kind: "unavailable" });
    expect(await reader(new Error("offline")).read()).toEqual({ kind: "unavailable" });
    const signedOut = reader(Response.json({ comparison: [] }), false);
    expect(await signedOut.read()).toEqual({ kind: "signedOut" });
    expect(signedOut.transport).not.toHaveBeenCalled();
  });
});

describe("faculty rules: view", () => {
  it("shows each kind with its label for all three states and the notice", async () => {
    const section = rulesSection(await show(withRules({ kind: "ok", rows: FAKE_THRESHOLDS })));
    expect(section).not.toBeNull();
    expect(section!.textContent).toContain(text.rulesNotice);
    const items = [...section!.querySelectorAll("[data-origin]")].map((li) => [li.getAttribute("data-origin"), li.textContent]);
    expect(items).toEqual([
      ["assistant_inserted", "Umetnuto iz pomoćnikau skladu"],
      ["pasted_known", "Zalijepljeno, podrijetlo poznatoza pregled"],
      ["pasted_unknown", "Zalijepljeno, podrijetlo nepoznatoprekoračeno"],
    ]);
    expect(section!.textContent).not.toMatch(/\d|%/);
  });

  it("shows nothing about faculty rules without thresholds or when they cannot be read", async () => {
    for (const rules of [{ kind: "ok", rows: [] }, { kind: "unavailable" }] as const) {
      const host = await show(withRules(rules));
      expect(host.textContent).toContain(text.stateTitle);
      expect(rulesSection(host)).toBeNull();
      expect(host.textContent).not.toContain(text.rulesNotice);
      act(() => root?.unmount());
      root = null;
      document.body.innerHTML = "";
    }
  });
});
