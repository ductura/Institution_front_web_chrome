import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import AssistantMatchNotice from "./AssistantMatchNotice";
import { explainAssistantMatch, readAssistantMatch } from "./contract";
import { DOCUMENT, FAKE_MATCH, fakeMatchServer } from "./fake-port";
import { noticeText } from "./messages.hr";

// Moved from teacher/origin-map/assistant-match (PIL-P1-PODUDARANJE-KARTA) with the contract of the notice.
describe("WEB-1230 assistant match notice", () => {
  it("reads the matches with one request, the same for student and teacher", async () => {
    const { call, calls } = fakeMatchServer();
    const read = await readAssistantMatch(call, DOCUMENT);
    expect(read).toEqual({ kind: "ready", state: { enabled: true, matches: [FAKE_MATCH] } });
    expect(calls).toEqual([{ id: "work.assistant-match.get", params: { documentId: DOCUMENT }, body: undefined }]);
  });

  it("flag off: reads as off", async () => {
    expect(await readAssistantMatch(fakeMatchServer({ enabled: false }).call, DOCUMENT)).toEqual({ kind: "off" });
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

  it("sends the student's explanation with the answer it explains and keeps it on the match (ED-13)", async () => {
    const { call, calls } = fakeMatchServer();
    const result = await explainAssistantMatch(call, DOCUMENT, FAKE_MATCH, "  Pitao/la sam pomoćnika za definiciju.  ");
    expect(result).toEqual({ kind: "saved", match: { ...FAKE_MATCH, explanation: { text: "Pitao/la sam pomoćnika za definiciju.", at: "2026-11-18T10:00:00.000Z" } } });
    expect(calls[0]).toEqual({ id: "work.assistant-match.explain", params: { documentId: DOCUMENT, segmentId: "s3" }, body: { text: "Pitao/la sam pomoćnika za definiciju.", messageId: FAKE_MATCH.messageId } });
    expect((await explainAssistantMatch(call, DOCUMENT, FAKE_MATCH, "   ")).kind).toBe("rejected");
    expect((await explainAssistantMatch(call, DOCUMENT, FAKE_MATCH, "x".repeat(2001))).kind).toBe("rejected");
  });

  it("maps every refusal of the explanation and never sends without the answer it explains", async () => {
    const kind = async (opts: Parameters<typeof fakeMatchServer>[0]) => (await explainAssistantMatch(fakeMatchServer(opts).call, DOCUMENT, FAKE_MATCH, "x")).kind;
    expect(await kind({ status: 401 })).toBe("signedOut");
    expect(await kind({ status: 409 })).toBe("conflict");
    expect(await kind({ status: 422 })).toBe("rejected");
    expect(await kind({ status: 400 })).toBe("rejected");
    expect(await kind({ status: 503 })).toBe("failed");
    expect(await kind({ throws: true })).toBe("failed");
    expect(await kind({ body: { text: "x", at: "2026-11-18T10:00:00.000Z", verdict: "copied" } })).toBe("failed");
    const { call, calls } = fakeMatchServer();
    const { messageId: _drop, ...withoutMessage } = FAKE_MATCH;
    expect((await explainAssistantMatch(call, DOCUMENT, withoutMessage, "x")).kind).toBe("failed");
    expect(calls).toEqual([]);
  });

  it("renders nothing before the read arrives and holds neutral copy", () => {
    expect(renderToStaticMarkup(createElement(AssistantMatchNotice, { call: fakeMatchServer().call, documentId: DOCUMENT }))).toBe("");
    const texts = Object.values(noticeText as Record<string, unknown>).filter((v): v is string => typeof v === "string");
    for (const text of texts) {
      expect(findForbiddenTerms(text)).toEqual([]);
      expect(text.toLowerCase()).not.toMatch(/prepis|plagij|varan|sumnj/);
    }
  });
});
