import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesEn } from "@/lib/i18n/messages.en";
import { messagesHr } from "@/lib/i18n/messages.hr";
import { parseStatusNotices, STATUS_NOTICES } from "@/lib/status/public-notices";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms";

import NoticesView from "./NoticesView";

const t = messagesHr.statusPage;
const now = Date.parse("2026-11-21T10:00:00Z");
const render = (notices = STATUS_NOTICES) => renderToStaticMarkup(h(NoticesView, { notices, now }));

describe("NoticesView (WEB-1905)", () => {
  it("lists upcoming maintenance and past outages with part names", () => {
    const html = render();
    expect(html).toContain(t.maintenanceTitle);
    expect(html).toContain(t.outagesTitle);
    expect(html).toContain(t.components.submission);
    expect(html).toContain(t.outageKinds.prekid);
  });

  it("says so when there is nothing to list, and drops maintenance already over", () => {
    const over = { maintenance: [{ id: "x", startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-01T01:00:00Z", parts: ["writing"] as const }], outages: [] };
    const html = render(over);
    expect(html).toContain(t.maintenanceNone);
    expect(html).toContain(t.outagesNone);
  });

  it("carries no person, address or link", () => {
    const html = render();
    expect(html).not.toMatch(/@|https?:|href=/);
    expect(findForbiddenTerms(html.replace(/<[^>]*>/g, " "))).toEqual([]);
    for (const c of [messagesHr.statusPage, messagesEn.statusPage]) expect(findForbiddenTerms(JSON.stringify(c))).toEqual([]);
  });

  it("accepts the shipped list and rejects open shapes", () => {
    expect(parseStatusNotices(STATUS_NOTICES)).toEqual(STATUS_NOTICES);
    expect(parseStatusNotices({ maintenance: [], outages: [{ id: "a", startedAt: "2026-01-02T00:00:00Z", endedAt: "2026-01-01T00:00:00Z", parts: ["writing"], kind: "prekid" }] })).toBeNull();
    expect(parseStatusNotices({ maintenance: [], outages: [] , extra: 1 })).not.toBeNull();
    expect(parseStatusNotices({ maintenance: [{ id: "a", startsAt: "x", endsAt: "y", parts: ["writing"] }], outages: [] })).toBeNull();
    expect(parseStatusNotices(null)).toBeNull();
  });
});
