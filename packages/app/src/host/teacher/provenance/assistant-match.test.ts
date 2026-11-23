import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { AssistantMatchView } from "./AssistantMatchSection";
import { ProvenanceMapView } from "./ProvenanceMap";
import { assistantMatchReader } from "./contract";
import { DOCUMENT, FAKE_FINDING, fakeParts } from "./fake-match";
import { matchText } from "./match-messages.hr";
import { matchOf, matchRows, shareLabel, type MatchRead } from "./match-model";
import { DEFAULT_SWITCHES } from "./model";

// Invented work and conversation; no real person or text.
const ORIGIN = "https://ductura.example.invalid";
const LABEL = "Podudara se s odgovorom pomoćnika";

/** A transport that answers the two reads of the section by their path. */
function reader(answers: { match?: Response | Error; parts?: Response | Error }) {
  const transport = vi.fn<typeof fetch>(async (url) => {
    const answer = String(url).endsWith("/assistant-match") ? answers.match : answers.parts;
    if (answer === undefined || answer instanceof Error) throw answer ?? new Error("offline");
    return answer.clone();
  });
  return { transport, read: assistantMatchReader({ baseUrl: ORIGIN, fetchImpl: transport }) };
}

const view = (read: MatchRead | null) => renderToStaticMarkup(createElement(AssistantMatchView, { read, onRetry: () => {} }));

describe("PIL-P1-PODUDARANJE-KARTA: read", () => {
  it("reads work.assistant-match.get and the share of work.origin-composition.get for the same work", async () => {
    const { transport, read } = reader({ match: Response.json({ findings: [FAKE_FINDING] }), parts: Response.json({ parts: fakeParts(4) }) });
    expect(await read(DOCUMENT)).toEqual({ kind: "ready", percent: 4, findings: [FAKE_FINDING] });
    const urls = transport.mock.calls.map(([url]) => String(url)).sort();
    expect(urls).toEqual([`${ORIGIN}/api/v1/works/${DOCUMENT}/assistant-match`, `${ORIGIN}/api/v1/works/${DOCUMENT}/origin-composition`]);
    for (const [, init] of transport.mock.calls) expect(init?.method).toBe("GET");
  });

  it("flag off: no finding and no share read as none", async () => {
    const { read } = reader({ match: Response.json({ findings: [] }), parts: Response.json({ parts: fakeParts(0) }) });
    expect(await read(DOCUMENT)).toEqual({ kind: "none" });
  });

  it("maps 401, 404, 503, an answer outside the contract and a network failure", async () => {
    const parts = () => Response.json({ parts: fakeParts(4) });
    const json = (status: number, code: string) => Response.json({ code }, { status });
    expect(await reader({ match: json(401, "unauthorized"), parts: parts() }).read(DOCUMENT)).toEqual({ kind: "signedOut" });
    expect(await reader({ match: json(404, "not_found"), parts: parts() }).read(DOCUMENT)).toEqual({ kind: "notFound" });
    expect(await reader({ match: json(403, "forbidden"), parts: parts() }).read(DOCUMENT)).toEqual({ kind: "notFound" });
    expect(await reader({ match: Response.json({ findings: [] }), parts: json(503, "unavailable") }).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    expect(await reader({ match: Response.json({ findings: [{ ...FAKE_FINDING, runWords: 7 }] }), parts: parts() }).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    expect(await reader({ match: Response.json({ findings: [{ ...FAKE_FINDING, copied: true }] }), parts: parts() }).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    expect(await reader({ match: new Error("offline"), parts: parts() }).read(DOCUMENT)).toEqual({ kind: "unavailable" });
    expect(await reader({}).read("")).toEqual({ kind: "notFound" });
  });
});

describe("PIL-P1-PODUDARANJE-KARTA: model", () => {
  it("keeps the server's share and order, and names a share below one percent", () => {
    expect(matchOf([], fakeParts(0))).toEqual({ kind: "none" });
    expect(matchOf([], fakeParts(2))).toEqual({ kind: "ready", percent: 2, findings: [] });
    expect(shareLabel(4)).toBe(`${LABEL} · 4 %`);
    expect(shareLabel(0.4)).toBe(`${LABEL} · manje od 1 %`);
    const second = { ...FAKE_FINDING, messageId: "00000000-0000-4000-8000-00000000a002", runWords: 21 };
    expect(matchRows([FAKE_FINDING, second]).map((row) => row.words)).toEqual(["11 riječi", "21 riječ"]);
    const keys = matchRows([FAKE_FINDING, FAKE_FINDING]).map((row) => row.key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe("PIL-P1-PODUDARANJE-KARTA: view", () => {
  it("shows the share, the attached conversation and the neutral notice", () => {
    const out = view({ kind: "ready", percent: 4, findings: [FAKE_FINDING] });
    for (const text of [`${LABEL} · 4 %`, matchText.heading, matchText.intro, matchText.neutral, matchText.colAttached, "11 riječi"]) {
      expect(out).toContain(text);
    }
    expect(out).toContain('data-assistant-match="ready"');
  });

  it("does not exist while there is nothing: flag off, loading, not found, signed out", () => {
    for (const read of [null, { kind: "none" }, { kind: "notFound" }, { kind: "signedOut" }] as const) expect(view(read)).toBe("");
  });

  it("offers a retry when the server is unavailable", () => {
    const out = view({ kind: "unavailable" });
    expect(out).toContain(matchText.unavailable);
    expect(out).toContain(matchText.retry);
  });

  it("is a section of Karta podrijetla, drawn only once the map has read the work", () => {
    const map = (state: Parameters<typeof ProvenanceMapView>[0]["state"], read: MatchRead) => renderToStaticMarkup(createElement(ProvenanceMapView,
      { state, switches: DEFAULT_SWITCHES, onSwitches: () => {}, onRetry: () => {} }, createElement(AssistantMatchView, { read, onRetry: () => {} })));
    const ready = { kind: "ready", percent: 4, findings: [FAKE_FINDING] } as const;
    expect(map({ kind: "marked" }, ready)).toContain(`${LABEL} · 4 %`);
    expect(map({ kind: "noMarks" }, ready)).toContain(`${LABEL} · 4 %`);
    expect(map({ kind: "loading" }, ready)).not.toContain("data-assistant-match");
    const off = map({ kind: "marked" }, { kind: "none" });
    expect(off).not.toContain("data-assistant-match");
    expect(off).not.toContain(LABEL);
    expect(off).not.toMatch(/%/);
  });

  it("holds no forbidden term and no verdict", () => {
    const texts = Object.values(matchText as Record<string, unknown>).filter((v): v is string => typeof v === "string");
    for (const text of [...texts, matchText.words(11)]) {
      expect(findForbiddenTerms(text, "hr")).toEqual([]);
      expect(text.toLowerCase()).not.toMatch(/prepis|plagij|varan|sumnj/);
    }
    // The student and the teacher read the same intro: it names nobody in the third person.
    expect(matchText.intro.toLowerCase()).not.toMatch(/student|nastavni/);
  });
});
