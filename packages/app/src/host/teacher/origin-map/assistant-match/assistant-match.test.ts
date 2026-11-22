import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { FAKE_COMPOSITION } from "../fake-port";
import AssistantMatchNotice from "../../../editor/assistant-match-notice/AssistantMatchNotice";
import { noticeText } from "../../../editor/assistant-match-notice/messages.hr";
import AssistantMatchSection from "./AssistantMatchSection";
import { explainAssistantMatch, readAssistantMatch } from "./contract";
import { DOCUMENT, FAKE_MATCH, fakeMatchServer } from "./fake-port";
import { matchText } from "./messages.hr";
import { gateProvenance, matchRows, withoutAssistantMatch } from "./model";

describe("WEB-1230 assistant match", () => {
  it("reads the matches with one request, the same for student and teacher", async () => {
    const { call, calls } = fakeMatchServer();
    const read = await readAssistantMatch(call, DOCUMENT);
    expect(read).toEqual({ kind: "ready", state: { enabled: true, matches: [FAKE_MATCH] } });
    expect(calls).toEqual([{ id: "work.assistant-match.get", params: { documentId: DOCUMENT }, body: undefined }]);
  });

  it("flag off: reads as off and shows nothing", async () => {
    const { call } = fakeMatchServer({ enabled: false });
    const read = await readAssistantMatch(call, DOCUMENT);
    expect(read).toEqual({ kind: "off" });
    expect(renderToStaticMarkup(createElement(AssistantMatchSection, { read, composition: FAKE_COMPOSITION, onRetry: () => {} }))).toBe("");
    const stripped = withoutAssistantMatch({ ...FAKE_COMPOSITION, segments: [{ id: "s3", text: "x", kind: "assistant_match", at: "2026-11-18T09:30:00.000Z" }] });
    expect(stripped.shares.some((s) => s.kind === "assistant_match")).toBe(false);
    expect(stripped.segments).toEqual([]);
  });

  it("refuses matches while the flag is off, fewer than 8 words, extra keys and verdict fields", async () => {
    const bad = (body: unknown) => readAssistantMatch(fakeMatchServer({ body }).call, DOCUMENT);
    expect((await bad({ enabled: false, matches: [FAKE_MATCH] })).kind).toBe("unavailable");
    expect((await bad({ enabled: true, matches: [{ ...FAKE_MATCH, words: 7 }] })).kind).toBe("unavailable");
    expect((await bad({ enabled: true, matches: [{ ...FAKE_MATCH, copied: true }] })).kind).toBe("unavailable");
    expect((await bad({ enabled: true, matches: [FAKE_MATCH, FAKE_MATCH] })).kind).toBe("unavailable");
    expect((await readAssistantMatch(fakeMatchServer({ status: 401 }).call, DOCUMENT)).kind).toBe("signedOut");
    expect((await readAssistantMatch(fakeMatchServer({ throws: true }).call, DOCUMENT)).kind).toBe("unavailable");
  });

  it("sends the student's explanation and gets the match back with it", async () => {
    const { call, calls } = fakeMatchServer();
    const result = await explainAssistantMatch(call, DOCUMENT, "s3", "  Pitao/la sam pomoćnika za definiciju.  ");
    expect(result.kind).toBe("saved");
    expect(calls[0]).toMatchObject({ id: "work.assistant-match.explain", params: { documentId: DOCUMENT, segmentId: "s3" }, body: { text: "Pitao/la sam pomoćnika za definiciju." } });
    expect((await explainAssistantMatch(call, DOCUMENT, "s3", "   ")).kind).toBe("rejected");
    expect((await explainAssistantMatch(fakeMatchServer({ status: 500 }).call, DOCUMENT, "s3", "x")).kind).toBe("failed");
  });

  it("lists matches in the server order with the segment text and the explanation", () => {
    const rows = matchRows([{ ...FAKE_MATCH, explanation: { text: "Objašnjenje.", at: "2026-11-18T10:00:00.000Z" } }], () => "Izmišljeni odsječak.");
    expect(rows[0]).toMatchObject({ text: "Izmišljeni odsječak.", words: "11 riječi", explanation: "Objašnjenje." });
  });

  it("strips the match marker of the declaration provenance when the flag is off", () => {
    const share = { unit: "code_point", totalCodePoints: 1, categories: [], notice: "not_authorship_evidence" } as const;
    const aiMatch = { normalization: "n", minMatchCodePoints: 1, spans: [], notice: "not_authorship_evidence" } as const;
    const read = { kind: "ready", share, aiMatch, blocks: [] } as const;
    expect("aiMatch" in gateProvenance(read, false)).toBe(false);
    expect(gateProvenance(read, true)).toBe(read);
  });

  it("renders the notice and the section with neutral copy that passes the forbidden-terms scan", async () => {
    const section = renderToStaticMarkup(createElement(AssistantMatchSection, {
      read: { kind: "ready", state: { enabled: true, matches: [FAKE_MATCH] } }, composition: FAKE_COMPOSITION, onRetry: () => {},
    }));
    expect(section).toContain(matchText.neutral);
    expect(section).toContain("data-assistant-match");
    const texts = [...Object.values(matchText), ...Object.values(noticeText)].filter((v): v is string => typeof v === "string");
    for (const text of texts) {
      expect(findForbiddenTerms(text)).toEqual([]);
      expect(text.toLowerCase()).not.toMatch(/prepis|plagij|varan|sumnj/);
    }
    // The notice renders nothing before the read arrives (static render) and never claims a verdict.
    expect(renderToStaticMarkup(createElement(AssistantMatchNotice, { call: fakeMatchServer().call, documentId: DOCUMENT }))).toBe("");
  });
});
