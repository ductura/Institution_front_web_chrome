import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RevisionRequest } from "@/client/revision-requests";

import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms";
import RevisionLog from "./RevisionLog";
import { sendRevisionHr } from "./messages.hr";
import { revisionLog } from "./revision-log";
import { buildSend, sendRevision } from "./send-revision";

const anchor = { nodeId: "n", startHint: 0, endHint: 1, quote: "a", prefix: "", suffix: "" };
const request = {
  id: "z1", number: 1, state: "accepted", rowSeq: 3, anchor: anchor as never,
  versions: [
    { version: 1, instruction: "Dopunite.", requestedRevision: 4, openedIsOwn: false, openedWindow: "2026-11-20T10:00:00.000Z",
      response: { kind: "done", explanation: "Dodano.", revision: 6, isOwn: true, window: "2026-11-21T09:00:00.000Z" },
      closed: { as: "reopened", isOwn: false, window: "2026-11-22T08:00:00.000Z", acceptedRevision: null } },
    { version: 2, instruction: "Još jednom.", requestedRevision: 6, openedIsOwn: false, openedWindow: "2026-11-22T08:00:00.000Z",
      response: { kind: "done", explanation: "Gotovo.", revision: 8, isOwn: true, window: "2026-11-23T09:00:00.000Z" },
      closed: { as: "accepted", isOwn: false, window: "2026-11-24T09:00:00.000Z", acceptedRevision: 8 } },
  ],
} as unknown as RevisionRequest;

describe("revisionLog", () => {
  it("lists rounds oldest first with who did what", () => {
    const log = revisionLog([request]);
    expect(log.map((e) => `${e.by}:${e.kind}:${e.round}`)).toEqual([
      "teacher:opened:1", "student:responded:1", "teacher:reopened:2", "student:responded:2", "teacher:accepted:2",
    ]);
  });
  it("is empty without requests and renders the empty text", () => {
    expect(revisionLog([])).toEqual([]);
    expect(renderToStaticMarkup(createElement(RevisionLog, { entries: [] }))).toContain(sendRevisionHr.log.empty);
  });
  it("renders text as text, never as HTML", () => {
    const html = renderToStaticMarkup(createElement(RevisionLog, { entries: revisionLog([request]) }));
    expect(html).toContain("Dnevnik dorade");
  });
});

describe("send", () => {
  it("refuses a too long message and trims a normal one", () => {
    expect(buildSend("d", "a".repeat(2001))).toEqual({ ok: false, error: "tooLong" });
    expect(buildSend("d", "  Dodano.  ")).toEqual({ ok: true, body: { documentId: "d", message: "Dodano." } });
  });
  it("maps statuses and sends nothing after the session ended", async () => {
    const body = { documentId: "d", message: "" };
    expect(await sendRevision(body, async () => 200)).toBe("ok");
    expect(await sendRevision(body, async () => 409)).toBe("conflict");
    expect(await sendRevision(body, async () => null)).toBe("unavailable");
    expect(await sendRevision(body, async () => 200, () => false)).toBe("signedOut");
  });
  it("has no forbidden terms", () => {
    expect(findForbiddenTerms(JSON.stringify(sendRevisionHr))).toEqual([]);
  });
});
